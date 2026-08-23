import express from 'express';
import path from 'path';
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { apiRouter } from './server/routes.js';
import { initBackupRoutine } from './server/backup.js';

console.log('API Router imported:', typeof apiRouter);

async function startServer() {
  const app = express();
  
  // Enable proxy trust to accurately detect HTTPS behind Cloud Run/Nginx/Load Balancers
  app.set('trust proxy', 1);

  // Initialize Database Automated Backups
  initBackupRoutine();
  const PORT = 3000;

  // Security Headers & HTTPS Enforcement Middleware
  app.use((req, res, next) => {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers.host;

    // Force HTTPS redirection if accessed over unencrypted HTTP (except on localhost)
    if (proto === 'http' && host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
      return res.redirect(301, `https://${host}${req.url}`);
    }

    // HTTP Strict Transport Security (HSTS) - enforce HTTPS for 1 year including subdomains
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // Content Security Policy (CSP) with upgrade-insecure-requests to prevent Mixed Content
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseio.com https://*.googleapis.com https://sdk.mercadopago.com https://http2.mlstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://api.mercadopago.com https://*.run.app https://api.instagram.com",
      "frame-src 'self' https://*.firebaseapp.com https://*.google.com https://sdk.mercadopago.com https://www.mercadopago.com https://www.mercadopago.com.br",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests"
    ].join('; ');
    res.setHeader('Content-Security-Policy', cspDirectives);

    // Prevent MIME-type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // XSS Protection for legacy browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self "https://sdk.mercadopago.com")');

    next();
  });

  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());

  // Log all requests for debugging
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // API routing
  app.post('/api/auth/login-test', (req, res) => {
    res.json({ ok: true, message: "Test route works" });
  });

  app.all('/api/auth/login', (req, res, next) => {
    console.log(`[LOGIN ATTEMPT] ${req.method} ${req.url}`);
    next();
  });

  app.get('/api/test', (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.use('/api', apiRouter);

  // Catch-all for missing API routes to prevent HTML response
  app.all('/api/*', (req, res) => {
    console.log(`[CATCH-ALL 404] ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Explicit route for assetlinks.json
  app.get('/.well-known/assetlinks.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(Buffer.from(JSON.stringify([
      {
        "relation": ["delegate_permission/common.handle_all_urls"],
        "target": {
          "namespace": "android_app",
          "package_name": "co.median.android.yezmykd",
          "sha256_cert_fingerprints": [
            "8F:85:92:F0:37:7D:5B:1F:F9:97:22:8F:DF:D4:14:43:3B:25:DC:5E:15:9F:F0:44:C3:04:F4:26:5D:BE:B3:63"
          ]
        }
      }
    ], null, 2), 'utf8'));
  });

  // Vite Integration
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { dotfiles: 'allow' }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('SERVER ERROR:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("FAILED TO START SERVER:", err);
  process.exit(1);
});
