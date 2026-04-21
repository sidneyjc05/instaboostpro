import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { authMiddleware } from './auth.js';
import crypto from 'crypto';
import qrcode from 'qrcode';
import { MercadoPagoConfig, Payment } from 'mercadopago';

export const apiRouter = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Initialize MP (fallback to empty token to avoid crash, but will fail requests if not set in .env)
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '' });
const mpPayment = new Payment(mpClient);

// --- AUTH --- //
apiRouter.post('/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash);
    
    const token = jwt.sign({ id: result.lastInsertRowid }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none' 
    }).json({ success: true });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ error: 'Username already taken' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

apiRouter.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { 
    httpOnly: true, 
    secure: true, 
    sameSite: 'none' 
  }).json({ success: true });
});

apiRouter.post('/auth/logout', (req, res) => {
  res.clearCookie('token', { sameSite: 'none', secure: true }).json({ success: true });
});

apiRouter.get('/me', authMiddleware, (req: any, res) => {
  const user = db.prepare('SELECT id, username, credits, created_at FROM users WHERE id = ?').get(req.userId);
  res.json(user);
});

// --- PROMOTIONS --- //
apiRouter.get('/promotions', authMiddleware, (req: any, res) => {
  // Get active promotions not yet interacted with
  const promotions = db.prepare(`
    SELECT p.id, p.url, p.user_id, u.username, p.expires_at 
    FROM promotions p
    JOIN users u ON p.user_id = u.id
    WHERE datetime(p.expires_at) > CURRENT_TIMESTAMP
      AND p.id NOT IN (SELECT promotion_id FROM interactions WHERE user_id = ?)
    ORDER BY p.created_at DESC
    LIMIT 20
  `).all(req.userId);
  res.json(promotions);
});

apiRouter.post('/promotions', authMiddleware, (req: any, res) => {
  const { url, durationMinutes } = req.body;
  if (!url || !durationMinutes) return res.status(400).json({ error: 'URL and duration required' });

  const cost = durationMinutes * 5;

  const tx = db.transaction(() => {
    const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(req.userId) as { credits: number };
    if (user.credits < cost) throw new Error('INSUFFICIENT_CREDITS');

    db.prepare('UPDATE users SET credits = credits - ? WHERE id = ?').run(cost, req.userId);
    
    // Convert durationMinutes to ms
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    return db.prepare('INSERT INTO promotions (user_id, url, cost, expires_at) VALUES (?, ?, ?, ?)').run(req.userId, url, cost, expiresAt);
  });

  try {
    tx();
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_CREDITS') return res.status(400).json({ error: 'Not enough credits' });
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.post('/promotions/:id/interact', authMiddleware, (req: any, res) => {
  const promotionId = req.params.id;
  const reward = 0.2; // 0.2 credits per interact

  const tx = db.transaction(() => {
    const promo = db.prepare('SELECT * FROM promotions WHERE id = ?').get(promotionId) as any;
    if (!promo) throw new Error('NOT_FOUND');
    if (promo.user_id === req.userId) throw new Error('CANT_INTERACT_OWN');

    try {
      db.prepare('INSERT INTO interactions (user_id, promotion_id) VALUES (?, ?)').run(req.userId, promotionId);
    } catch {
      throw new Error('ALREADY_INTERACTED');
    }

    db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(reward, req.userId);
  });

  try {
    tx();
    res.json({ success: true, reward });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- PAYMENTS (Mercado Pago Real API) --- //
apiRouter.post('/payments/pix', authMiddleware, async (req: any, res) => {
  const { credits } = req.body;
  if (!credits || typeof credits !== 'number') return res.status(400).json({ error: 'Invalid credits amount' });

  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return res.status(500).json({ error: 'Mercado Pago token não foi configurado (.env).' });
  }

  // Preços predefinidos da loja
  const packageMap: Record<number, number> = {
    5: 0.50,
    10: 1.00,
    25: 2.00,
    55: 5.00,
    125: 10.00,
    285: 20.00,
    640: 50.00,
    1430: 100.00,
    3210: 200.00,
    7200: 250.00
  };

  const amount = packageMap[credits];
  if (!amount) return res.status(400).json({ error: 'Pacote inválido' });

  try {
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.userId) as any;

    const paymentResponse = await mpPayment.create({
      body: {
        transaction_amount: amount,
        description: `${credits} Créditos InstaBoost (${user.username})`,
        payment_method_id: 'pix',
        payer: {
          email: `${user.username.replace(/[^a-zA-Z0-9]/g, '')}@instaboost.com.br`
        },
        notification_url: 'https://instaboostpro-production.up.railway.app/api/webhook/mercadopago'
      }
    });

    const paymentId = paymentResponse.id?.toString();
    if (!paymentId) throw new Error("ID do PIX não retornado.");

    // The MP QR Code base64 string doesn't include the Data URL prefix by default.
    const rawBase64 = paymentResponse.point_of_interaction?.transaction_data?.qr_code_base64;
    const pixCode = paymentResponse.point_of_interaction?.transaction_data?.qr_code;
    
    // Save locally
    db.prepare('INSERT INTO payments (id, user_id, amount, credits) VALUES (?, ?, ?, ?)').run(paymentId, req.userId, amount, credits);

    res.json({ 
      id: paymentId, 
      qrCode: rawBase64 ? `data:image/png;base64,${rawBase64}` : null, 
      pixCode 
    });
  } catch (err: any) {
    console.error('MercadoPago Error:', err);
    res.status(500).json({ error: 'Falha ao solicitar PIX do Mercado Pago.' });
  }
});

apiRouter.get('/payments/:id', authMiddleware, (req: any, res) => {
  const payment = db.prepare('SELECT id, status, credits FROM payments WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  res.json(payment || { error: 'Not found' });
});

// Simulates a webhook hitting our endpoint from Mercado Pago
apiRouter.post('/webhook/mercadopago', async (req, res) => {
  try {
    const { action, type, data } = req.body;
    
    // Support two common MP Webhook formats (Topic/Id vs Data/Action)
    const paymentId = data?.id || req.body.id || req.query['data.id'] || req.query.id;

    if (!paymentId) return res.status(400).json({ error: 'Missing payment_id payload' });

    // Ensure we actually ask MercadoPago about this payment
    const mpPayInfo = await mpPayment.get({ id: paymentId.toString() });

    if (mpPayInfo.status === 'approved') {
      const payment = db.prepare("SELECT * FROM payments WHERE id = ? AND status = 'pending'").get(paymentId.toString()) as any;
      
      if (payment) {
        const tx = db.transaction(() => {
          db.prepare("UPDATE payments SET status = 'approved' WHERE id = ?").run(paymentId.toString());
          db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(payment.credits, payment.user_id);
        });
        tx();
      }
    } else if (mpPayInfo.status === 'cancelled' || mpPayInfo.status === 'rejected') {
      db.prepare("UPDATE payments SET status = 'cancelled' WHERE id = ?").run(paymentId.toString());
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('MP Webhook Error:', err);
    res.status(500).json({ success: false });
  }
});
