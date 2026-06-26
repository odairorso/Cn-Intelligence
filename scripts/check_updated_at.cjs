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
      SELECT id, vencimento, valor, status, created_at, updated_at, created_by, updated_by
      FROM transactions
      WHERE id IN (${ids.map((_, i) => `$${i + 1}`).join(', ')})
    `, ids);
    console.table(res.rows.map(r => ({
      ...r,
      vencimento: r.vencimento ? new Date(r.vencimento).toISOString().slice(0, 10) : null,
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
