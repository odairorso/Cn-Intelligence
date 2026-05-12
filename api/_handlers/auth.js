import { sql } from '../_db.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../_middlewares/auth.js';
import { LoginSchema } from '../_schemas.js';
import { logSecurity } from '../_utils.js';

// ---------------------------------------------------------------
// POST /api?route=auth-login
// ---------------------------------------------------------------
export async function handleLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Validar schema
    const result = LoginSchema.safeParse(req.body);
    if (!result.success) {
      await logSecurity(req, res, `Tentativa de login com dados inválidos: ${result.error.errors.map((e) => e.message).join(', ')}`);
      return res.status(400).json({ error: 'Dados inválidos', details: result.error.errors });
    }

    const { email, senha } = result.data;

    // Buscar usuário no banco
    const rows = await sql`SELECT id, uid, email, display_name, password_hash FROM users WHERE email = ${email.toLowerCase()}`;

    if (rows.length === 0) {
      await logSecurity(req, res, `Tentativa de login para email inexistente: ${email}`);
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    const user = rows[0];

    // Verificar senha
    if (!user.password_hash) {
      await logSecurity(req, res, `Tentativa de login sem senha definida para: ${email}`);
      return res.status(401).json({ error: 'Senha não configurada para este usuário. Contate o administrador.' });
    }

    const validPassword = await bcrypt.compare(senha, user.password_hash);

    if (!validPassword) {
      await logSecurity(req, res, `Senha incorreta para: ${email}`);
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    // Gerar token JWT
    const token = generateToken(user.uid);

    await logSecurity(req, res, `Login bem-sucedido: ${email}`);

    return res.json({
      ok: true,
      token,
      user: {
        uid: user.uid,
        email: user.email,
        display_name: user.display_name,
      },
    });
  } catch (e) {
    console.error('[Login Error]', e);
    return res.status(500).json({ error: 'Erro interno no login' });
  }
}