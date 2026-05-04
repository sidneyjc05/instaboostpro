const fs = require('fs');
const lines = fs.readFileSync('server/routes.ts', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('// --- CREDIT CARD ROUTES ---'));
if (idx !== -1) {
    fs.writeFileSync('server/routes.ts', lines.slice(0, idx).join('\n'));
}
