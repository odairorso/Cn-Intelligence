import { config } from 'dotenv';
import pg from 'pg';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Mock client-side helpers
const toDisplayDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

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
  if (typeof tx.valor === 'number' && tx.valor < 0) return false;

  const tipo = String(tx.tipo || '').toUpperCase();
  if (tipo === 'RECEITA') return true;
  if (tipo === 'DESPESA') return false;

  const desc = normalizeSupplierName(tx.descricao ?? '');
  const forn = normalizeSupplierName(tx.fornecedor ?? '');

  const revenueKeywords = [
    'MENSALIDADE', 
    'REPASSE', 
    'RECEBIMENTO', 
    'EDUCBANK', 
    'KROTON', 
    'REDE FEMENINA', 
    'PIX RECEBIDO', 
    'TRANSFERENCIA RECEBIDA',
    'APLICACAO FINANCEIRA'
  ];
  
  const expenseKeywords = [
    'RECEITA FEDERAL',
    'SIMPLES NACIONAL',
    'DARF',
    'GPS',
    'FGTS',
    'PAGAMENTO',
    'COMPRA',
    'SERVICO',
    'FORNECEDOR'
  ];

  if (expenseKeywords.some(k => desc.includes(k) || forn.includes(k))) return false;

  return revenueKeywords.some(k => desc.includes(k) || forn.includes(k));
};

// Simulate backend getTransactions API
async function getTransactions(limit, offset, tipo) {
  let query = `SELECT * FROM transactions WHERE deleted_at IS NULL`;
  const params = [];
  let paramIdx = 1;
  
  if (tipo) {
    query += ` AND tipo = $${paramIdx++}`;
    params.push(tipo);
  }
  
  query += ` ORDER BY vencimento DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
  params.push(limit, offset);
  
  const res = await pool.query(query, params);
  return res.rows.map(tx => ({
    ...tx,
    vencimento: tx.vencimento ? new Date(tx.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '',
    pagamento: tx.pagamento ? new Date(tx.pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined,
    valor: Number(tx.valor),
    juros: Number(tx.juros || 0),
  }));
}

async function run() {
  try {
    const MIN_YEAR = 2024;
    const limit = 2000;

    // --- MODE 1: OLD FRONTEND (Fetch all, then filter) ---
    console.log("Simulating OLD frontend fetching...");
    let offset1 = 0;
    const acc1 = [];
    for (;;) {
      const page = await getTransactions(limit, offset1, undefined);
      if (!page || page.length === 0) break;
      
      const normalized = page.map((tx) => ({
        ...tx,
        valor: Number(tx.valor) || 0,
        juros: Number(tx.juros) || 0,
        vencimento: toDisplayDate(tx.vencimento),
        pagamento: tx.pagamento ? toDisplayDate(tx.pagamento) : undefined,
      }));
      acc1.push(...normalized);
      offset1 += page.length;

      const last = normalized[normalized.length - 1];
      const parts = last?.vencimento?.includes('/') ? last.vencimento.split('/') : last?.vencimento?.split('-');
      const lastYear = last?.vencimento?.includes('/') ? parts?.[2] : parts?.[0];
      if (lastYear && Number(lastYear) < MIN_YEAR) break;
      if (page.length < limit) break;
    }

    const since1 = acc1.filter((tx) => {
      const parts = tx.vencimento.includes('/') ? tx.vencimento.split('/') : tx.vencimento.split('-');
      const year = tx.vencimento.includes('/') ? parts[2] : parts[0];
      const y = Number(year);
      return !Number.isFinite(y) || y >= MIN_YEAR;
    });

    const oldRevenues = since1.filter(tx => isRevenueTransaction(tx));
    const oldTotal = oldRevenues.reduce((sum, tx) => sum + tx.valor, 0);
    console.log(`OLD: Found ${oldRevenues.length} revenues, Total value: R$ ${oldTotal.toLocaleString('pt-BR')}`);

    // --- MODE 2: NEW FRONTEND (Fetch only RECEITA, then filter) ---
    console.log("\nSimulating NEW frontend fetching...");
    let offset2 = 0;
    const acc2 = [];
    for (;;) {
      const page = await getTransactions(limit, offset2, 'RECEITA');
      if (!page || page.length === 0) break;
      
      const normalized = page.map((tx) => ({
        ...tx,
        valor: Number(tx.valor) || 0,
        juros: Number(tx.juros) || 0,
        vencimento: toDisplayDate(tx.vencimento),
        pagamento: tx.pagamento ? toDisplayDate(tx.pagamento) : undefined,
      }));
      acc2.push(...normalized);
      offset2 += page.length;

      const last = normalized[normalized.length - 1];
      const parts = last?.vencimento?.includes('/') ? last.vencimento.split('/') : last?.vencimento?.split('-');
      const lastYear = last?.vencimento?.includes('/') ? parts?.[2] : parts?.[0];
      if (lastYear && Number(lastYear) < MIN_YEAR) break;
      if (page.length < limit) break;
    }

    const since2 = acc2.filter((tx) => {
      const parts = tx.vencimento.includes('/') ? tx.vencimento.split('/') : tx.vencimento.split('-');
      const year = tx.vencimento.includes('/') ? parts[2] : parts[0];
      const y = Number(year);
      return !Number.isFinite(y) || y >= MIN_YEAR;
    });

    const newRevenues = since2.filter(tx => isRevenueTransaction(tx));
    const newTotal = newRevenues.reduce((sum, tx) => sum + tx.valor, 0);
    console.log(`NEW: Found ${newRevenues.length} revenues, Total value: R$ ${newTotal.toLocaleString('pt-BR')}`);

    // Let's find the difference
    const oldIds = new Set(oldRevenues.map(tx => tx.id));
    const newIds = new Set(newRevenues.map(tx => tx.id));

    const onlyInOld = oldRevenues.filter(tx => !newIds.has(tx.id));
    const onlyInNew = newRevenues.filter(tx => !oldIds.has(tx.id));

    console.log(`\nRevenues only in OLD: ${onlyInOld.length}`);
    if (onlyInOld.length > 0) {
      console.table(onlyInOld.slice(0, 10).map(tx => ({
        id: tx.id,
        fornecedor: tx.fornecedor,
        descricao: tx.descricao,
        vencimento: tx.vencimento,
        valor: tx.valor,
        tipo: tx.tipo
      })));
    }

    console.log(`Revenues only in NEW: ${onlyInNew.length}`);
    if (onlyInNew.length > 0) {
      console.table(onlyInNew.slice(0, 10).map(tx => ({
        id: tx.id,
        fornecedor: tx.fornecedor,
        descricao: tx.descricao,
        vencimento: tx.vencimento,
        valor: tx.valor,
        tipo: tx.tipo
      })));
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
