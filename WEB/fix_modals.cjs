const fs = require('fs');
const path = require('path');

const modals = [
  'PixModal.tsx',
  'DepositModal.tsx',
  'BiometricModal.tsx',
  'CardDashboard.tsx',
  'CardsView.tsx'
];

modals.forEach(file => {
  const filePath = path.join('F:/GITHUB/FintechBankApp/WEB/components', file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix hardcoded colors to use volt- tokens for the theme
    content = content.replace(/bg-\[#0a0a0a\]/g, 'bg-volt-surface');
    content = content.replace(/bg-\[#111111\]/g, 'bg-white/5');
    content = content.replace(/bg-\[#111\]/g, 'bg-white/5');
    content = content.replace(/bg-\[#1a1a1a\]/g, 'bg-white/10');
    content = content.replace(/border-\[#222\]/g, 'border-white/10');
    content = content.replace(/border-\[#333\]/g, 'border-white/20');
    content = content.replace(/text-\[#888\]/g, 'text-on-surface-variant');
    content = content.replace(/text-\[#00ff9d\]/g, 'text-volt-green');
    content = content.replace(/bg-\[#00ff9d\]/g, 'bg-volt-green');
    content = content.replace(/border-\[#00ff9d\]/g, 'border-volt-green');
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${file}`);
  }
});
