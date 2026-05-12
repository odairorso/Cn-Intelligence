import jwt from 'jsonwebtoken';
import { sql } from '../_db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'cn-default-secret-change-in-production';
const JWT_EXPIRES = '8h'; // Token válido por 8 horas

// Usuários do sistema (configurados via env para segurança)
// Formato: USER_1=uid:senha_hash, USER_2=uid:senha_hash
// Por enquanto suporte a senha simples via env
const getUsers = () => {
  const users = [];

  // Suporte a múltiplos usuários via variáveis de ambiente
  for (let i = 1; i <= 10; i++) {
    const entry = process.env[`APP_USER_${i}`];
    if (entry) {
      const [uid, password] = entry.split(':');
      if (uid && password) users.push({ uid, password });
    }
  }

  // Fallback: usuário padrão via variáveis individuais
  if (users.length === 0) {
    const uid = process.env.APP_UID || 'guest';
    const password = process.env.APP_PASSWORD || 'CN2024';
    users.push({ uid, password });
  }

  return users;
};

// POST /api?route=login
export async function handleLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Senha obrigatória' });

  const users = getUsers();
  const user = users.find(u => u.password === password);

  if (!user) {
    // Log da tentativa falha
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
    console.warn(`[auth] Login falhou de IP: ${ip}`);
    return res.status(401).json({ error: 'Senha inválida' });
  }

  // Gera token JWT com uid e expiração
  const token = jwt.sign(
    { uid: user.uid, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  return res.json({
    token,
    uid: user.uid,
    expiresIn: JWT_EXPIRES,
  });
}

// Middleware: valida JWT em todas as requisições
export function verifyToken(req) {
  // Aceita via header Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded; // { uid, iat, exp }
  } catch {
    return null;
  }
}
