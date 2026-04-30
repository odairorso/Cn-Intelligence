
import { sql } from '../api/_db.js';

async function check() {
  try {
    const rows = await sql`
      SELECT tipo, count(*) 
      FROM boleto_patterns 
      GROUP BY tipo
    `;
    console.log('Patterns by tipo:');
    console.table(rows);

    const samples = await sql`
      SELECT fornecedor, tipo, confirmacoes
      FROM boleto_patterns
      LIMIT 20
    `;
    console.log('Sample patterns:');
    console.table(samples);
  } catch (e) {
    console.error(e);
  }
}

check();
