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
      
      let originalContent = content;
      
      // Fix remaining border-2 and border-4 brutalism
      content = content.replace(/border-4 border-[a-zA-Z0-9\-\/]+/g, 'border border-white/5');
      content = content.replace(/border-2 border-[a-zA-Z0-9\-\/]+/g, 'border border-white/5');
      
      // Explicitly for cases where they just used border-4 or border-2 without color
      content = content.replace(/className=\"([^"]*)border-4([^"]*)\"/g, 'className="$1border border-white/5$2"');
      content = content.replace(/className=\"([^"]*)border-2([^"]*)\"/g, 'className="$1border border-white/5$2"');
      
      // Replace Text "Volt"
      content = content.replace(/>Volt</g, '>FintechBank<');
      content = content.replace(/'Volt Shop'/g, "'FintechBank Shop'");
      content = content.replace(/Volt AI/g, 'FintechBank AI');
      content = content.replace(/Volt Hub/g, 'FintechBank Hub');
      content = content.replace(/IA Volt/g, 'IA FintechBank');
      content = content.replace(/Volt Forecast/g, 'FintechBank Forecast');
      
      // Special case in Header.tsx
      if (file === 'Header.tsx') {
         content = content.replace(/getTitle\(\) === 'VOLT'/g, "getTitle() === 'FINTECHBANK'");
         content = content.replace(/return 'VOLT'/g, "return 'FINTECHBANK'");
      }
      
      if (originalContent !== content) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${file}`);
      }
    }
  }
}

processDirectory(dir);
console.log("Done");
