import { config } from 'dotenv';
import pg from 'pg';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log('--- DIPEBRAL SUPPLIER IN DB ---');
    const supRes = await pool.query(`
      SELECT id, uid, nome, length(nome) as nome_len
      FROM suppliers 
      WHERE nome ILIKE '%dipebral%'
    `);
    console.table(supRes.rows);

    console.log('\n--- DIPEBRAL TRANSACTIONS IN DB ---');
    const txRes = await pool.query(`
      SELECT id, uid, fornecedor, length(fornecedor) as forn_len, valor, vencimento, deleted_at
      FROM transactions 
      WHERE fornecedor ILIKE '%dipebral%'
    `);
    console.table(txRes.rows);

    if (supRes.rows.length > 0 && txRes.rows.length > 0) {
      const sName = supRes.rows[0].nome;
      const tName = txRes.rows[0].fornecedor;
      
      const unaccentRes = await pool.query(`
        SELECT 
          immutable_unaccent($1) as unaccent_supplier,
          immutable_unaccent($2) as unaccent_tx,
          (immutable_unaccent($1) = immutable_unaccent($2)) as is_equal
      `, [sName, tName]);
      console.log('\n--- UNACCENT COMPARISON ---');
      console.table(unaccentRes.rows);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
