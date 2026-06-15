import { config } from 'dotenv';
import pg from 'pg';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query(`
      SELECT * FROM transactions
      WHERE 1=1 AND (uid = 'odair' OR uid IS NULL)
      ORDER BY vencimento DESC, id DESC
      LIMIT 100;
    `);
    
    let total = 0;
    for (const tx of res.rows) {
      if (tx.tipo !== 'TRANSFERENCIA') {
        const val = Number(tx.valor) || 0;
        const j = Number(tx.juros) || 0;
        total += val + j;
      }
    }
    console.log('Soma dos primeiros 100 lançamentos:', total);
    console.log('Quantidade de registros:', res.rows.length);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
