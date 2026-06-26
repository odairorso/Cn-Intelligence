import { config } from 'dotenv';
import pg from 'pg';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query(`
      SELECT 
        s.nome,
        COALESCE(tc.count, 0)::int AS transaction_count
      FROM suppliers s
      LEFT JOIN (
        SELECT fornecedor, COUNT(*)::int as count
        FROM transactions
        WHERE uid = 'odair' AND deleted_at IS NULL
        GROUP BY fornecedor
      ) tc ON immutable_unaccent(coalesce(tc.fornecedor, '')) = immutable_unaccent(coalesce(s.nome, ''))
      WHERE s.uid = 'odair' AND s.nome = 'DIPEBRAL'
    `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
