const pg = require('pg');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const totalTx = await pool.query(`SELECT count(*) FROM transactions`);
    console.log("Total transactions in DB:", totalTx.rows[0].count);

    const neverUpdated = await pool.query(`
      SELECT count(*) FROM transactions WHERE updated_at = created_at
    `);
    console.log("Transactions never updated (updated_at = created_at):", neverUpdated.rows[0].count);

    const auditCount = await pool.query(`
      SELECT count(*), action, user_uid
      FROM audit_logs
      WHERE created_at >= '2026-05-12 00:00:00' AND created_at < '2026-05-13 00:00:00'
      GROUP BY action, user_uid
    `);
    console.log("Audit log entries on 2026-05-12:");
    console.table(auditCount.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
