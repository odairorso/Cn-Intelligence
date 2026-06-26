import { config } from 'dotenv';
import pg from 'pg';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log('--- LATEST 5 CREATED/UPDATED TRANSACTIONS ---');
    const res = await pool.query(`
      SELECT id, fornecedor, descricao, valor, vencimento, updated_at, created_at
      FROM transactions 
      WHERE uid = 'odair' AND deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT 5
    `);
    console.table(res.rows);

    console.log('\n--- TOTAL COUNT FOR BANCO DO BRASIL ---');
    const bbRes = await pool.query(`
      SELECT COUNT(*) as count
      FROM transactions
      WHERE uid = 'odair' AND deleted_at IS NULL
        AND immutable_unaccent(coalesce(fornecedor, '')) = immutable_unaccent('BANCO DO BRASIL')
    `);
    console.table(bbRes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
