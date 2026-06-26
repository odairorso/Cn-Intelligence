import fs from 'fs';

const content = fs.readFileSync('src/tabs/LancamentosTab.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('text-tertiary') || line.includes('text-primary') || line.includes('tx.valor')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
