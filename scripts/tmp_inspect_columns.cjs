require('dotenv').config();
const { Pool } = require('pg');

async function inspectColumns() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'suppliers'");
    res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspectColumns();
