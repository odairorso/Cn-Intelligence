import { sql } from '../_db.js';
import { logSecurity, handleError } from '../_utils.js';

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
      { codigo: '3.12', nome: 'Pagamento de Empréstimo', tipo: 'DESPESA' },
      { codigo: '4.1',  nome: 'Mensalidades',          tipo: 'RECEITA' },
      { codigo: '4.2',  nome: 'Repasses',              tipo: 'RECEITA' },
      { codigo: '4.3',  nome: 'Matrículas',            tipo: 'RECEITA' },
      { codigo: '4.4',  nome: 'Permutas / Convênios',  tipo: 'RECEITA' },
      { codigo: '4.5',  nome: 'Aplicação Bancária',    tipo: 'RECEITA' },
      { codigo: '4.6',  nome: 'Outras Receitas',       tipo: 'RECEITA' },
      { codigo: '4.7',  nome: 'Dia das Mães',          tipo: 'RECEITA' },
      { codigo: '4.8',  nome: 'Aluguel',               tipo: 'RECEITA' },
      { codigo: '4.9',  nome: 'Receita Cartão',        tipo: 'RECEITA' },
      { codigo: '4.10', nome: 'Empréstimo',            tipo: 'RECEITA' }
    ];

    for (const acc of defaultAccounts) {
      await sql`
        INSERT INTO contas_contabeis (codigo, nome, tipo)
        VALUES (${acc.codigo}, ${acc.nome}, ${acc.tipo})
        ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativo = true
      `;
    }

    // Soft Delete + Auditoria (colunas adicionais em transactions)
    await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`;
    await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS deleted_by TEXT`;
    await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by TEXT`;
    await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_by TEXT`;

    // Tabela de Auditoria
    await sql`
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
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(record_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_uid)`;

    // Tabela de segmentos
    await sql`CREATE TABLE IF NOT EXISTS segmentos (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      uid VARCHAR(255) NOT NULL,
      nome TEXT NOT NULL,
      horas_semanais NUMERIC(10,2) NOT NULL DEFAULT 10,
      perc_repouso NUMERIC(10,4) NOT NULL DEFAULT 0.1667,
      ha_percent NUMERIC(10,4) NOT NULL DEFAULT 0.05,
      valor_hora NUMERIC(10,2) NOT NULL DEFAULT 0,
      ajuda_custo NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE (uid, nome)
    )`;

    // Tabela de professores
    await sql`CREATE TABLE IF NOT EXISTS professores (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      uid VARCHAR(255) NOT NULL,
      nome TEXT NOT NULL,
      cpf TEXT NOT NULL,
      data_admissao DATE NOT NULL DEFAULT CURRENT_DATE,
      horas_semanais NUMERIC(10,2),
      valor_hora NUMERIC(10,2),
      ajuda_custo NUMERIC(10,2),
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;

    // Relacionamento N:N professor <-> segmento
    await sql`CREATE TABLE IF NOT EXISTS professor_segmentos (
      professor_id UUID NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
      segmento_id UUID NOT NULL REFERENCES segmentos(id) ON DELETE CASCADE,
      horas_semanais NUMERIC(10,2) NOT NULL DEFAULT 0,
      PRIMARY KEY (professor_id, segmento_id)
    )`;

    // Lançamentos mensais
    await sql`CREATE TABLE IF NOT EXISTS lancamentos (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      uid VARCHAR(255) NOT NULL,
      professor_id UUID NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
      segmento_id UUID NOT NULL REFERENCES segmentos(id) ON DELETE CASCADE,
      competencia TEXT NOT NULL, -- YYYY-MM
      horas_mensais NUMERIC(10,2) NOT NULL,
      repouso NUMERIC(10,2) NOT NULL,
      horas_atividade NUMERIC(10,2) NOT NULL,
      total_horas NUMERIC(10,2) NOT NULL,
      ajuda_custo NUMERIC(10,2) NOT NULL,
      total_pagar NUMERIC(12,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'aberto',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT lanc_status_chk CHECK (status IN ('aberto','fechado'))
    )`;

    // Fechamentos
    await sql`CREATE TABLE IF NOT EXISTS fechamentos (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      uid VARCHAR(255) NOT NULL,
      competencia TEXT NOT NULL,
      data_fechamento DATE NOT NULL DEFAULT CURRENT_DATE,
      observacao TEXT,
      total_geral NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE (uid, competencia)
    )`;

    // Índices
    await sql`CREATE INDEX IF NOT EXISTS idx_lanc_uid_comp ON lancamentos (uid, competencia)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_fech_uid_comp ON fechamentos (uid, competencia)`;

    // Seeder de segmentos padrão
    const defaultSegments = [
      ['Berçário I', 10, 1/6, 0.05, 17.68, 10.00],
      ['Berçário II', 10, 1/6, 0.05, 17.68, 0.00],
      ['Ed. Infantil', 10, 1/6, 0.05, 17.68, 0.00],
      ['Fund. I', 10, 1/6, 0.05, 19.59, 0.00],
      ['Fund. II', 10, 1/6, 0.20, 26.32, 0.00],
      ['Ens. Médio', 10, 1/6, 0.20, 26.32, 0.00],
      ['Estagiária', 30, 0, 0, 0, 1000.00],
      ['Monitora', 0, 0, 0, 0, 1621.00]
    ];

    const uid = req.authUid || 'odair';
    for (const [nome, hs, pr, ha, vh, aj] of defaultSegments) {
      await sql`
        INSERT INTO segmentos (uid, nome, horas_semanais, perc_repouso, ha_percent, valor_hora, ajuda_custo)
        VALUES (${uid}, ${nome}, ${hs}, ${pr}, ${ha}, ${vh}, ${aj})
        ON CONFLICT (uid, nome)
        DO NOTHING
      `;
    }

    // Índice de expressão para busca imutável no nome de fornecedores (otimização de join)
    await sql`CREATE INDEX IF NOT EXISTS idx_suppliers_unaccent_nome ON suppliers (immutable_unaccent(nome))`;

    return res.json({ message: 'Tables verified/created and default accounts seeded successfully' });
  } catch (e) {
    return handleError(res, e, 'admin.js handleSetupTables');
  }
}

// GET /api?route=db-check
export async function handleDbCheck(req, res) {
  try {
    const rows = await sql`SELECT 1 AS ok, version(), current_database() as db`;
    return res.json({ ok: true, info: rows[0] });
  } catch (e) {
    console.error('[admin.js handleDbCheck Error]:', e);
    return res.status(500).json({ ok: false, error: 'Erro interno no servidor' });
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
    return handleError(res, e, 'admin.js handleExportBackup');
  }
}

// Logging Helpers
export async function logRequest(req, res, startTime, responseSize = 0) {
  const duration = Date.now() - startTime;
  try {
    await sql`
      INSERT INTO api_logs (route, method, status_code, duration_ms, response_size, uid)
      VALUES (${req.query.route || "unknown"}, ${req.method}, ${res.statusCode}, ${duration}, ${responseSize}, ${req.authUid || null})
    `;
  } catch (e) {
    console.error("[logRequest] Error:", e.message);
  }
}