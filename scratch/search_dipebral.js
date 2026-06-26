import { config } from 'dotenv';
import pg from 'pg';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log('--- ALL SUPPLIERS MATCHING DIPEBRAL ---');
    const supRes = await pool.query(`
      SELECT id, uid, nome, cnpj, email, telefone
      FROM suppliers 
      WHERE nome ILIKE '%dipebral%' OR cnpj ILIKE '%05891555%' OR cnpj ILIKE '%05.891.555%'
    `);
    console.table(supRes.rows);

    console.log('\n--- TRANSACTIONS IN DB WITH SIMILAR FORNECEDOR NAME OR BOLETO NUMBER ---');
    const txNameRes = await pool.query(`
      SELECT id, fornecedor, descricao, valor, vencimento, status, numero_boleto, empresa
      FROM transactions 
      WHERE fornecedor ILIKE '%dipebral%' OR fornecedor ILIKE '%dipeb%'
    `);
    console.table(txNameRes.rows);

    console.log('\n--- TRANSACTIONS IN DB WHERE DESCRIPTION HAS DIPEBRAL ---');
    const txDescRes = await pool.query(`
      SELECT id, fornecedor, descricao, valor, vencimento, status, empresa
      FROM transactions 
      WHERE descricao ILIKE '%dipebral%' OR descricao ILIKE '%dipeb%'
    `);
    console.table(txDescRes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
