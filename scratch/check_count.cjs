const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function check() {
  try {
    const res = await sql`SELECT COUNT(*) FROM transactions`;
    console.log('REAL_DB_COUNT:', res[0].count);
  } catch (e) {
    console.error(e);
  }
}

check();
