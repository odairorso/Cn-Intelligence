import express from 'express';
import cors from 'cors';
import pg from 'pg';
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

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

// Banks API
app.get('/api/banks', async (req, res) => {
  try {
    const { uid } = req.query;
    const result = await pool.query(
      'SELECT * FROM banks WHERE ($1::text IS NULL OR uid = $1) AND ativo = true ORDER BY nome ASC',
      [uid || null]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching banks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/banks', async (req, res) => {
  try {
    const { uid, nome, agencia, conta, saldo } = req.body;
    const result = await pool.query(
      `INSERT INTO banks (uid, nome, agencia, conta, saldo)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [uid || 'guest', nome, agencia || null, conta || null, saldo ?? 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating bank:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/banks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, agencia, conta, saldo, ativo } = req.body;
    const result = await pool.query(
      `UPDATE banks SET
        nome = COALESCE($1, nome),
        agencia = COALESCE($2, agencia),
        conta = COALESCE($3, conta),
        saldo = COALESCE($4, saldo),
        ativo = COALESCE($5, ativo),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *`,
      [nome, agencia, conta, saldo, ativo, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating bank:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/banks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM banks WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting bank:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Transactions API
app.get('/api/transactions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transactions ORDER BY vencimento DESC');
    // Format dates to string DD/MM/YYYY for the frontend
    const formatted = result.rows.map(tx => ({
      ...tx,
      vencimento: tx.vencimento ? new Date(tx.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '',
      pagamento: tx.pagamento ? new Date(tx.pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined,
      valor: Number(tx.valor),
      juros: Number(tx.juros || 0),
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
      const { uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo } = tx;
      
      const vDate = parseDateToPg(vencimento);
      const pDate = parseDateToPg(pagamento);

      try {
        await client.query(
          `INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [uid || 'guest', fornecedor, descricao || '-', empresa || 'Geral', vDate, pDate, valor, status || 'PENDENTE', banco || null, tipo || 'DESPESA']
        );
      } catch (insertError) {
        console.error(`Erro inserindo linha [Fornecedor: ${fornecedor}, Venc: ${vencimento}, Valor: ${valor}]:`, insertError.message);
        throw insertError; // Propaga para o catch principal fazer o ROLLBACK
      }

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
    const { uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo } = req.body;

    
    // Convert DD/MM/YYYY back to YYYY-MM-DD
    const vDate = vencimento.split('/').reverse().join('-');
    const pDate = pagamento ? pagamento.split('/').reverse().join('-') : null;

    const result = await pool.query(
      `INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [uid || 'guest', fornecedor, descricao || '-', empresa || 'Geral', vDate, pDate, valor, status || 'PENDENTE', banco || null, tipo || 'DESPESA']
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
    const { fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, juros } = req.body;
    
    const pDate = pagamento ? pagamento.split('/').reverse().join('-') : null;
    const vDate = vencimento ? vencimento.split('/').reverse().join('-') : null;

    const result = await pool.query(
      `UPDATE transactions SET
        status = $1,
        pagamento = $2::date,
        fornecedor = $3,
        descricao = $4,
        empresa = $5,
        vencimento = $6::date,
        valor = $7,
        banco = $8,
        tipo = $9,
        juros = $10,
        updated_at = NOW()
      WHERE id = $11 RETURNING *`,
      [status, pDate, fornecedor, descricao, empresa, vDate, valor, banco, tipo || 'DESPESA', juros || 0, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    
    const tx = result.rows[0];
    res.json({
      ...tx,
      vencimento: tx.vencimento ? new Date(tx.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '',
      pagamento: tx.pagamento ? new Date(tx.pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined,
      valor: Number(tx.valor),
      juros: Number(tx.juros || 0),
    });
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

// Boleto PDF extraction with Gemini AI
app.post('/api/extract-boleto', async (req, res) => {
  try {
    const { text, fileName, pdfBase64 } = req.body;
    if (!text && !fileName && !pdfBase64) {
      return res.status(400).json({ error: 'text, fileName or pdfBase64 required' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Server-side PDF text extraction using pdfjs-dist
    let extractedText = text || '';
    if (pdfBase64 && !extractedText) {
      try {
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        const uint8 = new Uint8Array(pdfBuffer);
        const pdf = await pdfjsLib.default.getDocument({ data: uint8 }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map(item => item.str).join(' ') + '\n';
        }
        extractedText = fullText.trim();
        console.log(`[boleto] pdfjs-dist: ${extractedText.length} chars from ${fileName}`);
      } catch (parseErr) {
        console.error('[boleto] pdfjs-dist failed:', parseErr.message);
      }
    }

    const hasText = extractedText.length > 50;

    // Build prompt based on whether we have extracted text
    let prompt;
    if (hasText) {
      prompt = `Você é um especialista em extrair dados de boletos bancários brasileiros.
Analise o texto abaixo extraído de um PDF de boleto bancário e extraia os campos solicitados.

TEXTO DO PDF:
${extractedText}

Nome do arquivo: ${fileName || 'N/A'}

Extraia os seguintes campos:
1. fornecedor: NOME DO BENEFICIÁRIO/CEDENTE que recebe o pagamento (NÃO é o banco!).
   - Procure por "Beneficiário", "Cedente", "Razão Social", "Nome/Razão Social"
   - NUNCA use o nome do banco como fornecedor (ex: Sicredi, Bradesco, Itaú, Banco do Brasil, Cora são BANCOS, não fornecedores)
   - Se encontrar apenas o nome do banco, procure mais abaixo no boleto o nome real do beneficiário
2. vencimento: Data de vencimento no formato DD/MM/AAAA. Procure por "Vencimento", "Vcto".
3. valor: Valor do boleto em reais (apenas número, usar ponto como decimal). Procure por "Valor", "Valor do Documento", "Valor Cobrado", "Vlr Pagar".
4. cnpj: CNPJ do beneficiário se disponível.
5. descricao: Descrição do serviço ou referência do boleto.
6. empresa: Qual empresa do grupo CN pertence (CN, FACEMS, LAB, CEI, UNOPAR). Se não identificar, deixe vazio.

Responda APENAS com JSON válido:
{"fornecedor":"","vencimento":"","valor":0,"cnpj":"","descricao":"","empresa":""}`;
    } else {
      // No text extracted - PDF is likely scanned image
      // Send PDF directly to Gemini as inline data for visual analysis
      prompt = `Você é um especialista em extrair dados de boletos bancários brasileiros.
Analise visualmente o PDF de boleto bancário anexo e extraia os campos abaixo.

Nome do arquivo: ${fileName || 'N/A'}

Extraia os seguintes campos:
1. fornecedor: NOME DO BENEFICIÁRIO/CEDENTE que recebe o pagamento (NÃO é o banco!).
   - Procure por "Beneficiário", "Cedente", "Razão Social"
   - NUNCA use o nome do banco como fornecedor (Sicredi, Bradesco, Itaú, Banco do Brasil, Cora são BANCOS)
2. vencimento: Data de vencimento no formato DD/MM/AAAA.
3. valor: Valor do boleto em reais (apenas número, usar ponto como decimal).
4. cnpj: CNPJ do beneficiário se disponível.
5. descricao: Descrição do serviço ou referência do boleto.
6. empresa: Qual empresa do grupo CN pertence (CN, FACEMS, LAB, CEI, UNOPAR). Se não identificar, deixe vazio.

Responda APENAS com JSON válido:
{"fornecedor":"","vencimento":"","valor":0,"cnpj":"","descricao":"","empresa":""}`;
    }

    console.log(`[boleto] Gemini: text=${extractedText.length} chars, hasText=${hasText}, file=${fileName}`);

    let contents;
    if (!hasText && pdfBase64) {
      // Send PDF as inline data for Gemini to read visually
      contents = [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64,
          },
        },
      ];
    } else {
      contents = prompt;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    let rawText = response.text;
    console.log(`[boleto] Gemini response: ${rawText?.slice(0, 300)}`);
    if (rawText) {
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    }
    const extracted = JSON.parse(rawText);

    // Normalize vencimento to DD/MM/YYYY
    if (extracted.vencimento) {
      const v = extracted.vencimento;
      if (v.includes('-')) {
        const parts = v.split('-');
        if (parts.length === 3) {
          extracted.vencimento = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
    }

    // Ensure valor is a number
    if (typeof extracted.valor === 'string') {
      extracted.valor = parseFloat(extracted.valor.replace(/\./g, '').replace(',', '.'));
    }

    // Fallback: extract fornecedor from filename if AI didn't find it
    if (!extracted.fornecedor || extracted.fornecedor === '' || extracted.fornecedor.toLowerCase() === 'não identificado') {
      if (fileName) {
        let name = fileName.replace(/\.pdf$/i, '').replace(/^(BOL|BOLETO|MAT)\s*/i, '').trim();
        extracted.fornecedor = name;
      }
    }

    res.json(extracted);
  } catch (error) {
    console.error('[boleto] Error extracting boleto data:', error.message);
    console.error('[boleto] Stack:', error.stack);
    const { fileName } = req.body;
    let fornecedor = 'Fornecedor não identificado';
    if (fileName) {
      fornecedor = fileName.replace(/\.pdf$/i, '').replace(/^(BOL|BOLETO|MAT)\s*/i, '').trim();
    }
    res.json({
      fornecedor,
      vencimento: '',
      valor: 0,
      cnpj: '',
      descricao: fileName || '',
      empresa: '',
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
