const xlsx = require('xlsx');
const fs = require('fs');

const filePath = './fixed_fluxo.xlsx';

function main() {
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }
  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  
  console.log("Searching for Batistote rows in fixed_fluxo.xlsx...");
  
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
