import { config } from 'dotenv';
import pg from 'pg';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

async function run() {
  try {
    const res = await pool.query(`
      SELECT id, fornecedor, descricao, valor, vencimento, tipo
      FROM transactions 
      WHERE deleted_at IS NULL
    `);
    
    console.log(`Loaded ${res.rows.length} total transactions.`);

    // 1. How many have tipo = 'RECEITA'?
    const withTipoReceita = res.rows.filter(tx => tx.tipo === 'RECEITA');
    const totalWithTipo = withTipoReceita.reduce((sum, tx) => sum + Number(tx.valor), 0);
    console.log(`With tipo='RECEITA': ${withTipoReceita.length} transactions, total: R$ ${totalWithTipo.toLocaleString('pt-BR')}`);

    // 2. How many are classified as revenue by isRevenueTransaction?
    const classifiedAsRevenue = res.rows.filter(tx => isRevenueTransaction(tx));
    const totalClassified = classifiedAsRevenue.reduce((sum, tx) => sum + Number(tx.valor), 0);
    console.log(`Classified as revenue: ${classifiedAsRevenue.length} transactions, total: R$ ${totalClassified.toLocaleString('pt-BR')}`);

    // 3. Find the discrepancy: tx classified as revenue but tipo !== 'RECEITA'
    const discrepancy = classifiedAsRevenue.filter(tx => tx.tipo !== 'RECEITA');
    const totalDiscrepancy = discrepancy.reduce((sum, tx) => sum + Number(tx.valor), 0);
    console.log(`Discrepancy: ${discrepancy.length} transactions, total value: R$ ${totalDiscrepancy.toLocaleString('pt-BR')}`);
    
    // Print the first 20 discrepancies
    console.log("\nFirst 20 discrepancies:");
    console.table(discrepancy.slice(0, 20).map(tx => ({
      id: tx.id,
      fornecedor: tx.fornecedor,
      descricao: tx.descricao,
      valor: tx.valor,
      vencimento: tx.vencimento,
      tipo: tx.tipo
    })));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
