
import dotenv from 'dotenv';
dotenv.config();

const { default: handler } = await import('../api/index.js');

// Simula POST de um lançamento manual
async function testCreateTransaction() {
  const req = {
    method: 'POST',
    query: { route: 'transactions' },
    body: {
      uid: 'guest',
      fornecedor: 'TESTE LANÇAMENTO',
      descricao: 'Teste de lançamento manual',
      empresa: 'CN',
      vencimento: '2026-04-27',
      valor: 100,
      status: 'PENDENTE',
      tipo: 'DESPESA'
    }
  };
  const res = {
    _status: 200,
    status(c) { this._status = c; console.log('Status:', c); return this; },
    json(d) { console.log('Response:', JSON.stringify(d, null, 2)); return this; },
    setHeader() { return this; },
    end() { console.log('End'); return this; }
  };

  console.log('\n--- Test: Create Transaction ---');
  await handler(req, res);
}

// Simula PUT de update (markAsPaid)
async function testUpdateTransaction() {
  // Primeiro busca um ID qualquer
  const { sql } = await import('../api/_db.js');
  const rows = await sql`SELECT id FROM transactions WHERE uid = 'guest' LIMIT 1`;
  if (!rows.length) { console.log('No transactions found'); return; }
  const id = rows[0].id;
  console.log('Testing update on ID:', id);

  const req = {
    method: 'PUT',
    query: { route: 'transactions', id },
    body: {
      status: 'PAGO',
      pagamento: '2026-04-27',
      banco: 'Bradesco'
    }
  };
  const res = {
    _status: 200,
    status(c) { this._status = c; console.log('Status:', c); return this; },
    json(d) { console.log('Response:', JSON.stringify(d, null, 2)); return this; },
    setHeader() { return this; },
    end() { return this; }
  };

  console.log('\n--- Test: Update Transaction (markAsPaid) ---');
  await handler(req, res);
}

await testCreateTransaction();
await testUpdateTransaction();
