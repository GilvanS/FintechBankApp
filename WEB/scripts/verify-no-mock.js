const fs = require('fs');
const path = require('path');

function scanDir(dir, pattern) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            scanDir(full, pattern);
        } else if (e.isFile()) {
            const text = fs.readFileSync(full, 'utf8');
            if (pattern.test(text)) {
                console.error(`Mock API usage detected in: ${full}`);
                process.exit(1);
            }
        }
    }
}

const root = path.join(__dirname, '..');
const pattern = /from\s+['"]\.\.\/services\/mockApi['"]/;
scanDir(path.join(root, 'components'), pattern);
scanDir(path.join(root, 'services'), pattern);
console.log('OK: no mockApi imports found.');