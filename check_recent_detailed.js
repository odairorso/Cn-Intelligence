import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkRecentInsertsDetailed() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, fornecedor, vencimento::text, created_at
      FROM transactions
      WHERE created_at > NOW() - INTERVAL '48 hours'
      ORDER BY created_at DESC
    `);
    
    console.log(`TOTAL RECENTE (48h): ${result.rows.length}`);
    result.rows.forEach(r => {
      console.log(`>> [${r.created_at}] Forn: ${r.fornecedor} | Venc: ${r.vencimento}`);
    });
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    pool.end();
    process.exit(0);
  }
}
checkRecentInsertsDetailed();
