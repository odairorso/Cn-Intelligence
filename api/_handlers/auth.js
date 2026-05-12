import { logSecurity } from '../_utils.js';

// btoa/atob não existem no Node.js — usamos Buffer do Node
const generateSimpleToken = (payload) => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) })).toString('base64');
  return `${header}.${data}.signature`;
};

export const handleLogin = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, email } = req.body || {};

  // APP_PASSWORD DEVE estar configurada em variáveis de ambiente
  const APP_PASSWORD = process.env.APP_PASSWORD;
  const APP_UID = process.env.APP_UID || 'odair';

  if (!APP_PASSWORD) {
    return res.status(503).json({ error: 'Autenticação não configurada no servidor.' });
  }

  if (password === APP_PASSWORD) {
    const token = generateSimpleToken({ uid: APP_UID, email: email || null });

    // Log de sucesso com assinatura correta: (req, res, event)
    try {
      await logSecurity(req, res, `Login bem-sucedido: ${email || APP_UID}`);
    } catch { /* não bloqueia o login por falha de log */ }

    return res.json({
      token,
      user: { uid: APP_UID, email: email || null }
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
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.split(' ')[1];
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // atob não existe no Node — usamos Buffer
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

    // Verificar expiração
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
};