
import { sql } from '../api/_db.js';

// Mock normalizeSupplierName and isRevenueTransaction from utils.ts
const normalizeSupplierName = (value) => {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const isRevenueTransaction = (tx) => {
  if (tx.tipo === 'RECEITA') return true;
  if (tx.tipo === 'DESPESA') return false;
  const desc = normalizeSupplierName(tx.descricao ?? '');
  const forn = normalizeSupplierName(tx.fornecedor ?? '');
  const keywords = ['REPASSE', 'MENSALIDADE', 'RECEITA', 'RECEBIMENTO', 'EDUCBANK', 'KROTON', 'REDE FEMENINA', 'PIX RECEBIDO', 'TRANSFERENCIA RECEBIDA'];
  return keywords.some(k => desc.includes(k) || forn.includes(k));
};

async function check() {
  try {
    const samples = await sql`
      SELECT id, fornecedor, descricao, tipo, valor
      FROM transactions
      LIMIT 100
    `;
    
    let greenCount = 0;
    let blueCount = 0;
    let redCount = 0;

    console.log('Testing color logic on 100 samples:');
    samples.forEach(tx => {
      const isRev = isRevenueTransaction(tx);
      let color = '';
      if (tx.valor < 0) color = 'RED (tertiary)';
      else if (isRev) color = 'GREEN (success)';
      else color = 'BLUE (primary)';

      if (color.startsWith('RED')) redCount++;
      if (color.startsWith('GREEN')) greenCount++;
      if (color.startsWith('BLUE')) blueCount++;

      if (isRev && tx.tipo === 'DESPESA') {
        console.log(`BUG? ${tx.fornecedor} | ${tx.descricao} | Tipo: ${tx.tipo} | Color: ${color}`);
      }
    });

    console.log(`\nTotals: Green=${greenCount}, Blue=${blueCount}, Red=${redCount}`);
  } catch (e) {
    console.error(e);
  }
}

check();
