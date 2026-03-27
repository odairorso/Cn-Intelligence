const xlsx = require('xlsx');
const fs = require('fs');

const filePath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';

function inspectJan26Rows() {
  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const worksheet = workbook.Sheets['Janeiro 26'];
  const sheetMatrix = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: true });
  
  if (!sheetMatrix || sheetMatrix.length === 0) { console.log("Empty sheet"); return; }
  
  const headers = sheetMatrix[0].map(h => String(h || '').trim().toUpperCase());
  const vIndex = headers.indexOf('VENCIMENTO');
  
  console.log(`Headers found: ${headers.join(', ')}`);
  console.log(`Vencimento Index: ${vIndex}`);
  
  for (let i = 1; i < Math.min(sheetMatrix.length, 50); i++) {
    const row = sheetMatrix[i];
    console.log(`Row ${i}: [${row[vIndex]}] type: ${typeof row[vIndex]}`);
  }
}
inspectJan26Rows();
