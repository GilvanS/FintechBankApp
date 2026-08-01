const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', '..', 'docs', 'REGRAS-NEGOCIO-FATURA.md');
const md = fs.readFileSync(filePath, 'utf-8');

// 1. Extract all (#slug) links
const anchorRefs = new Set();
const linkRegex = /\]\(#([^)]+)\)/g;
let match;
while ((match = linkRegex.exec(md)) !== null) {
  anchorRefs.add(match[1]);
}

// 2. Extract all headings
const headings = [];
const headingRegex = /^(#{1,6})\s+(.+)$/gm;
while ((match = headingRegex.exec(md)) !== null) {
  const level = match[1].length;
  const text = match[2].trim();
  headings.push({ level, text });
}

// 3. Generate GitHub-style slugs
function githubSlug(text) {
  let slug = text.toLowerCase();
  // Remove markdown formatting
  slug = slug.replace(/[*`_~]/g, '');
  // Remove non-word chars (keep unicode letters, spaces, hyphens)
  // \u00C0-\u024F covers accented Latin chars
  slug = slug.replace(/[^a-z0-9\u00C0-\u024F\s-]/g, '');
  // Replace spaces with hyphens
  slug = slug.replace(/\s+/g, '-');
  // Collapse consecutive hyphens
  slug = slug.replace(/-+/g, '-');
  // Remove leading/trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');
  return slug;
}

const headingSlugs = new Map();
const headingInfo = [];
for (const h of headings) {
  const slug = githubSlug(h.text);
  headingSlugs.set(slug, h.text);
  headingInfo.push({ text: h.text, slug, level: h.level });
}

// 4. Compare
console.log('');
console.log('=== VALIDACAO DE ANCORAS INTRA-DOC ===');
console.log('='.repeat(55));
console.log('');
console.log('Total de links # encontrados:', anchorRefs.size);
console.log('Total de headings encontrados:', headings.length);

const notFound = [];
for (const ref of anchorRefs) {
  if (!headingSlugs.has(ref)) {
    notFound.push(ref);
  }
}

let allOk = true;
if (notFound.length === 0) {
  console.log('\nTODAS as ancoras correspondem a headings existentes!\n');
} else {
  allOk = false;
  console.log('\nANCORAS QUE NAO CORRESPONDEM A NENHUM HEADING:');
  console.log('-'.repeat(50));
  for (const ref of notFound) {
    const similar = headingInfo
      .filter(h => h.slug.includes(ref) || ref.includes(h.slug))
      .slice(0, 3)
      .map(h => `  "${h.slug}" (heading: "${h.text.substring(0, 50)}")`);
    console.log(`  "${ref}"`);
    if (similar.length > 0) {
      console.log('    Sugestoes proximas:');
      similar.forEach(s => console.log(s));
    }
    console.log('');
  }
}

// 5. Complete map
console.log('='.repeat(55));
console.log('MAPA COMPLETO DE ANCORAS');
console.log('='.repeat(55));
for (const ref of [...anchorRefs].sort()) {
  const h = headingInfo.find(i => i.slug === ref);
  if (h) {
    console.log(`  OK  ${ref.padEnd(60)}  <-  "${h.text.substring(0, 50)}"`);
  } else {
    console.log(`  BAD ${ref.padEnd(60)}  <-  (heading nao encontrado!)`);
  }
}

console.log('\n=== RESUMO ===');
console.log('Links OK:  ', anchorRefs.size - notFound.length);
console.log('Links BAD: ', notFound.length);
console.log(allOk ? '\nDocumento consistente!' : '\nDocumento com ancoras quebradas!');
process.exit(allOk ? 0 : 1);
