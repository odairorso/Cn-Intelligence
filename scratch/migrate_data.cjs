const pg = require('pg');

const oldUrl = 'postgresql://postgres.metrtvzgkcfeoompaidw:Turce.334180@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const newUrl = 'postgresql://postgres.pfrxigqbslzaflddxxww:Turce.334180@aws-1-sa-east-1.pooler.supabase.com:6543/postgres';

async function migrate() {
  const oldPool = new pg.Pool({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });
  const newPool = new pg.Pool({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });

  try {
    console.log('Connecting to databases...');

    // 1. Setup Tables in New DB
    console.log('Setting up tables in new database...');
    await newPool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await newPool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await newPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        uid VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255),
        display_name VARCHAR(255),
        photo_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`);

    await newPool.query(`
      CREATE TABLE IF NOT EXISTS contas_contabeis (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(20) NOT NULL,
        nome VARCHAR(255) NOT NULL,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
        ativo BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`);

    await newPool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        uid VARCHAR(255) NOT NULL,
        fornecedor VARCHAR(255) NOT NULL,
        descricao TEXT,
        empresa VARCHAR(100),
        vencimento DATE NOT NULL,
        pagamento DATE,
        valor DECIMAL(15, 2) NOT NULL DEFAULT 0,
        status VARCHAR(20) DEFAULT 'PENDENTE',
        observacao TEXT,
        banco VARCHAR(255),
        tipo VARCHAR(10) DEFAULT 'DESPESA',
        juros NUMERIC DEFAULT 0,
        numero_boleto VARCHAR(255),
        conta_contabil_id INTEGER REFERENCES contas_contabeis(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`);

    await newPool.query(`
      CREATE TABLE IF NOT EXISTS banks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        uid VARCHAR(255) NOT NULL,
        nome VARCHAR(255) NOT NULL,
        agencia VARCHAR(100),
        conta VARCHAR(100),
        saldo DECIMAL(15, 2) DEFAULT 0,
        ativo BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`);

    await newPool.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        uid VARCHAR(255) NOT NULL,
        nome VARCHAR(255) NOT NULL,
        cnpj VARCHAR(50),
        email VARCHAR(255),
        telefone VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`);

    await newPool.query(`
      CREATE TABLE IF NOT EXISTS boleto_patterns (
        id SERIAL PRIMARY KEY,
        cnpj VARCHAR(20),
        nome_normalizado VARCHAR(255),
        fornecedor VARCHAR(255) NOT NULL,
        descricao VARCHAR(255),
        empresa VARCHAR(50),
        tipo VARCHAR(10) DEFAULT 'DESPESA',
        conta_contabil_id INTEGER,
        confirmacoes INTEGER DEFAULT 1,
        ultima_confirmacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(cnpj),
        UNIQUE(nome_normalizado)
      )`);

    // 2. Transfer Data
    const tables = ['users', 'contas_contabeis', 'suppliers', 'banks', 'transactions', 'boleto_patterns'];

    for (const table of tables) {
      console.log(`Migrating table: ${table}...`);
      const rows = (await oldPool.query(`SELECT * FROM ${table}`)).rows;
      console.log(`Found ${rows.length} rows in ${table}.`);

      if (rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const placeholders = columns.map((_, i) => `$` + (i + 1)).join(', ');
      const colNames = columns.join(', ');

      await newPool.query(`DELETE FROM ${table}`); // Clear new table first if needed

      for (const row of rows) {
        const values = columns.map(col => row[col]);
        await newPool.query(`INSERT INTO ${table} (${colNames}) VALUES (${placeholders})`, values);
      }
      console.log(`Finished migrating ${table}.`);
    }

    console.log('Migration COMPLETED successfully!');

  } catch (err) {
    console.error('Migration FAILED:', err);
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

migrate();
