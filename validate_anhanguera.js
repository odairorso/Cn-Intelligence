import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function validateAnhanguera() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT COUNT(*) as qtd
      FROM transactions
      WHERE fornecedor ILIKE '%Anhanguera%' AND EXTRACT(YEAR FROM vencimento) = 2026
    `);
    
    console.log(`Registros Editora Anhanguera (2026): ${result.rows[0].qtd}`);
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    pool.end();
    process.exit(0);
  }
}
validateAnhanguera();
