const pg = require('pg');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const res = await pool.query(`
      SELECT id, vencimento, pagamento, valor, fornecedor, descricao, empresa, status
      FROM transactions
      WHERE pagamento IS NULL
        AND vencimento < '2026-02-01'
      ORDER BY vencimento ASC
    `);
    console.log(`Found ${res.rows.length} pending transactions before 2026-02-01:`);
    console.table(res.rows.map(r => ({
      ...r,
      vencimento: r.vencimento ? new Date(r.vencimento).toISOString().slice(0, 10) : null,
      pagamento: r.pagamento ? new Date(r.pagamento).toISOString().slice(0, 10) : null
    })));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
