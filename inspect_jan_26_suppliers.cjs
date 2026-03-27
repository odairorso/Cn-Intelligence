const xlsx = require('xlsx');
const fs = require('fs');

const filePath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';

function inspectJan26Fornecedores() {
  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const worksheet = workbook.Sheets['Janeiro 26'];
  const sheetMatrix = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: true });
  
  const headers = sheetMatrix[0].map(h => String(h || '').trim().toUpperCase());
  const fIndex = headers.indexOf('FORNECEDOR');
  
  const foundNames = new Set();
  for (let i = 1; i < sheetMatrix.length; i++) {
    const row = sheetMatrix[i];
    if (row && row[fIndex]) {
        foundNames.add(String(row[fIndex]).trim());
    }
  }
  
  console.log("Fornecedores na aba Janeiro 26 (Amostra):");
  Array.from(foundNames).slice(0, 100).forEach(name => {
      if (name.toLowerCase().includes('anhanguera')) {
          console.log(` MATCH: [${name}]`);
      } else {
          // console.log(`  Other: [${name}]`);
      }
  });
  
  if (Array.from(foundNames).some(n => n.toLowerCase().includes('anhanguera'))) {
      console.log("ANHANGUERA ENCONTRADA NA PLANILHA!");
  } else {
      console.log("ANHANGUERA NÃO ENCONTRADA NESSA ABA!");
  }
}
inspectJan26Fornecedores();
