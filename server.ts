import express from 'express';
import path from 'path';
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import { apiRouter } from './server/routes.js';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());

  // API routing
  app.use('/api', apiRouter);

  // Explicit route for assetlinks.json
  app.get('/.well-known/assetlinks.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json([
      {
        "relation": ["delegate_permission/common.handle_all_urls"],
        "target": {
          "namespace": "android_app",
          "package_name": "co.median.android.lpwdoqp",
          "sha256_cert_fingerprints": [
            "10:97:08:37:78:B5:9D:DA:E4:55:CE:FE:4C:F9:46:E9:A5:08:E3:46:54:22:3E:B4:FF:B0:69:6D:A3:F2:13:38"
          ]
        }
      }
    ]);
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
