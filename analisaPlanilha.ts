import * as xlsx from 'xlsx';
import * as fs from 'fs';

const filePath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';

try {
  console.log('Simulando o App.tsx...');
  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  
  let allDataMatrix: any[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const sheetMatrix = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as any[][];
    
    if (sheetMatrix.length < 2) continue;
    
    const headers = sheetMatrix[0].map(h => String(h || '').trim().toUpperCase());
    
    for (let i = 1; i < sheetMatrix.length; i++) {
      const row = sheetMatrix[i];
      if (!row || row.length === 0) continue;
      
      const rowData: any = { _aba_origem: sheetName };
      headers.forEach((header, index) => {
        if (header && row[index] !== undefined && row[index] !== null && row[index] !== '') {
          rowData[header] = row[index];
        }
      });
      allDataMatrix.push(rowData);
    }
  }

  const getRowValue = (row: any, keys: string[]) => {
    for (const key of keys) {
      const foundKey = Object.keys(row).find(rk => rk === key.toUpperCase());
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
        return row[foundKey];
      }
    }
    return undefined;
  };

  const parseValor = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val).replace(/[R$\s]/g, '').trim();
    if (str === '' || str.toUpperCase() === 'TOTAL') return 0;
    if (str.includes(',') && str.includes('.')) {
       return Number(str.replace(/\./g, '').replace(',', '.'));
    } else if (str.includes(',')) {
       return Number(str.replace(',', '.'));
    } else if ((str.match(/\./g) || []).length > 1) {
       return Number(str.replace(/\./g, ''));
    }
    const n = Number(str);
    return isNaN(n) ? 0 : n;
  };

  let totalFinanceiro = 0;
  let totalImported = 0;
  let dateSamples = [];

  for (const row of allDataMatrix) {
    const rawFornecedor = getRowValue(row, ['FORNECEDOR', 'FORNECEDORES', 'FORNECEDOR_NOME', 'NOME', 'FAVORECIDO', 'CLIENTE']);
    if (!rawFornecedor || String(rawFornecedor).toUpperCase().includes('TOTAL')) continue;

    const rawValor = getRowValue(row, ['VALOR', 'VALOR TOTAL', 'TOTAL', 'VALOR_TOTAL', 'QUANTIA', 'PREÇO', 'PRECO', 'SAIDA', 'SAÍDA', 'PAGAMENTO']);
    const sanitizedValor = parseValor(rawValor);
    
    if (sanitizedValor === 0 && !rawValor) continue;
    if (String(rawFornecedor).toUpperCase() === 'FORNECEDOR' || String(rawFornecedor).toUpperCase() === 'CLIENTE') continue;

    const rawVencimento = getRowValue(row, ['VENCIMENTO', 'DATA VENCIMENTO', 'DATA', 'VENC']);
    if (rawVencimento !== undefined && dateSamples.length < 5) {
      dateSamples.push(rawVencimento);
    }

    totalFinanceiro += sanitizedValor;
    totalImported++;
  }

  console.log(`Linhas lidas simulando App: ${totalImported}`);
  console.log(`Total Financeiro: R$ ${totalFinanceiro.toLocaleString('pt-BR')}`);
  console.log('Amostras de Vencimento cru:', dateSamples);

} catch (error) {
  console.error('Erro ao ler a planilha:', error);
}