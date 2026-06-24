-- ============================================================
-- Performance Indexes - Fluxo de Caixa Grupo CN
-- Execute este script no banco PostgreSQL (Supabase) para acelerar as queries
-- ============================================================

-- Helper functions (IMMUTABLE wrappers for index compatibility)
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text AS $$ SELECT unaccent($1) $$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION immutable_regexp_replace(text, text, text, text)
RETURNS text AS $$ SELECT regexp_replace($1, $2, $3, $4) $$ LANGUAGE sql IMMUTABLE;

-- 1. Indice composto para soft delete + uid (usado em TODAS as queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_uid_deleted
  ON transactions (uid, deleted_at)
  WHERE deleted_at IS NULL;

-- 2. Indice para busca textual com unaccent (fornecedor)
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_unaccent_fornecedor
  ON transactions (immutable_unaccent(fornecedor))
  WHERE deleted_at IS NULL;

-- 3. Indice para busca textual em descricao
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_unaccent_descricao
  ON transactions (immutable_unaccent(coalesce(descricao, '')))
  WHERE deleted_at IS NULL;

-- 4. Indice para busca textual em empresa
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_unaccent_empresa
  ON transactions (immutable_unaccent(coalesce(empresa, '')))
  WHERE deleted_at IS NULL;

-- 5. Indice para vencimento (filtrado por uid e deleted)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_uid_vencimento
  ON transactions (uid, vencimento DESC)
  WHERE deleted_at IS NULL;

-- 6. Indice para deteccao de duplicidade por boleto
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_uid_boleto_normalized
  ON transactions (uid, (immutable_regexp_replace(upper(coalesce(numero_boleto, '')), '[^A-Z0-9]', '', 'g')))
  WHERE deleted_at IS NULL;

-- 7. Indice para deteccao de duplicidade por chave composta
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_dedup_composite
  ON transactions (uid, upper(coalesce(fornecedor, '')), vencimento, valor, upper(coalesce(descricao, '')), upper(coalesce(empresa, '')))
  WHERE deleted_at IS NULL;

-- 8. Indice para filtros por tipo e status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_uid_tipo_status
  ON transactions (uid, tipo, status)
  WHERE deleted_at IS NULL;

-- 9. Indice para fornecedores - busca por nome normalizado
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_suppliers_uid_name
  ON suppliers (uid, upper(replace(replace(replace(replace(replace(nome, '.', ''), '-', ''), ' ', ''), '/', ''), '&', '')))
  WHERE deleted_at IS NULL;

-- 10. Indice para stats - soma de valores por tipo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_uid_tipo_valor
  ON transactions (uid, tipo, valor)
  WHERE deleted_at IS NULL;

-- 11. Indice para stats - agrupamento mensal
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_uid_vencimento_tipo
  ON transactions (uid, vencimento, tipo)
  WHERE deleted_at IS NULL;

-- 12. Indice para busca por data range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_vencimento_range
  ON transactions (vencimento)
  WHERE deleted_at IS NULL;

-- 13. Indice para top fornecedores (maior gasto)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_fornecedor_valor
  ON transactions (uid, fornecedor, valor)
  WHERE deleted_at IS NULL AND tipo = 'DESPESA';
