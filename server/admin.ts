import { Router } from 'express';
import { db, createNotification } from './db.js';
import { authMiddleware, adminMiddleware } from './auth.js';
import bcrypt from 'bcryptjs';

export const adminRouter = Router();

// Middleware that all these routes need both auth and admin
adminRouter.use(authMiddleware, adminMiddleware);

// Helper for audit logs
function logAction(adminId: number, targetId: number | null, action: string, details: string) {
    db.prepare('INSERT INTO audit_logs (admin_id, target_user_id, action, details) VALUES (?, ?, ?, ?)').run(adminId, targetId, action, details);
}

adminRouter.get('/stats', (req: any, res) => {
    const stats: any = {};
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get() as any;
    stats.totalUsers = totalUsers.c;

    const totalCoins = db.prepare('SELECT SUM(credits) as s FROM users').get() as any;
    stats.totalCoins = totalCoins.s || 0;

    const activePlans = db.prepare(`SELECT COUNT(*) as c FROM users WHERE plan_type != 'basic'`).get() as any;
    stats.activePlans = activePlans.c;

    const totalPixValue = db.prepare("SELECT SUM(amount) as s FROM payments WHERE status = 'approved'").get() as any;
    stats.totalPixValue = totalPixValue.s || 0;

    const usedTickets = db.prepare('SELECT COUNT(*) as c FROM interactions').get() as any; // Using interactions as proxy or ticket claims
    stats.totalInteractions = usedTickets.c;

    res.json(stats);
});

adminRouter.get('/users/all', (req: any, res) => {
    // We fetch everything required to filter on the client
    const users = db.prepare(`
        SELECT id, username, email, role, credits, tickets, plan_type, plan_expires_at, is_blocked, is_banned, suspension_end, last_active_at, created_at, referral_code 
        FROM users 
        ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, created_at DESC
    `).all();
    res.json(users);
});

adminRouter.post('/users/:id/update', (req: any, res) => {
    const userId = req.params.id;
    const { action, value, reason } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (action === 'add_coins' || action === 'remove_coins') {
        const amt = Number(value);
        if (action === 'remove_coins' && user.credits < amt) return res.status(400).json({ error: 'Saldo insuficiente' });
        const modifier = action === 'add_coins' ? amt : -amt;
        db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(modifier, userId);
        logAction(req.userId, userId, action, `${modifier > 0 ? '+' : ''}${modifier} moedas. Motivo: ${reason || 'Não informado'}`);
    } else if (action === 'add_tickets' || action === 'remove_tickets') {
        const amt = Number(value);
        if (action === 'remove_tickets' && user.tickets < amt) return res.status(400).json({ error: 'Tickets insuficientes' });
        const modifier = action === 'add_tickets' ? amt : -amt;
        db.prepare('UPDATE users SET tickets = tickets + ? WHERE id = ?').run(modifier, userId);
        logAction(req.userId, userId, action, `${modifier > 0 ? '+' : ''}${modifier} tickets. Motivo: ${reason || 'Não informado'}`);
    } else if (action === 'set_plan') {
        const plan = value;
        if (plan === 'basic') {
            db.prepare(`UPDATE users SET plan_type = 'basic', plan_expires_at = NULL WHERE id = ?`).run(userId);
            logAction(req.userId, userId, 'cancel_plan', 'Plano cancelado/removido pelo admin');
        } else {
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            db.prepare('UPDATE users SET plan_type = ?, plan_expires_at = ? WHERE id = ?').run(plan, expiresAt, userId);
            logAction(req.userId, userId, 'activate_plan', `Plano ${plan} ativado por 30 dias.`);
        }
    } else if (action === 'change_password') {
        const hash = bcrypt.hashSync(value, 10);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, userId);
        logAction(req.userId, userId, 'change_password', 'Senha alterada manualmente pelo admin');
    } else if (action === 'change_email') {
        db.prepare('UPDATE users SET email = ?, is_verified = 1 WHERE id = ?').run(value, userId);
        logAction(req.userId, userId, 'change_email', `Novo email: ${value}`);
    } else if (action === 'change_id') {
        // Changing user ID is fundamentally complex if there are strong FKs. Since we use ON DELETE CASCADE, changing an ID requires ON UPDATE CASCADE in SQLite.
        // We might need to manually update FKs.
        return res.status(400).json({ error: 'Alteração de ID não suportada por segurança.' });
    }
    
    res.json({ success: true });
});

adminRouter.post('/users/:id/block', (req: any, res) => {
    const userId = req.params.id;
    const { blocked } = req.body;
    db.prepare(`UPDATE users SET is_blocked = ? WHERE id = ?`).run(blocked ? 1 : 0, userId);
    logAction(req.userId, userId, 'block_user', blocked ? 'Usuário bloqueado' : 'Usuário desbloqueado');
    res.json({ success: true });
});

// Settings & Maintenance Mode
adminRouter.get('/settings', (req: any, res) => {
    const settings = db.prepare('SELECT key, value FROM settings').all() as any[];
    const result = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
    res.json(result);
});

adminRouter.post('/settings', (req: any, res) => {
    const { key, value } = req.body;
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    logAction(req.userId, null, 'update_setting', `${key} atualizado`);
    res.json({ success: true });
});

// System Cleanup Tool
adminRouter.post('/system/cleanup', (req: any, res) => {
    try {
        const results: string[] = [];
        let deletedRows = 0;

        // 1. Limpar logs de login antigos (mais de 30 dias)
        const loginLogs = db.prepare("DELETE FROM login_logs WHERE datetime(created_at) < datetime('now', '-30 days')").run();
        if (loginLogs.changes > 0) {
            results.push(`✔️ Removidos ${loginLogs.changes} logs de login antigos.`);
            deletedRows += loginLogs.changes;
        }

        // 2. Limpar notificações antigas ou lidas (mais de 15 dias)
        const notifs = db.prepare("DELETE FROM notifications WHERE is_read = 1 OR datetime(created_at) < datetime('now', '-15 days')").run();
        if (notifs.changes > 0) {
            results.push(`✔️ Removidas ${notifs.changes} notificações antigas/lidas.`);
            deletedRows += notifs.changes;
        }

        // 3. Limpar pagamentos pendentes esquecidos (mais de 7 dias)
        const pendPayments = db.prepare("DELETE FROM payments WHERE status = 'pending' AND datetime(created_at) < datetime('now', '-7 days')").run();
        if (pendPayments.changes > 0) {
            results.push(`✔️ Removidos ${pendPayments.changes} pagamentos pendentes abandonados.`);
            deletedRows += pendPayments.changes;
        }

        // 4. Limpar claims diários e hashes (mais de 3 dias - já que daily limits são < 24h)
        const dailyUser = db.prepare("DELETE FROM daily_claims WHERE claim_date < date('now', '-3 days')").run();
        const dailyDevice = db.prepare("DELETE FROM device_daily_claims WHERE claim_date < date('now', '-3 days')").run();
        if (dailyUser.changes > 0 || dailyDevice.changes > 0) {
            results.push(`✔️ Limpo ${dailyUser.changes + dailyDevice.changes} registros de claims diários vencidos.`);
            deletedRows += (dailyUser.changes + dailyDevice.changes);
        }

        // 5. Garantir que não existam requests de suporte "fechados" no sistema
        const supp = db.prepare("DELETE FROM support_requests WHERE status = 'closed'").run();
        if (supp.changes > 0) {
            results.push(`✔️ Limpos ${supp.changes} tickets de suporte que estavam esquecidos.`);
            deletedRows += supp.changes;
        }

        if (deletedRows === 0) {
            results.push("✨ O sistema já está limpo e otimizado!");
        }

        logAction(req.userId, null, 'system_cleanup', `Varredura inteligente executada. ${deletedRows} lixos removidos.`);
        res.json({ success: true, results, total_deleted: deletedRows });
    } catch (e: any) {
        res.status(500).json({ error: e.message || 'Erro ao realizar a varredura' });
    }
});

// Support endpoints
adminRouter.get('/support', (req: any, res) => {
    const reqs = db.prepare(`SELECT s.*, u.username, u.email FROM support_requests s JOIN users u ON s.user_id = u.id WHERE s.status != 'closed' ORDER BY s.created_at DESC`).all();
    res.json(reqs);
});

adminRouter.post('/support/:id/accept', (req: any, res) => {
    db.prepare(`UPDATE support_requests SET status = 'active' WHERE id = ?`).run(req.params.id);
    logAction(req.userId, null, 'accept_support', `Suporte #${req.params.id} aceito`);
    res.json({ success: true });
});

adminRouter.post('/support/:id/close', (req: any, res) => {
    // Apagar permanentemente a solicitação e mensagens (via cascade)
    db.prepare('DELETE FROM support_messages WHERE request_id = ?').run(req.params.id);
    db.prepare('DELETE FROM support_requests WHERE id = ?').run(req.params.id);
    logAction(req.userId, null, 'close_support', `Suporte #${req.params.id} encerrado e excluído do sistema`);
    res.json({ success: true });
});

adminRouter.get('/support/:id/chat', (req: any, res) => {
    const msgs = db.prepare('SELECT * FROM support_messages WHERE request_id = ? ORDER BY created_at ASC').all(req.params.id);
    res.json(msgs);
});

adminRouter.post('/support/:id/chat', (req: any, res) => {
    const { message, image_url } = req.body;
    db.prepare('INSERT INTO support_messages (request_id, sender_id, message, image_url) VALUES (?, ?, ?, ?)').run(req.params.id, req.userId, message, image_url);
    
    // Notify user
    const reqInfo = db.prepare('SELECT user_id FROM support_requests WHERE id = ?').get(req.params.id) as any;
    if (reqInfo) {
        createNotification(reqInfo.user_id, 'Mensagem do Suporte', 'O administrador respondeu sua solicitação de suporte. Clique para ver a mensagem.', 'support');
    }

    res.json({ success: true });
});

// Audit Logs
adminRouter.get('/audit-logs', (req: any, res) => {
    const logs = db.prepare('SELECT a.*, u.username as admin_name, t.username as target_name FROM audit_logs a LEFT JOIN users u ON a.admin_id = u.id LEFT JOIN users t ON a.target_user_id = t.id ORDER BY a.created_at DESC LIMIT 500').all();
    res.json(logs);
});

// Backup handling
adminRouter.get('/backup', (req: any, res) => {
    const users = db.prepare('SELECT * FROM users').all();
    const payments = db.prepare('SELECT * FROM payments').all();
    const settings = db.prepare('SELECT * FROM settings').all();
    const logs = db.prepare('SELECT * FROM audit_logs').all();
    
    // Simplistic full backup object
    const backup = {
        timestamp: new Date().toISOString(),
        users,
        payments,
        settings,
        logs
    };
    logAction(req.userId, null, 'export_backup', 'Exportou banco de dados');
    res.json(backup);
});

adminRouter.post('/backup', (req: any, res) => {
    const { users, payments, settings, logs } = req.body;
    
    if (!users || !Array.isArray(users)) return res.status(400).json({ error: 'Formato de backup inválido.' });

    // Protect against self-deletion: Ensure the admin doing the import is inside the backup
    const adminExists = users.some(u => u.id === req.userId && u.role === 'admin');
    if (!adminExists) return res.status(403).json({ error: 'O backup não contém sua conta Admin. Importação abortada por segurança.' });

    try {
        const importTx = db.transaction(() => {
            const processTable = (tableName: string, data: any[]) => {
                if (!data || !Array.isArray(data) || data.length === 0) return;
                
                db.prepare(`DELETE FROM ${tableName}`).run();
                
                // Get columns from first element
                const cols = Object.keys(data[0]);
                const placeholders = cols.map(() => '?').join(', ');
                const insertStmt = db.prepare(`INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`);
                
                for (const row of data) {
                    insertStmt.run(...cols.map(c => row[c]));
                }
            };

            processTable('users', users);
            if (payments) processTable('payments', payments);
            if (settings) processTable('settings', settings);
            if (logs) processTable('audit_logs', logs);
        });

        importTx();
        logAction(req.userId, null, 'import_backup', 'Restaurou banco de dados via backup completo');
        res.json({ success: true });
    } catch(e: any) {
        console.error('Import Error:', e);
        res.status(500).json({ error: 'Falha crítica ao importar backup: ' + e.message });
    }
});
