import { sql, setCors } from '../_db.js';

async function ensureContasTable() {
  // Cria tabela e insere plano padrão se estiver vazia
  await sql`
    CREATE TABLE IF NOT EXISTS contas_contabeis (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(20) NOT NULL,
      nome VARCHAR(255) NOT NULL,
      tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;
  const existing = await sql`SELECT COUNT(*)::int AS cnt FROM contas_contabeis`;
  if (Number(existing[0].cnt) === 0) {
    await sql`
      INSERT INTO contas_contabeis (codigo, nome, tipo) VALUES
      ('3.1', 'Folha de Pagamento', 'DESPESA'),
      ('3.2', 'Aluguel', 'DESPESA'),
      ('3.3', 'Água / Luz / Telefone', 'DESPESA'),
      ('3.4', 'Material de Escritório', 'DESPESA'),
      ('3.5', 'Segurança', 'DESPESA'),
      ('3.6', 'Editoras', 'DESPESA'),
      ('3.7', 'Impostos', 'DESPESA'),
      ('3.8', 'Manutenção', 'DESPESA'),
      ('3.9', 'Outras Despesas', 'DESPESA'),
      ('4.1', 'Mensalidades', 'RECEITA'),
      ('4.2', 'Repasses', 'RECEITA'),
      ('4.3', 'Matrículas', 'RECEITA'),
      ('4.4', 'Permutas / Convênios', 'RECEITA'),
      ('4.5', 'Outras Receitas', 'RECEITA')`;
  }
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET - Listar todas as contas
  if (req.method === 'GET') {
    try {
      const { ativo } = req.query;
      let rows;
      if (ativo === 'false') {
        rows = await sql`SELECT * FROM contas_contabeis ORDER BY tipo, codigo ASC`;
      } else {
        rows = await sql`SELECT * FROM contas_contabeis WHERE ativo = true ORDER BY tipo, codigo ASC`;
      }
      return res.json(rows);
    } catch (e) {
      try {
        // Se a tabela não existir, cria e tenta novamente
        await ensureContasTable();
        const rows = await sql`SELECT * FROM contas_contabeis WHERE ativo = true ORDER BY tipo, codigo ASC`;
        return res.json(rows);
      } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }
    }
  }

  // POST - Criar nova conta
  if (req.method === 'POST') {
    try {
      await ensureContasTable();
      const { codigo, nome, tipo } = req.body;
      if (!codigo || !nome || !tipo) {
        return res.status(400).json({ error: 'codigo, nome e tipo são obrigatórios' });
      }
      const rows = await sql`
        INSERT INTO contas_contabeis (codigo, nome, tipo)
        VALUES (${codigo}, ${nome}, ${tipo})
        RETURNING *`;
      return res.status(201).json(rows[0]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  // PUT - Atualizar conta
  if (req.method === 'PUT') {
    try {
      await ensureContasTable();
      const { id } = req.query;
      const { codigo, nome, tipo, ativo } = req.body;
      const rows = await sql`
        UPDATE contas_contabeis SET
          codigo = COALESCE(${codigo}, codigo),
          nome = COALESCE(${nome}, nome),
          tipo = COALESCE(${tipo}, tipo),
          ativo = COALESCE(${ativo}, ativo)
        WHERE id = ${id}
        RETURNING *`;
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Conta não encontrada' });
      }
      return res.json(rows[0]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  // DELETE - Desativar conta
  if (req.method === 'DELETE') {
    try {
      await ensureContasTable();
      const { id } = req.query;
      await sql`UPDATE contas_contabeis SET ativo = false WHERE id = ${id}`;
      return res.status(204).end();
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
