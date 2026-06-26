const xlsx = require('xlsx');
const fs = require('fs');

const files = ['./Fluxo de caixa - Grupo CN 2024_2025.xlsx', './fixed_fluxo.xlsx'];

function main() {
  files.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      console.log('File not found:', filePath);
      return;
    }
    console.log(`\nSearching in: ${filePath}...`);
    const buffer = fs.readFileSync(filePath);
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    
    let found = 0;
    workbook.SheetNames.forEach(sheetName => {
      const ws = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(ws, { raw: true });
      
      rows.forEach((row, index) => {
        const rowStr = JSON.stringify(row).toUpperCase();
        if (rowStr.includes('DIPEBRAL')) {
          found++;
          console.log(`[Sheet: ${sheetName}] [Row: ${index + 2}]`, row);
        }
      });
    });
    console.log(`Found ${found} matches for DIPEBRAL in ${filePath}.`);
  });
}

main();
