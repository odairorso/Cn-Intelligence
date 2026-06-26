import fs from 'fs';
import path from 'path';

function walk(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath);
    } else {
      if (filePath.endsWith('.js')) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('sql.join') || content.includes('transactions-batch')) {
          console.log(`Found in: ${filePath}`);
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.includes('sql.join') || line.includes('transactions-batch')) {
              console.log(`  Line ${idx + 1}: ${line.trim()}`);
            }
          });
        }
      }
    }
  });
}

walk('api');
