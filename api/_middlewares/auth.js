import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

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

export const verifyToken = (req) => {
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

/**
 * Middleware de autenticação JWT.
 * Injeta req.authUid se o token for válido.
 * Suporte a token legado x-cn-security para compatibilidade.
 */
export function authMiddleware(req, res, next) {
  const decoded = verifyToken(req);

  if (decoded) {
    if (decoded.uid) {
      req.authUid = decoded.uid;
      if (typeof next === 'function') next();
      return;
    }
  }

  // Fallback: token legado x-cn-security (compatibilidade durante transição)
  const legacyEnabled = String(process.env.ENABLE_LEGACY_SECURITY_TOKEN || 'false').toLowerCase() === 'true';
  const securityToken = req.headers['x-cn-security'];
  const EXPECTED_TOKEN = process.env.SECURITY_TOKEN;

  if (legacyEnabled && EXPECTED_TOKEN && securityToken === EXPECTED_TOKEN) {
    req.authUid = process.env.APP_UID || 'odair';
    if (typeof next === 'function') next();
    return;
  }

  // Sem autenticação válida — bloqueia
  res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
}

/**
 * Helper: retorna o UID do request autenticado.
 * Prioriza o uid do token JWT (mais seguro) sobre o query param.
 */
export function requireAuth(req, res) {
  if (!req.authUid) {
    res.status(401).json({ error: 'Não autorizado.' });
    return null;
  }
  return req.authUid;
}
