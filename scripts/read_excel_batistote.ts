import * as xlsx from 'xlsx';
import * as fs from 'fs';

const filePath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';

function main() {
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }
  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  
  console.log("Searching for Batistote rows in Excel sheets...");

  workbook.SheetNames.forEach(sheetName => {
    const ws = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { raw: true }) as any[];
    
    rows.forEach((row, index) => {
      const rowStr = JSON.stringify(row).toUpperCase();
      if (rowStr.includes('BATISTOTE')) {
        console.log(`[Sheet: ${sheetName}] [Row: ${index + 2}]`, row);
      }
    });
  });
}

main();
