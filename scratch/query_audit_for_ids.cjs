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
    console.log("Searching audit logs for the 6 target Batistote transaction IDs...");
    
    const res = await pool.query(`
      SELECT id, user_uid, action, record_id, created_at,
             dados_antigos, dados_novos
      FROM audit_logs
      WHERE record_id IN (${ids.map((_, i) => `$${i + 1}`).join(', ')})
      ORDER BY created_at DESC
    `, ids);
    
    console.log(`Found ${res.rows.length} audit logs for these IDs:`);
    if (res.rows.length > 0) {
      res.rows.forEach(r => {
        console.log(`Log ID: ${r.id} | Action: ${r.action} | Record: ${r.record_id} | User: ${r.user_uid} | Date: ${r.created_at.toISOString()}`);
        console.log("Old data:", JSON.stringify(r.dados_antigos));
        console.log("New data:", JSON.stringify(r.dados_novos));
        console.log("-----------------------------------------");
      });
    } else {
      console.log("No audit logs found for these IDs.");
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
