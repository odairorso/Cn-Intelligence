const xlsx = require('xlsx');
const fs = require('fs');

const filePath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';

function countJan26Anhanguera() {
  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const worksheet = workbook.Sheets['Janeiro 26'];
  const sheetMatrix = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: true });
  
  const headers = sheetMatrix[0].map(h => String(h || '').trim().toUpperCase());
  const fIndex = headers.indexOf('FORNECEDOR');
  
  let count = 0;
  for (let i = 1; i < sheetMatrix.length; i++) {
    const row = sheetMatrix[i];
    if (row && row[fIndex] && String(row[fIndex]).includes('Anhanguera')) {
        count++;
    }
  }
  
  console.log(`Linhas de Anhanguera em Janeiro 26: ${count}`);
}
countJan26Anhanguera();
