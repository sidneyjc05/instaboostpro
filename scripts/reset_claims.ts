import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/sqlite.db' 
  : path.join(process.cwd(), 'sqlite.db');

const db = new Database(dbPath);

console.log('Resetting claims...');
const res = db.prepare('DELETE FROM free_tickets_claims').run();
console.log('Deleted claims:', res.changes);

