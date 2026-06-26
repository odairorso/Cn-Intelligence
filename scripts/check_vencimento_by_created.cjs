const pg = require('pg');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const res = await pool.query(`
      SELECT 
        created_at::date as created_date,
        EXTRACT(YEAR FROM vencimento) as venc_year,
        count(*),
        count(CASE WHEN status = 'PENDENTE' THEN 1 END) as pending,
        count(CASE WHEN status = 'PAGO' THEN 1 END) as paid
      FROM transactions
      GROUP BY created_at::date, EXTRACT(YEAR FROM vencimento)
      ORDER BY created_date ASC, venc_year ASC
    `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
