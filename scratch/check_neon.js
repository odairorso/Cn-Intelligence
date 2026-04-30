
import { Client } from 'pg';

const NEON_URL = 'postgresql://neondb_owner:npg_c9LaAv3hXNmD@ep-young-mouse-aclmtaes-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkNeon() {
  const source = new Client({ connectionString: NEON_URL });
  try {
    await source.connect();
    const res = await source.query('SELECT user_id, COUNT(*) as count FROM transactions GROUP BY user_id');
    console.log('Neon Users:', res.rows);
  } catch (err) {
    console.error('Neon check failed:', err);
  } finally {
    await source.end();
  }
}

checkNeon();
