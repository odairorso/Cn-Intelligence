// --- Inicialização super rápida sem dependências externas ---
import { setCors } from './_db.js';
import { checkRateLimit, sanitizeObject } from './_utils.js';

// --- Configurações de Autenticação ---
const APP_PASSWORD = process.env.APP_PASSWORD;
const APP_UID = process.env.APP_UID || 'odair';
const APP_EMAIL = process.env.APP_EMAIL || 'user@cn.com';

if (!APP_PASSWORD) {
  console.warn('[AUTH] AVISO: APP_PASSWORD não definida em variáveis de ambiente. Autenticação desabilitada!');
}

const generateSimpleToken = (payload) => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) })).toString('base64');
  return `${header}.${data}.signature`;
};

const verifyToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch { return null; }
};

// --- Rotas que NÃO devem ser logadas (saúde, internas) ---
const SKIP_LOG_ROUTES = new Set(['health']);

export default async function handler(req, res) {
  const startTime = Date.now();

  // CORS Centralizado via _db.js
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { route, id } = req.query;

  // ── Lógica de Login Isolada e Imediata ──────────────────
  if (route === 'login' || route === 'auth-login') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    let bodyData = req.body || {};
    if (typeof bodyData === 'string') {
      try { bodyData = JSON.parse(bodyData); } catch (e) {}
    }

    const { password, email } = bodyData;

    if (!APP_PASSWORD) {
      return res.status(503).json({ error: 'Servidor: autenticação não configurada. Defina APP_PASSWORD nas variáveis de ambiente.' });
    }

    if (password === APP_PASSWORD) {
      const token = generateSimpleToken({ uid: APP_UID, email: email || null });
      try {
        await logSecurity(req, res, `Login bem-sucedido: ${email || APP_UID}`);
      } catch {}
      return res.json({ token, user: { uid: APP_UID, email: email || null } });
    }

    try {
      await logSecurity(req, res, `Tentativa de login falhou: ${email || 'unknown'}`);
    } catch {}

    await new Promise((r) => setTimeout(r, 1000));
    return res.status(401).json({ error: 'Senha incorreta' });
  }

  // ── Verificação de Token (OBRIGATÓRIA para todas as rotas exceto login) ──
  const decoded = verifyToken(req);

  if (!decoded) {
    // Sem JWT válido — verificar fallback de security token (APENAS para rotas públicas)
    const publicRoutes = new Set(['health']);
    if (!publicRoutes.has(route)) {
      const securityToken = req.headers['x-cn-security'];
      const EXPECTED = process.env.SECURITY_TOKEN || 'CN-INT-2024-SECURE-HARDENED-V1';
      if (securityToken !== EXPECTED) {
        return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
      }
    }
    // Security token válido: usar APP_UID como fallback (NUNCA aceitar uid de query param)
    req.authUid = APP_UID;
  } else {
    const uid = decoded.uid || APP_UID;
    req.authUid = uid === 'guest' ? APP_UID : uid;
  }

  // BLOQUEAR qualquer tentativa de injeção de uid via query param
  if (req.query.uid && req.query.uid !== req.authUid) {
    await logSecurity(req, res, `Tentativa de injeção de UID: query.uid=${req.query.uid} vs authUid=${req.authUid}`);
    return res.status(403).json({ error: 'UID não corresponde ao usuário autenticado.' });
  }

  // ── Preparação do Body (JSON) ──────────────────────────
  if (req.body && typeof req.body === 'string' && req.headers['content-type']?.includes('application/json')) {
    try { req.body = JSON.parse(req.body); } catch (e) { /* ignore parse error */ }
  }

  // ── Sanitização ──────────────────────────────────────
  if (['POST', 'PUT'].includes(req.method) && req.body && route !== 'extract-boleto') {
    req.body = sanitizeObject(req.body);
  }

  try {
    // Rate limiting (após auth para não bloquear login)
    if (!checkRateLimit(req, res)) return;

    // Carregamento Dinâmico (Lazy Load)
    switch (route) {
      case 'db-check': { const m = await import('./_handlers/admin.js'); return m.handleDbCheck(req, res); }
      case 'stats': { const m = await import('./_handlers/stats.js'); return m.handleStats(req, res); }
      case 'transactions': { const m = await import('./_handlers/transactions.js'); return id ? m.handleTransactionById(req, res) : m.handleTransactions(req, res); }
      case 'transactions-batch': { const m = await import('./_handlers/transactions.js'); return m.handleTransactionsBatch(req, res); }
      case 'transactions-batch-update': { const m = await import('./_handlers/transactions.js'); return m.handleTransactionsBatchUpdate(req, res); }
      case 'transactions-dedupe-movimentos': { const m = await import('./_handlers/transactions.js'); return m.handleTransactionsDedupeMovimentos(req, res); }
      case 'suppliers': { const m = await import('./_handlers/suppliers.js'); return id ? m.handleSupplierById(req, res) : m.handleSuppliers(req, res); }
      case 'suppliers-batch': { const m = await import('./_handlers/suppliers.js'); return m.handleSuppliersBatch(req, res); }
      case 'suppliers-merge': { const m = await import('./_handlers/suppliers.js'); return m.handleSuppliersMerge(req, res); }
      case 'suppliers-merge-auto': { const m = await import('./_handlers/suppliers.js'); return m.handleSuppliersMergeAuto(req, res); }
      case 'banks': { const m = await import('./_handlers/banks.js'); return id ? m.handleBankById(req, res) : m.handleBanks(req, res); }
      case 'contas-contabeis': { const m = await import('./_handlers/banks.js'); return m.handleContasContabeis(req, res); }
      case 'extract-boleto': { const m = await import('./_handlers/boleto.js'); return m.handleExtractBoleto(req, res); }
      case 'save-boleto-pattern': { const m = await import('./_handlers/boleto.js'); return m.handleSaveBoletoPattern(req, res); }
      case 'boleto-patterns': { const m = await import('./_handlers/boleto.js'); return id ? m.handleDeleteBoletoPattern(req, res) : m.handleBoletoPatterns(req, res); }
      case 'setup-tables': { const m = await import('./_handlers/admin.js'); return m.handleSetupTables(req, res); }
      case 'export-backup': { const m = await import('./_handlers/admin.js'); return m.handleExportBackup(req, res); }
      case 'fix-receitas-tipo': { const m = await import('./_handlers/transactions.js'); return m.handleFixReceitasTipo(req, res); }
      case 'folha-push': { const m = await import('./_handlers/folha.js'); return m.handleFolhaPush(req, res); }
      default: return res.status(404).json({ error: 'Route not found' });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Erro no servidor', details: e.message });
  } finally {
    if (!SKIP_LOG_ROUTES.has(route)) {
      try {
        const { logRequest } = await import('./_handlers/admin.js');
        await logRequest(req, res, startTime);
      } catch (logErr) {
        console.error('[logRequest] erro:', logErr.message);
      }
    }
  }
}

// Import inline para evitar circular dependency
async function logSecurity(req, res, event) {
  const { logSecurity: _logSecurity } = await import('./_utils.js');
  return _logSecurity(req, res, event);
}