import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkRecentInserts() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, fornecedor, vencimento::text, created_at
      FROM transactions
      WHERE created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
    `);
    
    console.log(`Registros criados nas últimas 24h: ${result.rows.length}`);
    result.rows.forEach(r => {
      console.log(`  ID: ${r.id} | Fornecedor: [${r.fornecedor}] | Venc: ${r.vencimento} | Created: ${r.created_at}`);
    });
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    pool.end();
    process.exit(0);
  }
}
checkRecentInserts();
