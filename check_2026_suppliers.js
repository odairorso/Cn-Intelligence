import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkSuppliers2026() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT fornecedor, COUNT(*) as qtd
      FROM transactions
      WHERE EXTRACT(YEAR FROM vencimento) = 2026
      GROUP BY fornecedor
      ORDER BY qtd DESC
      LIMIT 20
    `);
    
    console.log("Fornecedores em 2026 no banco:");
    result.rows.forEach(r => {
      console.log(`  ${r.fornecedor}: ${r.qtd}`);
    });
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    pool.end();
    process.exit(0);
  }
}
checkSuppliers2026();
