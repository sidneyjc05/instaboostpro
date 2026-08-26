const fs = require('fs');
let code = fs.readFileSync('server/routes.ts', 'utf8');

code = code.replace(
    "notification_url: 'https://ais-pre-tconxsfpyuznwzskpbmftf-186769099699.us-west2.run.app/api/webhook/mercadopago'",
    "notification_url: `${req.headers.origin || 'https://' + req.headers.host}/api/webhook/mercadopago`"
);

code = code.replace(
    "notification_url: 'https://ais-pre-tconxsfpyuznwzskpbmftf-186769099699.us-west2.run.app/api/webhook/mercadopago'",
    "notification_url: `${req.headers.origin || 'https://' + req.headers.host}/api/webhook/mercadopago`"
);

fs.writeFileSync('server/routes.ts', code);
console.log('Patched routes');
