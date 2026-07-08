import { sql, parseDateToPg } from '../_db.js';
import { normalizeBoletoNumber, sanitizeObject, handleError, getContaContabilId } from '../_utils.js';
import { TransactionSchema, TransactionBatchSchema } from '../_schemas.js';

// ── Audit Log Helper ────────────────────────────────────────────────────────
async function auditLog(userUid, action, recordId, dadosAntigos, dadosNovos) {
  try {
    await sql`
      INSERT INTO audit_logs (user_uid, action, tabela, record_id, dados_antigos, dados_novos)
      VALUES (
        ${userUid},
        ${action},
        'transactions',
        ${recordId ? String(recordId) : null},
        ${dadosAntigos ? JSON.stringify(dadosAntigos) : null},
        ${dadosNovos ? JSON.stringify(dadosNovos) : null}
      )
    `;
  } catch (e) {
    // Nunca bloquear a operação principal por falha de log
    console.error('[auditLog] Erro ao gravar:', e.message);
  }
}

// GET /api?route=transactions
export async function handleTransactions(req, res) {
  if (req.method === 'GET') {
    try {
      const uid = req.authUid;
      const { limit, offset, year, month, search, tipo, empresa, status, conta_contabil_id, startDate, endDate } = req.query;

      if (!uid || uid === 'undefined' || uid === 'null') {
        return res.status(401).json({ error: 'Identificação de usuário (UID) obrigatória para esta operação.' });
      }

      const defaultLimit = 100;
      let parsedLimit = limit ? parseInt(limit) : defaultLimit;
      let parsedOffset = offset ? parseInt(offset) : 0;
      if (isNaN(parsedLimit)) parsedLimit = defaultLimit;
      if (isNaN(parsedOffset)) parsedOffset = 0;

      let query = sql`SELECT * FROM transactions WHERE (uid = ${uid} OR uid IS NULL) AND deleted_at IS NULL`;
      if (tipo && tipo !== 'TODOS') query = sql`${query} AND tipo = ${tipo}`;
      if (empresa && empresa !== 'TODOS') query = sql`${query} AND upper(empresa) = upper(${empresa})`;
      if (status && status !== 'TODOS') {
        if (status === 'NAO_PAGO') {
          query = sql`${query} AND (status = 'PENDENTE' OR status = 'VENCIDO')`;
        } else if (status === 'VENCIDO') {
          query = sql`${query} AND (status = 'VENCIDO' OR (status = 'PENDENTE' AND vencimento < CURRENT_DATE))`;
        } else if (status === 'PENDENTE') {
          query = sql`${query} AND status = 'PENDENTE' AND vencimento >= CURRENT_DATE`;
        } else {
          query = sql`${query} AND status = ${status}`;
        }
      }
      if (conta_contabil_id) {
        const ccid = parseInt(String(conta_contabil_id));
        if (Number.isFinite(ccid)) query = sql`${query} AND conta_contabil_id = ${ccid}`;
      }

      if (search) {
        const terms = String(search).trim().split(/\s+/).filter(t => t.length > 0);
        const parseSearchMoney = (input) => {
          const raw = String(input || '').trim();
          if (!raw) return null;
          const cleaned = raw.replace(/[^\d,.\-]/g, '');
          if (!cleaned) return null;
          let n;
          if (cleaned.includes(',') && cleaned.includes('.')) {
            const lastComma = cleaned.lastIndexOf(',');
            const lastDot = cleaned.lastIndexOf('.');
            if (lastComma > lastDot) n = Number(cleaned.replace(/\./g, '').replace(',', '.'));
            else n = Number(cleaned.replace(/,/g, ''));
          } else if (cleaned.includes(',')) {
            n = Number(cleaned.replace(/\./g, '').replace(',', '.'));
          } else {
            n = Number(cleaned);
          }
          return Number.isFinite(n) ? n : null;
        };

        const money = parseSearchMoney(search);
        
        terms.forEach(term => {
          const sRaw = `%${term}%`;
          const sNum = `%${term.replace(/[^\d]/g, '')}%`;
          
          query = sql`${query} AND (
            immutable_unaccent(fornecedor) ILIKE immutable_unaccent(${sRaw})
            OR immutable_unaccent(coalesce(descricao, '')) ILIKE immutable_unaccent(${sRaw})
            OR immutable_unaccent(coalesce(empresa, '')) ILIKE immutable_unaccent(${sRaw})
            OR CAST(valor AS TEXT) ILIKE ${sRaw}
            ${sNum.length > 2 ? sql`OR REPLACE(CAST(valor AS TEXT), '.', '') ILIKE ${sNum}` : sql``}
            ${money !== null ? sql`OR abs(valor - ${money}) < 0.01 OR abs((valor + coalesce(juros, 0)) - ${money}) < 0.01` : sql``}
          )`;
        });
      }

      // Filtros de data (agora funcionam JUNTO com a busca)
      if (startDate) {
        query = sql`${query} AND vencimento >= ${startDate}`;
      }
      if (endDate) {
        query = sql`${query} AND vencimento <= ${endDate}`;
      }
      if (!startDate && !endDate) {
        if (year && year !== 'TODOS') {
          const start = `${year}-01-01`;
          const end = `${year}-12-31`;
          query = sql`${query} AND vencimento >= ${start} AND vencimento <= ${end}`;
        }
        if (month && month !== 'TODOS') {
          const m = month.padStart(2, '0');
          query = sql`${query} AND TO_CHAR(vencimento, 'MM') = ${m}`;
        }
      }

      const rows = await sql`${query} ORDER BY vencimento DESC LIMIT ${parsedLimit} OFFSET ${parsedOffset}`;

      const formatted = rows.map(tx => ({
        ...tx,
        vencimento: tx.vencimento ? new Date(tx.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '',
        pagamento: tx.pagamento ? new Date(tx.pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined,
        valor: Number(tx.valor),
        juros: Number(tx.juros || 0),
      }));
      return res.json(formatted);
    } catch (e) {
      return handleError(res, e, 'transactions.js handleTransactions');
    }
  }

  if (req.method === 'POST') {
    try {
      const uid = req.authUid;
      if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

      const rawBody = req.body || {};
      const payload = { ...(rawBody || {}), uid };
      if (payload.vencimento) {
        const vPg = parseDateToPg(payload.vencimento);
        if (!vPg) return res.status(400).json({ error: 'Data de vencimento inválida' });
        payload.vencimento = vPg;
      }
      if (payload.pagamento === '') payload.pagamento = null;
      if (payload.pagamento) {
        const pPg = parseDateToPg(payload.pagamento);
        if (!pPg) return res.status(400).json({ error: 'Data de pagamento inválida' });
        payload.pagamento = pPg;
      }

      // Validação Zod
      const result = TransactionSchema.safeParse(payload);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        const firstError = Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join(', ');
        return res.status(400).json({ error: `Dados inválidos: ${firstError}`, details: errors });
      }

      const { fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id } = result.data;

      const vDate = vencimento;
      const pDate = pagamento ? parseDateToPg(pagamento) : null;
      const normalizedNumber = normalizeBoletoNumber(numero_boleto);
      const valorNumber = Number(valor);

      if (!vDate) return res.status(400).json({ error: 'Data de vencimento inválida. Use o formato YYYY-MM-DD.' });

      // Dedup por número de boleto ou chave composta (ignora soft-deleted)
      const duplicateRows = normalizedNumber
        ? await sql`
            SELECT id FROM transactions WHERE uid = ${uid}
            AND deleted_at IS NULL
            AND regexp_replace(upper(coalesce(numero_boleto, '')), '[^A-Z0-9]', '', 'g') = ${normalizedNumber}
            AND upper(coalesce(fornecedor, '')) = upper(${fornecedor})
            LIMIT 1`
        : await sql`
            SELECT id FROM transactions
            WHERE uid = ${uid}
              AND deleted_at IS NULL
              AND upper(coalesce(fornecedor, '')) = upper(${fornecedor})
              AND vencimento = ${vDate}
              AND abs(valor - ${valorNumber}) < 0.0001
              AND upper(coalesce(descricao, '')) = upper(${descricao || ''})
              AND upper(coalesce(empresa, '')) = upper(${empresa || ''})
            LIMIT 1`;

      if (duplicateRows.length) {
        const errorMsg = normalizedNumber 
          ? 'Boleto já lançado para este usuário' 
          : 'Lançamento duplicado detectado (já existe um registro com mesmo fornecedor, valor, vencimento e descrição). Se for intencional, altere a descrição.';
        return res.status(409).json({ error: errorMsg, duplicate: true });
      }

      let resolvedContaContabilId = conta_contabil_id;
      if (!resolvedContaContabilId) {
        resolvedContaContabilId = await getContaContabilId(fornecedor, descricao, tipo);
      }

      const rows = await sql`
        INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id, created_by)
        VALUES (${uid}, ${fornecedor}, ${descricao || '-'}, ${empresa || 'Geral'},
                ${vDate}, ${pDate}, ${valorNumber}, ${status || 'PENDENTE'}, ${banco ?? null}, ${tipo}, ${numero_boleto || null}, ${resolvedContaContabilId ?? null}, ${uid})
        RETURNING *`;
      await auditLog(uid, 'CREATE', rows[0].id, null, rows[0]);
      return res.status(201).json(rows[0]);
    } catch (e) {
      return handleError(res, e, 'transactions.js handleTransactions POST');
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// GET/PUT/DELETE /api?route=transactions&id=...
export async function handleTransactionById(req, res) {
  const uid = req.authUid;
  if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'ID missing' });

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM transactions WHERE id = ${id} AND (uid = ${uid} OR uid IS NULL) AND deleted_at IS NULL`;
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
      const tx = rows[0];
      return res.json({
        ...tx,
        vencimento: tx.vencimento ? new Date(tx.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '',
        pagamento: tx.pagamento ? new Date(tx.pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined,
        valor: Number(tx.valor),
        juros: Number(tx.juros || 0),
      });
    } catch (e) {
      return handleError(res, e, 'transactions.js handleTransactionById GET');
    }
  }

  if (req.method === 'PUT') {
    try {
      // Verificar propriedade
      const existing = await sql`SELECT id, fornecedor, valor, status FROM transactions WHERE id = ${id} AND (uid = ${uid} OR uid IS NULL) AND deleted_at IS NULL`;
      if (existing.length === 0) return res.status(404).json({ error: 'Not found' });

      const body = req.body || {};

      // Validação parcial com Zod (pick)
      if (body.vencimento) {
        const vPg = parseDateToPg(body.vencimento);
        if (vPg) {
          const vResult = TransactionSchema.pick({ vencimento: true }).safeParse({ vencimento: vPg });
          if (!vResult.success) return res.status(400).json({ error: 'Data de vencimento inválida' });
        }
      }
      if (body.valor !== undefined && body.valor !== null) {
        const valResult = TransactionSchema.pick({ valor: true }).safeParse({ valor: Number(body.valor) });
        if (!valResult.success) return res.status(400).json({ error: 'Valor inválido' });
      }

      const fields = [];
      if (body.fornecedor !== undefined) fields.push(sql`fornecedor = ${body.fornecedor}`);
      if (body.descricao !== undefined) fields.push(sql`descricao = ${body.descricao}`);
      if (body.empresa !== undefined) fields.push(sql`empresa = ${body.empresa}`);
      if (body.vencimento !== undefined) fields.push(sql`vencimento = ${parseDateToPg(body.vencimento)}`);
      if (body.pagamento !== undefined) fields.push(sql`pagamento = ${parseDateToPg(body.pagamento)}`);
      if (body.valor !== undefined) fields.push(sql`valor = ${body.valor === null ? null : Number(body.valor)}`);
      if (body.status !== undefined) fields.push(sql`status = ${body.status}`);
      if (body.banco !== undefined) fields.push(sql`banco = ${body.banco}`);
      if (body.juros !== undefined) fields.push(sql`juros = ${body.juros === null ? null : Number(body.juros)}`);
      if (body.tipo !== undefined) fields.push(sql`tipo = ${body.tipo}`);
      if (body.numero_boleto !== undefined) fields.push(sql`numero_boleto = ${body.numero_boleto}`);
      if (body.conta_contabil_id !== undefined) fields.push(sql`conta_contabil_id = ${body.conta_contabil_id}`);

      if (fields.length === 0) {
        return res.json(existing[0]);
      }

      const setClause = fields.reduce((acc, curr, i) => {
        if (i === 0) return curr;
        return sql`${acc}, ${curr}`;
      }, sql``);

      const rows = await sql`
        UPDATE transactions
        SET ${setClause}, updated_at = NOW(), updated_by = ${uid}
        WHERE id = ${id} AND (uid = ${uid} OR uid IS NULL) AND deleted_at IS NULL
        RETURNING *`;
        
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
      await auditLog(uid, 'UPDATE', id, existing[0], rows[0]);
      return res.json({
        ...rows[0],
        vencimento: rows[0].vencimento ? new Date(rows[0].vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '',
        pagamento: rows[0].pagamento ? new Date(rows[0].pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined,
        valor: Number(rows[0].valor),
        juros: Number(rows[0].juros || 0),
      });
    } catch (e) {
      return handleError(res, e, 'transactions.js handleTransactionById PUT');
    }
  }

  if (req.method === 'DELETE') {
    try {
      const existing = await sql`SELECT * FROM transactions WHERE id = ${id} AND (uid = ${uid} OR uid IS NULL) AND deleted_at IS NULL`;
      if (existing.length === 0) return res.status(404).json({ error: 'Not found' });
      // Soft Delete — nunca apaga o registro do banco
      await sql`
        UPDATE transactions
        SET deleted_at = NOW(), deleted_by = ${uid}, updated_at = NOW()
        WHERE id = ${id} AND (uid = ${uid} OR uid IS NULL)
      `;
      await auditLog(uid, 'DELETE', id, existing[0], null);
      return res.status(200).json({ success: true });
    } catch (e) {
      return handleError(res, e, 'transactions.js handleTransactionById DELETE');
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// POST /api?route=transactions-batch
export async function handleTransactionsBatch(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const uid = req.authUid;
  if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

  const transactions = req.body;
  if (!Array.isArray(transactions) || transactions.length === 0) return res.status(400).json({ error: 'Invalid batch data' });

  try {
    // Formatar datas antes da validação do schema Zod
    const formattedTransactions = transactions.map(tx => {
      const vDate = parseDateToPg(tx.vencimento) || tx.vencimento;
      const pDate = tx.pagamento ? (parseDateToPg(tx.pagamento) || tx.pagamento) : null;
      return {
        ...(tx || {}),
        uid,
        vencimento: vDate,
        pagamento: pDate
      };
    });

    const batchResult = TransactionBatchSchema.safeParse(formattedTransactions);
    if (!batchResult.success) {
      return res.status(400).json({ error: 'Dados do batch inválidos', details: batchResult.error.flatten() });
    }

    let created = 0;
    let blocked = 0;
    let errors = [];
    const seenKeys = new Set();

    // Phase 1: Pre-validate and deduplicate locally (no DB calls)
    const prepared = [];
    for (let i = 0; i < batchResult.data.length; i++) {
      const tx = batchResult.data[i];
      const { fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id } = tx;

      const vDate = vencimento || new Date().toISOString().split('T')[0];
      const pDate = pagamento || null;
      const normalizedNumber = numero_boleto ? normalizeBoletoNumber(numero_boleto) : '';

      const descKey = String(descricao || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const empKey = String(empresa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const localKey = normalizedNumber
        ? `BOLETO:${uid}:${normalizedNumber}`
        : `BASE:${uid}:${String(fornecedor || '').toUpperCase()}|${vDate}|${Number(valor || 0).toFixed(2)}|${descKey}|${empKey}`;

      if (seenKeys.has(localKey)) {
        blocked++;
        continue;
      }
      seenKeys.add(localKey);

      let resolvedCcId = conta_contabil_id;
      if (!resolvedCcId) {
        resolvedCcId = await getContaContabilId(fornecedor, descricao, tipo);
      }

      prepared.push({ i, tx, vDate, pDate, normalizedNumber, localKey, resolvedCcId });
    }

    // Phase 2: Bulk dedup check against DB
    const boletoNumbers = prepared.filter(p => p.normalizedNumber).map(p => p.normalizedNumber);
    const existingBoletos = new Set();
    if (boletoNumbers.length > 0) {
      const rows = await sql`
        SELECT upper(coalesce(fornecedor, '')) AS forn, regexp_replace(upper(coalesce(numero_boleto, '')), '[^A-Z0-9]', '', 'g') AS num 
        FROM transactions 
        WHERE uid = ${uid} 
          AND deleted_at IS NULL 
          AND regexp_replace(upper(coalesce(numero_boleto, '')), '[^A-Z0-9]', '', 'g') = ANY(${boletoNumbers}::text[])
      `;
      for (const r of rows) existingBoletos.add(`${r.forn}|${r.num}`);
    }

    // Also check composite-key duplicates for non-boleto rows against DB
    const existingCompositeKeys = new Set();
    const nonBoletoRows = prepared.filter(p => !p.normalizedNumber);
    if (nonBoletoRows.length > 0) {
      // Build a composite key check using multiple OR conditions
      const compositeConditions = nonBoletoRows.map(p => {
        const { tx, vDate } = p;
        return sql`(upper(coalesce(fornecedor, '')) = upper(${tx.fornecedor}) AND vencimento = ${vDate} AND abs(valor - ${Number(tx.valor)}) < 0.0001 AND upper(coalesce(descricao, '')) = upper(${tx.descricao || ''}) AND upper(coalesce(empresa, '')) = upper(${tx.empresa || ''}))`;
      });
      const whereClause = sql.join(compositeConditions, sql` OR `);
      const existingRows = await sql`SELECT upper(coalesce(fornecedor, '')) AS forn, vencimento AS venc, valor AS val, upper(coalesce(descricao, '')) AS "desc", upper(coalesce(empresa, '')) AS emp FROM transactions WHERE uid = ${uid} AND deleted_at IS NULL AND (${whereClause})`;
      for (const r of existingRows) {
        existingCompositeKeys.add(`${r.forn}|${r.venc}|${r.val}|${r.desc}|${r.emp}`);
      }
    }

    // Phase 3: Insert valid rows in bulk using a single multi-row INSERT
    const toInsert = [];
    for (const p of prepared) {
      if (p.normalizedNumber) {
        const key = `${String(p.tx.fornecedor || '').toUpperCase()}|${p.normalizedNumber}`;
        if (existingBoletos.has(key)) {
          blocked++;
          continue;
        }
      }
      if (!p.normalizedNumber) {
        const { tx, vDate } = p;
        const compositeKey = `${String(tx.fornecedor || '').toUpperCase()}|${vDate}|${Number(tx.valor)}|${String(tx.descricao || '').toUpperCase()}|${String(tx.empresa || '').toUpperCase()}`;
        if (existingCompositeKeys.has(compositeKey)) {
          blocked++;
          continue;
        }
      }
      toInsert.push(p);
    }

    if (toInsert.length > 0) {
      try {
        // Build a single bulk INSERT with multiple value rows
        const values = toInsert.map(p => {
          const { tx, vDate, pDate, resolvedCcId } = p;
          return sql`(${uid}, ${tx.fornecedor}, ${tx.descricao || '-'}, ${tx.empresa || 'Geral'}, ${vDate}, ${pDate}, ${Number(tx.valor)}, ${tx.status || 'PENDENTE'}, ${tx.banco ?? null}, ${tx.tipo}, ${tx.numero_boleto || null}, ${resolvedCcId ?? null}, ${uid})`;
        });

        const inserted = await sql`INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id, created_by)
          VALUES ${sql.join(values, sql`, `)}
          RETURNING id`;

        created = inserted.length;
        // Audit log in parallel (non-blocking)
        Promise.all(inserted.map((row, idx) => {
          const p = toInsert[idx];
          return auditLog(uid, 'CREATE', row.id, null, { fornecedor: p.tx.fornecedor, valor: p.tx.valor, empresa: p.tx.empresa, vencimento: p.vDate, tipo: p.tx.tipo });
        })).catch(() => {});
      } catch (bulkError) {
        // Fallback: if multi-row INSERT fails, try individual inserts
        for (const p of toInsert) {
          try {
            const { tx, vDate, pDate, resolvedCcId } = p;
            const inserted = await sql`INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id, created_by)
              VALUES (${uid}, ${tx.fornecedor}, ${tx.descricao || '-'}, ${tx.empresa || 'Geral'}, ${vDate}, ${pDate}, ${Number(tx.valor)}, ${tx.status || 'PENDENTE'}, ${tx.banco ?? null}, ${tx.tipo}, ${tx.numero_boleto || null}, ${resolvedCcId ?? null}, ${uid})
              RETURNING id`;
            await auditLog(uid, 'CREATE', inserted[0]?.id, null, { fornecedor: tx.fornecedor, valor: tx.valor, empresa: tx.empresa, vencimento: vDate, tipo: tx.tipo });
            created++;
          } catch (rowError) {
            console.error(`[transactions.js handleTransactionsBatch fallback] Error inserting item ${p.i}:`, rowError);
            errors.push({ index: p.i, error: 'Erro ao processar item' });
          }
        }
      }
    }
    return res.status(201).json({ message: 'Batch processed', count: created, blocked, errors });
  } catch (e) {
    return handleError(res, e, 'transactions.js handleTransactionsBatch');
  }
}

// PUT /api?route=transactions-batch-update
export async function handleTransactionsBatchUpdate(req, res) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  const uid = req.authUid;
  if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

  const { ids, banco, dataPagamento } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'IDs missing' });

  try {
    // Validação de ownership: só permite atualizar IDs que pertencem ao usuário
    const ownedRows = await sql`
      SELECT id FROM transactions 
      WHERE (uid = ${uid} OR uid IS NULL) 
        AND deleted_at IS NULL 
        AND id = ANY(${ids}::uuid[])
    `;
    const ownedIds = new Set(ownedRows.map(r => r.id));

    // Verifica se todos os IDs solicitados pertencem ao usuário
    const unownedIds = ids.filter(id => !ownedIds.has(id));
    if (unownedIds.length > 0) {
      return res.status(403).json({ 
        error: 'Acesso negado: alguns lançamentos não pertencem ao usuário.',
        unowned_count: unownedIds.length
      });
    }

    const pDate = parseDateToPg(dataPagamento);
    await sql`UPDATE transactions SET status = 'PAGO', banco = ${banco}, pagamento = ${pDate}, updated_at = NOW() WHERE (uid = ${uid} OR uid IS NULL) AND id = ANY(${ids}::uuid[])`;
    return res.json({ message: 'Updated successfully' });
  } catch (e) {
    return handleError(res, e, 'transactions.js handleTransactionsBatchUpdate');
  }
}

// DELETE /api?route=transactions-dedupe-movimentos
export async function handleTransactionsDedupeMovimentos(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const uid = req.authUid;
  if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

  try {
    // Soft delete dos duplicados (não apaga de verdade)
    const rows = await sql`
      WITH duplicates AS (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY uid, fornecedor, vencimento, valor, upper(coalesce(descricao, '')), upper(coalesce(empresa, ''))
          ORDER BY created_at DESC
        ) as row_num
        FROM transactions
        WHERE (uid = ${uid} OR uid IS NULL) AND status = 'PAGO' AND deleted_at IS NULL
      )
      UPDATE transactions
      SET deleted_at = NOW(), deleted_by = ${uid}, updated_at = NOW()
      WHERE id IN (SELECT id FROM duplicates WHERE row_num > 1)
      RETURNING id`;
    await auditLog(uid, 'DEDUPE', null, null, { count: rows.length });
    return res.json({ message: 'Deduplicated', count: rows.length });
  } catch (e) {
    return handleError(res, e, 'transactions.js handleTransactionsDedupeMovimentos');
  }
}

// POST /api?route=fix-receitas-tipo
export async function handleFixReceitasTipo(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const uid = req.authUid;

  try {
    const result = await sql`
      UPDATE transactions
      SET tipo = 'RECEITA'
      WHERE ${uid ? sql`uid = ${uid} AND` : sql``}
        tipo != 'RECEITA'
        AND (
          descricao ILIKE '%REPASSE%'
          OR descricao ILIKE '%RECEITA%'
          OR descricao ILIKE '%RECEBIMENTO%'
          OR fornecedor ILIKE '%EDUCBANK%'
          OR fornecedor ILIKE '%KROTON%'
        )
    `;
    return res.json({ ok: true, updated: result.count || 0 });
  } catch (e) {
    return handleError(res, e, 'transactions.js handleFixReceitasTipo');
  }
}
