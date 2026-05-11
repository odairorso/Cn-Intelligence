-- ============================================
-- CN Intelligence - SCRIPT DE HARDENING DE BANCO
-- OBJETIVO: Segurança Máxima e Integridade
-- ============================================

-- 1. Ativando Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 2. Políticas de Isolamento (Tenancy Isolation)
-- Estas políticas garantem que o usuário autenticado só acesse o seu próprio UID.

-- Transações
DROP POLICY IF EXISTS "Users can only see their own transactions" ON transactions;
CREATE POLICY "Users can only see their own transactions" ON transactions
    FOR ALL USING (auth.uid()::text = uid);

-- Fornecedores
DROP POLICY IF EXISTS "Users can only see their own suppliers" ON suppliers;
CREATE POLICY "Users can only see their own suppliers" ON suppliers
    FOR ALL USING (auth.uid()::text = uid);

-- Bancos
DROP POLICY IF EXISTS "Users can only see their own banks" ON banks;
CREATE POLICY "Users can only see their own banks" ON banks
    FOR ALL USING (auth.uid()::text = uid);

-- 3. Constraints de Integridade de Dados
-- Garante que o status seja sempre um dos válidos
ALTER TABLE transactions 
    DROP CONSTRAINT IF EXISTS check_transaction_status;
ALTER TABLE transactions 
    ADD CONSTRAINT check_transaction_status 
    CHECK (status IN ('PAGO', 'PENDENTE', 'VENCIDO', 'CANCELADO'));

-- Garante que o valor nunca seja nulo ou infinito (básico para auditoria jurídica)
ALTER TABLE transactions 
    ALTER COLUMN valor SET NOT NULL,
    ALTER COLUMN vencimento SET NOT NULL;

-- 4. Proteção contra Deleção Acidental
-- Impede que um usuário seja deletado se houver transações (opcional, dependendo da regra de negócio)
-- ALTER TABLE transactions 
--    DROP CONSTRAINT IF EXISTS transactions_user_id_fkey,
--    ADD CONSTRAINT transactions_user_id_fkey 
--    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

-- 5. Índices de Performance para Auditoria
CREATE INDEX IF NOT EXISTS idx_transactions_composite_venc_uid ON transactions(uid, vencimento);
CREATE INDEX IF NOT EXISTS idx_suppliers_nome_uid ON suppliers(uid, nome);

-- ============================================
-- SCRIPT APLICADO COM SUCESSO
-- ============================================
