import 'dotenv/config';
import { sql } from '../api/_db.js';

async function listAllTablesRLS() {
  try {
    const rows = await sql`
      SELECT 
        n.nspname as schema,
        c.relname as name, 
        c.relrowsecurity as rls_enabled 
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND c.relkind = 'r'
    `;
    console.log('All Tables RLS Status:');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

listAllTablesRLS();
