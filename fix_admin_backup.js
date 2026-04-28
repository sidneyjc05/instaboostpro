import fs from 'fs';

const file = 'server/admin.ts';
let text = fs.readFileSync(file, 'utf8');

text = text.replace(/adminRouter\.post\('\/backup',.*?\}\);/s, `adminRouter.post('/backup', (req: any, res) => {
    const { users, payments, settings, logs } = req.body;
    
    if (!users || !Array.isArray(users)) return res.status(400).json({ error: 'Formato de backup inválido.' });

    // Protect against self-deletion: Ensure the admin doing the import is inside the backup
    const adminExists = users.some(u => u.id === req.userId && u.role === 'admin');
    if (!adminExists) return res.status(403).json({ error: 'O backup não contém sua conta Admin. Importação abortada por segurança.' });

    try {
        const importTx = db.transaction(() => {
            const processTable = (tableName: string, data: any[]) => {
                if (!data || !Array.isArray(data) || data.length === 0) return;
                
                db.prepare(\`DELETE FROM \${tableName}\`).run();
                
                // Get columns from first element
                const cols = Object.keys(data[0]);
                const placeholders = cols.map(() => '?').join(', ');
                const insertStmt = db.prepare(\`INSERT INTO \${tableName} (\${cols.join(', ')}) VALUES (\${placeholders})\`);
                
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
});`);

fs.writeFileSync(file, text);
console.log('Fixed backup import');
