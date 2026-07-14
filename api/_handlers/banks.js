import { sql } from '../_db.js';
import { BankSchema, ContaContabilSchema } from '../_schemas.js';
import { handleError } from '../_utils.js';

// GET/POST /api?route=banks
export async function handleBanks(req, res) {
  const uid = req.authUid;

  if (req.method === 'GET') {
    try {
      if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });
      const rows = await sql`
        SELECT 
          b.id,
          b.uid,
          b.nome,
          b.agencia,
          b.conta,
          b.saldo,
          b.ativo,
          COALESCE(
            (
              SELECT SUM(
                CASE 
                  WHEN t.valor = 'NaN'::numeric THEN 0 
                  WHEN t.tipo = 'RECEITA' THEN (t.valor + COALESCE(t.juros, 0))
                  WHEN t.tipo = 'DESPESA' THEN -(t.valor + COALESCE(t.juros, 0))
                  WHEN t.tipo = 'TRANSFERENCIA' THEN t.valor
                  ELSE -(t.valor + COALESCE(t.juros, 0))
                END
              )
              FROM transactions t
              WHERE t.uid = b.uid
                AND t.deleted_at IS NULL
                AND t.status = 'PAGO'
                AND regexp_replace(upper(coalesce(t.banco, '')), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(coalesce(b.nome, '')), '[^A-Z0-9]', '', 'g')
            ), 
            0
          ) AS total_pago
        FROM banks b
        WHERE b.uid = ${uid}
        ORDER BY b.nome ASC
      `;
      
      const formatted = rows.map(b => ({
        ...b,
        saldo: Number(b.saldo),
        total_pago: Number(b.total_pago)
      }));
      
      return res.json(formatted);
    } catch (e) {
      return handleError(res, e, 'banks.js handleBanks GET');
    }
  }

  if (req.method === 'POST') {
    try {
      if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

      const result = BankSchema.safeParse({ ...(req.body || {}), uid });
      if (!result.success) {
        return res.status(400).json({ error: 'Dados inválidos', details: result.error.flatten().fieldErrors });
      }

      const { nome, agencia, conta, saldo, ativo } = result.data;
      const rows = await sql`
        INSERT INTO banks (uid, nome, agencia, conta, saldo, ativo)
        VALUES (${uid}, ${nome}, ${agencia || null}, ${conta || null}, ${saldo || 0}, ${ativo !== false})
        RETURNING *`;
      return res.status(201).json(rows[0]);
    } catch (e) {
      return handleError(res, e, 'banks.js handleBanks POST');
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// PUT/DELETE /api?route=banks&id=xxx
export async function handleBankById(req, res) {
  const uid = req.authUid;

  const { id } = req.query;
  if (req.method === 'PUT') {
    try {
      if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

      const result = BankSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Dados inválidos', details: result.error.flatten().fieldErrors });
      }

      // Verificar propriedade
      const existing = await sql`SELECT id FROM banks WHERE id = ${id} AND uid = ${uid}`;
      if (existing.length === 0) return res.status(404).json({ error: 'Not found' });

      const { nome, agencia, conta, saldo, ativo } = result.data;
      const rows = await sql`
        UPDATE banks
        SET nome = COALESCE(${nome}, nome),
            agencia = COALESCE(${agencia}, agencia),
            conta = COALESCE(${conta}, conta),
            saldo = COALESCE(${saldo}, saldo),
            ativo = COALESCE(${ativo}, ativo)
        WHERE id = ${id} AND uid = ${uid}
        RETURNING *`;
      return res.json(rows[0]);
    } catch (e) {
      return handleError(res, e, 'banks.js handleBankById PUT');
    }
  }
  if (req.method === 'DELETE') {
    try {
      if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });
      const existing = await sql`SELECT id FROM banks WHERE id = ${id} AND uid = ${uid}`;
      if (existing.length === 0) return res.status(404).json({ error: 'Not found' });
      await sql`DELETE FROM banks WHERE id = ${id} AND uid = ${uid}`;
      return res.status(204).end();
    } catch (e) {
      return handleError(res, e, 'banks.js handleBankById DELETE');
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

// GET/POST/PUT/DELETE /api?route=contas-contabeis
export async function handleContasContabeis(req, res) {
  const ensureContasTable = async () => {
    await sql`CREATE TABLE IF NOT EXISTS contas_contabeis (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(20) UNIQUE NOT NULL,
      nome VARCHAR(255) NOT NULL,
      tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;
  };

  if (req.method === 'GET') {
    try {
      await ensureContasTable();
      const { ativo } = req.query;
      const rows = (ativo === 'false')
        ? await sql`SELECT * FROM contas_contabeis ORDER BY tipo, codigo ASC`
        : await sql`SELECT * FROM contas_contabeis WHERE ativo = true ORDER BY tipo, codigo ASC`;
      return res.json(rows);
    } catch (e) {
      return handleError(res, e, 'banks.js handleContasContabeis GET');
    }
  }

  if (req.method === 'POST') {
    try {
      const uid = req.authUid;
      if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

      // Contas contábeis são globais: só o administrador master pode criar/editar
      const MASTER_UID = process.env.APP_UID || 'odair';
      if (uid !== MASTER_UID) {
        return res.status(403).json({ error: 'Acesso negado: apenas o administrador pode gerenciar o plano de contas.' });
      }

      await ensureContasTable();
      const result = ContaContabilSchema.safeParse({ ...(req.body || {}), uid });
      if (!result.success) {
        return res.status(400).json({ error: 'Dados inválidos', details: result.error.flatten().fieldErrors });
      }

      const { codigo, nome, tipo } = result.data;
      const rows = await sql`
        INSERT INTO contas_contabeis (codigo, nome, tipo)
        VALUES (${codigo}, ${nome}, ${tipo})
        ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativo = true
        RETURNING *`;
      return res.status(201).json(rows[0]);
    } catch (e) {
      return handleError(res, e, 'banks.js handleContasContabeis POST');
    }
  }

  if (req.method === 'PUT') {
    try {
      const uid = req.authUid;
      if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

      // Contas contábeis são globais: só o administrador master pode criar/editar
      const MASTER_UID = process.env.APP_UID || 'odair';
      if (uid !== MASTER_UID) {
        return res.status(403).json({ error: 'Acesso negado: apenas o administrador pode gerenciar o plano de contas.' });
      }

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
      return res.json(rows[0]);
    } catch (e) {
      return handleError(res, e, 'banks.js handleContasContabeis PUT');
    }
  }

  if (req.method === 'DELETE') {
    try {
      const uid = req.authUid;
      if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

      // Contas contábeis são globais: só o administrador master pode desativar
      const MASTER_UID = process.env.APP_UID || 'odair';
      if (uid !== MASTER_UID) {
        return res.status(403).json({ error: 'Acesso negado: apenas o administrador pode gerenciar o plano de contas.' });
      }

      await ensureContasTable();
      const { id } = req.query;
      await sql`UPDATE contas_contabeis SET ativo = false WHERE id = ${id}`;
      return res.status(204).end();
    } catch (e) {
      return handleError(res, e, 'banks.js handleContasContabeis DELETE');
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
