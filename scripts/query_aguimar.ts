import { Client } from 'pg';

async function run() {
  const c = new Client('postgresql://neondb_owner:npg_c9LaAv3hXNmD@ep-young-mouse-aclmtaes-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require');
  await c.connect();
  try {
    const all = await c.query(`
      SELECT fornecedor, COUNT(*)::int AS qtd
      FROM transactions
      WHERE fornecedor ILIKE '%aguim%' OR fornecedor ILIKE '%agmar%'
      GROUP BY fornecedor
      ORDER BY qtd DESC
    `);

    const y2026 = await c.query(`
      SELECT fornecedor, COUNT(*)::int AS qtd
      FROM transactions
      WHERE (fornecedor ILIKE '%aguim%' OR fornecedor ILIKE '%agmar%')
        AND EXTRACT(YEAR FROM vencimento) = 2026
      GROUP BY fornecedor
      ORDER BY qtd DESC
    `);

    console.log('FORNECEDOR_AGUIMAR_RELACIONADOS', all.rows);
    console.log('FORNECEDOR_AGUIMAR_2026', y2026.rows);
  } finally {
    await c.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
