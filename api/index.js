// --- Inicialização super rápida sem dependências externas ---
import jwt from 'jsonwebtoken';
import { setCors, dbStorage, sql } from './_db.js';
import { checkRateLimit, sanitizeObject } from './_utils.js';
import { authMiddleware, verifyToken } from './_middlewares/auth.js';
import bcrypt from 'bcryptjs';

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

// --- Rotas que NÃO devem ser logadas (saúde, internas) ---
const SKIP_LOG_ROUTES = new Set(['health']);

export default async function handler(req, res) {
  const startTime = Date.now();

  // CORS Centralizado via _db.js
  setCors(req, res);

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

    if (!JWT_SECRET) {
      return res.status(503).json({ error: 'Servidor: autenticação não configurada. Defina JWT_SECRET nas variáveis de ambiente.' });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    let user = null;
    try {
      const users = await sql`SELECT * FROM portal_users WHERE LOWER(email) = ${email.toLowerCase().trim()}`;
      if (users && users.length > 0) {
        user = users[0];
      }
    } catch (dbErr) {
      console.warn('[AUTH] Erro ao buscar usuário no banco, usando fallback:', dbErr.message);
    }

    let isValid = false;
    let userPayload = null;

    if (user) {
      isValid = bcrypt.compareSync(password, user.password_hash);
      if (isValid) {
        userPayload = { uid: APP_UID, email: user.email, name: user.name, role: user.role };
      }
    } else {
      // Fallback para admin padrão via env
      const defaultEmail = APP_EMAIL || 'user@cn.com';
      if (APP_PASSWORD && email.toLowerCase().trim() === defaultEmail.toLowerCase().trim() && password === APP_PASSWORD) {
        isValid = true;
        userPayload = { uid: APP_UID, email: defaultEmail, name: 'Administrador', role: 'admin' };
      }
    }

    if (isValid && userPayload) {
      const token = generateToken(userPayload);
      try {
        await logSecurity(req, res, `Login bem-sucedido: ${userPayload.email} (${userPayload.role})`);
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

      return res.json({ token, user: userPayload });
    }

    try {
      await logSecurity(req, res, `Tentativa de login falhou: ${email || 'unknown'}`);
    } catch {}

    await new Promise((r) => setTimeout(r, 1000));
    return res.status(401).json({ error: 'E-mail ou senha incorretos' });
  }

  // ── Rota de Cadastro de Usuário (Primeiro Acesso) ───────
  if (route === 'auth-register') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    let bodyData = req.body || {};
    if (typeof bodyData === 'string') {
      try { bodyData = JSON.parse(bodyData); } catch (e) {}
    }

    const { name, email, password } = bodyData;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    try {
      const existing = await sql`SELECT id FROM portal_users WHERE LOWER(email) = ${email.toLowerCase().trim()}`;
      if (existing && existing.length > 0) {
        return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      const role = 'admin'; // Primeiro acesso com senha de empresa é sempre admin

      await sql`
        INSERT INTO portal_users (name, email, password_hash, role)
        VALUES (${name.trim()}, ${email.toLowerCase().trim()}, ${passwordHash}, ${role})
      `;

      await logSecurity(req, res, `Novo usuário admin cadastrado via Primeiro Acesso: ${email}`);
      return res.json({ success: true });
    } catch (dbErr) {
      console.error('[AUTH] Erro ao cadastrar usuário:', dbErr);
      return res.status(500).json({ error: 'Erro interno ao realizar cadastro.' });
    }
  }

  // ── Rota de Login com o Google ─────────────────────────
  if (route === 'auth-google') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    let bodyData = req.body || {};
    if (typeof bodyData === 'string') {
      try { bodyData = JSON.parse(bodyData); } catch (e) {}
    }

    const { credential } = bodyData;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential é obrigatória.' });
    }

    try {
      const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
      if (!googleRes.ok) {
        return res.status(400).json({ error: 'Token do Google inválido ou expirado.' });
      }
      const googleData = await googleRes.json();
      const googleEmail = googleData.email;
      const googleName = googleData.name || googleData.given_name || 'Usuário Google';

      if (!googleEmail) {
        return res.status(400).json({ error: 'Não foi possível obter o e-mail da conta Google.' });
      }

      const users = await sql`SELECT * FROM portal_users WHERE LOWER(email) = ${googleEmail.toLowerCase().trim()}`;
      
      if (users && users.length > 0) {
        const user = users[0];
        const userPayload = { uid: APP_UID, email: user.email, name: user.name, role: user.role };
        const token = generateToken(userPayload);

        await logSecurity(req, res, `Login com Google bem-sucedido: ${user.email} (${user.role})`);

        const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
        const cookieOptions = [
          `cn_jwt_token=${token}`,
          'Path=/',
          'HttpOnly',
          'SameSite=Strict',
          'Max-Age=604800'
        ];
        if (!isDev) {
          cookieOptions.push('Secure');
        }
        res.setHeader('Set-Cookie', cookieOptions.join('; '));

        return res.json({ success: true, token, user: userPayload });
      } else {
        return res.json({ registrationRequired: true, email: googleEmail, name: googleName });
      }
    } catch (err) {
      console.error('[AUTH] Erro no login com Google:', err);
      return res.status(500).json({ error: 'Erro interno ao autenticar com o Google.' });
    }
  }

  // ── Rota de Cadastro de Google com Senha de Empresa ─────
  if (route === 'auth-google-register') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    let bodyData = req.body || {};
    if (typeof bodyData === 'string') {
      try { bodyData = JSON.parse(bodyData); } catch (e) {}
    }

    const { email, name, credential } = bodyData;

    if (!email || !credential) {
      return res.status(400).json({ error: 'E-mail e credential do Google são obrigatórios.' });
    }

    const safeName = (name || 'Usuário Google').trim();

    try {
      const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
      if (!googleRes.ok) {
        return res.status(400).json({ error: 'Token do Google inválido ou expirado.' });
      }
      const googleData = await googleRes.json();
      if (googleData.email.toLowerCase().trim() !== email.toLowerCase().trim()) {
        return res.status(400).json({ error: 'E-mail informado não corresponde à conta do Google.' });
      }

      const existing = await sql`SELECT id FROM portal_users WHERE LOWER(email) = ${email.toLowerCase().trim()}`;
      if (existing && existing.length > 0) {
        return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
      }

      const role = 'user'; // Autocadastro via Google

      await sql`
        INSERT INTO portal_users (name, email, password_hash, role)
        VALUES (${safeName}, ${email.toLowerCase().trim()}, NULL, ${role})
      `;

      const userPayload = { uid: APP_UID, email: email.toLowerCase().trim(), name: safeName, role };
      const token = generateToken(userPayload);

      await logSecurity(req, res, `Novo usuário Google cadastrado via Primeiro Acesso: ${email}`);

      const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
      const cookieOptions = [
        `cn_jwt_token=${token}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Strict',
        'Max-Age=604800'
      ];
      if (!isDev) {
        cookieOptions.push('Secure');
      }
      res.setHeader('Set-Cookie', cookieOptions.join('; '));

      return res.json({ success: true, token, user: userPayload });
    } catch (err) {
      console.error('[AUTH] Erro ao cadastrar via Google:', err);
      return res.status(500).json({ error: 'Erro interno ao cadastrar com o Google.' });
    }
  }

  // ── Verificação de Token (OBRIGATÓRIA para todas as rotas exceto login e cadastros) ──
  const publicRoutes = new Set(['health', 'folha-push']);
  if (!publicRoutes.has(route)) {
    let authorized = false;
    authMiddleware(req, res, () => {
      authorized = true;
    });
    if (!authorized) return;

    if (req.authUid === 'guest') {
      return res.status(403).json({ error: 'Usuário guest não autorizado.' });
    }
  } else {
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
        case 'auth-users': { const m = await import('./_handlers/users.js'); return m.handleUsers(req, res); }
        case 'export-backup': { const m = await import('./_handlers/admin.js'); return m.handleExportBackup(req, res); }
        case 'fix-receitas-tipo': { const m = await import('./_handlers/transactions.js'); return m.handleFixReceitasTipo(req, res); }
        case 'fix-rounding': { const m = await import('./fix-rounding.js'); return m.handleFixRounding(req, res); }
        case 'folha-push': { const m = await import('./_handlers/folha.js'); return m.handleFolhaPush(req, res); }
        case 'folha-segmentos': { const m = await import('./_handlers/folha.js'); return m.handleSegmentos(req, res); }
        case 'folha-professores': { const m = await import('./_handlers/folha.js'); return m.handleProfessores(req, res); }
        case 'folha-cargos': { const m = await import('./_handlers/folha.js'); return m.handleCargos(req, res); }
        case 'folha-lancamentos': { const m = await import('./_handlers/folha.js'); return m.handleLancamentos(req, res); }
        case 'folha-fechamentos': { const m = await import('./_handlers/folha.js'); return m.handleFechamentos(req, res); }
        case 'auth-session': {
          const decoded = verifyToken(req);
          if (!decoded) return res.status(401).json({ error: 'Sessão expirada' });
          return res.json({ user: { uid: decoded.uid, email: decoded.email, name: decoded.name, role: decoded.role } });
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
