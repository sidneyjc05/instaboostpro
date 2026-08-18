import express from 'express';
import path from 'path';
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { apiRouter } from './server/routes.js';

console.log('API Router imported:', typeof apiRouter);

async function startServer() {
  const app = express();
  const PORT = 3000;

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
