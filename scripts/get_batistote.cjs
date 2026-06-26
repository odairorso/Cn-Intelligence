const pg = require('pg');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const res = await pool.query(`
      SELECT id, vencimento, pagamento, valor, fornecedor, status, created_at, updated_at
      FROM transactions
      WHERE fornecedor ILIKE '%BATISTOTE%'
      ORDER BY vencimento ASC
    `);
    console.log("All Batistote transactions in DB:");
    console.table(res.rows.map(r => ({
      ...r,
      vencimento: r.vencimento ? new Date(r.vencimento).toISOString().slice(0, 10) : null,
      pagamento: r.pagamento ? new Date(r.pagamento).toISOString().slice(0, 10) : null,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null
    })));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
