import 'dotenv/config';
import { sql } from '../api/_db.js';

async function clearLogPolicies() {
  try {
    console.log('Cleaning up log policies to clear warnings...');

    const tasks = [
      // Remove permissive INSERT policies. 
      // With RLS ENABLED and NO policies, the anon/authenticated roles are blocked.
      // The server (using postgres role) still works because it bypasses RLS.
      `DROP POLICY IF EXISTS "api_logs_insert" ON api_logs`,
      `DROP POLICY IF EXISTS "security_audit_insert" ON security_audit`,
      `DROP POLICY IF EXISTS "Allow system insert" ON api_logs`,
      `DROP POLICY IF EXISTS "Allow system insert" ON security_audit`
    ];

    for (const task of tasks) {
      console.log(`Executing: ${task}...`);
      try {
        await sql(task);
      } catch (e) {
        console.warn(`Note: ${e.message}`);
      }
    }

    console.log('Cleanup complete. The warnings should disappear after the next scan.');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

clearLogPolicies();
