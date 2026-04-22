const fs = require('fs');
let code = fs.readFileSync('server/routes.ts', 'utf8');
code = code.replace(/datetime\('now'/g, `datetime('now'`); // wait, no.

code = code.replace(
  /'INSERT INTO verification_codes \(user_id, code, expires_at\) VALUES \(\?, \?, datetime\('now', "\+15 minutes"\)\)'/g,
  "`INSERT INTO verification_codes (user_id, code, expires_at) VALUES (?, ?, datetime('now', '+15 minutes'))`"
);

code = code.replace(
  /'SELECT id FROM verification_codes WHERE user_id = \? AND code = \? AND expires_at > datetime\('now'\)'/g,
  "`SELECT id FROM verification_codes WHERE user_id = ? AND code = ? AND expires_at > datetime('now')`"
);

fs.writeFileSync('server/routes.ts', code);
