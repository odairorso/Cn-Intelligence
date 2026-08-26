INSERT INTO contas_contabeis (codigo, nome, tipo, ativo)
VALUES ('4.11', 'Rendimentos de Aplicações Financeiras', 'RECEITA', true)
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    tipo = EXCLUDED.tipo,
    ativo = true;
