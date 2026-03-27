const xlsx = require('xlsx');
const fs = require('fs');

const filePath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';

function inspectSheets() {
  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  
  console.log("Abas encontradas e status de processamento:");
  for (const sheetName of workbook.SheetNames) {
    const trimmed = sheetName.trim().toUpperCase();
    const isExcluded = ['CASHFLOW', 'PLANILHA1', 'MANUTENÇAO'].includes(trimmed);
    console.log(`- [${sheetName}] | Trimmed: [${trimmed}] | Processar: ${!isExcluded}`);
  }
}
inspectSheets();
