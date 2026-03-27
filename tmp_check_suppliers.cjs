require('dotenv').config();
const { Pool } = require('pg');

async function checkSuppliers() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query("SELECT * FROM suppliers ORDER BY name ASC");
    res.rows.forEach(r => console.log(JSON.stringify(r)));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkSuppliers();
