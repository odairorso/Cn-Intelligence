-- ============================================================
-- Correção de Índices Únicos e Multitenancy
-- Fluxo de Caixa Grupo CN
-- ============================================================

-- 1. Remover restrições únicas globais em boleto_patterns
ALTER TABLE public.boleto_patterns DROP CONSTRAINT IF EXISTS boleto_patterns_cnpj_key CASCADE;
ALTER TABLE public.boleto_patterns DROP CONSTRAINT IF EXISTS boleto_patterns_nome_normalizado_key CASCADE;
DROP INDEX IF EXISTS public.boleto_patterns_cnpj_key;
DROP INDEX IF EXISTS public.boleto_patterns_nome_normalizado_key;

-- Criar índices únicos multitenant para boleto_patterns
CREATE UNIQUE INDEX IF NOT EXISTS idx_boleto_patterns_cnpj_tenant 
  ON public.boleto_patterns (uid, cnpj) 
  WHERE (cnpj IS NOT NULL AND cnpj != '');

CREATE UNIQUE INDEX IF NOT EXISTS idx_boleto_patterns_nome_tenant 
  ON public.boleto_patterns (uid, nome_normalizado);


-- 2. Remover índice único global de número de boleto em transactions
DROP INDEX IF EXISTS public.idx_transactions_boleto_unique;

-- Criar índice único composto multitenant considerando soft delete (deleted_at IS NULL) e fornecedor
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_boleto_unique_tenant
  ON public.transactions (uid, upper(coalesce(fornecedor, '')), regexp_replace(upper(coalesce(numero_boleto, '')), '[^A-Z0-9]', '', 'g'))
  WHERE (numero_boleto IS NOT NULL AND numero_boleto != '' AND deleted_at IS NULL);


-- 3. Remover índice duplicado redundante em transactions
DROP INDEX IF EXISTS public.idx_transactions_uid_vencimento_active;
