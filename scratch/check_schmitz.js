import { config } from 'dotenv';
import pg from 'pg';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log('--- ALL SUPPLIERS MATCHING SCHMITZ ---');
    const supRes = await pool.query(`
      SELECT id, uid, nome, cnpj, email, telefone
      FROM suppliers 
      WHERE nome ILIKE '%schmitz%' OR nome ILIKE '%schmitiz%'
    `);
    console.table(supRes.rows);

    console.log('\n--- TRANSACTION COUNTS FOR EACH SCHMITZ VARIANT IN DB ---');
    const txCountRes = await pool.query(`
      SELECT fornecedor, COUNT(*) as count
      FROM transactions 
      WHERE fornecedor ILIKE '%schmitz%' OR fornecedor ILIKE '%schmitiz%'
      GROUP BY fornecedor
    `);
    console.table(txCountRes.rows);

    console.log('\n--- SAMPLE TRANSACTIONS FOR SCHMITZ IN DB ---');
    const txRes = await pool.query(`
      SELECT id, fornecedor, descricao, valor, vencimento, status, empresa
      FROM transactions 
      WHERE fornecedor ILIKE '%schmitz%' OR fornecedor ILIKE '%schmitiz%'
      LIMIT 10
    `);
    console.table(txRes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
