const fs = require('fs');
const readXlsxFile = require('read-excel-file/node');

const inputPath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';
const outputPath = './fixed_fluxo.xlsx';

async function main() {
  try {
    const data = fs.readFileSync(inputPath);
    // Strip first 2 bytes if they are "ag" (0x61, 0x67)
    if (data[0] === 0x61 && data[1] === 0x67) {
      console.log("Found 'ag' prefix. Stripping first 2 bytes...");
      const fixedData = data.subarray(2);
      fs.writeFileSync(outputPath, fixedData);
      console.log(`Saved fixed file to ${outputPath}`);
      
      const sheets = await readXlsxFile(outputPath, { getSheets: true });
      console.log("Successfully read fixed file. Sheets:", sheets.map(s => s.name));
    } else {
      console.log("First 2 bytes are not 'ag'. No correction needed.");
    }
  } catch (err) {
    console.error("Error during signature fix:", err);
  }
}

main();
