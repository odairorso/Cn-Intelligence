const pg = require('pg');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const res = await pool.query(`
      SELECT updated_at::date as date, count(*), count(CASE WHEN status = 'PENDENTE' THEN 1 END) as pending_count, count(CASE WHEN status = 'PAGO' THEN 1 END) as paid_count
      FROM transactions
      GROUP BY updated_at::date
      ORDER BY date DESC
      LIMIT 20
    `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
