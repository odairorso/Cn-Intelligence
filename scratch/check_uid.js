
import dotenv from 'dotenv';
dotenv.config();
const { sql } = await import('../api/_db.js');

async function checkUid() {
  try {
    const res = await sql`SELECT uid, COUNT(*) as count FROM transactions GROUP BY uid`;
    console.log('Uid distribution in Supabase:', res);
  } catch (err) {
    console.error('Check uid failed:', err);
  }
}

checkUid();
