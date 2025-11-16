import fs from 'fs';
import path from 'path';

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

// Resolve paths relative ao diretório WEB
const webRoot = path.resolve(process.cwd(), 'WEB');
const pattern = /from\s+['"]\.\.\/services\/mockApi['"]/;

scanDir(path.join(webRoot, 'components'), pattern);
scanDir(path.join(webRoot, 'services'), pattern);

console.log('OK: no mockApi imports found.');