import 'dotenv/config';
import { sql } from '../api/_db.js';

async function listPolicies() {
  try {
    const rows = await sql`
      SELECT 
        schemaname, 
        tablename, 
        policyname, 
        permissive, 
        roles, 
        cmd, 
        qual, 
        with_check 
      FROM pg_policies 
      WHERE schemaname = 'public'
    `;
    console.log('Policies:');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error listing policies:', e);
    process.exit(1);
  }
}

listPolicies();
