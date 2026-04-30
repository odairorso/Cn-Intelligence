
import dotenv from 'dotenv';
dotenv.config();

const { sql } = await import('../api/_db.js');

async function testNested() {
  try {
    const filter = sql`AND 1=1`;
    const uid = 'guest';
    const rows = await sql`SELECT COUNT(*) as total FROM transactions WHERE uid = ${uid} ${filter}`;
    console.log('Nested query success!');
    console.log('Total:', rows[0].total);
  } catch (err) {
    console.error('Nested query failed:', err);
  }
}

testNested();
