import 'dotenv/config';
import { sql } from '../api/_db.js';

async function checkPortugueseTables() {
  try {
    const tables = [
      'padrões_boleto_públicos',
      'auditoria_de_segurança_pública',
      'registros_da_api_públicos'
    ];
    const rows = await sql`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname = ANY(${tables})
    `;
    console.log('Results:');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

checkPortugueseTables();
