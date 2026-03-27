const xlsx = require('xlsx');
const fs = require('fs');

const filePath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';

const getRowValue = (row, keys) => {
    for (const key of keys) {
      const foundKey = Object.keys(row).find(rk => rk === key.toUpperCase());
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
        return row[foundKey];
      }
    }
    return undefined;
};

function testImportLogic() {
  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  
  const sheetName = 'Janeiro 26';
  console.log(`Testando aba: ${sheetName}`);
  const worksheet = workbook.Sheets[sheetName];
  const sheetMatrix = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: true });
  
  console.log(`Total de linhas na matriz: ${sheetMatrix.length}`);
  if (sheetMatrix.length < 2) return;
  
  const headers = sheetMatrix[0].map(h => String(h || '').trim().toUpperCase());
  console.log('Headers:', headers);
  
  let count = 0;
  let matches = 0;
  
  for (let i = 1; i < sheetMatrix.length; i++) {
    const row = sheetMatrix[i];
    const rowData = {};
    headers.forEach((header, index) => {
      if (header) rowData[header] = row[index];
    });
    
    const rawFornecedor = getRowValue(rowData, ['FORNECEDOR', 'FORNECEDORES', 'FORNECEDOR_NOME', 'NOME', 'FAVORECIDO', 'CLIENTE']);
    if (!rawFornecedor || String(rawFornecedor).toUpperCase().includes('TOTAL')) continue;
    
    count++;
    if (String(rawFornecedor).includes('Anhanguera')) {
      matches++;
    }
  }
  
  console.log(`Linhas válidas encontradas: ${count}`);
  console.log(`Linhas para 'Anhanguera': ${matches}`);
}
testImportLogic();
