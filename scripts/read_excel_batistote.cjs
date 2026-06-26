const xlsx = require('xlsx');
const fs = require('fs');

const filePath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';

function main() {
  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  
  console.log("Searching for Batistote rows in Excel sheets...");

  workbook.SheetNames.forEach(sheetName => {
    const ws = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { raw: true });
    
    rows.forEach((row, index) => {
      const rowStr = JSON.stringify(row).toUpperCase();
      if (rowStr.includes('BATISTOTE')) {
        console.log(`[Sheet: ${sheetName}] [Row: ${index + 2}]`, row);
      }
    });
  });
}

main();
