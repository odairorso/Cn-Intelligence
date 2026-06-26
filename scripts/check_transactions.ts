import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  try {
    const q1 = await c.query(`
      SELECT EXTRACT(YEAR FROM vencimento)::int AS ano,
             COUNT(*)::int AS qtd,
             COALESCE(SUM(valor),0)::numeric(14,2) AS total
      FROM transactions
      GROUP BY 1
      ORDER BY 1
    `);

    const q2 = await c.query(`
      SELECT EXTRACT(YEAR FROM pagamento)::int AS ano,
             COUNT(*)::int AS qtd
      FROM transactions
      WHERE pagamento IS NOT NULL
      GROUP BY 1
      ORDER BY 1
    `);

    const q3 = await c.query(`
      SELECT id, fornecedor, descricao, vencimento, pagamento, valor
      FROM transactions
      ORDER BY id DESC
      LIMIT 30
    `);

    console.log('ANOS_VENCIMENTO', q1.rows);
    console.log('ANOS_PAGAMENTO', q2.rows);
    console.log('ULTIMOS_30', q3.rows);
  } finally {
    await c.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
