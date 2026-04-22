const fs = require('fs');

const content = fs.readFileSync('src/pages/Profile.tsx', 'utf8');
const lines = content.split('\n');

for (let i = 460; i < 470; i++) {
  console.log(i + ": " + JSON.stringify(lines[i]));
}
