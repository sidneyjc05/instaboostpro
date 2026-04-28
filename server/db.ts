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

// Safe Migration for new columns
const userCols = db.prepare('PRAGMA table_info(users)').all() as any[];
const hasLastActiveAt = userCols.some(c => c.name === 'last_active_at');
const hasEmail = userCols.some(c => c.name === 'email');
const hasRole = userCols.some(c => c.name === 'role');
const hasIsVerified = userCols.some(c => c.name === 'is_verified');
const hasIsBlocked = userCols.some(c => c.name === 'is_blocked');
const hasTickets = userCols.some(c => c.name === 'tickets');
const hasSessionVersion = userCols.some(c => c.name === 'session_version');
const hasDeviceChangeCount = userCols.some(c => c.name === 'device_change_count');
const hasActiveDeviceHash = userCols.some(c => c.name === 'active_device_hash');
const hasReferralCode = userCols.some(c => c.name === 'referral_code');
const hasReferredBy = userCols.some(c => c.name === 'referred_by');

const paymentCols = db.prepare('PRAGMA table_info(payments)').all() as any[];
const hasPaymentTickets = paymentCols.some(c => c.name === 'tickets');
const hasPaymentItemType = paymentCols.some(c => c.name === 'item_type');
const hasPaymentPlanId = paymentCols.some(c => c.name === 'plan_id');

if (!hasLastActiveAt) db.exec('ALTER TABLE users ADD COLUMN last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP;');
if (!hasEmail) db.exec('ALTER TABLE users ADD COLUMN email TEXT;');
if (!hasRole) db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';`);
if (!hasIsVerified) db.exec('ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0;');
if (!hasIsBlocked) db.exec('ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0;');
const hasIsBanned = userCols.some(c => c.name === 'is_banned');
const hasSuspensionEnd = userCols.some(c => c.name === 'suspension_end');
if (!hasIsBanned) db.exec('ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0;');
if (!hasSuspensionEnd) db.exec('ALTER TABLE users ADD COLUMN suspension_end DATETIME;');
if (!hasTickets) db.exec('ALTER TABLE users ADD COLUMN tickets INTEGER DEFAULT 0;');
if (!hasSessionVersion) db.exec('ALTER TABLE users ADD COLUMN session_version INTEGER DEFAULT 1;');
if (!hasDeviceChangeCount) db.exec('ALTER TABLE users ADD COLUMN device_change_count INTEGER DEFAULT 0;');
if (!hasActiveDeviceHash) db.exec('ALTER TABLE users ADD COLUMN active_device_hash TEXT;');
if (!hasReferredBy) db.exec('ALTER TABLE users ADD COLUMN referred_by INTEGER;');

const hasPlanType = userCols.some(c => c.name === 'plan_type');
const hasPlanExpiresAt = userCols.some(c => c.name === 'plan_expires_at');
if (!hasPlanType) db.exec(`ALTER TABLE users ADD COLUMN plan_type TEXT DEFAULT 'basic';`);
if (!hasPlanExpiresAt) db.exec('ALTER TABLE users ADD COLUMN plan_expires_at DATETIME;');

if (!hasReferralCode) {
   db.exec('ALTER TABLE users ADD COLUMN referral_code TEXT;');
   db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);');
   // Assign unique referral codes to existing users
   const users = db.prepare('SELECT id, username FROM users WHERE referral_code IS NULL').all() as any[];
   const updateRefCode = db.prepare('UPDATE users SET referral_code = ? WHERE id = ?');
   db.transaction(() => {
      for (const u of users) {
          const code = u.username.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8) + u.id + Math.floor(100+Math.random()*900);
          updateRefCode.run(code, u.id);
      }
   })();
}

if (!hasPaymentTickets) db.exec('ALTER TABLE payments ADD COLUMN tickets INTEGER DEFAULT 0;');
if (!hasPaymentItemType) db.exec(`ALTER TABLE payments ADD COLUMN item_type TEXT DEFAULT 'credits';`);
if (!hasPaymentPlanId) db.exec('ALTER TABLE payments ADD COLUMN plan_id TEXT;');

db.exec(`
  CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ip TEXT,
    device TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS commissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL,
    referred_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    action_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(referrer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(referred_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS trusted_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  
  CREATE TABLE IF NOT EXISTS free_tickets_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_hash TEXT NOT NULL,
    claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    target_user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS support_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    message TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME,
    FOREIGN KEY(request_id) REFERENCES support_requests(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Fast Garbage Collector for Payments: every 1 minute
setInterval(() => {
  try {
    // Delete payments that have been stuck in pending for > 17 minutes
    db.prepare(`
      DELETE FROM payments 
      WHERE status = 'pending' AND datetime(created_at, '+17 minutes') < datetime('now')
    `).run();

    // Limpar e-mails não verificados em 7 dias (exigirá que o usuário cadastre outro e-mail na proxima sessao)
    db.prepare(`
      UPDATE users SET email = NULL WHERE is_verified = 0 AND email IS NOT NULL AND datetime(created_at, '+7 days') < datetime('now')
    `).run();
  } catch(e) {}
}, 60 * 1000); // 1 min

// Deep Garbage Collector: cleans up the database every hour
setInterval(() => {
  try {
    console.log('[Garbage Collector] Running DB cleanup...');

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

    // Reset weekly device change count if it's Monday
    const today = new Date();
    if (today.getDay() === 1) { // 1 = Monday
       db.exec(`UPDATE users SET device_change_count = 0`);
    }

    if (resPromos.changes > 0 || resUsers.changes > 0) {
      console.log(`[Garbage Collector] Cleaned up: ${resPromos.changes} old promos, ${resUsers.changes} inactive users.`);
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

export function createNotification(userId: number, title: string, message: string, type: string) {
    try {
        db.prepare(`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (?, ?, ?, ?)
        `).run(userId, title, message, type);
    } catch (e) {
        console.error('Error creating notification:', e);
    }
}

