const fs = require('fs');
let t = fs.readFileSync('components/CardDashboard.tsx', 'utf8');
t = t.replace(/\\'/g, "'");
t = t.replace(/\\`/g, "`");
fs.writeFileSync('components/CardDashboard.tsx', t);