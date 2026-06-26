const fs = require('fs');

try {
  const fd = fs.openSync('./Fluxo de caixa - Grupo CN 2024_2025.xlsx', 'r');
  const buffer = Buffer.alloc(100);
  fs.readSync(fd, buffer, 0, 100, 0);
  console.log("File starts with:");
  console.log(buffer.toString('utf8'));
  console.log("Hex:", buffer.toString('hex').slice(0, 40));
  fs.closeSync(fd);
} catch (err) {
  console.error(err);
}
