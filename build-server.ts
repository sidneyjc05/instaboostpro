import { build } from 'esbuild';

build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/server.cjs',
  format: 'cjs',
  external: [
    'express', 
    'better-sqlite3', 
    'bcryptjs', 
    'jsonwebtoken', 
    'cookie-parser', 
    'zod', 
    'qrcode',
    'mercadopago'
  ],
}).catch(() => process.exit(1));
