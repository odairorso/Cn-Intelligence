const { readWorkbook } = require('./lib/xlsx-reader.cjs');
const fs = require('fs');

const filePath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';

async function listSheets() {
  const buffer = fs.readFileSync(filePath);
  const workbook = await readWorkbook(buffer);
  console.log('Sheets names (with brackets to see spaces):');
  workbook.SheetNames.forEach(name => {
    console.log(`[${name}]`);
  });
}
listSheets().catch((error) => {
  console.error(error);
  process.exit(1);
});
