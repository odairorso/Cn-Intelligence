import 'dotenv/config';
import { sql } from '../api/_db.js';

async function findPermissivePolicies() {
  try {
    const rows = await sql`
      SELECT 
        tablename, 
        policyname, 
        roles, 
        cmd, 
        qual 
      FROM pg_policies 
      WHERE schemaname = 'public' 
      AND (roles::text[] && ARRAY['anon', 'public']::text[])
    `;
    console.log('Permissive Policies:');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

findPermissivePolicies();
