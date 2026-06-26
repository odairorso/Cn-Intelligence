require('dotenv/config');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT id, vencimento, pagamento, status FROM transactions WHERE fornecedor ILIKE '%BEATRIZ%'")
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => pool.end());
