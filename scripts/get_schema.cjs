const pg = require('pg');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'transactions'
    `);
    console.log("=== transactions columns ===");
    console.table(res.rows);

    const resAudit = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'audit_logs'
    `);
    console.log("=== audit_logs columns ===");
    console.table(resAudit.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
