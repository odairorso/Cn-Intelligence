import express from 'express';
import cors from 'cors';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const app = express();
app.use(cors());

// Middleware para payloads maiores (Excel tem muitos dados)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Helper para conversão robusta de datas
const parseDateToPg = (val) => {
  if (!val) return null;
  const str = String(val);
  
  // Se já vem como DD/MM/YYYY do frontend
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      // Retorna no formato YYYY-MM-DD
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  
  // Tenta ver se já é YYYY-MM-DD
  if (str.includes('-')) {
    return str;
  }
  
  return null;
};

// Transactions API
app.get('/api/transactions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transactions ORDER BY vencimento DESC');
    // Format dates to string DD/MM/YYYY for the frontend
    const formatted = result.rows.map(tx => ({
      ...tx,
      vencimento: tx.vencimento ? new Date(tx.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '',
      pagamento: tx.pagamento ? new Date(tx.pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined,
      valor: Number(tx.valor)
    }));
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/transactions/batch', async (req, res) => {
  const transactions = req.body;
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ error: 'Invalid batch data' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const tx of transactions) {
      const { uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status } = tx;
      
      const vDate = parseDateToPg(vencimento);
      const pDate = parseDateToPg(pagamento);

      await client.query(
        `INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [uid || 'guest', fornecedor, descricao || '-', empresa || 'Geral', vDate, pDate, valor, status || 'PENDENTE']
      );

    }
    
    await client.query('COMMIT');
    res.status(201).json({ message: 'Batch created successfully', count: transactions.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating transactions batch:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});
app.post('/api/transactions', async (req, res) => {
  try {
    const { uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status } = req.body;
    
    // Convert DD/MM/YYYY back to YYYY-MM-DD
    const vDate = vencimento.split('/').reverse().join('-');
    const pDate = pagamento ? pagamento.split('/').reverse().join('-') : null;

    const result = await pool.query(
      `INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [uid || 'guest', fornecedor, descricao || '-', empresa || 'Geral', vDate, pDate, valor, status || 'PENDENTE']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, pagamento } = req.body;
    
    let query = 'UPDATE transactions SET status = $1';
    let values = [status, id];
    
    if (pagamento) {
      const pDate = pagamento.split('/').reverse().join('-');
      query += ', pagamento = $3 WHERE id = $2 RETURNING *';
      values = [status, id, pDate];
    } else {
      query += ' WHERE id = $2 RETURNING *';
    }

    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM transactions WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Suppliers API
app.get('/api/suppliers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM suppliers ORDER BY nome ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/suppliers/batch', async (req, res) => {
  const suppliers = req.body;
  if (!Array.isArray(suppliers) || suppliers.length === 0) {
    return res.status(400).json({ error: 'Invalid batch data' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const sup of suppliers) {
      const { uid, nome, cnpj, email, telefone } = sup;

      // Usando ON CONFLICT DO NOTHING para não quebrar se já existir
      await client.query(
        `INSERT INTO suppliers (uid, nome, cnpj, email, telefone)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [uid || 'guest', nome, cnpj || null, email || null, telefone || null]
      );
    }
    
    await client.query('COMMIT');
    res.status(201).json({ message: 'Batch created successfully', count: suppliers.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating suppliers batch:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.post('/api/suppliers', async (req, res) => {
  try {
    const { uid, nome, cnpj, email, telefone } = req.body;
    const result = await pool.query(
      `INSERT INTO suppliers (uid, nome, cnpj, email, telefone)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [uid || 'guest', nome, cnpj || null, email || null, telefone || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/suppliers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM suppliers WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset Database API
app.delete('/api/reset', async (req, res) => {
  try {
    await pool.query('BEGIN');
    await pool.query('TRUNCATE TABLE transactions RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE suppliers RESTART IDENTITY CASCADE');
    await pool.query('COMMIT');
    res.status(204).send();
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error resetting database:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clean Duplicates API - keeps the oldest record per group (using ctid for reliability with UUID)
app.delete('/api/clean-duplicates', async (req, res) => {
  try {
    const result = await pool.query(`
      DELETE FROM transactions
      WHERE ctid IN (
        SELECT ctid FROM (
          SELECT ctid, ROW_NUMBER() OVER (
            PARTITION BY fornecedor, vencimento::text, valor, empresa
            ORDER BY ctid
          ) as rn
          FROM transactions
        ) t
        WHERE rn > 1
      )
    `);
    res.json({ deleted: result.rowCount });
  } catch (error) {
    console.error('Error cleaning duplicates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clean Suspicious Data API - removes records with extreme values or invalid data
app.delete('/api/clean-suspicious', async (req, res) => {
  try {
    const result = await pool.query(`
      DELETE FROM transactions
      WHERE valor > 500000
         OR valor < 0.01
         OR valor IS NULL
         OR valor = 0
         OR fornecedor IS NULL
         OR fornecedor = ''
         OR fornecedor ILIKE '%undefined%'
         OR fornecedor ILIKE '%null%'
    `);
    res.json({ deleted: result.rowCount });
  } catch (error) {
    console.error('Error cleaning suspicious data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});