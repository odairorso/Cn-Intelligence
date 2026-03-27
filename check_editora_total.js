import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT COUNT(*) as total
      FROM transactions
      WHERE fornecedor ILIKE '%editora%' AND fornecedor ILIKE '%anhanguera%'
    `);
    
    console.log(`Total no banco para Editora Anhanguera: ${result.rows[0].total}`);
    
    const years = await client.query(`
      SELECT EXTRACT(YEAR FROM vencimento) as ano, COUNT(*) as qtd
      FROM transactions
      WHERE fornecedor ILIKE '%editora%' AND fornecedor ILIKE '%anhanguera%'
      GROUP BY ano ORDER BY ano DESC
    `);
    console.log("\nPor ano de vencimento:");
    years.rows.forEach(r => console.log(`  ${r.ano}: ${r.qtd}`));
    
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    pool.end();
    process.exit(0);
  }
}
check();
