const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function check() {
  try {
    const res = await sql`
      SELECT EXTRACT(YEAR FROM vencimento) as year, COUNT(*), SUM(valor) as total
      FROM transactions
      WHERE uid = 'guest'
      GROUP BY year
      ORDER BY year
    `;
    console.log('--- YEAR DISTRIBUTION ---');
    res.forEach(r => {
      console.log(`Year: [${r.year}] | Count: ${r.count} | Total: ${r.total}`);
    });
  } catch (e) {
    console.error(e);
  }
}

check();
