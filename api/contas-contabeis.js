import { sql, setCors } from '../_db.js';

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
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  // POST - Criar nova conta
  if (req.method === 'POST') {
    try {
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
