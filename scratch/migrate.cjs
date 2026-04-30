
const { Client } = require('pg');

const NEON_URL = 'postgresql://neondb_owner:npg_c9LaAv3hXNmD@ep-young-mouse-aclmtaes-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require';
const SUPABASE_URL = 'postgresql://postgres.metrtvzgkcfeoompaidw:Turce.334180@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';

async function migrate() {
const source = new Client({ connectionString: NEON_URL });
const dest = new Client({
  host: 'aws-1-sa-east-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.metrtvzgkcfeoompaidw',
  password: 'Turce.334180',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

  try {
    await source.connect();
    await dest.connect();
    console.log('Connected to both databases.');

    const tables = ['contas_contabeis', 'suppliers', 'banks', 'transactions', 'boleto_patterns'];

    for (const table of tables) {
      console.log(`Migrating table: ${table}...`);
      
      // Drop and recreate for a clean migration
      await dest.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      
      // Get data from source
      const res = await source.query(`SELECT * FROM ${table}`);
      const rows = res.rows;
      console.log(`Found ${rows.length} rows in ${table}.`);

      if (rows.length === 0) continue;

      // Ensure table exists in destination (basic schema recreation if needed)
      // For transactions, we need to be careful with types.
      // But we can also just let the app's setup logic handle it.
      // However, direct migration is better.
      
      // Let's create the tables if they don't exist based on some known schemas or inspection
      // Create table dynamically based on columns
      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        const colDefs = columns.map(col => {
          if (col === 'id') {
            const val = rows[0][col];
            if (typeof val === 'number') return 'id SERIAL PRIMARY KEY';
            if (typeof val === 'string' && val.length > 30) return 'id UUID PRIMARY KEY';
            return 'id TEXT PRIMARY KEY';
          }
          if (col.includes('date') || col === 'vencimento' || col === 'pagamento' || col === 'ultima_confirmacao') return `"${col}" TIMESTAMP WITH TIME ZONE`;
          if (col === 'valor' || col === 'saldo' || col === 'juros') return `"${col}" NUMERIC`;
          if (col === 'conta_contabil_id' || col === 'confirmacoes') return `"${col}" INTEGER`;
          if (col === 'ativo') return `"${col}" BOOLEAN`;
          return `"${col}" TEXT`;
        }).join(', ');
        
        await dest.query(`CREATE TABLE IF NOT EXISTS "${table}" (${colDefs})`);
      }


      // Clear destination table to avoid duplicates if re-running
      await dest.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);

      // Insert rows
      const columns = Object.keys(rows[0]);
      const colStr = columns.join(', ');
      const valStr = columns.map((_, i) => `$${i + 1}`).join(', ');
      const query = `INSERT INTO ${table} (${colStr}) VALUES (${valStr})`;

      for (const row of rows) {
        const values = columns.map(col => row[col]);
        await dest.query(query, values);
      }
      console.log(`Table ${table} migrated successfully.`);
    }

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await source.end();
    await dest.end();
  }
}

migrate();
