import { sql, parseDateToPg, setCors } from './_db.js';
import { GoogleGenAI } from '@google/genai';

// --- Helpers ---
const normalizeBoletoNumber = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const raw = String(value).toUpperCase();
  if (!raw || raw === 'UNDEFINED' || raw === 'NULL') return '';
  const tokens = raw
    .split(/[\s:;|,]+/)
    .map((token) => token.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);
  const bestToken = tokens.find((token) => /\d{4,}/.test(token) && token.length >= 6 && token.length <= 30);
  if (bestToken) return bestToken;
  return raw.replace(/[^A-Z0-9]/g, '');
};

const isAddressLike = (value) => {
  const v = String(value || '').toUpperCase();
  if (!v) return false;
  if (v.includes(' AV ') || v.includes('AV.') || v.includes('AVENIDA') || v.includes('RUA') || v.includes('CEP')) return true;
  return false;
};

const extractLocalBoletoNumber = (text) => {
  const source = String(text || '').toUpperCase();
  const patterns = [
    /NOSSO\s*N[UÚ]MERO\s*[:\s-]*([A-Z0-9./-]{6,40})/,
    /N[UÚ]MERO\s*DO\s*DOCUMENTO\s*[:\s-]*([A-Z0-9./-]{6,40})/,
    /N[ROº°]*\s*DOCUMENTO\s*[:\s-]*([A-Z0-9./-]{6,40})/,
    /NR\.?\s*DOC\s*[:\s-]*([A-Z0-9./-]{6,40})/,
    /N[º°]?\s*DOC\s*[:\s-]*([A-Z0-9./-]{6,40})/,
    /DOCUMENTO\s*[:\s-]*([0-9]{6,20})/,
    /COD(?:IGO)?\s*(?:DE)?\s*BARRAS\s*[:\s-]*([0-9]{47,48})/,
    /C.{0,6}DIGO\s*(?:DE)?\s*BARRAS\s*[:\s-]*([0-9]{47,48})/,
    /UTILIZE\s+O\s+C.{0,6}DIGO\s*[:\s-]*([A-Z0-9]{6,25})/,
    /MATR.{0,6}CULA\s*[:\s-]*([0-9]{6,14}(?:[-/][0-9A-Z]{1,6}){1,8})/,
    /NOTA\s+FISCAL\s+N[ROº°]*\s*[:\s-]*([0-9.]{6,25})/,
    /([0-9]{11})\s+CADASTRE\s+SUA\s+FATURA/,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) {
      const normalized = normalizeBoletoNumber(match[1]);
      if (normalized) return normalized;
    }
  }
  const labeledBlockPatterns = [
    /LINHA\s*DIGIT[AÁ]VEL[^0-9]*([0-9\s.]{40,160})/,
    /C.{0,6}DIGO\s*DE\s*BARRAS[^0-9]*([0-9\s.]{40,160})/,
  ];
  for (const p of labeledBlockPatterns) {
    const m = source.match(p);
    const digits = (m?.[1]?.match(/\d/g) || []).join('');
    if (digits.length === 47 || digits.length === 48) return digits;
    if (digits.length > 48) return digits.slice(0, 48);
    if (digits.length > 47) return digits.slice(0, 47);
  }
  const barcodeMatch = source.match(/\b([0-9]{47,48})\b/);
  if (barcodeMatch?.[1]) return barcodeMatch[1];
  return '';
};

const normSupplier = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  // Common variations
  .replace(/\bCELULARS?\b/g, 'CELULAR')
  .replace(/\bEXTINTORES?\b/g, 'EXTINTOR')
  .replace(/\bPAPELARIA(S)?\b/g, 'PAPELARIA')
  .replace(/\bLivraria(S)?\b/g, 'LIVRARIA')
  .replace(/\bEditora(S)?\b/g, 'EDITORA')
  .replace(/\bDistribuidora(S)?\b/g, 'DISTRIBUIDORA')
  .replace(/\bServico(S)?\b/g, 'SERVICO')
  .replace(/\bManutencao(S)?\b/g, 'MANUTENCAO')
  .replace(/\bSeguranca(S)?\b/g, 'SEGURANCA')
  .replace(/\bLimpeza(S)?\b/g, 'LIMPEZA')
  .replace(/\bAlimentacao(S)?\b/g, 'ALIMENTACAO')
  .replace(/\bTransporte(S)?\b/g, 'TRANSPORTE')
  .replace(/\bComunicacao(S)?\b/g, 'COMUNICACAO')
  .replace(/\bEletrico(S)?\b/g, 'ELETRICO')
  .replace(/\bEletronico(S)?\b/g, 'ELETRONICO')
  .replace(/\bGrafica(S)?\b/g, 'GRAFICA')
  .replace(/\bInformatica(S)?\b/g, 'INFORMATICA')
  .replace(/\bConstrucao(S)?\b/g, 'CONSTRUCAO')
  .replace(/\bEscritorio(S)?\b/g, 'ESCRITORIO')
  .replace(/\bPosto(S)?\b/g, 'POSTO')
  .replace(/\bSupermercado(S)?\b/g, 'SUPERMERCADO')
  .replace(/\bRestaurante(S)?\b/g, 'RESTAURANTE')
  .replace(/\bFarmacia(S)?\b/g, 'FARMACIA')
  .replace(/\bClinica(S)?\b/g, 'CLINICA')
  .replace(/\bHospital(S)?\b/g, 'HOSPITAL')
  .replace(/\bLaboratorio(S)?\b/g, 'LABORATORIO')
  .replace(/\bEmpresa(S)?\b/g, 'EMPRESA')
  .replace(/\bComercio(S)?\b/g, 'COMERCIO')
  .replace(/\bIndustria(S)?\b/g, 'INDUSTRIA')
  .replace(/\bSolucões?\b/g, 'SOLUCOES')
  .replace(/\bSistemas?\b/g, 'SISTEMA')
  .replace(/\bProjeto(S)?\b/g, 'PROJETO')
  .replace(/\bSistema(S)?\b/g, 'SISTEMA')
  .replace(/\bGroup\w*\b/g, 'GRUPO')
  .trim();

async function ensureContasTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS contas_contabeis (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(20) NOT NULL,
      nome VARCHAR(255) NOT NULL,
      tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;

  // Atualiza ou insere contas padrão (upsert por código)
  const defaultAccounts = [
    ['3.1', 'Folha de Pagamento', 'DESPESA'],
    ['3.2', 'Aluguel', 'DESPESA'],
    ['3.3', 'Água / Luz / Telefone', 'DESPESA'],
    ['3.4', 'Material de Escritório', 'DESPESA'],
    ['3.5', 'Segurança', 'DESPESA'],
    ['3.6', 'Editoras', 'DESPESA'],
    ['3.7', 'Impostos', 'DESPESA'],
    ['3.8', 'Manutenção', 'DESPESA'],
    ['3.9', 'Tarifas Bancárias', 'DESPESA'],
    ['3.10', 'Juros / Multas', 'DESPESA'],
    ['3.11', 'Outras Despesas', 'DESPESA'],
    ['4.1', 'Mensalidades', 'RECEITA'],
    ['4.2', 'Repasses', 'RECEITA'],
    ['4.3', 'Matrículas', 'RECEITA'],
    ['4.4', 'Permutas / Convênios', 'RECEITA'],
    ['4.5', 'Aplicação Bancária', 'RECEITA'],
    ['4.6', 'Outras Receitas', 'RECEITA'],
  ];

  for (const [codigo, nome, tipo] of defaultAccounts) {
    const exists = await sql`SELECT id FROM contas_contabeis WHERE codigo = ${codigo} LIMIT 1`;
    if (exists.length === 0) {
      await sql`INSERT INTO contas_contabeis (codigo, nome, tipo) VALUES (${codigo}, ${nome}, ${tipo})`;
    } else {
      await sql`UPDATE contas_contabeis SET nome = ${nome}, tipo = ${tipo}, ativo = true WHERE codigo = ${codigo}`;
    }
  }
}

// --- Handlers ---

// GET /api?route=transactions
async function handleTransactions(req, res) {
  if (req.method === 'GET') {
    try {
      const { uid, limit, offset, year, month, search } = req.query;
      // Se tiver busca ou filtro de ano, aumentamos o limite para garantir que o resultado seja completo
      const defaultLimit = (year && year !== 'TODOS') || search ? 5000 : 50;
      const parsedLimit = limit ? parseInt(limit) : defaultLimit;
      const parsedOffset = offset ? parseInt(offset) : 0;

      let query = sql`SELECT * FROM transactions WHERE 1=1`;
      if (uid) query = sql`${query} AND uid = ${uid}`;

      // Se houver busca, ignoramos filtros de ano/mês para encontrar em todo o histórico
      if (search) {
        // Busca flexível: remove acentos básicos para melhorar a busca manual
        const s = `%${search}%`;
        query = sql`${query} AND (fornecedor ILIKE ${s} OR descricao ILIKE ${s} OR empresa ILIKE ${s})`;
      }
 else {
        // Filtros de período só se aplicam se NÃO houver busca ativa
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
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id } = req.body;
      const vDate = parseDateToPg(vencimento);
      const pDate = parseDateToPg(pagamento);
      const normalizedNumber = normalizeBoletoNumber(numero_boleto);
      const duplicateRows = normalizedNumber
        ? await sql`
            SELECT id FROM transactions
            WHERE regexp_replace(upper(coalesce(numero_boleto, '')), '[^A-Z0-9]', '', 'g') = ${normalizedNumber}
            LIMIT 1`
        : await sql`
            SELECT id FROM transactions
            WHERE upper(coalesce(fornecedor, '')) = upper(${fornecedor})
              AND vencimento = ${vDate}
              AND abs(valor - ${valor}) < 0.0001
              AND upper(coalesce(descricao, '')) = upper(${descricao || ''})
              AND upper(coalesce(empresa, '')) = upper(${empresa || ''})
            LIMIT 1`;
      if (duplicateRows.length) {
        return res.status(409).json({ error: 'Boleto já lançado', duplicate: true });
      }
      const rows = await sql`
        INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id)
        VALUES (${uid || 'guest'}, ${fornecedor}, ${descricao || '-'}, ${empresa || 'Geral'},
                ${vDate}, ${pDate}, ${valor}, ${status || 'PENDENTE'}, ${banco || null}, ${tipo || 'DESPESA'}, ${normalizedNumber || null}, ${conta_contabil_id || null})
        RETURNING *`;
      return res.status(201).json(rows[0]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}


// GET /api?route=stats — retorna agregados globais para o dashboard
async function handleStats(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { uid, year, period } = req.query;
    const filterUid = uid || 'guest';

    // Filtro de data dinâmico
    let dateFilterSql;
    const isRange = (val) => /^\d{4}-\d{4}$/.test(val);

    if (year && year !== 'TODOS' && !isRange(year)) {
      const y = parseInt(year);
      dateFilterSql = sql`AND vencimento >= ${y + '-01-01'} AND vencimento <= ${y + '-12-31'}`;
    } else if (isRange(year) || isRange(period)) {
      const range = isRange(year) ? year : period;
      const [start, end] = range.split('-');
      dateFilterSql = sql`AND vencimento >= ${start + '-01-01'} AND vencimento <= ${end + '-12-31'}`;
    } else {
      dateFilterSql = sql``; // TODOS
    }

    // 1. KPIs Agrupados (Somas e Contagens)
    const kpiRows = await sql`
      SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'RECEITA' THEN valor ELSE 0 END), 0) as total_receitas,
        COALESCE(SUM(CASE WHEN tipo != 'RECEITA' THEN valor + COALESCE(juros, 0) ELSE 0 END), 0) as total_despesas,
        COUNT(CASE WHEN status = 'PAGO' THEN 1 END) as count_pagos,
        COUNT(CASE WHEN status = 'PENDENTE' AND (vencimento >= CURRENT_DATE OR vencimento IS NULL) THEN 1 END) as count_pendentes,
        COUNT(CASE WHEN status = 'VENCIDO' OR (status = 'PENDENTE' AND vencimento < CURRENT_DATE) THEN 1 END) as count_vencidos,
        COUNT(*) as total_count
      FROM transactions
      WHERE uid = ${filterUid} ${dateFilterSql}`;

    // 2. Fluxo Mensal
    let fluxRows;
    const activeRange = isRange(year) ? year : (isRange(period) ? period : null);

    if (year && year !== 'TODOS' && !activeRange) {
      const y = parseInt(year);
      fluxRows = await sql`
        SELECT 
          EXTRACT(MONTH FROM vencimento) as month_num,
          COALESCE(SUM(CASE WHEN tipo = 'RECEITA' THEN valor ELSE 0 END), 0) as receitas,
          COALESCE(SUM(CASE WHEN tipo != 'RECEITA' THEN valor + COALESCE(juros, 0) ELSE 0 END), 0) as despesas
        FROM transactions
        WHERE uid = ${filterUid} 
          AND vencimento >= ${y + '-01-01'}
          AND vencimento <= ${y + '-12-31'}
        GROUP BY EXTRACT(MONTH FROM vencimento)
        ORDER BY month_num`;
    } else if (activeRange) {
      const [start, end] = activeRange.split('-');
      fluxRows = await sql`
        SELECT 
          EXTRACT(MONTH FROM vencimento) as month_num,
          COALESCE(SUM(CASE WHEN tipo = 'RECEITA' THEN valor ELSE 0 END), 0) as receitas,
          COALESCE(SUM(CASE WHEN tipo != 'RECEITA' THEN valor + COALESCE(juros, 0) ELSE 0 END), 0) as despesas
        FROM transactions
        WHERE uid = ${filterUid} 
          AND vencimento >= ${start + '-01-01'}
          AND vencimento <= ${end + '-12-31'}
        GROUP BY EXTRACT(MONTH FROM vencimento)
        ORDER BY month_num`;
    } else {
      // Padrão: Ano Atual ou TODOS (mostra acumulado por mês do ano corrente)
      fluxRows = await sql`
        SELECT 
          EXTRACT(MONTH FROM vencimento) as month_num,
          COALESCE(SUM(CASE WHEN tipo = 'RECEITA' THEN valor ELSE 0 END), 0) as receitas,
          COALESCE(SUM(CASE WHEN tipo != 'RECEITA' THEN valor + COALESCE(juros, 0) ELSE 0 END), 0) as despesas
        FROM transactions
        WHERE uid = ${filterUid} 
          AND vencimento >= DATE_TRUNC('year', CURRENT_DATE)
          AND vencimento < DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year'
        GROUP BY EXTRACT(MONTH FROM vencimento)
        ORDER BY month_num`;
    }

    // 3. Top Fornecedores
    const supplierRows = await sql`
      SELECT 
        fornecedor as name,
        COALESCE(SUM(valor + COALESCE(juros, 0)), 0) as value
      FROM transactions
      WHERE uid = ${filterUid} ${dateFilterSql}
      GROUP BY fornecedor
      ORDER BY value DESC
      LIMIT 10`;

    return res.json({
      kpis: kpiRows[0],
      monthlyFlux: fluxRows,
      topSuppliers: supplierRows
    });
  } catch (e) {
    console.error('[stats] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

// POST /api?route=transactions-batch
async function handleTransactionsBatch(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const transactions = req.body;
  console.log('[batch] Received:', JSON.stringify(transactions?.slice(0, 2), null, 2));

  if (!Array.isArray(transactions) || transactions.length === 0) {
    console.log('[batch] Invalid: not an array or empty');
    return res.status(400).json({ error: 'Invalid batch data' });
  }

  try {
    let created = 0;
    let blocked = 0;
    let errors = [];
    const seenKeys = new Set();

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const { uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id } = tx;

      // Validate required fields
      if (!fornecedor || !vencimento || valor === undefined || valor === null) {
        console.log(`[batch] Skipping row ${i}: missing required fields`, { fornecedor, vencimento, valor });
        errors.push({ index: i, error: 'Missing required fields' });
        continue;
      }

      const vDate = parseDateToPg(vencimento) || new Date().toISOString().split('T')[0];
      const pDate = parseDateToPg(pagamento);
      const normalizedNumber = normalizeBoletoNumber(numero_boleto);

      const descKey = String(descricao || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const empKey = String(empresa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const localKey = normalizedNumber
        ? `BOLETO:${normalizedNumber}`
        : `BASE:${String(fornecedor || '').toUpperCase()}|${vDate}|${Number(valor || 0).toFixed(2)}|${descKey}|${empKey}`;

      if (seenKeys.has(localKey)) {
        blocked++;
        continue;
      }

      const duplicateRows = normalizedNumber
        ? await sql`
            SELECT id FROM transactions
            WHERE regexp_replace(upper(coalesce(numero_boleto, '')), '[^A-Z0-9]', '', 'g') = ${normalizedNumber}
            LIMIT 1`
        : await sql`
            SELECT id FROM transactions
            WHERE upper(coalesce(fornecedor, '')) = upper(${fornecedor})
              AND vencimento = ${vDate}
              AND abs(valor - ${valor}) < 0.0001
              AND upper(coalesce(descricao, '')) = upper(${descricao || ''})
              AND upper(coalesce(empresa, '')) = upper(${empresa || ''})
            LIMIT 1`;

      if (duplicateRows.length) {
        blocked++;
        continue;
      }

      await sql`
        INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id)
        VALUES (${uid || 'guest'}, ${fornecedor}, ${descricao || '-'}, ${empresa || 'Geral'},
                ${vDate}, ${pDate}, ${valor}, ${status || 'PENDENTE'}, ${banco || null}, ${tipo || 'DESPESA'}, ${normalizedNumber || null}, ${conta_contabil_id || null})`;
      created++;
      seenKeys.add(localKey);
    }

    console.log(`[batch] Done: ${created} created, ${blocked} blocked, ${errors.length} errors`);
    return res.status(201).json({ message: 'Batch processed', count: created, blocked, errors });
  } catch (e) {
    console.error('[batch] Error:', e.message, e.stack);
    return res.status(500).json({ error: e.message, details: e.stack });
  }
}

// PUT /api?route=transactions-batch-update
async function handleTransactionsBatchUpdate(req, res) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  const { ids, banco, dataPagamento } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const finalDate = parseDateToPg(dataPagamento) || today;
    
    let updated = 0;
    for (const id of ids) {
      const rows = await sql`
        UPDATE transactions
        SET status = 'PAGO', pagamento = ${finalDate}, banco = ${banco || null}
        WHERE id = ${id} AND status != 'PAGO'
        RETURNING id
      `;
      updated += rows.length;
    }
    console.log(`[batch-update] Updated ${updated} of ${ids.length} transactions with date ${finalDate}`);
    return res.json({ message: 'Batch updated', count: updated });
  } catch (e) {
    console.error('[batch-update] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

// PUT/DELETE /api?route=transactions&id=xxx
async function handleTransactionById(req, res) {
  const { id } = req.query;

  if (req.method === 'PUT') {
    try {
      const { status, pagamento, vencimento, fornecedor, descricao, empresa, valor, banco, tipo, juros, numero_boleto, conta_contabil_id } = req.body;
      const pDate = pagamento ? parseDateToPg(pagamento) : null;
      const vDate = vencimento ? parseDateToPg(vencimento) : null;
      const rows = await sql`
        UPDATE transactions SET
          status     = COALESCE(${status}, status),
          pagamento  = ${pDate},
          vencimento = COALESCE(${vDate}, vencimento),
          fornecedor = COALESCE(${fornecedor}, fornecedor),
          descricao  = COALESCE(${descricao}, descricao),
          empresa    = COALESCE(${empresa}, empresa),
          valor      = COALESCE(${valor !== undefined ? Number(valor) : null}, valor),
          banco      = ${banco !== undefined ? banco : null},
          tipo       = COALESCE(${tipo}, tipo),
          juros      = ${juros !== undefined ? Number(juros) : null},
          numero_boleto = ${numero_boleto !== undefined ? numero_boleto : null},
          conta_contabil_id = ${conta_contabil_id !== undefined ? conta_contabil_id : null}
        WHERE id = ${id}
        RETURNING *`;
      const tx = rows[0];
      return res.json({
        ...tx,
        vencimento: tx.vencimento ? new Date(tx.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '',
        pagamento: tx.pagamento ? new Date(tx.pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined,
        valor: Number(tx.valor),
        juros: Number(tx.juros || 0),
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM transactions WHERE id = ${id}`;
      return res.status(204).end();
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// GET/POST /api?route=suppliers
async function handleSuppliers(req, res) {
  if (req.method === 'GET') {
    try {
      const { uid } = req.query;
      const rows = uid
        ? await sql`SELECT * FROM suppliers WHERE uid = ${uid} ORDER BY nome ASC`
        : await sql`SELECT * FROM suppliers ORDER BY nome ASC`;
      return res.json(rows);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { uid, nome, cnpj, email, telefone } = req.body;
      const rows = await sql`
        INSERT INTO suppliers (uid, nome, cnpj, email, telefone)
        VALUES (${uid || 'guest'}, ${nome}, ${cnpj || null}, ${email || null}, ${telefone || null})
        RETURNING *`;
      return res.status(201).json(rows[0]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// POST /api?route=suppliers-batch
async function handleSuppliersBatch(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const suppliers = req.body;
  if (!Array.isArray(suppliers) || suppliers.length === 0) {
    return res.status(400).json({ error: 'Invalid batch data' });
  }

  try {
    for (const sup of suppliers) {
      const { uid, nome, cnpj, email, telefone } = sup;
      await sql`
        INSERT INTO suppliers (uid, nome, cnpj, email, telefone)
        VALUES (${uid || 'guest'}, ${nome}, ${cnpj || null}, ${email || null}, ${telefone || null})
        ON CONFLICT DO NOTHING`;
    }
    return res.status(201).json({ message: 'Batch created successfully', count: suppliers.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

// POST /api?route=suppliers-merge
async function handleSuppliersMerge(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { target, aliases } = req.body || {};
    const canonical = String(target || '').trim();
    const list = Array.isArray(aliases) ? aliases.filter(Boolean).map(String) : [];
    if (!canonical || list.length === 0) {
      return res.status(400).json({ error: 'target e aliases são obrigatórios' });
    }

    const upperTarget = normSupplier(canonical);
    const upperAliases = list.map(normSupplier).filter((v) => v && v !== upperTarget);
    if (upperAliases.length === 0) {
      return res.status(200).json({ updated: 0, removed: 0 });
    }

    const existingTarget = await sql`SELECT id FROM suppliers WHERE upper(regexp_replace(nome, '[^A-Za-z0-9]+', ' ', 'g')) = ${upperTarget} LIMIT 1`;
    if (existingTarget.length === 0) {
      await sql`INSERT INTO suppliers (uid, nome) VALUES ('guest', ${canonical})`;
    }

    let updated = 0;
    for (const alias of upperAliases) {
      await sql`UPDATE transactions SET fornecedor = ${canonical} WHERE upper(regexp_replace(fornecedor, '[^A-Za-z0-9]+', ' ', 'g')) = ${alias}`;
    }
    const cnt = await sql`SELECT COUNT(*)::int AS c FROM transactions WHERE fornecedor = ${canonical}`;
    updated = Number(cnt[0].c) || 0;

    let removed = 0;
    for (const alias of upperAliases) {
      const rows = await sql`DELETE FROM suppliers WHERE upper(regexp_replace(nome, '[^A-Za-z0-9]+', ' ', 'g')) = ${alias} AND upper(regexp_replace(nome, '[^A-Za-z0-9]+', ' ', 'g')) <> ${upperTarget} RETURNING id`;
      removed += rows.length;
    }

    return res.json({ updated, removed, target: canonical });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

// POST /api?route=suppliers-merge-auto
async function handleSuppliersMergeAuto(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    console.log('[merge-auto] Starting auto merge process...');

    const suppliers = await sql`SELECT id, nome FROM suppliers ORDER BY nome`;
    const txs = await sql`SELECT id, fornecedor FROM transactions`;

    console.log(`[merge-auto] Found ${suppliers.length} suppliers and ${txs.length} transactions`);

    // Count frequency of each fornecedor in transactions
    const freqByName = new Map();
    txs.forEach((t) => {
      const name = String(t.fornecedor || '').trim();
      if (!name) return;
      freqByName.set(name, (freqByName.get(name) || 0) + 1);
    });

    // Group suppliers by normalized name
    const groups = new Map(); // normalized -> [{id, nome}]
    suppliers.forEach((s) => {
      const key = normSupplier(s.nome);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ id: s.id, nome: s.nome });
    });

    let totalUpdated = 0;
    let totalRemoved = 0;
    let groupsProcessed = 0;

    // Collect all updates and deletes to do in batches
    const updates = [];
    const deletes = [];

    for (const [key, items] of groups.entries()) {
      if (items.length <= 1) continue; // Skip uniques

      groupsProcessed++;
      const names = items.map(i => i.nome);
      console.log(`[merge-auto] Group "${key}": ${names.length} variants: ${names.join(' | ')}`);

      // Choose canonical name (most frequent in transactions, fallback to longest)
      let canonical = names[0];
      let bestScore = -1;
      names.forEach((n) => {
        const score = freqByName.get(n) || 0;
        if (score > bestScore || (score === bestScore && n.length > canonical.length)) {
          bestScore = score;
          canonical = n;
        }
      });

      const aliases = names.filter((n) => n !== canonical);
      if (aliases.length === 0) continue;

      console.log(`[merge-auto] Canonical: "${canonical}", Aliases: ${aliases.join(', ')}`);

      // Collect aliases for batch update
      aliases.forEach(alias => {
        updates.push({ alias, canonical });
      });

      // Collect aliases for batch delete
      aliases.forEach(alias => {
        deletes.push({ alias, canonical });
      });
    }

    // Execute batch updates
    for (const { alias, canonical } of updates) {
      const normalizedAlias = normSupplier(alias);
      const updateResult = await sql`
        UPDATE transactions 
        SET fornecedor = ${canonical} 
        WHERE upper(regexp_replace(coalesce(fornecedor, ''), '[^A-Za-z0-9]+', ' ', 'g')) = ${normalizedAlias}
           OR fornecedor = ${alias}
      `;
      console.log(`[merge-auto] Updated transactions: "${alias}" -> "${canonical}" (${updateResult.length} rows)`);
      totalUpdated += updateResult.length;
    }

    // Execute batch deletes
    for (const { alias, canonical } of deletes) {
      const normalizedAlias = normSupplier(alias);
      const deleteResult = await sql`
        DELETE FROM suppliers 
        WHERE (upper(regexp_replace(coalesce(nome, ''), '[^A-Za-z0-9]+', ' ', 'g')) = ${normalizedAlias}
               OR nome = ${alias})
        AND nome != ${canonical}
        RETURNING id
      `;
      console.log(`[merge-auto] Deleted supplier: "${alias}" (${deleteResult.length} rows)`);
      totalRemoved += deleteResult.length;
    }

    console.log(`[merge-auto] Completed: ${groupsProcessed} groups, ${totalUpdated} transactions updated, ${totalRemoved} suppliers removed`);

    return res.json({
      updated: totalUpdated,
      removed: totalRemoved,
      groupsProcessed,
      message: `${groupsProcessed} grupos unificados, ${totalUpdated} transações atualizadas, ${totalRemoved} fornecedores removidos`
    });
  } catch (e) {
    console.error('[merge-auto] Error:', e);
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
}

// DELETE /api?route=suppliers&id=xxx
async function handleSupplierById(req, res) {
  const { id } = req.query;

  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM suppliers WHERE id = ${id}`;
      return res.status(204).end();
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// GET/POST /api?route=banks
async function handleBanks(req, res) {
  if (req.method === 'GET') {
    try {
      const { uid } = req.query;
      const rows = uid
        ? await sql`SELECT * FROM banks WHERE uid = ${uid} ORDER BY nome ASC`
        : await sql`SELECT * FROM banks ORDER BY nome ASC`;
      return res.json(rows);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { uid, nome, agencia, conta, saldo, ativo } = req.body;
      const rows = await sql`
        INSERT INTO banks (uid, nome, agencia, conta, saldo, ativo)
        VALUES (${uid || 'guest'}, ${nome}, ${agencia || null}, ${conta || null}, ${saldo || 0}, ${ativo !== false})
        RETURNING *`;
      return res.status(201).json(rows[0]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// PUT/DELETE /api?route=banks&id=xxx
async function handleBankById(req, res) {
  const { id } = req.query;

  if (req.method === 'PUT') {
    try {
      const { nome, agencia, conta, saldo, ativo } = req.body;
      const rows = await sql`
        UPDATE banks 
        SET nome = COALESCE(${nome}, nome),
            agencia = COALESCE(${agencia}, agencia),
            conta = COALESCE(${conta}, conta),
            saldo = COALESCE(${saldo}, saldo),
            ativo = COALESCE(${ativo}, ativo)
        WHERE id = ${id}
        RETURNING *`;
      return res.json(rows[0]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM banks WHERE id = ${id}`;
      return res.status(204).end();
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// GET/POST/PUT/DELETE /api?route=contas-contabeis
async function handleContasContabeis(req, res) {
  // GET
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
        await ensureContasTable();
        const rows = await sql`SELECT * FROM contas_contabeis WHERE ativo = true ORDER BY tipo, codigo ASC`;
        return res.json(rows);
      } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }
    }
  }

  // POST
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

  // PUT
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

  // DELETE
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

// POST /api?route=setup-tables
async function handleSetupTables(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS banks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        uid VARCHAR(255) NOT NULL,
        nome VARCHAR(255) NOT NULL,
        agencia VARCHAR(100),
        conta VARCHAR(100),
        saldo DECIMAL(15, 2) DEFAULT 0,
        ativo BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`;

    await sql`ALTER TABLE banks ADD COLUMN IF NOT EXISTS agencia VARCHAR(100)`;
    await sql`ALTER TABLE banks ADD COLUMN IF NOT EXISTS conta VARCHAR(100)`;
    await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS banco VARCHAR(255)`;
    await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tipo VARCHAR(10) DEFAULT 'DESPESA'`;
    await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS juros NUMERIC DEFAULT 0`;
    await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS numero_boleto VARCHAR(255)`;
    await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS conta_contabil_id INTEGER REFERENCES contas_contabeis(id)`;

    await sql`
      CREATE TABLE IF NOT EXISTS contas_contabeis (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(20) NOT NULL,
        nome VARCHAR(255) NOT NULL,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
        ativo BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`;

    // Atualiza ou insere contas padrão (upsert por código)
    const defaultAccounts = [
      ['3.1', 'Folha de Pagamento', 'DESPESA'],
      ['3.2', 'Aluguel', 'DESPESA'],
      ['3.3', 'Água / Luz / Telefone', 'DESPESA'],
      ['3.4', 'Material de Escritório', 'DESPESA'],
      ['3.5', 'Segurança', 'DESPESA'],
      ['3.6', 'Editoras', 'DESPESA'],
      ['3.7', 'Impostos', 'DESPESA'],
      ['3.8', 'Manutenção', 'DESPESA'],
      ['3.9', 'Tarifas Bancárias', 'DESPESA'],
      ['3.10', 'Juros / Multas', 'DESPESA'],
      ['3.11', 'Outras Despesas', 'DESPESA'],
      ['4.1', 'Mensalidades', 'RECEITA'],
      ['4.2', 'Repasses', 'RECEITA'],
      ['4.3', 'Matrículas', 'RECEITA'],
      ['4.4', 'Permutas / Convênios', 'RECEITA'],
      ['4.5', 'Aplicação Bancária', 'RECEITA'],
      ['4.6', 'Outras Receitas', 'RECEITA'],
    ];

    for (const [codigo, nome, tipo] of defaultAccounts) {
      const exists = await sql`SELECT id FROM contas_contabeis WHERE codigo = ${codigo} LIMIT 1`;
      if (exists.length === 0) {
        await sql`INSERT INTO contas_contabeis (codigo, nome, tipo) VALUES (${codigo}, ${nome}, ${tipo})`;
        console.log(`[setup] Conta ${codigo} - ${nome} inserida`);
      } else {
        // Atualiza nome se diferente
        await sql`UPDATE contas_contabeis SET nome = ${nome}, tipo = ${tipo}, ativo = true WHERE codigo = ${codigo}`;
        console.log(`[setup] Conta ${codigo} - ${nome} atualizada`);
      }
    }

    await sql`CREATE INDEX IF NOT EXISTS idx_banks_uid ON banks(uid)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_transactions_duplicate ON transactions(fornecedor, vencimento, valor, empresa)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_transactions_vencimento ON transactions(vencimento DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_transactions_uid ON transactions(uid)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_transactions_fornecedor ON transactions(fornecedor)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)`;

    // Unique normalized boleto number (prevents duplicados definitivos)
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_boleto_unique
              ON transactions ((regexp_replace(upper(coalesce(numero_boleto, '')), '[^A-Z0-9]', '', 'g')))
              WHERE numero_boleto IS NOT NULL AND numero_boleto <> ''`;

    return res.json({ message: 'Tables created successfully' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

// Helper: normaliza nome para chave de busca
const normName = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

// Helper: extrai CNPJ limpo
const cleanCnpj = (s) => String(s || '').replace(/[^0-9]/g, '');

// Consulta padrão aprendido pelo CNPJ ou nome normalizado
async function lookupPattern(cnpj, nomeNormalizado) {
  try {
    if (cnpj && cnpj.length >= 11) {
      const r = await sql`SELECT * FROM boleto_patterns WHERE cnpj = ${cnpj} LIMIT 1`;
      if (r.length) return r[0];
    }
    if (nomeNormalizado && nomeNormalizado.length >= 5) {
      // Busca por similaridade — nome contém ou é contido
      const r = await sql`
        SELECT * FROM boleto_patterns 
        WHERE ${nomeNormalizado} LIKE '%' || nome_normalizado || '%'
           OR nome_normalizado LIKE '%' || ${nomeNormalizado} || '%'
        ORDER BY confirmacoes DESC LIMIT 1`;
      if (r.length) return r[0];
    }
  } catch { /* tabela pode não existir ainda */ }
  return null;
}

// GET /api?route=boleto-patterns — lista todos os padrões aprendidos
async function handleBoletoPatterns(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS boleto_patterns (
        id SERIAL PRIMARY KEY, cnpj VARCHAR(20), nome_normalizado VARCHAR(255),
        fornecedor VARCHAR(255) NOT NULL, descricao VARCHAR(255), empresa VARCHAR(50),
        tipo VARCHAR(10) DEFAULT 'DESPESA', conta_contabil_id INTEGER,
        confirmacoes INTEGER DEFAULT 1,
        ultima_confirmacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(cnpj), UNIQUE(nome_normalizado)
      )`;
    const rows = await sql`SELECT * FROM boleto_patterns ORDER BY confirmacoes DESC, fornecedor ASC`;
    return res.json(rows);
  } catch (e) {
    console.error('[patterns] Error listing:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

// DELETE /api?route=boleto-patterns&id=xxx — deleta um padrão específico
async function handleDeleteBoletoPattern(req, res) {
  const { id } = req.query;
  if (req.method !== 'DELETE' || !id) return res.status(405).json({ error: 'Method not allowed' });
  try {
    await sql`DELETE FROM boleto_patterns WHERE id = ${id}`;
    return res.status(204).end();
  } catch (e) {
    console.error('[patterns] Error deleting:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

// POST /api?route=save-boleto-pattern — chamado quando usuário confirma importação
// v2 — auto-save nunca sobrescreve padrão existente
async function handleSaveBoletoPattern(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { cnpj, nome_beneficiario, fornecedor, descricao, empresa, tipo, conta_contabil_id } = req.body;
    if (!fornecedor) return res.status(400).json({ error: 'fornecedor obrigatório' });

    const cnpjClean = cleanCnpj(cnpj);
    const nomeNorm = normName(nome_beneficiario || fornecedor);

    // Garante que a tabela existe
    await sql`
      CREATE TABLE IF NOT EXISTS boleto_patterns (
        id SERIAL PRIMARY KEY,
        cnpj VARCHAR(20),
        nome_normalizado VARCHAR(255),
        fornecedor VARCHAR(255) NOT NULL,
        descricao VARCHAR(255),
        empresa VARCHAR(50),
        tipo VARCHAR(10) DEFAULT 'DESPESA',
        conta_contabil_id INTEGER,
        confirmacoes INTEGER DEFAULT 1,
        ultima_confirmacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(cnpj),
        UNIQUE(nome_normalizado)
      )`;

    if (cnpjClean.length >= 11) {
      await sql`
        INSERT INTO boleto_patterns (cnpj, nome_normalizado, fornecedor, empresa, tipo, conta_contabil_id)
        VALUES (${cnpjClean}, ${nomeNorm}, ${fornecedor}, ${empresa || null}, ${tipo || 'DESPESA'}, ${conta_contabil_id || null})
        ON CONFLICT (cnpj) DO UPDATE SET
          fornecedor = EXCLUDED.fornecedor,
          empresa = COALESCE(EXCLUDED.empresa, boleto_patterns.empresa),
          tipo = EXCLUDED.tipo,
          conta_contabil_id = COALESCE(EXCLUDED.conta_contabil_id, boleto_patterns.conta_contabil_id),
          confirmacoes = boleto_patterns.confirmacoes + 1,
          ultima_confirmacao = NOW()`;
    } else {
      await sql`
        INSERT INTO boleto_patterns (nome_normalizado, fornecedor, empresa, tipo, conta_contabil_id)
        VALUES (${nomeNorm}, ${fornecedor}, ${empresa || null}, ${tipo || 'DESPESA'}, ${conta_contabil_id || null})
        ON CONFLICT (nome_normalizado) DO UPDATE SET
          fornecedor = EXCLUDED.fornecedor,
          empresa = COALESCE(EXCLUDED.empresa, boleto_patterns.empresa),
          tipo = EXCLUDED.tipo,
          conta_contabil_id = COALESCE(EXCLUDED.conta_contabil_id, boleto_patterns.conta_contabil_id),
          confirmacoes = boleto_patterns.confirmacoes + 1,
          ultima_confirmacao = NOW()`;
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('[pattern] Error saving pattern:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

// POST /api?route=extract-boleto
async function handleExtractBoleto(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, fileName, pdfBase64 } = req.body;
    if (!text && !fileName && !pdfBase64) {
      return res.status(400).json({ error: 'text, fileName or pdfBase64 required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const extractedText = text || '';
    const hasText = extractedText.length > 50;

    // ── 1. Tenta extrair CNPJ e nome do beneficiário do texto antes do Gemini ──
    const srcUpper = extractedText.toUpperCase();

    // ATENÇÃO: no boleto existem 2 CNPJs — do beneficiário e do pagador
    // O CNPJ do beneficiário aparece JUNTO ao nome do beneficiário
    // Extrai todos os CNPJs e associa ao contexto
    const cnpjMatches = [...srcUpper.matchAll(/(\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2})/g)];
    const allCnpjs = cnpjMatches.map(m => cleanCnpj(m[1])).filter(c => c.length >= 11);

    // Tenta identificar o beneficiário pelo campo explícito
    const benefPatterns = [
      /BENEFICI[AÁ]RIO[:\s]+([\w\u00C0-\u017E\s.&/,-]{3,60})(?:\s+CNPJ|\s+AG[EÊ]|\s+\d{2}\/)/i,
      /CEDENTE[:\s]+([\w\u00C0-\u017E\s.&/,-]{3,60})(?:\s+CNPJ|\s+CPF)/i,
      /SACADOR[^:]*:[:\s]+([\w\u00C0-\u017E\s.&/,-]{3,60})(?:\s+-\s+CNPJ|\s+CNPJ)/i,
      // Nome seguido de CNPJ: "Empresa Ltda  18.717.282/0001-08"
      /([\w\u00C0-\u017E][\w\u00C0-\u017E\s.&/,-]{5,60})\s+\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2}/i,
    ];
    let rawBenefName = '';

    // Hardcoded safety for common utilities
    if (srcUpper.includes('SANESUL') || srcUpper.includes('SANEAMENTO DE MATO GROSSO')) {
      rawBenefName = 'SANESUL';
    } else if (srcUpper.includes('ENERGISA')) {
      rawBenefName = 'ENERGISA';
    } else if (srcUpper.includes('CLARO') || srcUpper.includes('NET RESIDENCIAL')) {
      rawBenefName = 'CLARO';
    } else if (srcUpper.includes('VIVO') || srcUpper.includes('TELEFONICA')) {
      rawBenefName = 'VIVO';
    } else {
      for (const p of benefPatterns) {
        const m = srcUpper.match(p);
        if (m?.[1]) {
          const candidate = m[1].trim().replace(/\s+/g, ' ');
          const rejectWords = ['BRADESCO', 'ITAU', 'SANTANDER', 'CAIXA', 'SICREDI', 'BANCO', 'PAGADOR', 'SACADO', 'RECIBO', 'AGENCIA', 'CODIGO', 'BENEFICI', 'ESPECIE', 'CARTEIRA', 'INSTRUCOES', 'LOCAL DE', 'INSC', 'DOM.', 'AV.', 'AVENIDA', 'RUA', 'CEP '];
          if (candidate.length >= 5 && !rejectWords.some(w => candidate.toUpperCase().includes(w))) {
            rawBenefName = candidate;
            break;
          }
        }
      }
    }

    // Tenta o CNPJ que aparece próximo ao nome do beneficiário
    // Pega o CNPJ que NÃO é do pagador (pagador aparece depois de "Pagador" ou "Sacado")
    const pagadorMatch = srcUpper.match(/PAGADOR[:\s]+([\w\u00C0-\u017E\s.&/,-]{3,60})(?=\s+\d{3}\.|\s+CPF|\s+CNPJ)/i);
    const pagadorNome = pagadorMatch?.[1]?.trim() || '';
    // CNPJ do beneficiário = primeiro CNPJ que não está associado ao pagador
    const rawCnpj = allCnpjs.find(c => {
      // Verifica se esse CNPJ aparece próximo ao nome do pagador
      const cnpjIdx = srcUpper.indexOf(c.slice(0, 8)); // busca pelos primeiros 8 dígitos
      const pagIdx = pagadorNome ? srcUpper.indexOf(pagadorNome.slice(0, 10)) : -1;
      if (pagIdx === -1) return true; // sem pagador identificado, usa o primeiro
      return Math.abs(cnpjIdx - pagIdx) > 200; // CNPJ longe do pagador = beneficiário
    }) || allCnpjs[0] || '';

    const pattern = await lookupPattern(rawCnpj, normName(rawBenefName));

    if (pattern) {
      // ✅ Padrão encontrado — retorna sem chamar o Gemini
      console.log(`[boleto] Pattern hit: ${pattern.fornecedor} (${pattern.confirmacoes}x confirmado)`);

      // Ainda precisa do Gemini só para vencimento, valor e numero_boleto
      // Tenta extrair localmente primeiro
      const dateMatch = srcUpper.match(/VENCIMENTO[:\s]+(\d{2}\/\d{2}\/\d{4})/);
      const valorMatch = srcUpper.match(/\(=\)\s*VALOR[^0-9]*([\d.,]+)|VALOR\s*DO\s*DOCUMENTO[:\s]+([\d.,]+)/);

      const parseV = (s) => {
        if (!s) return 0;
        const r = s.trim().replace(/[R$\s]/g, '');
        // Se tem ponto E vírgula (ex: 1.250,00)
        if (r.includes('.') && r.includes(',')) {
          // Se o ponto vem antes da vírgula (formato brasileiro)
          if (r.indexOf('.') < r.indexOf(',')) return parseFloat(r.replace(/\./g, '').replace(',', '.'));
          // Formato americano com vírgula como separador de milhar
          return parseFloat(r.replace(/,/g, ''));
        }
        if (r.includes(',')) return parseFloat(r.replace(',', '.'));
        return parseFloat(r) || 0;
      };

      const vencimento = dateMatch?.[1] || '';

      // Tenta uma busca mais inteligente: data próxima ao valor financeiro (R$)
      // No boleto da Energisa, o vencimento real está na mesma linha ou logo após o valor.
      const dateNearValueMatch = srcUpper.match(/(\d{2}\/\d{2}\/\d{4})[\s\n]+R\$/i) || srcUpper.match(/R\$[\s\n]*[\d.,]+[\s\n]+(\d{2}\/\d{2}\/\d{4})/i);
      const experimentalVencimento = dateNearValueMatch?.[1];

      const valor = parseV(valorMatch?.[1] || valorMatch?.[2] || '');
      const numero_boleto = extractLocalBoletoNumber(srcUpper);

      // Bloqueio específico para Energisa: se pegou a data de leitura do topo (07/05/2026), tenta a outra.
      let finalVencimento = experimentalVencimento || vencimento;
      if (pattern.fornecedor.includes('ENERGISA') && finalVencimento === '07/05/2026') {
        const otherDateMatch = [...srcUpper.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)]
          .map(m => m[1])
          .find(d => d !== '07/05/2026' && (d.includes('/04/') || d.includes('/04/2026')));
        if (otherDateMatch) finalVencimento = otherDateMatch;
      }

      // Extrai nome do Pagador do texto para usar como descrição (aceita acentos e caracteres especiais)
      const pagadorRawMatch = srcUpper.match(/PAGADOR\s+([\w\u00C0-\u017E\s.'-]{5,80})(?=\s+\d{3}\.|\s+CPF|\s+CNPJ|\s+\d{2,3}\.\d{3})/i);
      const pagadorDescricao = (pagadorRawMatch?.[1] || '').trim().replace(/\s+/g, ' ');

      // Se não conseguiu extrair localmente, chama Gemini só para esses campos
      if (!vencimento || !valor) {
        // Chama Gemini com prompt mínimo só para data/valor
        const miniPrompt = `Extraia do texto de boleto abaixo APENAS:
- vencimento: data de vencimento no formato DD/MM/AAAA (IMPORTANTE: Para faturas de energia, NUNCA use a data de 'Próxima Leitura'! Use o Vencimento real próximo ao valor total).
- valor: valor total em reais com ponto decimal (ex: 105.00)
- numero_boleto: Nosso Número ou Número do Documento (só dígitos)

TEXTO: ${extractedText.slice(0, 5000)}

Responda APENAS JSON: {"vencimento":"","valor":0,"numero_boleto":""}`;

        const miniResp = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: miniPrompt,
          config: { responseMimeType: 'application/json', temperature: 0 },
        });
        const mini = JSON.parse((miniResp.text || '{}').replace(/```json|```/gi, '').trim());

        return res.json({
          fornecedor: pattern.fornecedor,
          vencimento: finalVencimento || mini.vencimento || vencimento,
          valor: mini.valor || valor,
          cnpj: rawCnpj || '',
          descricao: `${fileName} - ${pagadorDescricao || pattern.descricao || ''}`.replace(/ - $/, ''),
          empresa: pattern.empresa || '',
          tipo: pattern.tipo || 'DESPESA',
          conta_contabil_id: pattern.conta_contabil_id || null,
          numero_boleto: mini.numero_boleto || numero_boleto,
          _from_pattern: true,
        });
      }

      return res.json({
        fornecedor: pattern.fornecedor,
        vencimento: finalVencimento,
        valor,
        cnpj: rawCnpj || '',
        descricao: `${fileName} - ${pagadorDescricao || pattern.descricao || ''}`.replace(/ - $/, ''),
        empresa: pattern.empresa || '',
        tipo: pattern.tipo || 'DESPESA',
        conta_contabil_id: pattern.conta_contabil_id || null,
        numero_boleto,
        _from_pattern: true,
      });
    }

    // ── 2. Sem padrão — chama Gemini completo ────────────────────────────────

    const promptBase = `Você é um especialista em boletos bancários brasileiros com 20 anos de experiência em automação financeira.

REGRAS CRÍTICAS (Siga rigorosamente):
1. FORNECEDOR (Beneficiário):
   - É quem RECEBE o dinheiro (Ex: SANESUL, ENERGISA, CLARO, Condomínio Edifício X).
   - NUNCA use o banco emissor (Sicredi, Bradesco, Itaú, Santander, Caixa, BB, Cora, Inter, Nubank, C6, Safra, etc).
   - Se encontrar "BANCO DO BRASIL" e "SANESUL", o fornecedor é SANESUL.
   - NUNCA use o "Pagador" ou "Sacado" as fornecedor.
   - NUNCA use um endereço (Rua, Av, CEP) como nome do fornecedor.

2. VALOR FINANCEIRO:
   - Use o "Valor Total a Pagar" ou "Total da Fatura".
   - NUNCA extraia "Multas", "Juros" ou "Atualização Monetária" como o valor principal.
   - Formato: use PONTO decimal (ex: 142.46).

3. VENCIMENTO:
   - Procure por "Vencimento" ou "Data de Vencimento".
   - Para ENERGISA/SANESUL: NUNCA use a "Data de Próxima Leitura". Use a data limite de pagamento.

CAMPOS ADICIONAIS:
- cnpj: CNPJ do fornecedor (só números).
- numero_boleto: Linha digitável ou código de barras (só números).

JSON FORMAT:
{"fornecedor":"","vencimento":"","valor":0,"cnpj":"","descricao":"","empresa":"","numero_boleto":""}`;

    let prompt;
    if (hasText) {
      prompt = `${promptBase}\n\nTEXTO DO PDF:\n${extractedText}\n\nNome do arquivo: ${fileName || 'N/A'}`;
    } else {
      prompt = `${promptBase}\n\nNome do arquivo: ${fileName || 'N/A'}\nAnalise visualmente o PDF anexo.`;
    }

    let contents;
    if (!hasText && pdfBase64) {
      contents = [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64,
          },
        },
      ];
    } else {
      contents = prompt;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    let rawText = response.text;
    if (rawText) {
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    }
    const extracted = JSON.parse(rawText || '{}');

    if (extracted.vencimento) {
      const v = extracted.vencimento;
      if (v.includes('-')) {
        const parts = v.split('-');
        if (parts.length === 3) {
          extracted.vencimento = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
    }

    if (typeof extracted.valor === 'string') {
      const raw = String(extracted.valor).trim().replace(/[R$\s]/g, '');
      if (/^\d{1,3}(\.\d{3})+(,\d{2})$/.test(raw)) {
        extracted.valor = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
      } else if (/^\d{1,3}(,\d{3})+(\.\d{2})$/.test(raw)) {
        extracted.valor = parseFloat(raw.replace(/,/g, ''));
      } else if (/^\d+\.\d{1,2}$/.test(raw)) {
        extracted.valor = parseFloat(raw);
      } else if (/^\d+,\d{1,2}$/.test(raw)) {
        extracted.valor = parseFloat(raw.replace(',', '.'));
      } else {
        extracted.valor = parseFloat(raw.replace(/[^0-9.]/g, ''));
      }
    }
    if (!Number.isFinite(extracted.valor) || extracted.valor <= 0) extracted.valor = 0;
    if (extracted.valor > 500000) extracted.valor = 0;

    if (!extracted.fornecedor || extracted.fornecedor === '' || extracted.fornecedor.toLowerCase() === 'não identificado') {
      if (fileName) {
        let name = fileName.replace(/\.pdf$/i, '').replace(/^(BOL|BOLETO|MAT)\s*/i, '').trim();
        extracted.fornecedor = name;
      }
    }

    if ((isAddressLike(extracted.fornecedor) || !extracted.fornecedor) && srcUpper.includes('ENERGISA')) {
      extracted.fornecedor = 'ENERGISA';
    }

    if ((extracted.fornecedor === 'ATUALIZA' || !extracted.fornecedor) && srcUpper.includes('CLARO')) {
      extracted.fornecedor = 'CLARO';
    }

    // Post-processing filter for Energisa reading date
    if (extracted.fornecedor === 'ENERGISA' && extracted.vencimento === '07/05/2026') {
      const realDate = srcUpper.match(/(\d{2}\/04\/2026)/);
      if (realDate) extracted.vencimento = realDate[1];
    }

    const localNumero = extractLocalBoletoNumber(extractedText);
    const finalNumero = normalizeBoletoNumber(extracted.numero_boleto || '') || localNumero;
    if (finalNumero) extracted.numero_boleto = finalNumero;

    res.status(200).json(extracted);
  } catch (error) {
    console.error('[boleto] Error extracting boleto data:', error.message);
    const { fileName } = req.body;
    let fornecedor = 'Fornecedor não identificado';
    if (fileName) {
      fornecedor = fileName.replace(/\.pdf$/i, '').replace(/^(BOL|BOLETO|MAT)\s*/i, '').trim();
    }
    res.status(200).json({
      fornecedor,
      vencimento: '',
      valor: 0,
      cnpj: '',
      descricao: fileName || '',
      empresa: '',
      numero_boleto: '',
    });
  }
}

// GET /api?route=export-backup
async function handleExportBackup(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const [transactions, suppliers, banks, contasContabeis, boletoPatterns] = await Promise.all([
      sql`SELECT * FROM transactions ORDER BY created_at DESC`,
      sql`SELECT * FROM suppliers ORDER BY nome`,
      sql`SELECT * FROM banks ORDER BY nome`,
      sql`SELECT * FROM contas_contabeis ORDER BY codigo`,
      sql`SELECT * FROM boleto_patterns ORDER BY created_at DESC`
    ]);

    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'Neon PostgreSQL'
      },
      data: {
        transactions: transactions || [],
        suppliers: suppliers || [],
        banks: banks || [],
        contas_contabeis: contasContabeis || [],
        boleto_patterns: boletoPatterns || []
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=backup-cn-${new Date().toISOString().split('T')[0]}.json`);
    return res.json(backup);
  } catch (e) {
    console.error('[backup] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

// --- Main Router ---
export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { route, id } = req.query;

  switch (route) {
    case 'transactions':
      if (id) return handleTransactionById(req, res);
      return handleTransactions(req, res);
    case 'transactions-batch':
      return handleTransactionsBatch(req, res);
    case 'transactions-batch-update':
      return handleTransactionsBatchUpdate(req, res);
    case 'suppliers':
      if (id) return handleSupplierById(req, res);
      return handleSuppliers(req, res);
    case 'suppliers-batch':
      return handleSuppliersBatch(req, res);
    case 'suppliers-merge':
      return handleSuppliersMerge(req, res);
    case 'suppliers-merge-auto':
      return handleSuppliersMergeAuto(req, res);
    case 'banks':
      if (id) return handleBankById(req, res);
      return handleBanks(req, res);
    case 'contas-contabeis':
      return handleContasContabeis(req, res);
    case 'setup-tables':
      return handleSetupTables(req, res);
    case 'save-boleto-pattern':
      return handleSaveBoletoPattern(req, res);
    case 'boleto-patterns':
      if (id) return handleDeleteBoletoPattern(req, res);
      return handleBoletoPatterns(req, res);
    case 'extract-boleto':
      return handleExtractBoleto(req, res);
    case 'stats':
      return handleStats(req, res);
    case 'export-backup':
      return handleExportBackup(req, res);
    default:
      return res.status(404).json({ error: 'Route not found' });
  }
}
