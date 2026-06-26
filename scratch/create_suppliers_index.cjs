const pg = require('pg');
require('dotenv').config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    console.log("Creating index idx_suppliers_unaccent_nome...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_suppliers_unaccent_nome 
      ON suppliers (immutable_unaccent(nome))
    `);
    console.log("Index created successfully!");
  } catch (err) {
    console.error("Failed to create index:", err);
  } finally {
    pool.end();
  }
}

main();
