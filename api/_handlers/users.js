import { sql } from '../_db.js';
import { verifyToken } from '../_middlewares/auth.js';
import { logSecurity, handleError } from '../_utils.js';
import bcrypt from 'bcryptjs';

export async function handleUsers(req, res) {
  const decoded = verifyToken(req);
  if (!decoded || decoded.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado: apenas administradores podem gerenciar usuários.' });
  }

  const { method } = req;

  try {
    switch (method) {
      case 'GET': {
        const users = await sql`
          SELECT id, email, name, role, created_at 
          FROM portal_users 
          ORDER BY name ASC
        `;
        return res.json(users);
      }

      case 'POST': {
        const { email, password, name, role } = req.body || {};

        if (!email || !password || !name) {
          return res.status(400).json({ error: 'Todos os campos (e-mail, senha, nome) são obrigatórios.' });
        }

        const cleanEmail = email.toLowerCase().trim();
        const userRole = role === 'admin' ? 'admin' : 'user';

        // Verifica se o usuário já existe
        const existing = await sql`
          SELECT id FROM portal_users WHERE LOWER(email) = ${cleanEmail}
        `;
        if (existing && existing.length > 0) {
          return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
        }

        // Criptografa a senha
        const hash = bcrypt.hashSync(password, 10);

        // Insere o novo usuário
        await sql`
          INSERT INTO portal_users (email, password_hash, name, role)
          VALUES (${cleanEmail}, ${hash}, ${name}, ${userRole})
        `;

        await logSecurity(req, res, `Usuário criado: ${cleanEmail} com papel ${userRole}`);
        return res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
      }

      case 'DELETE': {
        const { id } = req.query;
        if (!id) {
          return res.status(400).json({ error: 'ID do usuário é obrigatório.' });
        }

        // Busca o usuário para verificação
        const users = await sql`
          SELECT email FROM portal_users WHERE id = ${id}
        `;
        if (!users || users.length === 0) {
          return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        const user = users[0];

        // Impede de excluir o próprio usuário conectado
        if (user.email.toLowerCase() === decoded.email.toLowerCase()) {
          return res.status(400).json({ error: 'Você não pode excluir a sua própria conta administrador.' });
        }

        // Executa a exclusão
        await sql`
          DELETE FROM portal_users WHERE id = ${id}
        `;

        await logSecurity(req, res, `Usuário excluído: ${user.email}`);
        return res.json({ message: 'Usuário excluído com sucesso.' });
      }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).json({ error: `Método ${method} não permitido` });
    }
  } catch (e) {
    return handleError(res, e, 'users.js handleUsers');
  }
}
