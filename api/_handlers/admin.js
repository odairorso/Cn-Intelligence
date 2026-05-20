import { sql } from '../_db.js';
import { logSecurity } from '../_utils.js';

// POST /api?route=setup-tables
export async function handleSetupTables(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    
    // Tabela de usuários
    await sql`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      uid VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255),
      display_name VARCHAR(255),
      photo_url TEXT,
      password_hash TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;

    // Tabela de contas contábeis
    await sql`CREATE TABLE IF NOT EXISTS contas_contabeis (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(20) UNIQUE NOT NULL,
      nome VARCHAR(255) NOT NULL,
      tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;

    // Seeder de contas contábeis padrão
    const defaultAccounts = [
      { codigo: '3.1',  nome: 'Folha de Pagamento',    tipo: 'DESPESA' },
      { codigo: '3.2',  nome: 'Aluguel',               tipo: 'DESPESA' },
      { codigo: '3.3',  nome: 'Água / Luz / Telefone', tipo: 'DESPESA' },
      { codigo: '3.4',  nome: 'Material de Escritório',tipo: 'DESPESA' },
      { codigo: '3.5',  nome: 'Segurança',             tipo: 'DESPESA' },
      { codigo: '3.6',  nome: 'Editoras',              tipo: 'DESPESA' },
      { codigo: '3.7',  nome: 'Impostos',              tipo: 'DESPESA' },
      { codigo: '3.8',  nome: 'Manutenção',            tipo: 'DESPESA' },
      { codigo: '3.9',  nome: 'Tarifas Bancárias',     tipo: 'DESPESA' },
      { codigo: '3.10', nome: 'Juros / Multas',        tipo: 'DESPESA' },
      { codigo: '3.11', nome: 'Outras Despesas',       tipo: 'DESPESA' },
      { codigo: '4.1',  nome: 'Mensalidades',          tipo: 'RECEITA' },
      { codigo: '4.2',  nome: 'Repasses',              tipo: 'RECEITA' },
      { codigo: '4.3',  nome: 'Matrículas',            tipo: 'RECEITA' },
      { codigo: '4.4',  nome: 'Permutas / Convênios',  tipo: 'RECEITA' },
      { codigo: '4.5',  nome: 'Aplicação Bancária',    tipo: 'RECEITA' },
      { codigo: '4.6',  nome: 'Outras Receitas',       tipo: 'RECEITA' },
      { codigo: '4.7',  nome: 'Dia das Mães',          tipo: 'RECEITA' },
      { codigo: '4.8',  nome: 'Aluguel',               tipo: 'RECEITA' }
    ];

    for (const acc of defaultAccounts) {
      await sql`
        INSERT INTO contas_contabeis (codigo, nome, tipo)
        VALUES (${acc.codigo}, ${acc.nome}, ${acc.tipo})
        ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativo = true
      `;
    }

    return res.json({ message: 'Tables verified/created and default accounts seeded successfully' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// GET /api?route=db-check
export async function handleDbCheck(req, res) {
  try {
    const rows = await sql`SELECT 1 AS ok, version(), current_database() as db`;
    return res.json({ ok: true, info: rows[0] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}

// GET /api?route=export-backup
export async function handleExportBackup(req, res) {
  const backupToken = req.headers['x-cn-backup-token'];
  const BACKUP_TOKEN = process.env.BACKUP_TOKEN;

  if (!BACKUP_TOKEN) {
    await logSecurity(req, res, "BACKUP_TOKEN não configurado no servidor");
    return res.status(500).json({ error: 'Backup não disponível. BACKUP_TOKEN não configurado.' });
  }

  if (backupToken !== BACKUP_TOKEN) {
    await logSecurity(req, res, "Tentativa de backup sem token válido");
    return res.status(403).json({ error: "Acesso negado" });
  }

  try {
    const [txs, sups, banks] = await Promise.all([
      sql`SELECT * FROM transactions`,
      sql`SELECT * FROM suppliers`,
      sql`SELECT * FROM banks`
    ]);
    return res.json({ timestamp: new Date(), data: { transactions: txs, suppliers: sups, banks } });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// Logging Helpers
export async function logRequest(req, res, startTime, responseSize = 0) {
  const duration = Date.now() - startTime;
  try {
    await sql`
      INSERT INTO api_logs (route, method, status_code, duration_ms, response_size_bytes)
      VALUES (${req.query.route || "unknown"}, ${req.method}, ${res.statusCode}, ${duration}, ${responseSize})
    `;
  } catch (e) {
    console.error("[logRequest] Error:", e.message);
  }
}