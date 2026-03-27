import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkVariations() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT fornecedor, COUNT(*) as qtd, MIN(vencimento)::text as min_v, MAX(vencimento)::text as max_v
      FROM transactions
      WHERE fornecedor ILIKE '%anhanguera%'
      GROUP BY fornecedor
    `);
    
    console.log("Variações de Anhanguera encontradas:");
    result.rows.forEach(r => {
      console.log(`  Name: [${r.fornecedor}] | Qtd: ${r.qtd} | Min: ${r.min_v} | Max: ${r.max_v}`);
    });
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    pool.end();
    process.exit(0);
  }
}
checkVariations();
