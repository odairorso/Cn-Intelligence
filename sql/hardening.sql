-- ============================================================
-- Hardening SQL — Fluxo de Caixa Grupo CN
-- Executar como superuser para aplicar RLS e constraints
-- ============================================================

-- ---------------------------------------------------------------
-- 1. EXTENSÕES
-- ---------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------
-- 2. TABELA users (novo — autenticação)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uid             VARCHAR(255) UNIQUE NOT NULL,
    email           VARCHAR(255),
    display_name    VARCHAR(255),
    photo_url       TEXT,
    password_hash   TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- RLS para users — o próprio usuário acessa apenas seus dados
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users — acesso ao próprio registro"
    ON users FOR ALL
    USING (uid = current_setting('app.current_uid', true));
CREATE POLICY "Users — admin pode listar"
    ON users FOR SELECT
    USING (true);

-- ---------------------------------------------------------------
-- 3. TABELA api_logs (novo — auditoria de requisições)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_logs (
    id              SERIAL PRIMARY KEY,
    route           VARCHAR(100),
    method          VARCHAR(10) NOT NULL,
    status_code     SMALLINT,
    duration_ms     INTEGER,
    response_size   INTEGER DEFAULT 0,
    uid             VARCHAR(255),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_route ON api_logs(route, created_at);
CREATE INDEX IF NOT EXISTS idx_api_logs_uid ON api_logs(uid) WHERE uid IS NOT NULL;

-- ---------------------------------------------------------------
-- 4. TABELA security_logs (auditório de segurança)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS security_logs (
    id              SERIAL PRIMARY KEY,
    event_type      VARCHAR(50) NOT NULL,
    description     TEXT,
    ip_address      INET,
    user_agent      TEXT,
    uid             VARCHAR(255),
    route           VARCHAR(100),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_logs_created ON security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_uid ON security_logs(uid) WHERE uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_logs_event ON security_logs(event_type, created_at DESC);

-- ---------------------------------------------------------------
-- 5. TABELA transactions (atualizada com owner)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id                  SERIAL PRIMARY KEY,
    uid                 VARCHAR(255) NOT NULL,
    tipo                VARCHAR(20) NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA', 'TRANSFERENCIA')),
    fornecedor          VARCHAR(255) NOT NULL,
    descricao           TEXT DEFAULT '-',
    empresa             VARCHAR(100) DEFAULT 'Geral',
    vencimento          DATE NOT NULL,
    pagamento           DATE,
    valor               NUMERIC(15,2) NOT NULL,
    juros               NUMERIC(15,2) DEFAULT 0,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDENTE'
                        CHECK (status IN ('PAGO', 'PENDENTE', 'VENCIDO', 'CANCELADO')),
    banco               VARCHAR(100),
    numero_boleto       VARCHAR(255),
    conta_contabil_id   INTEGER,
    hash_boleto         VARCHAR(64),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices otimizados para consultas por usuário
CREATE INDEX IF NOT EXISTS idx_transactions_uid ON transactions(uid);
CREATE INDEX IF NOT EXISTS idx_transactions_uid_vencimento ON transactions(uid, vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_uid_numero_boleto ON transactions(uid, numero_boleto) WHERE numero_boleto IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_uid_hash ON transactions(uid, hash_boleto) WHERE hash_boleto IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_uid_status ON transactions(uid, status);
CREATE INDEX IF NOT EXISTS idx_transactions_uid_tipo ON transactions(uid, tipo);

-- Dedup automático — remover duplicatas a cada 30 min via pg_cron ou app
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('*/30 * * * *', $$DELETE FROM transactions WHERE id IN (
--   SELECT id FROM (
--     SELECT id, ROW_NUMBER() OVER (
--       PARTITION BY uid, hash_boleto ORDER BY created_at DESC
--     ) rn FROM transactions WHERE hash_boleto IS NOT NULL
--   ) t WHERE rn > 1
-- )$$);

-- ---------------------------------------------------------------
-- 6. TABELA suppliers (atualizada com owner)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    id              SERIAL PRIMARY KEY,
    uid             VARCHAR(255) NOT NULL,
    nome            VARCHAR(255) NOT NULL,
    cnpj            VARCHAR(18),
    email           VARCHAR(255),
    telefone        VARCHAR(50),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_uid ON suppliers(uid);
CREATE INDEX IF NOT EXISTS idx_suppliers_nome ON suppliers(uid, upper(regexp_replace(nome, '[^A-Za-z0-9]+', ' ', 'g')));

-- ---------------------------------------------------------------
-- 7. TABELA banks (atualizada com owner)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS banks (
    id              SERIAL PRIMARY KEY,
    uid             VARCHAR(255) NOT NULL,
    nome            VARCHAR(255) NOT NULL,
    agencia         VARCHAR(20),
    conta           VARCHAR(20),
    saldo           NUMERIC(15,2) DEFAULT 0,
    ativo           BOOLEAN DEFAULT true,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banks_uid ON banks(uid);

-- ---------------------------------------------------------------
-- 8. TABELA contas_contabeis
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contas_contabeis (
    id              SERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL,
    nome            VARCHAR(255) NOT NULL,
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
    ativo           BOOLEAN DEFAULT true,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contas_contabeis_codigo ON contas_contabeis(codigo);

-- ---------------------------------------------------------------
-- 9. TABELA boleto_patterns (novo — IA aprendizado)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boleto_patterns (
    id                  SERIAL PRIMARY KEY,
    uid                 VARCHAR(255) NOT NULL,
    cnpj                VARCHAR(14),
    nome_normalizado    VARCHAR(255) NOT NULL,
    fornecedor          VARCHAR(255) NOT NULL,
    descricao           VARCHAR(255) DEFAULT '',
    empresa             VARCHAR(100) DEFAULT 'Geral',
    tipo                VARCHAR(20) DEFAULT 'DESPESA',
    conta_contabil_id   INTEGER,
    confirmacoes        INTEGER DEFAULT 1,
    ultima_confirmacao  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boleto_patterns_uid ON boleto_patterns(uid);
CREATE INDEX IF NOT EXISTS idx_boleto_patterns_cnpj ON boleto_patterns(uid, cnpj) WHERE cnpj IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_boleto_patterns_nome ON boleto_patterns(uid, nome_normalizado);

-- ---------------------------------------------------------------
-- 10. TABELA user_settings (preferências do usuário)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
    uid                 VARCHAR(255) PRIMARY KEY,
    empresa_filter      VARCHAR(100) DEFAULT NULL,
    default_account     INTEGER DEFAULT NULL,
    notifications       BOOLEAN DEFAULT true,
    theme               VARCHAR(20) DEFAULT 'dark',
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------
-- Função auxiliar para setar o contexto do usuário
CREATE OR REPLACE FUNCTION set_app_uid(p_uid VARCHAR)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_uid', p_uid, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── transactions ────────────────────────────────────────────
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select_own"
    ON transactions FOR SELECT
    USING (uid = current_setting('app.current_uid', true));

CREATE POLICY "transactions_insert_own"
    ON transactions FOR INSERT
    WITH CHECK (uid = current_setting('app.current_uid', true));

CREATE POLICY "transactions_update_own"
    ON transactions FOR UPDATE
    USING (uid = current_setting('app.current_uid', true))
    WITH CHECK (uid = current_setting('app.current_uid', true));

CREATE POLICY "transactions_delete_own"
    ON transactions FOR DELETE
    USING (uid = current_setting('app.current_uid', true));

-- ─── suppliers ───────────────────────────────────────────────
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_select_own"
    ON suppliers FOR SELECT
    USING (uid = current_setting('app.current_uid', true));

CREATE POLICY "suppliers_insert_own"
    ON suppliers FOR INSERT
    WITH CHECK (uid = current_setting('app.current_uid', true));

CREATE POLICY "suppliers_update_own"
    ON suppliers FOR UPDATE
    USING (uid = current_setting('app.current_uid', true))
    WITH CHECK (uid = current_setting('app.current_uid', true));

CREATE POLICY "suppliers_delete_own"
    ON suppliers FOR DELETE
    USING (uid = current_setting('app.current_uid', true));

-- ─── banks ───────────────────────────────────────────────────
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "banks_select_own"
    ON banks FOR SELECT
    USING (uid = current_setting('app.current_uid', true));

CREATE POLICY "banks_insert_own"
    ON banks FOR INSERT
    WITH CHECK (uid = current_setting('app.current_uid', true));

CREATE POLICY "banks_update_own"
    ON banks FOR UPDATE
    USING (uid = current_setting('app.current_uid', true))
    WITH CHECK (uid = current_setting('app.current_uid', true));

CREATE POLICY "banks_delete_own"
    ON banks FOR DELETE
    USING (uid = current_setting('app.current_uid', true));

-- ─── boleto_patterns ─────────────────────────────────────────
ALTER TABLE boleto_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patterns_select_own"
    ON boleto_patterns FOR SELECT
    USING (uid = current_setting('app.current_uid', true));

CREATE POLICY "patterns_insert_own"
    ON boleto_patterns FOR INSERT
    WITH CHECK (uid = current_setting('app.current_uid', true));

CREATE POLICY "patterns_delete_own"
    ON boleto_patterns FOR DELETE
    USING (uid = current_setting('app.current_uid', true));

-- ─── user_settings ───────────────────────────────────────────
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select_own"
    ON user_settings FOR SELECT
    USING (uid = current_setting('app.current_uid', true));

CREATE POLICY "settings_upsert_own"
    ON user_settings FOR ALL
    USING (uid = current_setting('app.current_uid', true))
    WITH CHECK (uid = current_setting('app.current_uid', true));

-- ─── api_logs — apenas INSERT (leitura só via admin) ─────────
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_logs_insert"
    ON api_logs FOR INSERT
    WITH CHECK (true);

CREATE POLICY "api_logs_select_admin"
    ON api_logs FOR SELECT
    USING (current_setting('app.current_uid', true) = 'admin');

-- ─── security_logs — apenas INSERT ────────────────────────────
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_logs_insert"
    ON security_logs FOR INSERT
    WITH CHECK (true);

CREATE POLICY "security_logs_select_admin"
    ON security_logs FOR SELECT
    USING (current_setting('app.current_uid', true) = 'admin');

-- ─── users — self-select + self-update ────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own"
    ON users FOR SELECT
    USING (uid = current_setting('app.current_uid', true));

CREATE POLICY "users_update_own"
    ON users FOR UPDATE
    USING (uid = current_setting('app.current_uid', true));

-- ---------------------------------------------------------------
-- 12. DADOS PADRÃO (se não existirem)
-- ---------------------------------------------------------------
INSERT INTO contas_contabeis (codigo, nome, tipo, ativo) VALUES
    ('3.1',  'Folha de Pagamento',         'DESPESA', true),
    ('3.2',  'Aluguel',                    'DESPESA', true),
    ('3.3',  'Água / Luz / Telefone',      'DESPESA', true),
    ('3.4',  'Material de Escritório',     'DESPESA', true),
    ('3.5',  'Segurança',                  'DESPESA', true),
    ('3.6',  'Editoras',                   'DESPESA', true),
    ('3.7',  'Impostos',                   'DESPESA', true),
    ('3.8',  'Manutenção',                 'DESPESA', true),
    ('3.9',  'Tarifas Bancárias',          'DESPESA', true),
    ('3.10', 'Juros / Multas',             'DESPESA', true),
    ('3.11', 'Outras Despesas',            'DESPESA', true),
    ('4.1',  'Mensalidades',               'RECEITA', true),
    ('4.2',  'Repasses',                   'RECEITA', true),
    ('4.3',  'Matrículas',                 'RECEITA', true),
    ('4.4',  'Permutas / Convênios',       'RECEITA', true),
    ('4.5',  'Aplicação Bancária',         'RECEITA', true),
    ('4.6',  'Outras Receitas',            'RECEITA', true),
    ('4.7',  'Dia das Mães',               'RECEITA', true)
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------
-- 13. FUNCTION: limpeza automática de transações antigas
-- Mantém apenas as 10.000 mais recentes por usuário
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_old_transactions()
RETURNS VOID AS $$
BEGIN
    DELETE FROM transactions
    WHERE id IN (
        SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (
                PARTITION BY uid ORDER BY vencimento DESC, created_at DESC
            ) as rn
            FROM transactions
        ) t
        WHERE rn > 10000
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------
-- 14. FUNCTION: dedup de transações duplicadas
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION dedup_transactions()
RETURNS VOID AS $$
BEGIN
    DELETE FROM transactions
    WHERE id IN (
        SELECT id FROM (
            SELECT id,
                ROW_NUMBER() OVER (
                    PARTITION BY uid, numero_boleto
                    ORDER BY created_at DESC
                ) as rn
            FROM transactions
            WHERE numero_boleto IS NOT NULL
              AND numero_boleto != ''
        ) t
        WHERE rn > 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;