import 'dotenv/config';
import { sql } from '../api/_db.js';

async function checkRLS() {
  try {
    const rows = await sql`
      SELECT 
        relname as tablename, 
        relrowsecurity as rls_enabled 
      FROM pg_class 
      JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace 
      WHERE pg_namespace.nspname = 'public' 
      AND relkind = 'r'
    `;
    console.log('RLS Status:');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error checking RLS:', e);
    process.exit(1);
  }
}

checkRLS();
