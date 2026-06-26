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

// --- Rate Limiting ---
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 60;

// Limpeza periódica do rate limit para evitar vazamento de memória
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 300_000).unref(); // Limpa a cada 5 minutos (não-bloqueante)

export const checkRateLimit = (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
  
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + RATE_LIMIT_WINDOW;
  } else {
    record.count++;
  }
  
  if (record.count > RATE_LIMIT_MAX) {
    res.status(429).json({ error: 'Too many requests' });
    return false;
  }
  
  rateLimitMap.set(ip, record);
  return true;
};

// --- Processamento de Boleto ---
export const normalizeBoletoNumber = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const clean = String(value).replace(/[^A-Z0-9]/g, '');
  if (clean.length === 47 || clean.length === 48 || clean.length === 44) {
    return clean;
  }
  const raw = String(value).toUpperCase();
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
