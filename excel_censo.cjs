const xlsx = require('xlsx');
const fs = require('fs');

const filePath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';

const isDateSerial = (v) => typeof v === 'number' && v > 40000 && v < 60000;

const parseDateYear = (val) => {
    if (val instanceof Date) return val.getUTCFullYear();
    if (typeof val === 'number') {
        const excelEpoch = Date.UTC(1899, 11, 30);
        const dt = new Date(excelEpoch + val * 24 * 60 * 60 * 1000);
        return dt.getUTCFullYear();
    }
    if (typeof val === 'string' && val.includes('/')) {
        const parts = val.split('/');
        if (parts.length === 3) {
            let y = parts[2];
            if (y.length === 2) y = '20' + y;
            return Number(y);
        }
    }
    return null;
};

function excelCenso() {
  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  
  const years = {};
  
  for (const sheetName of workbook.SheetNames) {
    if (['CASHFLOW', 'PLANILHA1', 'MANUTENÇAO'].includes(sheetName.trim().toUpperCase())) continue;
    const worksheet = workbook.Sheets[sheetName];
    const sheetMatrix = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: true });
    if (sheetMatrix.length < 1) continue;
    const headers = sheetMatrix[0].map(h => String(h || '').trim().toUpperCase());
    const vIndex = headers.indexOf('VENCIMENTO');
    const fIndex = headers.indexOf('FORNECEDOR');
    
    if (vIndex === -1 || fIndex === -1) continue;
    
    for (let i = 1; i < sheetMatrix.length; i++) {
        const row = sheetMatrix[i];
        if (!row || !row[fIndex]) continue;
        const year = parseDateYear(row[vIndex]);
        if (year) {
            years[year] = (years[year] || 0) + 1;
        }
    }
  }
  
  console.log("Censo Excel (Linhas com Vencimento e Fornecedor):");
  Object.keys(years).sort().forEach(y => {
      console.log(`  ${y}: ${years[y]}`);
  });
}
excelCenso();
