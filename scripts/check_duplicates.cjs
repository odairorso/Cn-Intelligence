const pg = require('pg');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const res = await pool.query(`
      SELECT id, vencimento, pagamento, valor, status, created_at
      FROM transactions
      WHERE fornecedor ILIKE '%BATISTOTE%'
        AND (EXTRACT(YEAR FROM vencimento) = 2024 OR EXTRACT(YEAR FROM vencimento) = 2025)
      ORDER BY vencimento ASC
    `);
    console.log("All 2024/2025 BATISTOTE transactions with created_at:");
    console.table(res.rows.map(r => ({
      ...r,
      vencimento: r.vencimento ? new Date(r.vencimento).toISOString().slice(0, 10) : null,
      pagamento: r.pagamento ? new Date(r.pagamento).toISOString().slice(0, 10) : null,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null
    })));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
