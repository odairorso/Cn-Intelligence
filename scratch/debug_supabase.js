
import dotenv from 'dotenv';
dotenv.config();
const { sql } = await import('../api/_db.js');

async function debug() {
  try {
    const total = await sql`SELECT COUNT(*) as count FROM transactions`;
    const companies = await sql`SELECT empresa, COUNT(*) as count FROM transactions GROUP BY empresa`;
    const users = await sql`SELECT user_id, COUNT(*) as count FROM transactions GROUP BY user_id`;
    
    console.log('Total in Supabase:', total[0].count);
    console.log('Companies:', companies);
    console.log('Users:', users);
  } catch (err) {
    console.error('Debug failed:', err);
  }
}

debug();
