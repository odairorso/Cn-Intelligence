const fs = require('fs');
const path = require('path');

const keywords = ['password', 'secret', 'token', 'key'];
const dir = path.join(__dirname, '..', 'api');

function scanDir(currentDir) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        scanDir(fullPath);
      }
    } else if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.ts'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        keywords.forEach(kw => {
          if (line.toLowerCase().includes(kw) && line.includes('=') && !line.includes('process.env')) {
            // Filter out common code declarations
            if (!line.includes('const ') && !line.includes('let ') && !line.includes('export ')) return;
            if (line.includes('schema') || line.includes('Schema') || line.includes('verifyToken') || line.includes('jwt')) return;
            console.log(`[FOUND] ${path.relative(dir, fullPath)}:${index + 1} - ${line.trim()}`);
          }
        });
      });
    }
  }
}

console.log("=== Scanning for hardcoded secrets ===");
scanDir(dir);
