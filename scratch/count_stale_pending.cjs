const pg = require('pg');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const res = await pool.query(`
      SELECT count(*), count(CASE WHEN vencimento < '2026-02-01' THEN 1 END) as before_feb_26
      FROM transactions
      WHERE status = 'PENDENTE'
    `);
    console.log("Pending transactions statistics:");
    console.table(res.rows);
    
    const sample = await pool.query(`
      SELECT id, fornecedor, vencimento::text, valor, status
      FROM transactions
      WHERE status = 'PENDENTE' AND vencimento < '2026-02-01'
      ORDER BY vencimento ASC
      LIMIT 10
    `);
    console.log("Sample pending transactions before Feb 2026:");
    console.table(sample.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
