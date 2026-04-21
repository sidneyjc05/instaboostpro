import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized, missing token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number, role: string };
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
