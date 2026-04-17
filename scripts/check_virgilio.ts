import { sql } from '../api/_db.js';

async function check() {
  console.log('--- Buscando JOSÉ VIRGILIO ---');
  try {
    const allSuppliers = await sql`SELECT nome FROM suppliers ORDER BY nome`;
    console.log('--- TODOS OS FORNECEDORES NO BANCO ---');
    allSuppliers.forEach((s, i) => console.log(`${i+1}. ${s.nome}`));

    if (suppliers.length === 0 && transactions.length > 0) {
      console.log('Opa! Ele está nas transações mas não nos fornecedores. Vou sincronizar agora.');
      for (const t of transactions) {
         await sql`INSERT INTO suppliers (uid, nome) VALUES ('guest', ${t.fornecedor}) ON CONFLICT DO NOTHING`;
         console.log(`Cadastrado: ${t.fornecedor}`);
      }
    }
  } catch (e) {
    console.error(e.message);
  }
}

check();
