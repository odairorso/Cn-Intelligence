import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function sampleData() {
  const client = await pool.connect();
  try {
    console.log("--- Sample of 'transactions' ---");
    const res = await client.query(`
      SELECT id, fornecedor, vencimento, valor, status
      FROM transactions
      LIMIT 5;
    `);
    console.log(JSON.stringify(res.rows, null, 2));

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    pool.end();
    process.exit(0);
  }
}
sampleData();
