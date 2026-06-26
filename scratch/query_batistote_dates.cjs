const pg = require('pg');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const dates = ['2024-05-20', '2024-08-15', '2025-01-15'];
    const res = await pool.query(`
      SELECT id, fornecedor, descricao, empresa, vencimento::text, pagamento::text, valor, status, created_at, updated_at
      FROM transactions
      WHERE fornecedor ILIKE '%BATISTOTE%'
        AND vencimento::text IN (${dates.map((_, i) => `$${i + 1}`).join(', ')})
      ORDER BY vencimento ASC, valor ASC, status DESC
    `, dates);
    
    console.log(`Found ${res.rows.length} rows for Batistote on these dates:`);
    res.rows.forEach(r => {
      console.log(`ID: ${r.id} | Venc: ${r.vencimento} | Pag: ${r.pagamento} | Valor: ${r.valor} | Status: ${r.status} | Empresa: ${r.empresa} | Desc: ${r.descricao}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
