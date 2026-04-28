import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized, missing token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number, role: string, session_version?: number };
    
    // Check if session version is still valid
    const user = db.prepare('SELECT session_version FROM users WHERE id = ?').get(payload.id) as any;
    if (!user) {
        return res.status(401).json({ error: 'User deleted' });
    }
    
    if (payload.session_version && payload.session_version !== user.session_version) {
       return res.status(401).json({ error: 'Outra pessoa acessou sua conta (Sessão expirada)' });
    }

    if (payload.role !== 'admin') {
       const allowedPaths = ['/api/me', '/api/notifications'];
       if (!allowedPaths.includes(req.originalUrl)) {
           const maintenanceMode = db.prepare('SELECT value FROM settings WHERE key = ?').get('maintenance_mode') as any;
           if (maintenanceMode && maintenanceMode.value === 'on') {
               return res.status(403).json({ error: 'Sistema em manutenção' });
           }
       }
    }

    (req as any).userId = payload.id;
    (req as any).userRole = payload.role || 'user';
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized, invalid token' });
  }
};

export const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if ((req as any).userRole !== 'admin') {
     return res.status(403).json({ error: 'Forbidden, admins only' });
  }
  next();
};
