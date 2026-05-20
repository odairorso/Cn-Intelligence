import { config } from 'dotenv';
import pg from 'pg';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('🔧 Adicionando colunas de auditoria em transactions...');
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS deleted_by TEXT`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by TEXT`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_by TEXT`);

    console.log('📋 Criando tabela audit_logs...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_uid TEXT NOT NULL,
        action VARCHAR(20) NOT NULL,
        tabela VARCHAR(50) NOT NULL DEFAULT 'transactions',
        record_id TEXT,
        dados_antigos JSONB,
        dados_novos JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(record_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_uid);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    `);

    await client.query('COMMIT');
    console.log('✅ Migração v2 concluída com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na migração:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
