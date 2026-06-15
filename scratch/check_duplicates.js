import { config } from 'dotenv';
import pg from 'pg';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const ids = ['d057eafe-f329-4694-8902-6d29f1c1d970', 'f160207b-e510-4730-8f39-cd82b94fd02b'];
    const res = await pool.query(`
      SELECT id, fornecedor, descricao, valor, vencimento, tipo
      FROM transactions 
      WHERE id = ANY($1::uuid[])
    `, [ids]);
    
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
