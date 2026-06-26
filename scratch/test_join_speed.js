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
        (
          SELECT COALESCE(COUNT(*), 0)::int
          FROM transactions t
          WHERE t.uid = s.uid
            AND t.deleted_at IS NULL
            AND upper(regexp_replace(coalesce(t.fornecedor, ''), '[^A-Za-z0-9]+', ' ', 'g')) = upper(regexp_replace(coalesce(s.nome, ''), '[^A-Za-z0-9]+', ' ', 'g'))
        ) AS count
      FROM suppliers s
      WHERE s.uid = 'odair'
      ORDER BY s.nome ASC
    `);
    const duration = Date.now() - start;
    console.log(`Query took ${duration}ms, returned ${res.rows.length} rows.`);
    console.log('Sample counts (top 15):');
    console.table(res.rows.slice(0, 15));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
