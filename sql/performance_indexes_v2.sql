-- ============================================================================
-- Índices de performance — Cn-Intelligence
-- Rodar UMA vez no banco de produção (Neon/Supabase SQL Editor).
-- É seguro rodar de novo: tudo usa IF NOT EXISTS.
-- ============================================================================

-- 1) Busca textual (ILIKE '%termo%') -------------------------------------------------
-- Os índices btree em immutable_unaccent(...) NÃO atendem ILIKE com % na frente.
-- Sem pg_trgm, toda busca varre a tabela inteira do tenant.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_tx_fornecedor_trgm
  ON transactions USING gin (immutable_unaccent(fornecedor) gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tx_descricao_trgm
  ON transactions USING gin (immutable_unaccent(coalesce(descricao, '')) gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tx_empresa_trgm
  ON transactions USING gin (immutable_unaccent(coalesce(empresa, '')) gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- 2) Ordenação da listagem principal ------------------------------------------------
-- ORDER BY pagamento DESC NULLS LAST, vencimento DESC  (transactions.js)
CREATE INDEX IF NOT EXISTS idx_tx_uid_pagamento_venc
  ON transactions (uid, pagamento DESC NULLS LAST, vencimento DESC)
  WHERE deleted_at IS NULL;

-- 3) Filtro por empresa (upper(empresa)) --------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tx_uid_empresa_upper
  ON transactions (uid, upper(coalesce(empresa, '')))
  WHERE deleted_at IS NULL;

-- 4) Filtro por status (dashboard/relatórios) ---------------------------------------
CREATE INDEX IF NOT EXISTS idx_tx_uid_status
  ON transactions (uid, status)
  WHERE deleted_at IS NULL;

-- 5) Fornecedores: junção por nome normalizado --------------------------------------
-- suppliers.js faz LEFT JOIN em immutable_unaccent(coalesce(tc.fornecedor,''))
CREATE INDEX IF NOT EXISTS idx_tx_fornecedor_norm
  ON transactions (uid, immutable_unaccent(coalesce(fornecedor, '')))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_nome_norm
  ON suppliers (uid, immutable_unaccent(coalesce(nome, '')));

-- 6) Listagens auxiliares ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_boleto_patterns_uid_confirmacoes
  ON boleto_patterns (uid, confirmacoes DESC);

-- ============================================================================
-- Depois de rodar: ANALYZE para o planejador usar os índices novos.
-- ============================================================================
ANALYZE transactions;
ANALYZE suppliers;
ANALYZE boleto_patterns;
