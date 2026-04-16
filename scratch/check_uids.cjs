const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function check() {
  try {
    const res = await sql`
      SELECT uid, COUNT(*), SUM(valor) as total
      FROM transactions
      GROUP BY uid
    `;
    console.log('--- UID DISTRIBUTION ---');
    res.forEach(r => {
      console.log(`UID: [${r.uid}] | Count: ${r.count} | Total: ${r.total}`);
    });
  } catch (e) {
    console.error(e);
  }
}

check();
