import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware de autenticação JWT.
 * Injeta req.authUid se o token for válido.
 * Suporte a token legado x-cn-security para compatibilidade.
 */
export function authMiddleware(req, res, next) {
  // 1. Tenta JWT via Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    try {
      if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
      const decoded = jwt.verify(token, JWT_SECRET);
      req.authUid = decoded.uid;
      if (typeof next === 'function') next();
      return;
    } catch {
      // Token inválido ou expirado — cai no fallback abaixo
    }
  }

  // 2. Fallback: token legado x-cn-security (compatibilidade durante transição)
  const securityToken = req.headers['x-cn-security'];
  const EXPECTED_TOKEN = process.env.SECURITY_TOKEN;

  if (EXPECTED_TOKEN && securityToken === EXPECTED_TOKEN) {
    // Token legado aceito somente como ponte para rotas antigas.
    req.authUid = process.env.APP_UID || 'odair';
    if (typeof next === 'function') next();
    return;
  }

  // 3. Sem autenticação válida — bloqueia
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
