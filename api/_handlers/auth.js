import { logSecurity } from '../_utils.js';

// Função simples para gerar um token sem bibliotecas externas
const generateSimpleToken = (payload) => {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const data = btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) }));
  return `${header}.${data}.static-sig`;
};

export const handleLogin = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, email } = req.body || {};
  
  // Senha do ambiente ou padrão de segurança
  const APP_PASSWORD = process.env.APP_PASSWORD || "Turce.334180";
  const APP_UID = process.env.APP_UID || "odair";

  if (password === APP_PASSWORD) {
    const token = generateSimpleToken({ uid: APP_UID, email: email || 'user@cn.com' });
    
    logSecurity('Login bem-sucedido', { email, uid: APP_UID });
    
    return res.json({ 
      token, 
      user: { uid: APP_UID, email: email || 'user@cn.com' } 
    });
  }

  logSecurity('Tentativa de login falhou', { email });
  return res.status(401).json({ error: 'Senha incorreta' });
};

export const verifyToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.split(' ')[1];
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    
    // Verificar expiração
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    
    return payload;
  } catch (e) {
    return null;
  }
};