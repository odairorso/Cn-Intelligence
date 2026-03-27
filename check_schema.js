import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkSchema() {
  const client = await pool.connect();
  try {
    console.log("--- Constraints ---");
    const constraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND conrelid = 'transactions'::regclass;
    `);
    constraints.rows.forEach(r => console.log(`${r.conname}: ${r.pg_get_constraintdef}`));

    console.log("\n--- Indexes ---");
    const indexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'transactions';
    `);
    indexes.rows.forEach(r => console.log(`${r.indexname}: ${r.indexdef}`));

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    pool.end();
    process.exit(0);
  }
}
checkSchema();
