import { Client } from 'pg';

const normalize = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

async function run() {
  const c = new Client('postgresql://neondb_owner:npg_c9LaAv3hXNmD@ep-young-mouse-aclmtaes-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require');
  await c.connect();
  try {
    const suppliersRes = await c.query<{ nome: string }>('SELECT nome FROM suppliers ORDER BY nome');
    const txSuppliersRes = await c.query<{ fornecedor: string; qtd: string }>(`
      SELECT fornecedor, COUNT(*)::text AS qtd
      FROM transactions
      GROUP BY fornecedor
      ORDER BY fornecedor
    `);

    const suppliers = suppliersRes.rows.map((r) => r.nome);
    const txSuppliers = txSuppliersRes.rows.map((r) => ({ nome: r.fornecedor, qtd: Number(r.qtd) }));

    const supplierKeySet = new Set(suppliers.map(normalize));
    const txKeySet = new Set(txSuppliers.map((x) => normalize(x.nome)));

    const missingInSuppliers = txSuppliers.filter((x) => !supplierKeySet.has(normalize(x.nome)));
    const noTransactions = suppliers.filter((s) => !txKeySet.has(normalize(s)));

    const topTxSuppliers = [...txSuppliers].sort((a, b) => b.qtd - a.qtd).slice(0, 20);

    console.log('=== AUDITORIA FORNECEDORES X LANCAMENTOS ===');
    console.log(`Fornecedores cadastrados: ${suppliers.length}`);
    console.log(`Fornecedores distintos nos lancamentos: ${txSuppliers.length}`);
    console.log(`Sem cadastro em suppliers (mas existe em lancamentos): ${missingInSuppliers.length}`);
    console.log(`Cadastrados sem lancamento: ${noTransactions.length}`);
    console.log('Top 20 fornecedores por quantidade de lançamentos:');
    topTxSuppliers.forEach((x) => console.log(`  ${x.nome}: ${x.qtd}`));
    if (missingInSuppliers.length > 0) {
      console.log('Exemplos sem cadastro:');
      missingInSuppliers.slice(0, 20).forEach((x) => console.log(`  ${x.nome}: ${x.qtd}`));
    }
    if (noTransactions.length > 0) {
      console.log('Exemplos sem lançamento:');
      noTransactions.slice(0, 20).forEach((x) => console.log(`  ${x}`));
    }
  } finally {
    await c.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
