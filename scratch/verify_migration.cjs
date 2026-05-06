const pg = require('pg');
const newUrl = 'postgresql://postgres.pfrxigqbslzaflddxxww:Turce.334180@aws-1-sa-east-1.pooler.supabase.com:6543/postgres';

async function verify() {
  const pool = new pg.Pool({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });
  try {
    const tables = ['contas_contabeis', 'suppliers', 'banks', 'transactions', 'boleto_patterns'];
    for (const table of tables) {
      const res = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`Table ${table}: ${res.rows[0].count} rows.`);
    }
  } finally {
    await pool.end();
  }
}

verify();
