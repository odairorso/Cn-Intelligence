const xlsx = require('xlsx');

const filePath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';

function main() {
  try {
    console.log("Reading file using xlsx.readFile...");
    const workbook = xlsx.readFile(filePath);
    console.log("Sheet names found:", workbook.SheetNames);
    
    workbook.SheetNames.slice(0, 5).forEach(sheetName => {
      console.log(`\n--- Sheet: ${sheetName} ---`);
      const ws = workbook.Sheets[sheetName];
      const sheetMatrix = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });
      console.log("Number of rows:", sheetMatrix.length);
      if (sheetMatrix.length > 0) {
        console.log("Row 1 (Headers?):", sheetMatrix[0].slice(0, 10));
      }
      if (sheetMatrix.length > 1) {
        console.log("Row 2:", sheetMatrix[1].slice(0, 10));
      }
    });
  } catch (err) {
    console.error("Error reading file:", err);
  }
}

main();
