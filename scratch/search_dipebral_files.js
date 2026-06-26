import fs from 'fs';
import path from 'path';

const keyword = 'DIPEBRAL';
const rootDir = '.';

function walk(dir, callback) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    if (filePath.includes('node_modules') || filePath.includes('.git') || filePath.includes('.vercel') || filePath.includes('dist')) {
      return;
    }
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath, callback);
    } else {
      callback(filePath);
    }
  });
}

console.log(`Searching for files containing "${keyword}"...`);
walk(rootDir, (filePath) => {
  try {
    // Only read text files
    if (filePath.endsWith('.js') || filePath.endsWith('.json') || filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.sql') || filePath.endsWith('.html') || filePath.endsWith('.md')) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.toUpperCase().includes(keyword)) {
        console.log(`Found in: ${filePath}`);
      }
    }
  } catch (e) {
    // ignore
  }
});
