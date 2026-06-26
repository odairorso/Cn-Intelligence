const pg = require('pg');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ids = [
  '2602df78-cfc2-404a-8295-45709bd70cd0',
  'd1461dc0-f91f-406f-b8c9-6dfbd1c997a5',
  'fc20bead-93a6-4d41-920d-7473008d68c2',
  '05cba06c-ffab-493a-abac-2a0faa884f2e',
  'c2517c3f-0d76-4012-9676-fc77c3643309',
  'ddefaf86-fc6d-4b44-ab9a-d3c75f43fc7a'
];

async function main() {
  try {
    const res = await pool.query(`
      SELECT id, user_uid, action, tabela, record_id, created_at, dados_antigos, dados_novos
      FROM audit_logs
      WHERE record_id IN (${ids.map((_, i) => `$${i + 1}`).join(', ')})
      ORDER BY created_at ASC
    `, ids);
    
    console.log(`Found ${res.rows.length} audit log entries:`);
    console.table(res.rows.map(r => ({
      id: r.id,
      action: r.action,
      record_id: r.record_id,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      dados_antigos: r.dados_antigos ? JSON.stringify(r.dados_antigos).slice(0, 100) : null,
      dados_novos: r.dados_novos ? JSON.stringify(r.dados_novos).slice(0, 100) : null
    })));
  } catch (err) {
    console.error("Error fetching audit logs:", err);
  } finally {
    pool.end();
  }
}

main();
