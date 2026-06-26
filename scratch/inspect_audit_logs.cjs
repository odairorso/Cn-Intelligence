const pg = require('pg');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const totalCount = await pool.query('SELECT count(*) FROM audit_logs');
    console.log('Total audit logs:', totalCount.rows[0].count);

    const sample = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10');
    console.log('Recent 10 audit logs:');
    console.table(sample.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
