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
        EXTRACT(YEAR FROM vencimento) as year,
        tipo,
        COUNT(*) as count,
        SUM(valor) as total_valor
      FROM transactions 
      WHERE deleted_at IS NULL
      GROUP BY EXTRACT(YEAR FROM vencimento), tipo
      ORDER BY year DESC, tipo;
    `);
    
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
