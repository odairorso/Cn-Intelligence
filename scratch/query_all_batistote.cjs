const pg = require('pg');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const res = await pool.query(`
      SELECT id, tipo, fornecedor, descricao, empresa, vencimento::text, pagamento::text, valor, status, deleted_at, created_at, updated_at
      FROM transactions
      WHERE fornecedor ILIKE '%BATISTOTE%'
      ORDER BY vencimento ASC, status DESC
    `);
    console.log(`Found ${res.rows.length} transactions for BATISTOTE in DB:`);
    console.table(res.rows.map(r => ({
      ...r,
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
