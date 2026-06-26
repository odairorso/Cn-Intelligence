import { config } from 'dotenv';
import pg from 'pg';
config();
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT id, tipo, fornecedor, descricao, empresa, vencimento, pagamento, valor, juros, status
      FROM transactions
      WHERE fornecedor ILIKE '%BATISTOTE%'
        AND vencimento < '2026-01-01'
        AND pagamento IS NULL
      ORDER BY vencimento ASC
    `);
    console.log("Unpaid transactions before 2026:");
    console.table(res.rows.map(r => ({
      ...r,
      vencimento: r.vencimento ? new Date(r.vencimento).toISOString().slice(0, 10) : null,
      pagamento: r.pagamento ? new Date(r.pagamento).toISOString().slice(0, 10) : null
    })));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
