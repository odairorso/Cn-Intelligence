import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkYear26() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT COUNT(*) as count
      FROM transactions
      WHERE EXTRACT(YEAR FROM vencimento) < 2000
    `);
    
    console.log(`Registros com ano < 2000: ${result.rows[0].count}`);
    
    if (result.rows[0].count > 0) {
        const samples = await client.query(`
          SELECT id, fornecedor, vencimento::text
          FROM transactions
          WHERE EXTRACT(YEAR FROM vencimento) < 2000
          LIMIT 10
        `);
        samples.rows.forEach(r => console.log(`  ID: ${r.id} | Fornecedor: [${r.fornecedor}] | Venc: ${r.vencimento}`));
    }
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    pool.end();
    process.exit(0);
  }
}
checkYear26();
