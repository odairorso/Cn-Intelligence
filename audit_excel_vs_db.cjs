const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { Pool } = require('pg');
require('dotenv').config();

const filePath = path.join(__dirname, 'Fluxo de caixa - Grupo CN 2024_2025.xlsx');

const EXCLUDED_SHEETS = new Set(['CASHFLOW', 'PLANILHA1', 'MANUTENÇAO']);
const KNOWN_COLS = ['FORNECEDOR', 'FORNECEDORES', 'NOME', 'FAVORECIDO', 'CLIENTE', 'VALOR', 'VENCIMENTO', 'DATA', 'PAGAMENTO', 'SITUAÇÃO', 'SITUACAO'];

const getRowValue = (row, keys) => {
  for (const key of keys) {
    const foundKey = Object.keys(row).find((rk) => rk === key.toUpperCase());
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
      return row[foundKey];
    }
  }
  return undefined;
};

const excelDateToIso = (serial) => {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const month = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateInfo.getUTCDate()).padStart(2, '0');
  const year = dateInfo.getUTCFullYear();
  return `${year}-${month}-${day}`;
};

const normalizeDate = (value) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number' && value > 40000 && value < 70000) return excelDateToIso(value);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);

  const str = String(value).trim();
  const br = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return str;
  return str;
};

const parseValor = (value) => {
  if (typeof value === 'number') return value;
  if (value === undefined || value === null || value === '') return 0;
  const str = String(value).replace(/[R$\s]/g, '').trim();
  if (!str || str.toUpperCase() === 'TOTAL' || str === '-') return 0;

  if (str.includes(',') && str.includes('.')) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) return Number(str.replace(/\./g, '').replace(',', '.'));
    return Number(str.replace(/,/g, ''));
  }

  if (str.includes(',')) return Number(str.replace(',', '.'));
  if ((str.match(/\./g) || []).length > 1) return Number(str.replace(/\./g, ''));

  const parsed = Number(str);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const readExcelRows = () => {
  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  const rows = [];

  for (const sheetName of workbook.SheetNames) {
    if (EXCLUDED_SHEETS.has(sheetName.trim().toUpperCase())) continue;
    const worksheet = workbook.Sheets[sheetName];
    const sheetMatrix = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: true });
    if (!sheetMatrix.length) continue;

    const firstRowUpper = sheetMatrix[0].map((h) => String(h || '').trim().toUpperCase());
    const hasStandardHeader = firstRowUpper.some((h) => KNOWN_COLS.includes(h));
    if (!hasStandardHeader) continue;

    for (let i = 1; i < sheetMatrix.length; i++) {
      const row = sheetMatrix[i];
      if (!row || row.length === 0) continue;

      const rowData = {};
      firstRowUpper.forEach((header, index) => {
        if (header && row[index] !== undefined && row[index] !== null && row[index] !== '') rowData[header] = row[index];
      });

      const fornecedor = String(getRowValue(rowData, ['FORNECEDOR', 'FORNECEDORES', 'NOME', 'FAVORECIDO', 'CLIENTE']) || '').trim();
      const empresa = String(getRowValue(rowData, ['EMPRESA', 'OBS 2', 'UNIDADE']) || '').trim() || 'CN';
      const vencimento = normalizeDate(getRowValue(rowData, ['VENCIMENTO', 'DATA']));
      const valor = parseValor(getRowValue(rowData, ['VALOR']));

      if (!fornecedor || fornecedor.toUpperCase().includes('TOTAL')) continue;
      if (!valor) continue;

      rows.push({
        fornecedor,
        empresa,
        vencimento,
        valor: Number(valor.toFixed(2)),
        sheetName,
      });
    }
  }

  return rows;
};

const buildSummary = (rows) => {
  const total = rows.reduce((sum, row) => sum + row.valor, 0);
  const highValues = rows.filter((row) => row.valor > 500000).sort((a, b) => b.valor - a.valor);
  const grouped = new Map();

  for (const row of rows) {
    const key = [row.fornecedor, row.empresa, row.vencimento, row.valor.toFixed(2)].join('|');
    grouped.set(key, (grouped.get(key) || 0) + 1);
  }

  const duplicates = Array.from(grouped.entries())
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);

  return { count: rows.length, total, highValues, duplicates };
};

async function main() {
  const excelRows = readExcelRows();
  const excelSummary = buildSummary(excelRows);

  console.log('=== EXCEL ===');
  console.log('Registros:', excelSummary.count);
  console.log('Total:', excelSummary.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  console.log('Altos (>500k):', excelSummary.highValues.length);
  excelSummary.highValues.slice(0, 10).forEach((row) => {
    console.log(`  ${row.fornecedor} | ${row.empresa} | ${row.vencimento} | R$ ${row.valor.toLocaleString('pt-BR')}`);
  });
  console.log('Duplicados no Excel:', excelSummary.duplicates.length);
  excelSummary.duplicates.slice(0, 10).forEach((item) => {
    console.log(`  ${item.count}x | ${item.key}`);
  });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query(`
      SELECT fornecedor, COALESCE(empresa, 'CN') AS empresa, vencimento::text AS vencimento, valor::numeric AS valor
      FROM transactions
      ORDER BY fornecedor
    `);

    const dbRows = result.rows.map((row) => ({
      fornecedor: String(row.fornecedor || '').trim(),
      empresa: String(row.empresa || 'CN').trim(),
      vencimento: String(row.vencimento || '').slice(0, 10),
      valor: Number(Number(row.valor).toFixed(2)),
    }));

    const dbSummary = buildSummary(dbRows);
    console.log('\n=== BANCO ===');
    console.log('Registros:', dbSummary.count);
    console.log('Total:', dbSummary.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    console.log('Altos (>500k):', dbSummary.highValues.length);
    dbSummary.highValues.slice(0, 10).forEach((row) => {
      console.log(`  ${row.fornecedor} | ${row.empresa} | ${row.vencimento} | R$ ${row.valor.toLocaleString('pt-BR')}`);
    });
    console.log('Duplicados no banco:', dbSummary.duplicates.length);
    dbSummary.duplicates.slice(0, 20).forEach((item) => {
      console.log(`  ${item.count}x | ${item.key}`);
    });

    const excelSet = new Set(excelRows.map((row) => [row.fornecedor, row.empresa, row.vencimento, row.valor.toFixed(2)].join('|')));
    const dbOnly = dbRows
      .filter((row) => !excelSet.has([row.fornecedor, row.empresa, row.vencimento, row.valor.toFixed(2)].join('|')))
      .sort((a, b) => b.valor - a.valor);

    console.log('\n=== SOMENTE NO BANCO ===');
    console.log('Quantidade:', dbOnly.length);
    dbOnly.slice(0, 30).forEach((row) => {
      console.log(`  ${row.fornecedor} | ${row.empresa} | ${row.vencimento} | R$ ${row.valor.toLocaleString('pt-BR')}`);
    });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
