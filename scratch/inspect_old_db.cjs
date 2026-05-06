const pg = require('pg');
const oldUrl = 'postgresql://postgres.metrtvzgkcfeoompaidw:Turce.334180@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function inspect() {
  const pool = new pg.Pool({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });
  try {
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables found:', tables.rows.map(r => r.table_name));

    for (const table of tables.rows) {
      const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${table.table_name}'
      `);
      console.log(`Table: ${table.table_name}`);
      console.log(columns.rows);
    }
  } finally {
    await pool.end();
  }
}

inspect();
