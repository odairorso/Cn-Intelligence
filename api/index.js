import { sql, parseDateToPg, setCors } from './_db.js';
import { GoogleGenAI } from '@google/genai';

// --- Helpers ---
const normalizeBoletoNumber = (value) => {
  const raw = String(value || '').toUpperCase();
  if (!raw) return '';
  const tokens = raw
    .split(/[\s:;|,]+/)
    .map((token) => token.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);
  const bestToken = tokens.find((token) => /\d{4,}/.test(token) && token.length >= 6 && token.length <= 30);
  if (bestToken) return bestToken;
  return raw.replace(/[^A-Z0-9]/g, '');
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
      const { uid } = req.query;
      // Carrega todas as transações
      const rows = uid
        ? await sql`SELECT * FROM transactions WHERE uid = ${uid} ORDER BY vencimento DESC`
        : await sql`SELECT * FROM transactions ORDER BY vencimento DESC`;

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

// POST /api?route=transactions-batch
async function handleTransactionsBatch(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const transactions = req.body;
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ error: 'Invalid batch data' });
  }

  try {
    let created = 0;
    let blocked = 0;
    const seenKeys = new Set();
    for (const tx of transactions) {
      const { uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id } = tx;
      const vDate = parseDateToPg(vencimento) || new Date().toISOString().split('T')[0];
      const pDate = parseDateToPg(pagamento);
      const normalizedNumber = normalizeBoletoNumber(numero_boleto);
      // Include descricao and empresa in duplicate key to avoid false positives
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
    return res.status(201).json({ message: 'Batch processed', count: created, blocked });
  } catch (e) {
    console.error(e);
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

    let prompt;
    if (hasText) {
      prompt = `Você é um especialista em extrair dados de boletos bancários brasileiros.
Analise o texto abaixo extraído de um PDF de boleto bancário e extraia os campos solicitados.

TEXTO DO PDF:
${extractedText}

Nome do arquivo: ${fileName || 'N/A'}

Extraia os seguintes campos:
1. fornecedor: NOME DO BENEFICIÁRIO/CEDENTE que recebe o pagamento (NÃO é o banco!).
2. vencimento: Data de vencimento no formato DD/MM/AAAA.
3. valor: Valor do boleto em reais (apenas número, usar ponto como decimal).
4. cnpj: CNPJ do beneficiário se disponível.
5. descricao: Descrição do serviço ou referência do boleto.
6. empresa: Qual empresa do grupo CN pertence (CN, FACEMS, LAB, CEI, UNOPAR).
7. numero_boleto: O NÚMERO QUE IDENTIFICA UNICAMENTE O BOLETO. Procure por:
   - "Nosso número" ou "Nosso Numero"
   - "Nro documento" ou "Nº documento" ou "Nr documento"
   - "Número do documento" ou "Numero do documento"
   - "Código de barras" (extraia apenas os números)
   - Este campo é OBRIGATÓRIO e nunca deve ser vazio. Se não encontrar, procure na linha digitável (código de barras com 47-48 dígitos).

Responda APENAS com JSON válido:
{"fornecedor":"","vencimento":"","valor":0,"cnpj":"","descricao":"","empresa":"","numero_boleto":""}`;
    } else {
      prompt = `Você é um especialista em extrair dados de boletos bancários brasileiros.
Analise visualmente o PDF de boleto bancário anexo e extraia os campos abaixo.

Nome do arquivo: ${fileName || 'N/A'}

Extraia os seguintes campos:
1. fornecedor: NOME DO BENEFICIÁRIO/CEDENTE que recebe o pagamento (NÃO é o banco!).
2. vencimento: Data de vencimento no formato DD/MM/AAAA.
3. valor: Valor do boleto em reais (apenas número, usar ponto como decimal).
4. cnpj: CNPJ do beneficiário se disponível.
5. descricao: Descrição do serviço ou referência do boleto.
6. empresa: Qual empresa do grupo CN pertence (CN, FACEMS, LAB, CEI, UNOPAR).
7. numero_boleto: O NÚMERO QUE IDENTIFICA UNICAMENTE O BOLETO. Procure por:
   - "Nosso número" ou "Nosso Numero"
   - "Nro documento" ou "Nº documento" ou "Nr documento"
   - "Número do documento" ou "Numero do documento"
   - "Código de barras" (extraia apenas os números)
   - Este campo é OBRIGATÓRIO e nunca deve ser vazio. Se não encontrar, procure na linha digitável (código de barras com 47-48 dígitos).

Responda APENAS com JSON válido:
{"fornecedor":"","vencimento":"","valor":0,"cnpj":"","descricao":"","empresa":"","numero_boleto":""}`;
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
      model: 'gemini-2.5-flash',
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
      extracted.valor = parseFloat(extracted.valor.replace(/\./g, '').replace(',', '.'));
    }

    if (!extracted.fornecedor || extracted.fornecedor === '' || extracted.fornecedor.toLowerCase() === 'não identificado') {
      if (fileName) {
        let name = fileName.replace(/\.pdf$/i, '').replace(/^(BOL|BOLETO|MAT)\s*/i, '').trim();
        extracted.fornecedor = name;
      }
    }

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
    case 'extract-boleto':
      return handleExtractBoleto(req, res);
    default:
      return res.status(404).json({ error: 'Route not found' });
  }
}
