const pg = require('pg');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const res = await pool.query(`
      SELECT fornecedor, count(*), sum(valor) as total_valor, min(vencimento)::text as min_venc, max(vencimento)::text as max_venc
      FROM transactions
      WHERE status = 'PENDENTE'
        AND vencimento < '2026-02-01'
      GROUP BY fornecedor
      ORDER BY count(*) DESC
      LIMIT 30
    `);
    console.log("Top suppliers with pending transactions before 2026-02-01:");
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
