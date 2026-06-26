import readXlsxFile from 'read-excel-file/node';
import fs from 'fs';

const filePath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';

async function main() {
  try {
    console.log("Reading sheets...");
    // Since read-excel-file/node reads sheets, let's see how to get all sheets
    // To list sheets:
    const sheets = await readXlsxFile(filePath, { getSheets: true });
    console.log("Sheets found:", sheets.map(s => s.name));
    
    for (const sheet of sheets) {
      const rows = await readXlsxFile(filePath, { sheet: sheet.name });
      rows.forEach((row, idx) => {
        const rowStr = JSON.stringify(row).toUpperCase();
        if (rowStr.includes('BATISTOTE')) {
          console.log(`[Sheet: ${sheet.name}] [Row: ${idx + 1}]`, row);
        }
      });
    }
  } catch (err) {
    console.error("Error reading excel:", err);
  }
}

main();
