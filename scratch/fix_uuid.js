
import dotenv from 'dotenv';
dotenv.config();

const { sql } = await import('../api/_db.js');

async function fixUuid() {
  try {
    // Habilita extensão uuid se não estiver ativa
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    console.log('Extension uuid-ossp enabled.');
    
    // Configura o DEFAULT no campo id da transactions
    await sql`ALTER TABLE transactions ALTER COLUMN id SET DEFAULT uuid_generate_v4()`;
    console.log('Default UUID set for transactions.id');
    
    // Faz o mesmo para suppliers e banks se necessário
    await sql`ALTER TABLE suppliers ALTER COLUMN id SET DEFAULT uuid_generate_v4()`;
    console.log('Default UUID set for suppliers.id');
    
    await sql`ALTER TABLE banks ALTER COLUMN id SET DEFAULT uuid_generate_v4()`;
    console.log('Default UUID set for banks.id');
    
    // Testa inserção
    const test = await sql`
      INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, valor, status, tipo)
      VALUES ('guest', 'TESTE_UUID_FIX', 'teste', 'CN', '2026-01-01', 1, 'PENDENTE', 'DESPESA')
      RETURNING id`;
    console.log('Insert test OK! New ID:', test[0].id);
    
    // Remove o registro de teste
    await sql`DELETE FROM transactions WHERE id = ${test[0].id}`;
    console.log('Test record cleaned up.');
    
  } catch (err) {
    console.error('Fix failed:', err);
  }
}

fixUuid();
