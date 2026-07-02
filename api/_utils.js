import { sql } from './_db.js';

// --- Sanitização ---
export const sanitizeInput = (value) => {
  if (typeof value !== 'string') return value;
  // Prepared statements do driver do PostgreSQL já cuidam da segurança de SQL Injection.
  // Remove apenas caracteres de tags HTML para evitar injeções básicas no frontend,
  // preservando aspas de nomes próprios (ex: D'Angelo) e ampersands (ex: A & B).
  return value.replace(/[<>]/g, '').slice(0, 10000);
};

export const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => sanitizeObject(item));
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') sanitized[key] = sanitizeInput(value);
    else if (value && typeof value === 'object') sanitized[key] = sanitizeObject(value);
    else sanitized[key] = value;
  }
  return sanitized;
};

// --- Rate Limiting via PostgreSQL (funciona em serverless) ---
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_TABLE = 'rate_limits';

// Garante que a tabela de rate limit existe (criada automaticamente no primeiro uso)
let rateLimitTableChecked = false;

async function ensureRateLimitTable() {
  if (rateLimitTableChecked) return;
  rateLimitTableChecked = true;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS ${sql.unsafe(RATE_LIMIT_TABLE)} (
        key VARCHAR(255) PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_at BIGINT NOT NULL
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON ${sql.unsafe(RATE_LIMIT_TABLE)} (reset_at)`;
  } catch (e) {
    console.error('[rateLimit] Falha ao criar tabela:', e.message);
    rateLimitTableChecked = false; // Tenta de novo na próxima requisição
  }
}

// Cleanup periódico das entradas expiradas (a cada 5 min)
setInterval(async () => {
  try {
    await sql`DELETE FROM ${sql.unsafe(RATE_LIMIT_TABLE)} WHERE reset_at < ${Date.now() - RATE_LIMIT_WINDOW_MS}`;
  } catch {}
}, 300_000).unref();

export const checkRateLimit = async (req, res) => {
  await ensureRateLimitTable();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
  const now = Date.now();

  try {
    // Limpa entradas expiradas antes de checar
    await sql`DELETE FROM ${sql.unsafe(RATE_LIMIT_TABLE)} WHERE reset_at < ${now}`;

    // Tenta pegar registro existente
    const existing = await sql`SELECT count, reset_at FROM ${sql.unsafe(RATE_LIMIT_TABLE)} WHERE key = ${ip}`;

    if (!existing.length) {
      // Primeira requisição na janela: insere e permite
      const resetAt = now + RATE_LIMIT_WINDOW_MS;
      await sql`INSERT INTO ${sql.unsafe(RATE_LIMIT_TABLE)} (key, count, reset_at) VALUES (${ip}, 1, ${resetAt})`;
      return true;
    }

    const record = existing[0];
    if (record.reset_at <= now) {
      // Janela expirou: reseta contador
      const resetAt = now + RATE_LIMIT_WINDOW_MS;
      await sql`UPDATE ${sql.unsafe(RATE_LIMIT_TABLE)} SET count = 1, reset_at = ${resetAt} WHERE key = ${ip}`;
      return true;
    }

    if (record.count >= RATE_LIMIT_MAX) {
      res.status(429).json({ error: 'Too many requests' });
      return false;
    }

    // Incrementa contador
    await sql`UPDATE ${sql.unsafe(RATE_LIMIT_TABLE)} SET count = count + 1 WHERE key = ${ip}`;
    return true;
  } catch (e) {
    // Se o DB falhar, permite a requisição (fail-open)
    // Importante para serverless em cold-start
    console.error('[rateLimit] Erro:', e.message);
    return true;
  }
};

// --- Processamento de Boleto ---
export const normalizeBoletoNumber = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const raw = String(value).toUpperCase();
  const blacklist = ['CONSTATADO', 'CONTRATADO', 'CONTRATO', 'ISENTO', 'UNDEFINED', 'NULL', 'INVALID', 'CADASTRE', 'TELEFONE'];
  if (blacklist.some(word => raw.includes(word)) || !/\d/.test(raw)) {
    return '';
  }
  const clean = String(value).replace(/[^A-Z0-9]/g, '');
  if (clean.length === 47 || clean.length === 48 || clean.length === 44) {
    return clean;
  }
  if (!raw || raw === 'UNDEFINED' || raw === 'NULL') return '';
  const tokens = raw
    .split(/[\s:;|,]+/)
    .map((token) => token.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);
  const bestToken = tokens.find((token) => /\d{4,}/.test(token) && token.length >= 6 && token.length <= 30);
  if (bestToken) return bestToken;
  return clean;
};

export const isAddressLike = (value) => {
  const v = String(value || '').toUpperCase();
  if (!v) return false;
  if (v.includes(' AV ') || v.includes('AV.') || v.includes('AVENIDA') || v.includes('RUA') || v.includes('CEP')) return true;
  return false;
};

export const supplierFromFileName = (fileName) => {
  let name = String(fileName || '').replace(/\.pdf$/i, '');
  name = name.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  while (/^(BOL|BOLETO|MAT)\b/i.test(name)) {
    name = name.replace(/^(BOL|BOLETO|MAT)\b[\s\-_:]*/i, '').trim();
  }
  name = name.replace(/[\s\-_:]*(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)$/i, '').trim();
  return name;
};

export const extractLocalBoletoNumber = (text) => {
  const source = String(text || '').toUpperCase();
  const patterns = [
    /N[UÚ]MERO\s*DO\s*DOCUMENTO\s*[:\s-]*([A-Z0-9][A-Z0-9.\/ -]{3,39})/,
    /NOSSO\s*N[UÚ]MERO\s*[:\s-]*([A-Z0-9][A-Z0-9.\/ -]{3,39})/,
    /N[ROº°]*\s*DOCUMENTO\s*[:\s-]*([A-Z0-9][A-Z0-9.\/ -]{3,39})/,
    /NR\.?\s*DOC\.?\s*[:\s-]*([A-Z0-9][A-Z0-9.\/ -]{3,39})/,
    /N[º°]?\s*DOC\s*[:\s-]*([A-Z0-9][A-Z0-9.\/ -]{3,39})/,
    /DOCUMENTO\s*[:\s-]*([0-9]{6,20})/,
    /COD(?:IGO)?\s*(?:DE)?\s*BARRAS\s*[:\s-]*([0-9]{47,48})/,
    /C.{0,6}DIGO\s*(?:DE)?\s*BARRAS\s*[:\s-]*([0-9]{47,48})/,
    /UTILIZE\s+O\s+C.{0,6}DIGO\s*[:\s-]*([A-Z0-9]{6,25})/,
    /MATR.{0,6}CULA\s*[:\s-]*([0-9]{6,14}(?:[-\/][0-9A-Z]{1,6}){1,8})/,
    /NOTA\s+FISCAL\s+N[ROº°]*\s*[:\s-]*([0-9.]{6,25})/,
    /([0-9]{11})\s+CADASTRE\s+SUA\s+FATURA/,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) {
      const raw = match[1].trim().replace(/\s+/g, ' ');
      const blacklist = ['CONSTATADO', 'CONTRATADO', 'CONTRATO', 'ISENTO', 'UNDEFINED', 'NULL', 'INVALID', 'CADASTRE', 'TELEFONE'];
      const isBlacklisted = blacklist.some(word => raw.includes(word));
      const hasDigits = /\d/.test(raw);
      if (raw.length >= 4 && !isBlacklisted && hasDigits) return raw;
    }
  }
  return '';
};

// --- Utilitários de Boleto e CNPJ ---
export const normName = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

export const cleanCnpj = (s) => String(s || '').replace(/[^0-9]/g, '');

export const isValidCnpj = (cnpj) => {
  const v = String(cnpj || '').replace(/[^0-9]/g, '');
  if (v.length !== 14) return false;
  if (/^(\d)\1+$/.test(v)) return false;
  const calcDigit = (base) => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += Number(base[i]) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? '0' : String(11 - mod);
  };
  const base12 = v.slice(0, 12);
  const d1 = calcDigit(base12);
  const d2 = calcDigit(base12 + d1);
  return v === base12 + d1 + d2;
};

// --- Normalização de Fornecedores ---
export const normSupplier = (val) => {
  if (!val) return '';
  return String(val)
    .toUpperCase()
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim();
};

export async function logSecurity(req, res, event) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || '127.0.0.1';
  const ua = req.headers['user-agent'] || 'unknown';
  const { route } = req.query || {};
  const method = req.method || 'GET';
  const uid = req.authUid || null;
  const eventType = event.toLowerCase().includes('falhou') || event.toLowerCase().includes('injeção')
    ? 'SECURITY_WARNING'
    : 'SECURITY_INFO';
  
  try {
    await sql`
      INSERT INTO security_logs (event_type, description, ip_address, user_agent, uid, route)
      VALUES (${eventType}, ${event}, ${ip}, ${ua}, ${uid}, ${route || 'unknown'})
    `;
  } catch (e) {
    console.error('[security_log] erro', e);
  }
}

export function handleError(res, error, context = 'API Error') {
  console.error(`[${context}]:`, error);
  return res.status(500).json({ error: 'Erro interno no servidor' });
}

export async function getContaContabilId(fornecedor, descricao, tipo = 'DESPESA') {
  const fUpper = String(fornecedor || '').toUpperCase();
  const dUpper = String(descricao || '').toUpperCase();
  const text = `${fUpper} ${dUpper}`;

  // 1. Tentar buscar em boleto_patterns por fornecedor normalizado
  const normName = fUpper.replace(/[^A-Z0-9]/g, '');
  if (normName.length >= 3) {
    try {
      const patternRows = await sql`
        SELECT conta_contabil_id FROM boleto_patterns 
        WHERE upper(replace(replace(replace(replace(replace(nome_normalizado, '.', ''), '-', ''), ' ', ''), '/', ''), '&', '')) = ${normName} 
        LIMIT 1
      `;
      if (patternRows.length > 0 && patternRows[0].conta_contabil_id) {
        return patternRows[0].conta_contabil_id;
      }
    } catch (e) {
      console.error('[getContaContabilId] Erro ao buscar pattern:', e.message);
    }
  }

  // 2. Mapeamento heurístico por palavras-chave
  let targetCodigo = null;

  if (tipo === 'RECEITA') {
    if (text.includes('MENSALIDADE') || text.includes('ALUNO') || text.includes('MATRICULA') || text.includes('MATRÍCULA')) {
      targetCodigo = '4.1';
    } else if (text.includes('REPASSE') || text.includes('CONVÊNIO') || text.includes('CONVENIO')) {
      targetCodigo = '4.2';
    } else if (text.includes('MATRICULA') || text.includes('MATRÍCULA')) {
      targetCodigo = '4.3';
    } else if (text.includes('PERMUTA')) {
      targetCodigo = '4.4';
    } else if (text.includes('APLICAÇÃO') || text.includes('APLICACAO') || text.includes('RENDIMENTO')) {
      targetCodigo = '4.5';
    } else {
      targetCodigo = '4.6';
    }
  } else {
    // DESPESA
    if (text.includes('FOLHA') || text.includes('FOPAG') || text.includes('SALARIO') || text.includes('SALÁRIO') || text.includes('GPS') || text.includes('INSS') || text.includes('FGTS') || text.includes('CONTRIBUIÇÃO SINDICAL') || text.includes('RESCISÃO') || text.includes('13º') || text.includes('DECIMO')) {
      targetCodigo = '3.1';
    } else if (text.includes('ALUGUEL') || text.includes('LOCAÇÃO') || text.includes('LOCACAO')) {
      targetCodigo = '3.2';
    } else if (text.includes('ENERGISA') || text.includes('SANESUL') || text.includes('AGUA') || text.includes('ÁGUA') || text.includes('LUZ') || text.includes('TELEFONE') || text.includes('CLARO') || text.includes('VIVO') || text.includes('TIM') || text.includes('TELECOM')) {
      targetCodigo = '3.3';
    } else if (text.includes('PAPELARIA') || text.includes('ESCRITÓRIO') || text.includes('ESCRITORIO') || text.includes('MATERIAL') || text.includes('IMPRESSÃO') || text.includes('IMPRESSAO')) {
      targetCodigo = '3.4';
    } else if (text.includes('INVIOLAVEL') || text.includes('SEGURANÇA') || text.includes('SEGURANCA') || text.includes('VIGILANCIA') || text.includes('VIGILÂNCIA')) {
      targetCodigo = '3.5';
    } else if (text.includes('EDITOR') || text.includes('LIVRO') || text.includes('APOSTILA')) {
      targetCodigo = '3.6';
    } else if (text.includes('IMPOSTO') || text.includes('DARF') || text.includes('DAS') || text.includes('SIMPLES NACIONAL') || text.includes('RECEITA FEDERAL') || text.includes('TRIBUTO') || text.includes('CONTRIBUIÇÃO SOCIAL')) {
      targetCodigo = '3.7';
    } else if (text.includes('MANUTENÇÃO') || text.includes('MANUTENCAO') || text.includes('REFORMA') || text.includes('REPARO') || text.includes('CONSERTO')) {
      targetCodigo = '3.8';
    } else if (text.includes('TARIFA') || text.includes('MENSALIDADE CONTA') || text.includes('MENSALIDADE BANCARIA') || text.includes('SERVIÇOS BANCÁRIOS') || text.includes('SERVICOS BANCARIOS')) {
      targetCodigo = '3.9';
    } else if (text.includes('JUROS') || text.includes('MULTA') || text.includes('ENCARGOS')) {
      targetCodigo = '3.10';
    } else if (text.includes('CONTABILIDADE') || text.includes('ASSESSORIA') || text.includes('VSC') || text.includes('HONORÁRIOS') || text.includes('HONORARIOS')) {
      targetCodigo = '3.11';
    }
  }

  if (targetCodigo) {
    try {
      const res = await sql`SELECT id FROM contas_contabeis WHERE codigo = ${targetCodigo} AND ativo = true LIMIT 1`;
      if (res.length > 0) {
        return res[0].id;
      }
    } catch (e) {
      console.error('[getContaContabilId] Erro ao buscar contas_contabeis:', e.message);
    }
  }

  return null;
}
