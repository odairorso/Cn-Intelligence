import { sql, parseDateToPg } from '../_db.js';
import { handleError } from '../_utils.js';

// GET/POST/PATCH /api?route=folha-segmentos
export async function handleSegmentos(req, res) {
  const uid = req.authUid;
  if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM segmentos WHERE uid = ${uid} ORDER BY nome ASC`;
      return res.json(rows);
    } catch (e) {
      return handleError(res, e, 'folha.js handleSegmentos GET');
    }
  }

  if (req.method === 'POST') {
    try {
      const { nome, horas_semanais, perc_repouso, ha_percent, valor_hora, ajuda_custo } = req.body;
      const rows = await sql`
        INSERT INTO segmentos (uid, nome, horas_semanais, perc_repouso, ha_percent, valor_hora, ajuda_custo)
        VALUES (${uid}, ${nome}, ${horas_semanais || 0}, ${perc_repouso || 0}, ${ha_percent || 0}, ${valor_hora || 0}, ${ajuda_custo || 0})
        RETURNING *`;
      return res.status(201).json(rows[0]);
    } catch (e) {
      return handleError(res, e, 'folha.js handleSegmentos POST');
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, nome, horas_semanais, perc_repouso, ha_percent, valor_hora, ajuda_custo } = req.body;
      const rows = await sql`
        UPDATE segmentos
        SET nome = ${nome},
            horas_semanais = ${horas_semanais},
            perc_repouso = ${perc_repouso},
            ha_percent = ${ha_percent},
            valor_hora = ${valor_hora},
            ajuda_custo = ${ajuda_custo}
        WHERE id = ${id} AND uid = ${uid}
        RETURNING *`;
      return res.json(rows[0]);
    } catch (e) {
      return handleError(res, e, 'folha.js handleSegmentos PATCH');
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// GET/POST/PATCH/DELETE /api?route=folha-professores
export async function handleProfessores(req, res) {
  const uid = req.authUid;
  if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

  if (req.method === 'GET') {
    try {
      const rows = await sql`
        SELECT 
          p.*,
          COALESCE(
            (
              SELECT jsonb_object_agg(ps.segmento_id, ps.horas_semanais)
              FROM professor_segmentos ps
              WHERE ps.professor_id = p.id
            ),
            '{}'::jsonb
          ) AS "segmentoHoras",
          COALESCE(
            (
              SELECT jsonb_agg(ps.segmento_id)
              FROM professor_segmentos ps
              WHERE ps.professor_id = p.id
            ),
            '[]'::jsonb
          ) AS "segmentoIds"
        FROM professores p
        WHERE p.uid = ${uid}
        ORDER BY p.nome ASC
      `;
      return res.json(rows);
    } catch (e) {
      return handleError(res, e, 'folha.js handleProfessores GET');
    }
  }

  if (req.method === 'POST') {
    try {
      const { nome, cpf, dataAdmissao, ativo, segmentos } = req.body;
      const pRows = await sql`
        INSERT INTO professores (uid, nome, cpf, data_admissao, ativo)
        VALUES (${uid}, ${nome}, ${cpf}, ${dataAdmissao || new Date().toISOString().split('T')[0]}, ${ativo !== false})
        RETURNING *`;

      const prof = pRows[0];

      if (Array.isArray(segmentos)) {
        for (const s of segmentos) {
          if (!s.segmentoId) continue;
          await sql`
            INSERT INTO professor_segmentos (professor_id, segmento_id, horas_semanais)
            VALUES (${prof.id}, ${s.segmentoId}, ${s.horasSemanais || 0})
          `;
        }
      }

      // Sincroniza automaticamente como Fornecedor (Supplier) no financeiro
      const existing = await sql`SELECT id FROM suppliers WHERE uid = ${uid} AND upper(nome) = upper(${nome}) LIMIT 1`;
      if (existing.length === 0) {
        await sql`INSERT INTO suppliers (uid, nome) VALUES (${uid}, ${nome})`;
      }

      return res.status(201).json(prof);
    } catch (e) {
      return handleError(res, e, 'folha.js handleProfessores POST');
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, nome, cpf, dataAdmissao, ativo, segmentos, fichaCadastro } = req.body;
      let pRows;
      if (fichaCadastro !== undefined) {
        pRows = await sql`
          UPDATE professores
          SET nome = ${nome},
              cpf = ${cpf},
              data_admissao = ${dataAdmissao},
              ativo = ${ativo !== false},
              ficha_cadastro = ${JSON.stringify(fichaCadastro)}
          WHERE id = ${id} AND uid = ${uid}
          RETURNING *`;
      } else {
        pRows = await sql`
          UPDATE professores
          SET nome = ${nome},
              cpf = ${cpf},
              data_admissao = ${dataAdmissao},
              ativo = ${ativo !== false}
          WHERE id = ${id} AND uid = ${uid}
          RETURNING *`;
      }

      if (pRows.length === 0) return res.status(404).json({ error: 'Professor não encontrado' });
      const prof = pRows[0];

      await sql`DELETE FROM professor_segmentos WHERE professor_id = ${id}`;

      if (Array.isArray(segmentos)) {
        for (const s of segmentos) {
          if (!s.segmentoId) continue;
          await sql`
            INSERT INTO professor_segmentos (professor_id, segmento_id, horas_semanais)
            VALUES (${id}, ${s.segmentoId}, ${s.horasSemanais || 0})
          `;
        }
      }

      // Sincroniza automaticamente como Fornecedor (Supplier) no financeiro
      const existing = await sql`SELECT id FROM suppliers WHERE uid = ${uid} AND upper(nome) = upper(${nome}) LIMIT 1`;
      if (existing.length === 0) {
        await sql`INSERT INTO suppliers (uid, nome) VALUES (${uid}, ${nome})`;
      }

      return res.json(prof);
    } catch (e) {
      return handleError(res, e, 'folha.js handleProfessores PATCH');
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.body;
      await sql`DELETE FROM professores WHERE id = ${id} AND uid = ${uid}`;
      return res.json({ message: 'Professor excluído com sucesso' });
    } catch (e) {
      return handleError(res, e, 'folha.js handleProfessores DELETE');
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// GET /api?route=folha-lancamentos
export async function handleLancamentos(req, res) {
  const uid = req.authUid;
  if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

  if (req.method === 'GET') {
    try {
      const { competencia } = req.query;
      if (!competencia) return res.status(400).json({ error: 'Falta parâmetro competencia' });

      const rows = await sql`
        SELECT * FROM lancamentos
        WHERE uid = ${uid} AND competencia = ${competencia}
      `;
      return res.json(rows);
    } catch (e) {
      return handleError(res, e, 'folha.js handleLancamentos GET');
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// GET/POST /api?route=folha-fechamentos
export async function handleFechamentos(req, res) {
  const uid = req.authUid;
  if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM fechamentos WHERE uid = ${uid} ORDER BY competencia DESC`;
      return res.json(rows);
    } catch (e) {
      return handleError(res, e, 'folha.js handleFechamentos GET');
    }
  }

  if (req.method === 'POST') {
    try {
      const { competencia, observacao, totalGeral, lancamentos, lancamentosFinanceiros } = req.body;

      if (!competencia || !lancamentos) {
        return res.status(400).json({ error: 'Dados insuficientes' });
      }

      // 1. Registra o fechamento
      const fRows = await sql`
        INSERT INTO fechamentos (uid, competencia, total_geral, observacao)
        VALUES (${uid}, ${competencia}, ${totalGeral || 0}, ${observacao || ''})
        ON CONFLICT (uid, competencia) 
        DO UPDATE SET total_geral = EXCLUDED.total_geral, observacao = EXCLUDED.observacao
        RETURNING *`;

      // 2. Salva e congela os lançamentos calculados
      await sql`DELETE FROM lancamentos WHERE uid = ${uid} AND competencia = ${competencia}`;
      for (const l of lancamentos) {
        await sql`
          INSERT INTO lancamentos (uid, professor_id, segmento_id, competencia, horas_mensais, repouso, horas_atividade, total_horas, ajuda_custo, total_pagar, status)
          VALUES (
            ${uid}, 
            ${l.professorId}, 
            ${l.segmentoId}, 
            ${competencia}, 
            ${l.horasMensais || 0}, 
            ${l.repouso || 0}, 
            ${l.horasAtividade || 0}, 
            ${l.totalHoras || 0}, 
            ${l.ajudaCusto || 0}, 
            ${l.totalPagar || 0}, 
            'fechado'
          )
        `;
      }

      // 3. INTEGRAÇÃO FINANCEIRA AUTOMÁTICA
      // Busca o ID da conta contábil '3.1' (Folha de Pagamento)
      let contaContabilId = null;
      const contaRows = await sql`SELECT id FROM contas_contabeis WHERE codigo = '3.1' AND ativo = true LIMIT 1`;
      if (contaRows.length > 0) contaContabilId = contaRows[0].id;

      // Define data de vencimento: dia 5 do mês subsequente
      let vDate = '';
      try {
        const [year, month] = competencia.split('-');
        let nextM = parseInt(month) + 1;
        let nextY = parseInt(year);
        if (nextM > 12) {
          nextM = 1;
          nextY += 1;
        }
        vDate = `${nextY}-${String(nextM).padStart(2, '0')}-05`;
      } catch {
        vDate = new Date().toISOString().split('T')[0];
      }

      if (Array.isArray(lancamentosFinanceiros)) {
        for (const lf of lancamentosFinanceiros) {
          if (Number(lf.totalPagar) <= 0) continue;

          // Dedup no financeiro para não duplicar o salário do mesmo professor no mesmo mês
          const dup = await sql`
            SELECT id FROM transactions
            WHERE uid = ${uid}
              AND fornecedor = ${lf.nome}
              AND deleted_at IS NULL
              AND vencimento = ${vDate}
              AND upper(descricao) LIKE ${`%FOLHA DE PAGAMENTO - COMPETÊNCIA ${competencia}%`}
            LIMIT 1
          `;
          if (dup.length > 0) continue;

          await sql`
            INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, valor, status, tipo, conta_contabil_id, created_by)
            VALUES (
              ${uid},
              ${lf.nome},
              ${`Folha de Pagamento - Competência ${competencia}`},
              'Geral',
              ${vDate},
              ${Number(lf.totalPagar)},
              'PENDENTE',
              'DESPESA',
              ${contaContabilId},
              ${uid}
            )
          `;
        }
      }

      return res.status(201).json(fRows[0]);
    } catch (e) {
      return handleError(res, e, 'folha.js handleFechamentos POST');
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// POST /api?route=folha-push (Legado/Compatibilidade)
export async function handleFolhaPush(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  const INTEGRATION_TOKEN = process.env.FOLHA_INTEGRATION_TOKEN;
  if (!INTEGRATION_TOKEN) {
    console.error('[FOLHA] Erro: FOLHA_INTEGRATION_TOKEN não configurada.');
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
  if (!authHeader || authHeader !== `Bearer ${INTEGRATION_TOKEN}`) {
    return res.status(401).json({ error: 'Token de integração inválido' });
  }

  try {
    const { competencia, empresa, totalPagar, vencimento, fornecedor } = req.body;
    if (!competencia || !totalPagar) return res.status(400).json({ error: 'Dados insuficientes.' });

    const vDate = parseDateToPg(vencimento) || new Date().toISOString().split('T')[0];
    const valorNumber = Number(totalPagar);

    let contaContabilId = null;
    const contaRows = await sql`SELECT id FROM contas_contabeis WHERE codigo = '3.1' AND ativo = true LIMIT 1`;
    if (contaRows.length > 0) contaContabilId = contaRows[0].id;

    const uid = req.authUid;

    const duplicateRows = await sql`
      SELECT id FROM transactions
      WHERE fornecedor = ${fornecedor || `Folha de Pagamento - ${competencia}`}
        AND empresa = ${empresa || 'Geral'}
        AND deleted_at IS NULL
        AND abs(valor - ${valorNumber}) < 0.0001
      LIMIT 1
    `;

    if (duplicateRows.length) return res.status(409).json({ error: 'Folha já integrada.' });

    const rows = await sql`
      INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, conta_contabil_id, created_by)
      VALUES (
        ${uid},
        ${fornecedor || `Folha de Pagamento - ${competencia}`},
        ${`Lançamento automático via integração da Folha - ${competencia}`},
        ${empresa || 'Geral'},
        ${vDate},
        NULL,
        ${valorNumber},
        'PENDENTE',
        NULL,
        'DESPESA',
        ${contaContabilId},
        ${uid}
      )
      RETURNING *`;

    await sql`
      INSERT INTO audit_logs (user_uid, action, tabela, record_id, dados_novos)
      VALUES (${uid}, 'CREATE', 'transactions', ${rows[0].id}, ${JSON.stringify(rows[0])})
    `;

    return res.status(201).json(rows[0]);
  } catch (e) {
    return handleError(res, e, 'folha.js handleFolhaPush');
  }
}
