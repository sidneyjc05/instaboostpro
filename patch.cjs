const fs = require('fs');
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

code = code.replace(
    "    // If it's already approved, deliver items\n    if (payData.status === 'approved') {",
    "    // If it's already approved, deliver items\n    const isDirectPix = String(paymentId).startsWith('pix_');\n    const isTokenValid = verificationToken && payData.verificationToken && verificationToken === payData.verificationToken;\n\n    if (payData.status === 'approved' || (isDirectPix && isTokenValid)) {"
);

code = code.replace(
    "verifiedVia: 'approved_sync'",
    "verifiedVia: isDirectPix ? 'token_confirmation' : 'approved_sync'"
);

fs.writeFileSync('src/lib/store.ts', code);
console.log('Patched');
