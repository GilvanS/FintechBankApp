const fs = require('fs');
const path = require('path');

const dir = 'F:/GITHUB/FintechBankApp/WEB/components';

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Basic replacements
      content = content.replace(/border-4 border-black/g, 'border border-white/5');
      content = content.replace(/border-2 border-black/g, 'border border-white/5');
      content = content.replace(/border-black/g, 'border-white/5');
      
      // Replace all shadow-[...rgba(0,0,0,1)] variants
      content = content.replace(/shadow-\[[0-9\.]+px_[0-9\.]+px_[0-9\.]+px_[0-9\.]+px_rgba\(0,0,0,1\)\]/g, 'shadow-2xl');
      
      fs.writeFileSync(fullPath, content);
      console.log(`Updated ${file}`);
    }
  }
}

processDirectory(dir);
console.log("Done");
