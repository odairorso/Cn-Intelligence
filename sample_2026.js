import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check2026Data() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, fornecedor, vencimento::text, status
      FROM transactions
      WHERE EXTRACT(YEAR FROM vencimento) = 2026
      LIMIT 10
    `);
    
    console.log("Amostra 2026 no banco:");
    result.rows.forEach(r => {
      console.log(`  ID: ${r.id} | Fornecedor: [${r.fornecedor}] | Vencimento: ${r.vencimento} | Status: ${r.status}`);
    });
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    pool.end();
    process.exit(0);
  }
}
check2026Data();
