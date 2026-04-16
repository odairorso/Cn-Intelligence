const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function checkPatterns() {
  try {
    const patterns = await sql`SELECT * FROM boleto_patterns`;
    console.log('--- ALL PATTERNS ---');
    console.log(JSON.stringify(patterns, null, 2));
    
    // Check specifically for the CNPJ of Sanesul (03.982.931/0001-20)
    const sanesulPattern = await sql`SELECT * FROM boleto_patterns WHERE cnpj LIKE '03982931%'`;
    console.log('--- SANESUL SPECIFIC PATTERNS ---');
    console.log(JSON.stringify(sanesulPattern, null, 2));

  } catch (e) {
    console.error(e);
  }
}

checkPatterns();
