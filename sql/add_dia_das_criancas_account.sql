-- Adiciona contas para o Dia das Crianças (Receita e Despesa)
INSERT INTO contas_contabeis (codigo, nome, tipo, ativo)
VALUES 
    ('4.13', 'Dia das Crianças', 'RECEITA', true),
    ('3.36', 'Festa / Evento Dia das Crianças', 'DESPESA', true)
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    tipo = EXCLUDED.tipo,
    ativo = true;
