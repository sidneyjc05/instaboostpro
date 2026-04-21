import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/sqlite.db' 
  : path.join(process.cwd(), 'sqlite.db');

// Create a database file (in /tmp for production, project root for dev)
export const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    credits REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    cost INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    promotion_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, promotion_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(promotion_id) REFERENCES promotions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    credits INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Safe Migration for last_active_at
try {
  db.exec('ALTER TABLE users ADD COLUMN last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP;');
} catch (error: any) {
  if (!error.message.includes('duplicate column name')) {
    console.error('Migration error:', error);
  }
}

// Garbage Collector: cleans up the database every hour
// 1. Deletes pending payments older than 15 minutes
// 2. Deletes interactions for promotions that no longer exist
// 3. Deletes expired promotions older than 7 days
// 4. Deletes inactive users (no activity for 90 days)
setInterval(() => {
  try {
    console.log('[Garbage Collector] Running DB cleanup...');

    const deletePendingPayments = db.prepare(`
      DELETE FROM payments 
      WHERE status = 'pending' AND datetime(created_at, '+15 minutes') < datetime('now')
    `);
    const resPayments = deletePendingPayments.run();

    const deleteOldPromos = db.prepare(`
      DELETE FROM promotions 
      WHERE expires_at < datetime('now', '-7 days')
    `);
    const resPromos = deleteOldPromos.run();
    
    // Interactions that are orphaned are cascade-deleted normally, but let's be sure:
    db.exec(`DELETE FROM interactions WHERE promotion_id NOT IN (SELECT id FROM promotions);`);

    const deleteInactiveUsers = db.prepare(`
      DELETE FROM users 
      WHERE last_active_at < datetime('now', '-90 days')
    `);
    const resUsers = deleteInactiveUsers.run();

    if (resPayments.changes > 0 || resPromos.changes > 0 || resUsers.changes > 0) {
      console.log(`[Garbage Collector] Cleaned up: ${resPayments.changes} pending payments, ${resPromos.changes} old promos, ${resUsers.changes} inactive users.`);
    }

  } catch (error) {
    console.error('[Garbage Collector] Error during cleanup:', error);
  }
}, 60 * 60 * 1000); // every 1 hour

// Run immediately on boot to clean up
setTimeout(() => {
  try {
    db.exec(`DELETE FROM payments WHERE status = 'pending' AND datetime(created_at, '+15 minutes') < datetime('now')`);
    db.exec(`DELETE FROM promotions WHERE expires_at < datetime('now', '-7 days')`);
    db.exec(`DELETE FROM users WHERE last_active_at < datetime('now', '-90 days')`);
    db.exec(`DELETE FROM interactions WHERE promotion_id NOT IN (SELECT id FROM promotions)`);
  } catch(e) {}
}, 5000);

console.log('Database initialized successfully.');
