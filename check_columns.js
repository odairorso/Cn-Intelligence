import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkColumns() {
  const client = await pool.connect();
  try {
    console.log("--- Columns in 'transactions' ---");
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'transactions'
      ORDER BY ordinal_position;
    `);
    res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type} (Nullable: ${r.is_nullable})`));

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    pool.end();
    process.exit(0);
  }
}
checkColumns();
