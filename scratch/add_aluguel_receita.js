import { config } from 'dotenv';
import pg from 'pg';
import path from 'path';

// Carrega as variáveis de ambiente a partir da raiz do projeto
config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    // Insere ou atualiza a conta de Aluguel (Receita) no banco de dados ativo
    const query = `
      INSERT INTO contas_contabeis (codigo, nome, tipo, ativo)
      VALUES ('4.8', 'Aluguel', 'RECEITA', true)
      ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativo = true
      RETURNING *;
    `;
    const res = await pool.query(query);
    console.log('Sucesso! Conta cadastrada/atualizada:', res.rows[0]);
  } catch (err) {
    console.error('Erro ao cadastrar conta:', err);
  } finally {
    await pool.end();
  }
}

run();
