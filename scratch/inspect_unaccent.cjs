const pg = require('pg');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const res = await pool.query(`
      SELECT routine_name, routine_definition, data_type 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' AND routine_name ILIKE '%unaccent%'
    `);
    console.log("=== Unaccent Routines ===");
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
