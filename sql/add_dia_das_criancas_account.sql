INSERT INTO contas_contabeis (codigo, nome, tipo, ativo)
VALUES ('4.13', 'Dia das Crianças', 'RECEITA', true)
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    tipo = EXCLUDED.tipo,
    ativo = true;
