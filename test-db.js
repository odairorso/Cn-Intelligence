import { config } from 'dotenv';
import pg from 'pg';
config();
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
pool.query("SELECT COUNT(*), EXTRACT(YEAR FROM vencimento) as yr FROM transactions GROUP BY yr")
  .then(res => {
    console.table(res.rows);
    pool.end();
  })
  .catch(err => {
    console.error(err);
    pool.end();
  });
