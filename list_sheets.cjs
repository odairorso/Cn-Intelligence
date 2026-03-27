const xlsx = require('xlsx');
const fs = require('fs');

const filePath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';

function listSheets() {
  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  console.log('Sheets names (with brackets to see spaces):');
  workbook.SheetNames.forEach(name => {
    console.log(`[${name}]`);
  });
}
listSheets();
