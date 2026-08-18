import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { getAuth } from 'firebase-admin/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decodedToken = await getAuth().verifyIdToken(token);
      (req as any).userId = decodedToken.uid;
      (req as any).userEmail = decodedToken.email || '';
      (req as any).userName = decodedToken.name || (decodedToken.email ? decodedToken.email.split('@')[0] : 'usuario');
      (req as any).userRole = 'user'; // Assume standard user for Firebase right now
      return next();
    } catch (e) {
      console.warn("Firebase token verification failed:", e);
      return res.status(401).json({ error: 'Unauthorized, invalid Firebase token' });
    }
  }

  const token = req.cookies?.token;

  if (!token) {
    return res.status(400).json({ error: 'Unauthorized, missing token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number, role: string, session_version?: number };
    
    // Check if session version is still valid
    const user = db.prepare('SELECT session_version FROM users WHERE id = ?').get(payload.id) as any;
    if (!user) {
        return res.status(400).json({ error: 'User deleted' });
    }
    
    if (payload.session_version && payload.session_version !== user.session_version) {
       return res.status(400).json({ error: 'Outra pessoa acessou sua conta (Sessão expirada)' });
    }

    if (payload.role !== 'admin' && payload.role !== 'owner') {
       const allowedPaths = ['/api/me', '/api/notifications'];
       if (!allowedPaths.includes(req.originalUrl)) {
           const maintenanceMode = db.prepare('SELECT value FROM settings WHERE key = ?').get('maintenance_mode') as any;
           if (maintenanceMode && maintenanceMode.value === 'on') {
               return res.status(400).json({ error: 'Sistema em manutenção' });
           }
       }
    }

    (req as any).userId = payload.id;
    (req as any).userRole = payload.role || 'user';
    next();
  } catch (error) {
    res.status(400).json({ error: 'Unauthorized, invalid token' });
  }
};

export const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const role = (req as any).userRole;
  if (role !== 'admin' && role !== 'owner') {
     return res.status(403).json({ error: 'Forbidden, admins and owners only' });
  }
  next();
};
