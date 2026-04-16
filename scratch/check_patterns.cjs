const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function check() {
  try {
    const patterns = await sql`SELECT * FROM supplier_patterns`;
    console.log('--- SUPPLIER PATTERNS ---');
    console.log(JSON.stringify(patterns, null, 2));
    
    const relevantSuppliers = await sql`SELECT * FROM suppliers WHERE nome ILIKE '%EMPRESTIMO%' OR nome ILIKE '%BB%' OR nome ILIKE '%CEI%'`;
    console.log('--- RELEVANT SUPPLIERS ---');
    console.log(JSON.stringify(relevantSuppliers, null, 2));
  } catch (e) {
    console.error(e);
  }
}

check();
