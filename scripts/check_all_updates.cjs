const pg = require('pg');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    console.log("=== CREATED AT GROUPINGS ===");
    const resCreated = await pool.query(`
      SELECT created_at::date as date, count(*), count(CASE WHEN status = 'PENDENTE' THEN 1 END) as pending, count(CASE WHEN status = 'PAGO' THEN 1 END) as paid
      FROM transactions
      GROUP BY created_at::date
      ORDER BY date ASC
    `);
    console.table(resCreated.rows);

    console.log("\n=== UPDATED AT GROUPINGS ===");
    const resUpdated = await pool.query(`
      SELECT updated_at::date as date, count(*), count(CASE WHEN status = 'PENDENTE' THEN 1 END) as pending, count(CASE WHEN status = 'PAGO' THEN 1 END) as paid
      FROM transactions
      GROUP BY updated_at::date
      ORDER BY date ASC
    `);
    console.table(resUpdated.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
