import { config } from 'dotenv';
import pg from 'pg';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const start = Date.now();
    const res = await pool.query(`
      SELECT 
        s.nome,
        COALESCE(tc.count, 0)::int as count
      FROM suppliers s
      LEFT JOIN (
        SELECT fornecedor, COUNT(*)::int as count
        FROM transactions
        WHERE uid = 'odair' AND deleted_at IS NULL
        GROUP BY fornecedor
      ) tc ON UPPER(tc.fornecedor) = UPPER(s.nome)
      WHERE s.uid = 'odair'
      ORDER BY s.nome ASC
    `);
    const duration = Date.now() - start;
    console.log(`FAST JOIN Query took ${duration}ms, returned ${res.rows.length} rows.`);
    console.log('Sample counts (top 15):');
    console.table(res.rows.slice(0, 15));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
