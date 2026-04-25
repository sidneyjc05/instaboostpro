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

db.exec(`
  CREATE TABLE IF NOT EXISTS weekly_reward_plans (
    user_id INTEGER,
    week_start TEXT,
    plan_json TEXT,
    PRIMARY KEY (user_id, week_start)
  );

  CREATE TABLE IF NOT EXISTS daily_claims (
    user_id INTEGER,
    claim_date TEXT,
    device_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, claim_date)
  );

  CREATE TABLE IF NOT EXISTS device_daily_claims (
    device_hash TEXT,
    claim_date TEXT,
    user_id INTEGER,
    PRIMARY KEY (device_hash, claim_date)
  );

  CREATE TABLE IF NOT EXISTS missions_progress (
    user_id INTEGER,
    mission_type TEXT,
    level INTEGER DEFAULT 1,
    progress INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, mission_type)
  );
`);

function getUTCDateString(d: Date) {
  return d.toISOString().split('T')[0];
}

function getWeekStart(d: Date) {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  date.setUTCDate(diff);
  date.setUTCHours(0,0,0,0);
  return date;
}

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
    const tempReferralCode = username.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8) + Math.floor(100+Math.random()*900);

    const result = db.prepare('INSERT INTO users (username, email, password, role, referral_code) VALUES (?, ?, ?, ?, ?)').run(username, email || null, hash, initialRole, tempReferralCode);
    
    // Attempt to update referral code to include row id just in case
    db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(username.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8) + result.lastInsertRowid + Math.floor(100+Math.random()*900), result.lastInsertRowid);
    
    // Auto-trust the device they used to register
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown') as string;
    const device = req.headers['user-agent'] || 'unknown';
    const deviceHash = crypto.createHash('md5').update(`${ip}-${device}`).digest('hex');
    db.prepare('INSERT INTO trusted_devices (user_id, device_hash) VALUES (?, ?)').run(result.lastInsertRowid, deviceHash);
    db.prepare('UPDATE users SET active_device_hash = ?, session_version = 1 WHERE id = ?').run(deviceHash, result.lastInsertRowid);

    const token = jwt.sign({ id: result.lastInsertRowid, role: initialRole, session_version: 1 }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none' 
    }).json({ success: true });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ error: 'Este nome de usuário já está sendo usado no sistema.' });
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
   const mailStatus = await sendVerificationEmail(email, code, 'recovery');
   if (!mailStatus.success) {
      return res.status(500).json({ error: 'Falha ao enviar email. ' + (mailStatus.reason || '') });
   }
   
   if (mailStatus.bypassed) {
      return res.status(200).json({ success: true, bypassed: true, code: code });
   }
   
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
  try {
    const { username, password, verificationCode } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username) as any;
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Sua conta foi suspensa pelo administrador.' });
    }

    // Get IP and Device
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown') as string;
    const device = req.headers['user-agent'] || 'unknown';
    const deviceHash = crypto.createHash('md5').update(`${ip}-${device}`).digest('hex');

    db.prepare('INSERT INTO login_logs (user_id, ip, device) VALUES (?, ?, ?)').run(user.id, ip, device);

    // Suspicious Login Detection (New device check)
    // Here we check the user limits before trusting the device
    if (user.active_device_hash && user.active_device_hash !== deviceHash) {
       if (user.device_change_count >= 100) {
          // Exceeded limit
          return res.status(403).json({ error: 'Sua conta foi suspensa temporariamente por excesso de mudanças de rede. Contate o suporte.' });
       }
    }

    const isTrusted = db.prepare('SELECT id FROM trusted_devices WHERE user_id = ? AND device_hash = ?').get(user.id, deviceHash);
    
    if (!isTrusted && user.email) {
       if (!verificationCode) {
           // Limit to 3 active codes to prevent spam
           const recentCodes = db.prepare(`SELECT count(*) as count FROM verification_codes WHERE user_id = ? AND created_at > datetime('now', '-24 hours')`).get(user.id) as {count: number};
           
           if (recentCodes.count >= 5) {
              return res.status(429).json({ requiresVerification: true, error: 'Você alcançou o limite de envio de códigos. Use o último código que enviamos por email ou procure o suporte.' });
           }

           // Create a new code if no code provided
           // We delete OLD EXPIRED codes to save space, but leave recent ones for the count
           db.prepare(`DELETE FROM verification_codes WHERE user_id = ? AND expires_at < datetime('now')`).run(user.id);
           
           const code = Math.floor(100000 + Math.random() * 900000).toString();
           db.prepare(`INSERT INTO verification_codes (user_id, code, expires_at) VALUES (?, ?, datetime('now', '+15 minutes'))`).run(user.id, code);
           
           console.log(`[SECURITY] Suspicious login for ${user.email}. Verification Code: ${code}`);
           try {
             const mailStatus = await sendVerificationEmail(user.email, code, 'login');
             if (!mailStatus.success) {
                 return res.status(500).json({ error: 'Configure a variável MAILERSEND_API_TOKEN no painel do Railway para ativar os e-mails. ' + (mailStatus.reason || '') });
             }
             
             if (mailStatus.bypassed) {
                // Bypass se as configs de email não foram colocadas no Railway/Vercel/etc
                return res.status(403).json({ requiresVerification: true, bypassed: true, code, error: 'Bypass ativo. Use o código exibido para prosseguir.' });
             } else {
                return res.status(403).json({ requiresVerification: true, error: 'Acesso de novo dispositivo! Código de segurança enviado para seu email (pode chegar em até 10 minutos).' });
             }
           } catch (mailError) {
             console.error("[Mailer Error]", mailError);
             return res.status(500).json({ error: 'Erro de sistema. Não foi possível processar o código.' });
           }
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

    // Now update the device limits if it changed
    let newSessionVersion = (user.session_version || 1) + 1;
    if (user.active_device_hash !== deviceHash) {
        db.prepare('UPDATE users SET device_change_count = device_change_count + 1 WHERE id = ?').run(user.id);
    }

    db.prepare('UPDATE users SET last_active_at = CURRENT_TIMESTAMP, active_device_hash = ?, session_version = ? WHERE id = ?').run(deviceHash, newSessionVersion, user.id);

    const token = jwt.sign({ id: user.id, role: user.role, session_version: newSessionVersion }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none' 
    }).json({ success: true });
  } catch (err: any) {
    console.error("Login Error: ", err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
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

apiRouter.post('/me/referral/claim', authMiddleware, (req: any, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Código de indicação obrigatório' });

  // Validate user eligibility
  const user = db.prepare('SELECT id, created_at, referred_by FROM users WHERE id = ?').get(req.userId) as any;
  if (!user) return res.status(400).json({ error: 'Usuário não encontrado' });
  if (user.referred_by) {
    return res.status(400).json({ error: 'Você já utilizou um código de indicação' });
  }

  // Check 24 hours rule
  const createdAt = new Date(user.created_at).getTime();
  const now = new Date().getTime();
  if (now - createdAt > 24 * 60 * 60 * 1000) {
    return res.status(400).json({ error: 'O prazo de 24 horas para inserir um código expirou' });
  }

  // Find referrer
  const referrer = db.prepare('SELECT id, username FROM users WHERE referral_code = ? COLLATE NOCASE').get(code) as any;
  if (!referrer) {
    return res.status(400).json({ error: 'Código de indicação inválido' });
  }
  if (referrer.id === user.id) {
    return res.status(400).json({ error: 'Você não pode usar seu próprio código' });
  }
  
  // Basic Anti-Fraud: Same Device/IP check could be added here, but for now we look if there are other users referred from this device
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown') as string;
  const recentReferralsFromIp = db.prepare('SELECT count(*) as count FROM users WHERE referred_by = ? AND id IN (SELECT user_id FROM login_logs WHERE ip = ?)').get(referrer.id, ip) as {count: number};
  if (recentReferralsFromIp.count > 1) { // strict, max 1 extra account from same IP
     return res.status(403).json({ error: 'Sistema anti-fraude: limite de indicações por rede excedido.' });
  }

  // Reward!
  db.transaction(() => {
    // Novato: 1000 moedas
    db.prepare('UPDATE users SET credits = credits + 1000, referred_by = ? WHERE id = ?').run(referrer.id, user.id);
    // Veterano: 500 moedas
    db.prepare('UPDATE users SET credits = credits + 500 WHERE id = ?').run(referrer.id);
    
    // Log commissions
    db.prepare('INSERT INTO commissions (referrer_id, referred_id, amount, action_type) VALUES (?, ?, ?, ?)').run(referrer.id, user.id, 500, 'signup_bonus');
  })();

  res.json({ success: true, message: 'Código ativado com sucesso! Você ganhou 1.000 moedas.' });
});

apiRouter.get('/me/referral', authMiddleware, (req: any, res) => {
  const user = db.prepare('SELECT referral_code, referred_by, created_at FROM users WHERE id = ?').get(req.userId) as any;
  
  const referredUsers = db.prepare(`
    SELECT u.username, u.created_at, u.last_active_at, SUM(c.amount) as total_earned
    FROM users u
    LEFT JOIN commissions c ON c.referred_id = u.id AND c.referrer_id = ?
    WHERE u.referred_by = ?
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all(req.userId, req.userId) as any[];

  const commissions = db.prepare(`
    SELECT c.amount, c.action_type, c.created_at, u.username
    FROM commissions c
    JOIN users u ON c.referred_id = u.id
    WHERE c.referrer_id = ?
    ORDER BY c.created_at DESC
    LIMIT 50
  `).all(req.userId);

  const earnings = db.prepare('SELECT SUM(amount) as sum FROM commissions WHERE referrer_id = ?').get(req.userId) as any;

  res.json({
    referral_code: user.referral_code,
    referred_by: user.referred_by,
    created_at: user.created_at,
    referred_users: referredUsers,
    commissions_history: commissions,
    total_earnings: earnings.sum || 0
  });
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
  const mailStatus = await sendVerificationEmail(user.email, code, 'verify');
  if (!mailStatus.success) {
      return res.status(500).json({ error: 'Falha ao enviar e-mail de verificação. ' + (mailStatus.reason || '') });
  }

  if (mailStatus.bypassed) {
      db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(req.userId);
      return res.status(200).json({ success: true, bypassed: true, code: code });
  }

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
      AND p.user_id != ?
      AND p.id NOT IN (SELECT promotion_id FROM interactions WHERE user_id = ?)
    ORDER BY p.created_at DESC
    LIMIT 20
  `).all(req.userId, req.userId);
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

    // Comissão de 10% para o indicador (0.02)
    const user = db.prepare('SELECT referred_by FROM users WHERE id = ?').get(req.userId) as any;
    if (user && user.referred_by) {
       db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(reward * 0.1, user.referred_by);
       db.prepare('INSERT INTO commissions (referrer_id, referred_id, amount, action_type) VALUES (?, ?, ?, ?)').run(user.referred_by, req.userId, reward * 0.1, 'interact');
    }

    // Progresso das missões
    let missionType = 'follows';
    if (promo.url.includes('/reel/')) {
        missionType = 'reels';
    } else if (promo.url.includes('/p/')) {
        missionType = 'likes';
    }

    db.prepare(`
        INSERT INTO missions_progress (user_id, mission_type, progress, level)
        VALUES (?, ?, 1, 1)
        ON CONFLICT(user_id, mission_type) DO UPDATE SET progress = progress + 1
    `).run(req.userId, missionType);
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

  const deviceClaim = db.prepare(`SELECT claimed_at FROM free_tickets_claims WHERE device_hash = ? AND datetime(claimed_at, '+24 hours') > datetime('now')`).get(deviceHash);
  if (deviceClaim) {
     return res.status(400).json({ error: 'Este prêmio já foi resgatado nas últimas 24h em outra conta criada neste dispositivo.' });
  }

  const userClaim = db.prepare(`SELECT claimed_at FROM free_tickets_claims WHERE user_id = ? AND datetime(claimed_at, '+24 hours') > datetime('now')`).get(req.userId);
  if (userClaim) {
     return res.status(400).json({ error: 'Esta conta já resgatou tickets nas últimas 24h.' });
  }

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
      { prize: 0.5, prob: 90 },
      { prize: 1, prob: 5 },
      { prize: 5, prob: 2.5 },
      { prize: 10, prob: 1.2 },
      { prize: 20, prob: 0.8 },
      { prize: 50, prob: 0.3 },
      { prize: 100, prob: 0.15 },
      { prize: 150, prob: 0.04 },
      { prize: 200, prob: 0.009 },
      { prize: 300, prob: 0.001 }
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
    110: 0.50,
    230: 1.00,
    480: 2.00,
    1150: 5.00,
    2300: 10.00,
    4200: 20.00,
    5100: 50.00,
    5800: 100.00,
    6500: 200.00,
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
             
             // Comissão para o referenciador (10% das moedas compradas)
             const userForComm = db.prepare('SELECT referred_by FROM users WHERE id = ?').get(payment.user_id) as any;
             if (userForComm && userForComm.referred_by) {
                const comm = Math.floor(payment.credits * 0.1);
                db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(comm, userForComm.referred_by);
                db.prepare('INSERT INTO commissions (referrer_id, referred_id, amount, action_type) VALUES (?, ?, ?, ?)').run(userForComm.referred_by, payment.user_id, comm, 'purchase');
             }
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

apiRouter.get('/rewards/daily', authMiddleware, (req: any, res) => {
    const now = new Date();
    const todayStr = getUTCDateString(now);
    const weekStart = getWeekStart(now);
    const weekStartStr = getUTCDateString(weekStart);

    let planRecord = db.prepare('SELECT plan_json FROM weekly_reward_plans WHERE user_id = ? AND week_start = ?').get(req.userId, weekStartStr) as any;
    
    if (!planRecord) {
        const user = db.prepare('SELECT created_at FROM users WHERE id = ?').get(req.userId) as any;
        const createdAtStr = user.created_at.includes('Z') ? user.created_at : user.created_at.replace(' ', 'T') + 'Z';
        const createdAt = new Date(createdAtStr);
        
        let isNewLateWeek = false;
        if (createdAt >= weekStart) {
            const d = createdAt.getUTCDay();
            if (d === 5 || d === 6 || d === 0) isNewLateWeek = true;
        }

        const weekMultiplier = isNewLateWeek ? (Math.random() * 0.4 + 0.3) : (Math.random() * 1.3 + 0.7);

        const baseRanges = [
            { min: 0.2, max: 2, tChance: 0.10 },
            { min: 0.5, max: 5, tChance: 0.15 },
            { min: 1, max: 10, tChance: 0.20 },
            { min: 2, max: 20, tChance: 0.10 },
            { min: 5, max: 40, tChance: 0.15 },
            { min: 10, max: 80, tChance: 0.10 },
            { min: 20, max: 200, tChance: 0.30 },
        ];

        let ticketsGiven = 0;
        const plan = baseRanges.map((range, index) => {
            const rawCoins = (Math.random() * (range.max - range.min) + range.min) * weekMultiplier;
            const coins = parseFloat(rawCoins.toFixed(1));
            let tickets = 0;
            if (ticketsGiven < 2 && Math.random() < range.tChance) {
                 tickets = Math.floor(Math.random() * 4) + 2; 
                 ticketsGiven++;
            }
            return { dayIndex: index + 1, coins, tickets };
        });

        const planJson = JSON.stringify(plan);
        db.prepare('INSERT INTO weekly_reward_plans (user_id, week_start, plan_json) VALUES (?, ?, ?)').run(req.userId, weekStartStr, planJson);
        planRecord = { plan_json: planJson };
    }

    const plan = JSON.parse(planRecord.plan_json);

    const claims = db.prepare(`SELECT claim_date FROM daily_claims WHERE user_id = ? AND claim_date >= ?`).all(req.userId, weekStartStr) as any[];
    const claimedDates = new Set(claims.map(c => c.claim_date));

    const todayIndex = now.getUTCDay() === 0 ? 7 : now.getUTCDay(); // 1 = Mon, 7 = Sun
    
    const mappedPlan = plan.map((p: any) => {
        const dateObj = new Date(weekStart);
        dateObj.setUTCDate(dateObj.getUTCDate() + p.dayIndex - 1);
        const dayDateStr = getUTCDateString(dateObj);
        
        let state = 'locked';
        if (claimedDates.has(dayDateStr)) {
             state = 'claimed';
        } else if (dayDateStr === todayStr) {
             state = 'available';
        } else if (p.dayIndex < todayIndex) {
             state = 'missed';
        }

        return { ...p, date: dayDateStr, state };
    });

    res.json({
        todayStr,
        weekStartStr,
        plan: mappedPlan
    });
});

apiRouter.post('/rewards/daily/claim', authMiddleware, (req: any, res) => {
    const { deviceHash } = req.body;
    if (!deviceHash) return res.status(400).json({ error: 'Device hash required' });

    const now = new Date();
    const todayStr = getUTCDateString(now);

    const tx = db.transaction(() => {
        const deviceClaim = db.prepare('SELECT user_id FROM device_daily_claims WHERE device_hash = ? AND claim_date = ?').get(deviceHash, todayStr);
        if (deviceClaim) {
            throw new Error('Este prêmio diário já foi resgatado hoje em outra conta cadastrada neste dispositivo.');
        }

        const userClaim = db.prepare('SELECT claim_date FROM daily_claims WHERE user_id = ? AND claim_date = ?').get(req.userId, todayStr);
        if (userClaim) {
             throw new Error('Você já resgatou o prêmio de hoje!');
        }

        const weekStart = getWeekStart(now);
        const weekStartStr = getUTCDateString(weekStart);

        const planRecord = db.prepare('SELECT plan_json FROM weekly_reward_plans WHERE user_id = ? AND week_start = ?').get(req.userId, weekStartStr) as any;
        if (!planRecord) throw new Error('PLAN_NOT_FOUND');

        const plan = JSON.parse(planRecord.plan_json);
        const todayIndex = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
        const todayReward = plan.find((p: any) => p.dayIndex === todayIndex);

        if (!todayReward) throw new Error('REWARD_NOT_FOUND');

        db.prepare('UPDATE users SET credits = credits + ?, tickets = tickets + ? WHERE id = ?').run(todayReward.coins, todayReward.tickets, req.userId);

        db.prepare('INSERT INTO daily_claims (user_id, claim_date, device_hash) VALUES (?, ?, ?)').run(req.userId, todayStr, deviceHash);
        db.prepare('INSERT INTO device_daily_claims (device_hash, claim_date, user_id) VALUES (?, ?, ?)').run(deviceHash, todayStr, req.userId);

        return todayReward;
    });

    try {
        const reward = tx();
        res.json({ success: true, reward });
    } catch (err: any) {
        if (err.message === 'DEVICE_ALREADY_CLAIMED') {
             return res.status(403).json({ error: 'Este dispositivo já resgatou o prêmio de hoje em outra conta.' });
        }
        if (err.message === 'ALREADY_CLAIMED') {
             return res.status(400).json({ error: 'Você já resgatou o prêmio de hoje.' });
        }
         if (err.message === 'PLAN_NOT_FOUND') {
             return res.status(400).json({ error: 'Nenhum plano conf. Mude os dias e tente de novo.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// --- MISSIONS --- //
const MISSION_CONFIG = {
  likes: {
    goals: [10, 25, 50, 100, 200],
    rewards: [0.2, 0.5, 1.5, 3.0, 6.0],
    tickets: [0, 1, 1, 2, 3]
  },
  reels: {
    goals: [3, 8, 15, 30, 60],
    rewards: [0.3, 1.0, 3.0, 7.0, 14.0],
    tickets: [1, 2, 3, 4, 5]
  },
  follows: {
    goals: [5, 15, 30, 60, 120],
    rewards: [0.3, 1.0, 2.5, 5.0, 12.0],
    tickets: [1, 1, 2, 2, 3]
  },
  time: {
    goals: [1, 5, 10, 20, 40], // in minutes
    rewards: [0.5, 1.5, 3.5, 7.0, 15.0],
    tickets: [0, 0, 1, 1, 2]
  }
};

apiRouter.get('/missions', authMiddleware, (req: any, res) => {
    // 10 minutes timeout reset (progress = 0)
    db.prepare(`
       UPDATE missions_progress 
       SET progress = 0, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = ? AND datetime(updated_at, '+10 minutes') < datetime('now')
    `).run(req.userId);

    const rows = db.prepare('SELECT mission_type, level, progress, updated_at FROM missions_progress WHERE user_id = ?').all(req.userId) as any[];
    const state: Record<string, any> = {};

    for (const key of Object.keys(MISSION_CONFIG)) {
        const row = rows.find(r => r.mission_type === key);
        if (row) {
            state[key] = {
                level: row.level,
                progress: row.progress,
                updated_at: row.updated_at
            };
        } else {
            state[key] = { level: 1, progress: 0, updated_at: null };
            // Initialize in DB
            db.prepare('INSERT INTO missions_progress (user_id, mission_type, level, progress) VALUES (?, ?, 1, 0)').run(req.userId, key);
        }
    }

    res.json(state);
});

apiRouter.post('/missions/progress', authMiddleware, (req: any, res) => {
    const { type, amount = 1 } = req.body;
    if (!(type in MISSION_CONFIG)) return res.status(400).json({ error: 'Invalid mission type' });

    // Enforce 10-minute reset
    db.prepare(`
       UPDATE missions_progress 
       SET progress = 0, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND mission_type = ? AND datetime(updated_at, '+10 minutes') < datetime('now')
    `).run(req.userId, type);

    const config = MISSION_CONFIG[type as keyof typeof MISSION_CONFIG];
    const row = db.prepare('SELECT level, progress FROM missions_progress WHERE user_id = ? AND mission_type = ?').get(req.userId, type) as any;
    
    if (!row) return res.status(404).json({ error: 'Mission state not initialized' });

    let currentLevel = row.level;
    let currentProgress = row.progress;

    if (currentLevel > 5) {
       // max level reached / repeatable level 5
       currentLevel = 5;
    }

    const goal = config.goals[currentLevel - 1];

    if (currentProgress < goal) {
        db.prepare('UPDATE missions_progress SET progress = MIN(progress + ?, ?), updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND mission_type = ?')
          .run(amount, goal, req.userId, type);
    }

    res.json({ success: true, newProgress: Math.min(currentProgress + amount, goal) });
});

apiRouter.post('/missions/claim', authMiddleware, (req: any, res) => {
    const { type } = req.body;
    if (!(type in MISSION_CONFIG)) return res.status(400).json({ error: 'Invalid mission type' });

    const tx = db.transaction(() => {
        const row = db.prepare('SELECT level, progress FROM missions_progress WHERE user_id = ? AND mission_type = ?').get(req.userId, type) as any;
        if (!row) throw new Error('NOT_FOUND');

        const config = MISSION_CONFIG[type as keyof typeof MISSION_CONFIG];
        const realLevel = Math.min(row.level, 5);
        const goal = config.goals[realLevel - 1];
        const reward = config.rewards[realLevel - 1];
        const tickets = config.tickets ? config.tickets[realLevel - 1] : 0;

        if (row.progress < goal) throw new Error('NOT_COMPLETED');

        // Give reward
        db.prepare('UPDATE users SET credits = credits + ?, tickets = tickets + ? WHERE id = ?').run(reward, tickets, req.userId);

        // Move to next level, reset progress
        const nextLevel = Math.min(row.level + 1, 5);
        db.prepare('UPDATE missions_progress SET level = ?, progress = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND mission_type = ?')
          .run(nextLevel, req.userId, type);

        return reward;
    });

    try {
        const reward = tx();
        res.json({ success: true, reward });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});
