import xlsxReader from './lib/xlsx-reader.cjs';
const { readWorkbook, sheetToJson } = xlsxReader;
import * as fs from 'fs';

const filePath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';

async function main() {
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }
  const buffer = fs.readFileSync(filePath);
  const workbook = await readWorkbook(buffer);
  
  console.log("Searching for Batistote rows in Excel sheets...");

  workbook.SheetNames.forEach(sheetName => {
    const ws = workbook.Sheets[sheetName];
    const rows = sheetToJson(ws, { raw: true }) as any[];
    
    rows.forEach((row, index) => {
      const rowStr = JSON.stringify(row).toUpperCase();
      if (rowStr.includes('BATISTOTE')) {
        console.log(`[Sheet: ${sheetName}] [Row: ${index + 2}]`, row);
      }
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
