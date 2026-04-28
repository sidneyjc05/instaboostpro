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

  // Asset links for Android App Link verification
  app.get('/.well-known/assetlinks.json', (req, res) => {
    res.json([
      {
        "relation": [
          "delegate_permission/common.handle_all_urls"
        ],
        "target": {
          "namespace": "android_app",
          "package_name": "co.median.android.xlpqlnd",
          "sha256_cert_fingerprints": [
            "FA:2E:FB:B8:77:BE:22:DF:A4:22:E1:0F:A8:DD:C0:77:3B:B8:05:7A:56:DA:90:9C:DE:13:72:FD:A8:60:90:A4"
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
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
