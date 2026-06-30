import jwt from 'jsonwebtoken';
import { logSecurity } from '../_utils.js';

// btoa/atob não existem no Node.js — usamos Buffer do Node
const generateToken = (payload) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return jwt.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
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

export const handleLogin = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, email } = req.body || {};

  // APP_PASSWORD DEVE estar configurada em variáveis de ambiente
  const APP_PASSWORD = process.env.APP_PASSWORD;
  const APP_UID = process.env.APP_UID || 'odair';
  const APP_EMAIL = process.env.APP_EMAIL || 'user@cn.com';

  if (!APP_PASSWORD || !process.env.JWT_SECRET) {
    return res.status(503).json({ error: 'Autenticação não configurada no servidor.' });
  }

  if (password === APP_PASSWORD) {
    const token = generateToken({ uid: APP_UID, email: email || APP_EMAIL || null });

    // Log de sucesso com assinatura correta: (req, res, event)
    try {
      await logSecurity(req, res, `Login bem-sucedido: ${email || APP_UID}`);
    } catch { /* não bloqueia o login por falha de log */ }

    // Grava o cookie HttpOnly e Secure
    const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
    const cookieOptions = [
      `cn_jwt_token=${token}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      'Max-Age=604800' // 7 dias
    ];
    if (!isDev) {
      cookieOptions.push('Secure');
    }
    res.setHeader('Set-Cookie', cookieOptions.join('; '));

    return res.json({
      token,
      user: { uid: APP_UID, email: email || APP_EMAIL || null }
    });
  }

  // Log de falha com assinatura correta
  try {
    await logSecurity(req, res, `Tentativa de login falhou: ${email || 'unknown'}`);
  } catch { /* não expõe detalhes do erro */ }

  // Delay artificial para dificultar brute force (~1s)
  await new Promise((r) => setTimeout(r, 1000));

  return res.status(401).json({ error: 'Senha incorreta' });
};

export const verifyToken = (req) => {
  // Tenta obter do cookie HttpOnly
  let token = getCookie(req, 'cn_jwt_token');

  // Fallback para o header Authorization
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) return null;
  try {
    if (!process.env.JWT_SECRET) return null;
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
};
