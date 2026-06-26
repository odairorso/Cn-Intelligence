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

function testAppImportLogic() {
  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  
  let totalRows = 0;
  let anhangueraRows = 0;
  
  for (const sheetName of workbook.SheetNames) {
    if (['CASHFLOW', 'PLANILHA1', 'MANUTENÇAO'].includes(sheetName.trim().toUpperCase())) continue;

    const worksheet = workbook.Sheets[sheetName];
    const sheetMatrix = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: true });
    
    if (sheetMatrix.length < 1) continue;
    
    const firstRowUpper = sheetMatrix[0].map(h => String(h || '').trim().toUpperCase());
    const KNOWN_COLS = ['FORNECEDOR','FORNECEDORES','NOME','FAVORECIDO','CLIENTE','VALOR','VENCIMENTO','DATA','PAGAMENTO','SITUAÇÃO','SITUACAO'];
    const hasStandardHeader = firstRowUpper.some(h => KNOWN_COLS.includes(h));

    if (hasStandardHeader) {
      const headers = firstRowUpper;
      for (let i = 1; i < sheetMatrix.length; i++) {
        const row = sheetMatrix[i];
        if (!row || row.length === 0) continue;
        const rowData = {};
        headers.forEach((header, index) => {
          if (header && row[index] !== undefined) rowData[header] = row[index];
        });
        
        const rawFornecedor = getRowValue(rowData, ['FORNECEDOR', 'FORNECEDORES', 'FORNECEDOR_NOME', 'NOME', 'FAVORECIDO', 'CLIENTE']);
        if (!rawFornecedor || String(rawFornecedor).toUpperCase().includes('TOTAL')) continue;
        
        totalRows++;
        if (String(rawFornecedor).includes('Anhanguera')) anhangueraRows++;
      }
    }
  }
  
  console.log(`Total de linhas que seriam importadas: ${totalRows}`);
  console.log(`Linhas para 'Anhanguera': ${anhangueraRows}`);
}
testAppImportLogic();
