require('dotenv').config();
const { Pool } = require('pg');

async function analyze() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('--- TABLES ---');
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log(tables.rows.map(r => r.table_name).join(', '));

    console.log('\n--- SUPPLIER VARIATIONS ---');
    const variations = await pool.query(`
      SELECT fornecedor, COUNT(*) as count 
      FROM transactions 
      GROUP BY fornecedor 
      ORDER BY fornecedor ASC
    `);
    
    variations.rows.forEach(row => {
      console.log(`${row.fornecedor}|${row.count}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

analyze();
