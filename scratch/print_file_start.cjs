const fs = require('fs');
const data = fs.readFileSync('./Fluxo de caixa - Grupo CN 2024_2025.xlsx');
console.log("File size:", data.length);
console.log("Start bytes as hex:", data.subarray(0, 50).toString('hex'));
console.log("Start bytes as text:", data.subarray(0, 200).toString('utf-8'));
