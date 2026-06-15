import { config } from 'dotenv';
import pg from 'pg';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const years = ['2022', '2023', '2024', '2025', '2026', 'TODOS'];
    for (const year of years) {
      let dateFilter = '';
      if (year !== 'TODOS') {
        dateFilter = `AND vencimento >= '${year}-01-01' AND vencimento <= '${year}-12-31'`;
      }
      
      const query = `
        SELECT
          COALESCE(SUM(CASE WHEN UPPER(tipo) = 'RECEITA' THEN valor ELSE 0 END), 0) as total_receitas,
          COALESCE(SUM(CASE WHEN UPPER(tipo) = 'DESPESA' THEN valor + COALESCE(juros, 0) ELSE 0 END), 0) as total_despesas,
          COUNT(CASE WHEN tipo != 'TRANSFERENCIA' THEN 1 END) as total_count
        FROM transactions
        WHERE 1=1 AND (uid = 'odair' OR uid IS NULL) ${dateFilter};
      `;
      const res = await pool.query(query);
      const row = res.rows[0];
      console.log(`Ano: ${year} | Total Receitas: ${row.total_receitas} | Total Despesas: ${row.total_despesas} | Registros: ${row.total_count}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
