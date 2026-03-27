import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'c:\\Users\\Financeiro\\Documents\\Fluxo de caixa - Grupo CN 2024_2025\\Fluxo de caixa - Grupo CN 2024_2025.xlsx';

function excelDateToJS(serial) {
  if (typeof serial !== 'number') return String(serial);
  const utc_days  = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return date_info.toLocaleDateString('pt-BR');
}

const results = [];

try {
  const workbook = XLSX.readFile(filePath);
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    if (data.length > 0) {
      results.push(`\n=== ABA: ${sheetName} (Colunas: ${Object.keys(data[0]).join(', ')}) ===`);
      
      const filtered = data.filter(row => {
        const rowStr = JSON.stringify(row).toLowerCase();
        return rowStr.includes('editora') && rowStr.includes('anhanguera');
      });
      
      filtered.forEach((row, i) => {
        const keys = Object.keys(row);
        const vencKey = keys.find(k => k.toLowerCase().includes('venc') || k.toLowerCase().includes('data'));
        const valorKey = keys.find(k => k.toLowerCase().includes('valor'));
        const forneceKey = keys.find(k => k.toLowerCase().includes('fornece'));
        const empresaKey = keys.find(k => k.toLowerCase().includes('empresa'));
        
        const vRaw = row[vencKey];
        const vFormated = (typeof vRaw === 'number') ? excelDateToJS(vRaw) : vRaw;
        
        results.push(`[Linha ${i}] FORN: ${row[forneceKey]} | VENC: ${vFormated} | VALOR: ${row[valorKey]} | EMPRESA: ${row[empresaKey]}`);
      });
    }
  });
  
  fs.writeFileSync('excel_analysis.txt', results.join('\n'));
  console.log('Análise salva em excel_analysis.txt');
} catch (error) {
  console.error('Erro:', error.message);
}
