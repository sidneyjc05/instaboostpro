import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { authMiddleware, adminMiddleware } from './auth.js';
import crypto from 'crypto';
import qrcode from 'qrcode';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { sendVerificationEmail } from './mailer.js';

export const apiRouter = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Initialize MP (fallback to empty token to avoid crash, but will fail requests if not set in .env)
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '' });
const mpPayment = new Payment(mpClient);

// --- AUTH --- //
apiRouter.post('/auth/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  // Check unique email if provided
  if (email) {
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'E-mail já está em uso por outra conta' });
    }
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    
    // Check if this is the first user
    const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    if (count === 0 && !email) {
      return res.status(400).json({ error: 'O primeiro usuário (Admin) precisa informar um e-mail' });
    }

    const initialRole = count === 0 ? 'admin' : 'user';

    const result = db.prepare('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)').run(username, email || null, hash, initialRole);
    
    const token = jwt.sign({ id: result.lastInsertRowid, role: initialRole }, JWT_SECRET, { expiresIn: '7d' });
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

// PASSWORD RECOVERY
apiRouter.post('/auth/recover/send', async (req, res) => {
   const { email } = req.body;
   if (!email) return res.status(400).json({ error: 'Email requerido' });

   const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any;
   if (!user) {
      // Return success even if not found to prevent email enumeration, or just return success
      return res.json({ success: true }); 
   }

   // Generate code
   const code = Math.floor(100000 + Math.random() * 900000).toString();
   db.prepare('DELETE FROM verification_codes WHERE user_id = ?').run(user.id);
   db.prepare(`INSERT INTO verification_codes (user_id, code, expires_at) VALUES (?, ?, datetime('now', '+15 minutes'))`).run(user.id, code);

   console.log(`[RECOVERY] Envio de recuperação para ${email}. Código: ${code}`);
   await sendVerificationEmail(email, code, 'recovery');
   
   res.json({ success: true });
});

apiRouter.post('/auth/recover/reset', (req, res) => {
   const { email, code, newPassword } = req.body;
   if (!email || !code || !newPassword) return res.status(400).json({ error: 'Preencha todos os campos' });

   const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any;
   if (!user) return res.status(400).json({ error: 'Código inválido' });

   const validCode = db.prepare(`SELECT id FROM verification_codes WHERE user_id = ? AND code = ? AND expires_at > datetime('now')`).get(user.id, code);
   
   if (!validCode) {
      return res.status(400).json({ error: 'Código inválido ou expirado' });
   }

   const hash = bcrypt.hashSync(newPassword, 10);
   db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, user.id);
   db.prepare('DELETE FROM verification_codes WHERE user_id = ?').run(user.id);

   res.json({ success: true });
});

apiRouter.post('/auth/login', async (req, res) => {
  const { username, password, verificationCode } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username) as any;
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.is_blocked) {
    return res.status(403).json({ error: 'Your account has been blocked by an administrator.' });
  }

  // Get IP and Device
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown') as string;
  const device = req.headers['user-agent'] || 'unknown';
  const deviceHash = crypto.createHash('md5').update(`${ip}-${device}`).digest('hex');

  db.prepare('INSERT INTO login_logs (user_id, ip, device) VALUES (?, ?, ?)').run(user.id, ip, device);

  // Suspicious Login Detection (New device check)
  const isTrusted = db.prepare('SELECT id FROM trusted_devices WHERE user_id = ? AND device_hash = ?').get(user.id, deviceHash);
  
  if (!isTrusted && user.email) {
     if (!verificationCode) {
         // Create a new code if no code provided
         const code = Math.floor(100000 + Math.random() * 900000).toString();
         db.prepare(`INSERT INTO verification_codes (user_id, code, expires_at) VALUES (?, ?, datetime('now', '+15 minutes'))`).run(user.id, code);
         
         console.log(`[SECURITY] Suspicious login for ${user.email}. Verification Code: ${code}`);
         await sendVerificationEmail(user.email, code, 'login');

         return res.status(403).json({ requiresVerification: true, error: 'Acesso de novo dispositivo! Código de segurança enviado para seu email.' });
     } else {
         const validCode = db.prepare(`SELECT id FROM verification_codes WHERE user_id = ? AND code = ? AND expires_at > datetime('now')`).get(user.id, verificationCode);
         if (!validCode) {
             return res.status(401).json({ error: 'Código de verificação inválido ou expirado.' });
         }
         // Code is valid, clean up and trust device
         db.prepare('DELETE FROM verification_codes WHERE user_id = ?').run(user.id);
         db.prepare('INSERT INTO trusted_devices (user_id, device_hash) VALUES (?, ?)').run(user.id, deviceHash);
         db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(user.id);
     }
  } else if (!isTrusted) {
      // Legacy user without email, just trust automatically to not lock them out
      db.prepare('INSERT INTO trusted_devices (user_id, device_hash) VALUES (?, ?)').run(user.id, deviceHash);
  }

  db.prepare('UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { 
    httpOnly: true, 
    secure: true, 
    sameSite: 'none' 
  }).json({ success: true });
});

apiRouter.post('/auth/logout', (req, res) => {
  res.clearCookie('token', { sameSite: 'none', secure: true }).json({ success: true });
});

// --- ADMIN ROUTES --- //
apiRouter.get('/admin/users', authMiddleware, adminMiddleware, (req, res) => {
   const users = db.prepare(`
      SELECT id, username, email, role, credits, is_blocked, last_active_at, created_at 
      FROM users 
      ORDER BY created_at DESC
   `).all();
   res.json(users);
});

apiRouter.get('/admin/logs', authMiddleware, adminMiddleware, (req, res) => {
   const logs = db.prepare(`
      SELECT l.id, u.username, l.ip, l.device, l.created_at
      FROM login_logs l
      JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC LIMIT 100
   `).all();
   res.json(logs);
});

apiRouter.post('/admin/users/:id/block', authMiddleware, adminMiddleware, (req, res) => {
   const { blocked } = req.body;
   db.prepare('UPDATE users SET is_blocked = ? WHERE id = ?').run(blocked ? 1 : 0, req.params.id);
   res.json({ success: true });
});

apiRouter.post('/admin/users/:id/role', authMiddleware, adminMiddleware, (req, res) => {
   const { role } = req.body; // 'admin' or 'user'
   db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
   res.json({ success: true });
});

apiRouter.get('/me', authMiddleware, (req: any, res) => {
  db.prepare('UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.userId);
  const user = db.prepare('SELECT id, username, email, role, is_verified, credits, tickets, created_at FROM users WHERE id = ? AND is_blocked = 0').get(req.userId);
  if (!user) return res.status(401).json({ error: 'User blocked or not found' });
  res.json(user);
});

apiRouter.post('/me/email', authMiddleware, (req: any, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });

  const existingEmail = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.userId);
  if (existingEmail) return res.status(400).json({ error: 'E-mail já está em uso por outra conta' });

  db.prepare('UPDATE users SET email = ?, is_verified = 0 WHERE id = ?').run(email, req.userId);
  res.json({ success: true });
});

apiRouter.post('/me/email/verify/send', authMiddleware, async (req: any, res) => {
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !user.email) return res.status(400).json({ error: 'Nenhum e-mail vinculado' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  db.prepare('DELETE FROM verification_codes WHERE user_id = ?').run(req.userId);
  db.prepare(`INSERT INTO verification_codes (user_id, code, expires_at) VALUES (?, ?, datetime('now', '+15 minutes'))`).run(req.userId, code);

  console.log(`[VERIFY] Código de verificação para ${user.email}. Código: ${code}`);
  await sendVerificationEmail(user.email, code, 'verify');

  res.json({ success: true });
});

apiRouter.post('/me/email/verify', authMiddleware, (req: any, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Código requerido' });

  const validCode = db.prepare(`SELECT id FROM verification_codes WHERE user_id = ? AND code = ? AND expires_at > datetime('now')`).get(req.userId, code);
  
  if (!validCode) {
     return res.status(400).json({ error: 'Código inválido ou expirado' });
  }

  db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(req.userId);
  db.prepare('DELETE FROM verification_codes WHERE user_id = ?').run(req.userId);

  res.json({ success: true });
});

apiRouter.get('/users/me/promotions', authMiddleware, (req: any, res) => {
  const promos = db.prepare(`
    SELECT id, url, expires_at, created_at, cost 
    FROM promotions 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `).all(req.userId);
  res.json(promos);
});

apiRouter.get('/users/me/payments', authMiddleware, (req: any, res) => {
  const payments = db.prepare(`
    SELECT id, amount, credits, status, created_at 
    FROM payments 
    WHERE user_id = ? AND status = 'pending'
    ORDER BY created_at DESC
  `).all(req.userId);
  res.json(payments);
});

apiRouter.post('/promotions/:id/reboost', authMiddleware, (req: any, res) => {
  const promoId = req.params.id;

  const tx = db.transaction(() => {
    const promo = db.prepare('SELECT user_id, expires_at, cost FROM promotions WHERE id = ?').get(promoId) as any;
    if (!promo) throw new Error('NOT_FOUND');
    if (promo.user_id !== req.userId) throw new Error('UNAUTHORIZED');

    const cost = promo.cost;
    const durationMinutes = cost / 5;

    const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(req.userId) as any;
    if (user.credits < cost) throw new Error('INSUFFICIENT_CREDITS');

    db.prepare('UPDATE users SET credits = credits - ? WHERE id = ?').run(cost, req.userId);
    
    // Check if expired or active
    const now = Date.now();
    const expiresAtMs = new Date(promo.expires_at).getTime();
    
    // If it expires in > 1 hour, block reboost (so they don't stack up infinitely)
    if (expiresAtMs > now + 60 * 60 * 1000) {
       throw new Error('TOO_SOON');
    }

    // New expiration base is either now (if expired) or the current expiration (if active)
    const baseTime = expiresAtMs < now ? now : expiresAtMs;
    const newExpiresAt = new Date(baseTime + durationMinutes * 60 * 1000).toISOString();
    
    db.prepare('UPDATE promotions SET expires_at = ? WHERE id = ?').run(newExpiresAt, promoId);
  });

  try {
    tx();
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'TOO_SOON') return res.status(400).json({ error: 'Ainda resta muito tempo de destaque.' });
    if (err.message === 'INSUFFICIENT_CREDITS') return res.status(400).json({ error: 'Not enough credits' });
    res.status(500).json({ error: err.message });
  }
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

  // Limit check: Does user have 10 active promotions already?
  const activeCount: any = db.prepare(`SELECT count(*) as count FROM promotions WHERE user_id = ? AND datetime(expires_at) > CURRENT_TIMESTAMP`).get(req.userId);
  if (activeCount.count >= 10) {
     return res.status(400).json({ error: 'Limite alcançado: Você pode ter no máximo 10 publicações ativas simultaneamente.' });
  }

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

// --- ROULETTE (Tickets & Moedas) --- //

apiRouter.get('/roulette/status', authMiddleware, (req: any, res) => {
  // Free tickets logic: 3 tickets per 24 hours per unique device hash & user
  // Will check in /claim, for now just show if 24 hours have passed for the user
  const latestClaim = db.prepare('SELECT claimed_at FROM free_tickets_claims WHERE user_id = ? ORDER BY claimed_at DESC LIMIT 1').get(req.userId) as any;
  
  let canClaim = true;
  let nextClaimTime = null;

  if (latestClaim) {
     const claimDate = new Date(latestClaim.claimed_at);
     const msPassed = Date.now() - claimDate.getTime();
     const ms24h = 24 * 60 * 60 * 1000;
     
     if (msPassed < ms24h) {
        canClaim = false;
        const msLeft = ms24h - msPassed;
        const hrs = Math.floor(msLeft / (1000 * 60 * 60));
        const mins = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
        nextClaimTime = `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
     }
  }

  res.json({ canClaim, nextClaimTime });
});

apiRouter.post('/roulette/claim', authMiddleware, (req: any, res) => {
  const { deviceHash } = req.body;
  if (!deviceHash) return res.status(400).json({ error: 'Device indisponível.' });

  // Anti-abuse Check 1: Did THIS device claim in the last 24h?
  const deviceClaim = db.prepare(`SELECT claimed_at FROM free_tickets_claims WHERE device_hash = ? AND datetime(claimed_at, '+24 hours') > datetime('now')`).get(deviceHash);
  if (deviceClaim) {
     return res.status(400).json({ error: 'Este dispositivo já resgatou tickets nas últimas 24h.' });
  }

  // Anti-abuse Check 2: Did THIS user claim in the last 24h?
  const userClaim = db.prepare(`SELECT claimed_at FROM free_tickets_claims WHERE user_id = ? AND datetime(claimed_at, '+24 hours') > datetime('now')`).get(req.userId);
  if (userClaim) {
     return res.status(400).json({ error: 'Esta conta já resgatou tickets nas últimas 24h.' });
  }

  // Everything is fine, give 3 tickets
  try {
     const tx = db.transaction(() => {
        db.prepare('INSERT INTO free_tickets_claims (user_id, device_hash) VALUES (?, ?)').run(req.userId, deviceHash);
        db.prepare('UPDATE users SET tickets = tickets + 3 WHERE id = ?').run(req.userId);
     });
     tx();
     res.json({ success: true, tickets: 3 });
  } catch(e) {
     res.status(500).json({ error: 'Falha ao processar.' });
  }
});

apiRouter.post('/roulette/spin', authMiddleware, (req: any, res) => {
   // Check if user has at least 1 ticket
   const user = db.prepare('SELECT tickets FROM users WHERE id = ?').get(req.userId) as any;
   if (!user || user.tickets < 1) {
      return res.status(400).json({ error: 'Você não tem tickets suficientes.' });
   }

   // 10 prizes definitions and exact probability mapping
   // Total must be 100
   const prizes = [
      { prize: 0.5, prob: 25 },
      { prize: 1, prob: 20 },
      { prize: 5, prob: 15 },
      { prize: 10, prob: 12 },
      { prize: 20, prob: 10 },
      { prize: 50, prob: 8 },
      { prize: 100, prob: 5 },
      { prize: 150, prob: 3 },
      { prize: 200, prob: 1.5 },
      { prize: 300, prob: 0.5 }
   ];

   const rand = Math.random() * 100; // 0 to 100
   let accumulatedProb = 0;
   let wonPrize = 0.5;

   for (const p of prizes) {
      accumulatedProb += p.prob;
      if (rand <= accumulatedProb) {
         wonPrize = p.prize;
         break;
      }
   }

   try {
      const tx = db.transaction(() => {
         // Deduct 1 ticket and add the prize
         db.prepare('UPDATE users SET tickets = tickets - 1, credits = credits + ? WHERE id = ?').run(wonPrize, req.userId);
      });
      tx();

      res.json({ success: true, prize: wonPrize });
   } catch(e) {
      res.status(500).json({ error: 'Erro ao girar a roleta.' });
   }
});

apiRouter.post('/payments/pix', authMiddleware, async (req: any, res) => {
  const { credits, type } = req.body;
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

  const ticketPackageMap: Record<number, number> = {
    5: 1.50,
    12: 3.00,
    22: 5.00,
    50: 10.00,
    110: 20.00,
    300: 50.00,
    650: 100.00,
    1050: 150.00,
    1900: 250.00,
    2400: 300.00
  };

  const amount = type === 'tickets' ? ticketPackageMap[credits] : packageMap[credits];
  if (!amount) return res.status(400).json({ error: 'Pacote inválido' });

  try {
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.userId) as any;

    const expiresAtDate = new Date(Date.now() + 15 * 60 * 1000);
    const dateOfExpirationString = expiresAtDate.toISOString();

    const descriptionText = type === 'tickets' ? `${credits} Tickets InstaBoost` : `${credits} Créditos InstaBoost`;

    const paymentResponse = await mpPayment.create({
      body: {
        transaction_amount: amount,
        description: `${descriptionText} (${user.username})`,
        payment_method_id: 'pix',
        date_of_expiration: dateOfExpirationString,
        payer: {
          email: `${user.username.replace(/[^a-zA-Z0-9]/g, '')}@instaboost.com.br`
        },
        notification_url: 'https://instaboostpro-production.up.railway.app/api/webhook/mercadopago'
      }
    });

    const paymentId = paymentResponse.id?.toString();
    if (!paymentId) throw new Error("ID do PIX não retornado.");

    const rawBase64 = paymentResponse.point_of_interaction?.transaction_data?.qr_code_base64;
    const pixCode = paymentResponse.point_of_interaction?.transaction_data?.qr_code;
    
    if (type === 'tickets') {
      db.prepare('INSERT INTO payments (id, user_id, amount, credits, tickets) VALUES (?, ?, ?, 0, ?)').run(paymentId, req.userId, amount, credits);
    } else {
      db.prepare('INSERT INTO payments (id, user_id, amount, credits, tickets) VALUES (?, ?, ?, ?, 0)').run(paymentId, req.userId, amount, credits);
    }

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

apiRouter.get('/payments/:id', authMiddleware, async (req: any, res) => {
  const payment = db.prepare('SELECT id, status, credits FROM payments WHERE id = ? AND user_id = ?').get(req.params.id, req.userId) as any;
  if (!payment) return res.status(404).json({ error: 'Not found' });

  if (payment.status === 'pending') {
    try {
      const mpPayInfo = await mpPayment.get({ id: payment.id });
      const rawBase64 = mpPayInfo.point_of_interaction?.transaction_data?.qr_code_base64;
      payment.qrCode = rawBase64 ? `data:image/png;base64,${rawBase64}` : null;
      payment.pixCode = mpPayInfo.point_of_interaction?.transaction_data?.qr_code;
    } catch (err) {
      console.error('Failed to get QR from MP', err);
    }
  }

  res.json(payment);
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
          if (payment.tickets > 0) {
             db.prepare('UPDATE users SET tickets = tickets + ? WHERE id = ?').run(payment.tickets, payment.user_id);
          } else {
             db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(payment.credits, payment.user_id);
          }
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
