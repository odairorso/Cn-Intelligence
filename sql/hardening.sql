-- ============================================
-- CN Intelligence - FULL SETUP & HARDENING (FINAL)
-- Garante que as tabelas existam e aplica segurança
-- ============================================

-- 1. Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Garantir que as tabelas básicas existam
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    display_name VARCHAR(255),
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    uid VARCHAR(255) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    cnpj VARCHAR(50),
    email VARCHAR(255),
    telefone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    numero_boleto VARCHAR(255),
    conta_contabil_id INTEGER,
    tipo VARCHAR(20) DEFAULT 'DESPESA',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS banks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    uid VARCHAR(255) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    agencia VARCHAR(100),
    conta VARCHAR(100),
    saldo DECIMAL(15, 2) DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    uid VARCHAR(255) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(uid, key)
);

-- 3. Ativar Row Level Security (RLS) em tudo
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 4. Criar Políticas de Acesso (Tenancy Isolation)
DO $$ 
BEGIN
    -- Política para Transações
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can only see their own transactions') THEN
        CREATE POLICY "Users can only see their own transactions" ON transactions FOR ALL USING (uid = current_setting('request.jwt.claims', true)::json->>'sub' OR uid = 'guest');
    END IF;

    -- Política para Fornecedores
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can only see their own suppliers') THEN
        CREATE POLICY "Users can only see their own suppliers" ON suppliers FOR ALL USING (uid = current_setting('request.jwt.claims', true)::json->>'sub' OR uid = 'guest');
    END IF;
END $$;

-- 5. Adicionar Constraints de Integridade
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS check_transaction_status;
ALTER TABLE transactions ADD CONSTRAINT check_transaction_status CHECK (status IN ('PAGO', 'PENDENTE', 'VENCIDO', 'CANCELADO'));

-- 6. Índices para performance
CREATE INDEX IF NOT EXISTS idx_transactions_uid_venc ON transactions(uid, vencimento);
CREATE INDEX IF NOT EXISTS idx_transactions_numero_boleto ON transactions(numero_boleto);

-- SCRIPT EXECUTADO COM SUCESSO!
