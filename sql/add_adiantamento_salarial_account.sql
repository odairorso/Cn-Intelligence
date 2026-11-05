-- Adiciona conta para Vale / Adiantamento Salarial
INSERT INTO contas_contabeis (codigo, nome, tipo, ativo)
VALUES ('3.38', 'Vale / Adiantamento Salarial', 'DESPESA', true)
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    tipo = EXCLUDED.tipo,
    ativo = true;
