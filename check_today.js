import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkToday() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, fornecedor, vencimento::text, status
      FROM transactions
      WHERE vencimento = '2026-03-24'
         OR (vencimento >= '2026-03-24' AND vencimento < '2026-03-25')
    `);
    
    console.log(`Registros para 24/03/2026: ${result.rows.length}`);
    result.rows.forEach(r => {
      console.log(`  ID: ${r.id} | Fornecedor: [${r.fornecedor}] | Status: ${r.status}`);
    });
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    pool.end();
    process.exit(0);
  }
}
checkToday();
