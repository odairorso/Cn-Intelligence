// --- Inicialização super rápida sem dependências externas ---
import jwt from 'jsonwebtoken';
import { setCors, dbStorage } from './_db.js';
import { checkRateLimit, sanitizeObject } from './_utils.js';

// --- Configurações de Autenticação ---
const APP_PASSWORD = process.env.APP_PASSWORD;
const APP_UID = process.env.APP_UID || 'odair';
const APP_EMAIL = process.env.APP_EMAIL || 'user@cn.com';
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!APP_PASSWORD) {
  console.warn('[AUTH] AVISO: APP_PASSWORD não definida em variáveis de ambiente. Login desabilitado!');
}

const generateToken = (payload) => {
  if (!JWT_SECRET) return null;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const getCookie = (req, name) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').reduce((acc, c) => {
    const [key, ...val] = c.trim().split('=');
    acc[key] = val.join('=');
    return acc;
  }, {});
  return cookies[name] || null;
};

const verifyToken = (req) => {
  // Tenta obter o token do cookie HttpOnly
  let token = getCookie(req, 'cn_jwt_token');

  // Fallback para o header Authorization (legado/suporte a testes)
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) return null;
  try {
    if (!JWT_SECRET) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch { return null; }
};

// --- Rotas que NÃO devem ser logadas (saúde, internas) ---
const SKIP_LOG_ROUTES = new Set(['health']);

export default async function handler(req, res) {
  const startTime = Date.now();

  // CORS Centralizado via _db.js
  setCors(req, res);

  // Security headers (minimal, non-invasive)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

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

    if (!APP_PASSWORD || !JWT_SECRET) {
      return res.status(503).json({ error: 'Servidor: autenticação não configurada. Defina APP_PASSWORD e JWT_SECRET nas variáveis de ambiente.' });
    }

    if (password === APP_PASSWORD) {
      const token = generateToken({ uid: APP_UID, email: email || APP_EMAIL || null });
      try {
        await logSecurity(req, res, `Login bem-sucedido: ${email || APP_UID}`);
      } catch {}

      // Grava o cookie HttpOnly e Secure
      const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
      const cookieOptions = [
        `cn_jwt_token=${token}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Strict',
        'Max-Age=604800' // 7 dias em segundos
      ];
      if (!isDev) {
        cookieOptions.push('Secure');
      }
      res.setHeader('Set-Cookie', cookieOptions.join('; '));

      return res.json({ token, user: { uid: APP_UID, email: email || APP_EMAIL || null } });
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
    // Sem JWT válido — apenas rotas públicas podem continuar
    const publicRoutes = new Set(['health', 'folha-push']);
    if (!publicRoutes.has(route)) {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }
    if (route === 'folha-push') {
      let targetUid = req.query.uid || (req.body && typeof req.body === 'object' ? req.body.uid : null);
      if (!targetUid && req.body && typeof req.body === 'string') {
        try {
          const parsed = JSON.parse(req.body);
          targetUid = parsed.uid;
        } catch {}
      }
      if (!targetUid) {
        return res.status(401).json({ error: 'folha-push requires uid' });
      }
      req.authUid = targetUid;
    }
  } else {
    // Temos token válido
    if (!decoded.uid) {
      return res.status(401).json({ error: 'Token inválido: campo uid ausente.' });
    }
    if (decoded.uid === 'guest') {
      return res.status(403).json({ error: 'Usuário guest não autorizado.' });
    }
    req.authUid = decoded.uid;
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

  return dbStorage.run(req.authUid, async () => {
    try {
      // Rate limiting (após auth para não bloquear login)
      if (!(await checkRateLimit(req, res))) return;

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
        case 'auth-session': {
          const decoded = verifyToken(req);
          if (!decoded) return res.status(401).json({ error: 'Sessão expirada' });
          return res.json({ user: { uid: decoded.uid, email: decoded.email } });
        }
        case 'auth-logout':
        case 'logout': {
          const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
          res.setHeader('Set-Cookie', `cn_jwt_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${!isDev ? '; Secure' : ''}`);
          return res.json({ message: 'Logged out successfully' });
        }
        default: return res.status(404).json({ error: 'Route not found' });
      }
    } catch (e) {
      console.error('[API Router Error]:', e);
      return res.status(500).json({ error: 'Erro interno no servidor' });
    } finally {
      if (!SKIP_LOG_ROUTES.has(route) && res.statusCode !== 429) {
        try {
          const { logRequest } = await import('./_handlers/admin.js');
          await logRequest(req, res, startTime);
        } catch (logErr) {
          console.error('[logRequest] erro:', logErr.message);
        }
      }
    }
  });
}

// Import inline para evitar circular dependency
async function logSecurity(req, res, event) {
  const { logSecurity: _logSecurity } = await import('./_utils.js');
  return _logSecurity(req, res, event);
}
