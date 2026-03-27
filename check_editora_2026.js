import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT fornecedor, vencimento::text, valor, empresa, status
      FROM transactions
      WHERE (fornecedor ILIKE '%editora%' AND fornecedor ILIKE '%anhanguera%')
        AND vencimento >= '2026-01-01'
      ORDER BY vencimento ASC
    `);
    
    console.log(`Encontrados no banco para Editora Anhanguera em 2026: ${result.rows.length} registros`);
    result.rows.forEach(r => {
      console.log(`  Venc: ${r.vencimento} | Valor: ${r.valor} | Empresa: ${r.empresa} | Status: ${r.status}`);
    });
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    pool.end();
    process.exit(0);
  }
}
check();
