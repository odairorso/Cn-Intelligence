const pg = require('pg');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const res = await pool.query(`
      SELECT id, user_uid, action, record_id, created_at,
             dados_antigos->>'status' as old_status,
             dados_novos->>'status' as new_status,
             dados_novos->>'fornecedor' as fornecedor,
             dados_novos->>'valor' as valor,
             dados_novos->>'vencimento' as vencimento
      FROM audit_logs
      WHERE action = 'UPDATE'
        AND dados_antigos->>'status' = 'PAGO'
        AND dados_novos->>'status' = 'PENDENTE'
      ORDER BY created_at DESC
    `);
    console.log(`Found ${res.rows.length} status reversions in audit logs:`);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
