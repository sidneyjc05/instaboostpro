const fs = require('fs');
let code = fs.readFileSync('server/routes.ts', 'utf8');
code = code.replace(/datetime\("now"/g, "datetime('now'");
fs.writeFileSync('server/routes.ts', code);
