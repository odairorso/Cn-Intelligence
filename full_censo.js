import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fullCenso() {
  const client = await pool.connect();
  try {
    const total = await client.query('SELECT COUNT(*) as count FROM transactions');
    console.log(`Total geral de registros no banco: ${total.rows[0].count}`);
    
    const byYear = await client.query(`
      SELECT EXTRACT(YEAR FROM vencimento) as ano, COUNT(*) as qtd
      FROM transactions
      GROUP BY ano ORDER BY ano ASC
    `);
    console.log("\nRegistros por ano:");
    byYear.rows.forEach(r => console.log(`  ${r.ano}: ${r.qtd}`));
    
    const topSuppliers = await client.query(`
      SELECT fornecedor, COUNT(*) as qtd
      FROM transactions
      GROUP BY fornecedor
      ORDER BY qtd DESC
      LIMIT 10
    `);
    console.log("\nTop 10 fornecedores no banco:");
    topSuppliers.rows.forEach(r => console.log(`  ${r.fornecedor}: ${r.qtd}`));

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    pool.end();
    process.exit(0);
  }
}
fullCenso();
