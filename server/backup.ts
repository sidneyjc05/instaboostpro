import { db } from './db.js';
import fs from 'fs';
import path from 'path';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

export async function runAutomatedBackup() {
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }

        const dateStr = new Date().toISOString().split('T')[0];
        const backupFileName = `database-backup-${dateStr}-${Date.now()}.db`;
        const backupPath = path.join(BACKUP_DIR, backupFileName);

        console.log(`[Backup] Iniciando backup automático do banco de dados para: ${backupPath}`);
        
        // better-sqlite3 native backup feature (Thread-safe, doesn't block main loop)
        await db.backup(backupPath);
        
        console.log(`[Backup] Concluído com sucesso: ${backupFileName}`);

        // Rotação de Backups: Manter apenas os 7 arquivos mais recentes
        cleanupOldBackups();
    } catch (error) {
        console.error('[Backup] Falha ao realizar backup automático:', error);
    }
}

function cleanupOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('database-backup-') && file.endsWith('.db'))
            .map(file => ({
                name: file,
                path: path.join(BACKUP_DIR, file),
                time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Ordena decrescente (mais recentes primeiro)

        // Se houver mais que 7 backups, deleta os mais antigos
        if (files.length > 7) {
            const filesToDelete = files.slice(7);
            for (const file of filesToDelete) {
                fs.unlinkSync(file.path);
                console.log(`[Backup] Backup antigo removido: ${file.name}`);
            }
        }
    } catch (error) {
        console.error('[Backup] Erro durante a limpeza de backups antigos:', error);
    }
}

// Iniciar agendamento do backup diário (Executa a cada 24 horas)
export function initBackupRoutine() {
    console.log('[Backup] Rotina de backups automatizados iniciada (Intervalo: 24h).');
    
    // Executa a primeira vez ao iniciar (opcional, pode deixar para apenas agendar)
    // Descomente se quiser forçar um backup ao iniciar o servidor:
    // runAutomatedBackup();

    // 24 horas em milissegundos
    setInterval(runAutomatedBackup, 24 * 60 * 60 * 1000);
}
