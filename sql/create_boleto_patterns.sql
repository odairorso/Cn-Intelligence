-- Tabela de padrões aprendidos de boletos
-- Cada linha representa um padrão confirmado pelo usuário
CREATE TABLE IF NOT EXISTS boleto_patterns (
  id SERIAL PRIMARY KEY,
  -- Chave de identificação do emissor
  cnpj VARCHAR(20),                    -- CNPJ do beneficiário (mais confiável)
  nome_normalizado VARCHAR(255),       -- Nome normalizado do beneficiário
  -- O que foi aprendido
  fornecedor VARCHAR(255) NOT NULL,    -- Nome canônico do fornecedor no sistema
  descricao VARCHAR(255),              -- Descrição padrão do serviço
  empresa VARCHAR(50),                 -- Empresa do Grupo CN que paga
  tipo VARCHAR(10) DEFAULT 'DESPESA',  -- DESPESA ou RECEITA
  conta_contabil_id INTEGER,           -- Conta contábil padrão
  -- Metadados
  confirmacoes INTEGER DEFAULT 1,      -- Quantas vezes foi confirmado
  ultima_confirmacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Unicidade por CNPJ ou nome normalizado
  UNIQUE(cnpj),
  UNIQUE(nome_normalizado)
);

CREATE INDEX IF NOT EXISTS idx_boleto_patterns_cnpj ON boleto_patterns(cnpj);
CREATE INDEX IF NOT EXISTS idx_boleto_patterns_nome ON boleto_patterns(nome_normalizado);
