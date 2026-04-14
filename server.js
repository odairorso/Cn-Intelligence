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

// Helper para CORS
const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Helper para conversão robusta de datas
const parseDateToPg = (val) => {
  if (!val) return null;
  const str = String(val).replace(/\D/g, ''); // Remove qualquer coisa que não seja número
  
  // Formato DD/MM/YYYY ou similar (já tratado pelo replace acima se vier com separadores)
  if (str.length === 8) {
    const day = str.substring(0, 2);
    const month = str.substring(2, 4);
    const year = str.substring(4, 8);
    return `${year}-${month}-${day}`;
  }

  // Se já vier no formato do banco YYYY-MM-DD
  if (String(val).includes('-')) {
    const parts = String(val).split('-');
    if (parts.length === 3 && parts[0].length === 4) return String(val);
  }

  return null;
};

const normalizeBoletoNumber = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const raw = String(value).toUpperCase();
  if (!raw || raw === 'UNDEFINED' || raw === 'NULL') return '';
  const tokens = raw
    .split(/[\s:;|,]+/)
    .map((token) => token.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);
  const bestToken = tokens.find((token) => /\d{4,}/.test(token) && token.length >= 6 && token.length <= 30);
  if (bestToken) return bestToken;
  return raw.replace(/[^A-Z0-9]/g, '');
};

const extractLocalBoletoNumber = (text) => {
  const source = String(text || '').toUpperCase();
  const patterns = [
    /NOSSO\s*N[UÚ]MERO\s*[:\s-]*([A-Z0-9./-]{6,40})/,
    /N[UÚ]MERO\s*DO\s*DOCUMENTO\s*[:\s-]*([A-Z0-9./-]{6,40})/,
    /N[ROº°]*\s*DOCUMENTO\s*[:\s-]*([A-Z0-9./-]{6,40})/,
    /NR\.?\s*DOC\s*[:\s-]*([A-Z0-9./-]{6,40})/,
    /N[º°]?\s*DOC\s*[:\s-]*([A-Z0-9./-]{6,40})/,
    /DOCUMENTO\s*[:\s-]*([0-9]{6,20})/,
    /COD(?:IGO)?\s*(?:DE)?\s*BARRAS\s*[:\s-]*([0-9]{47,48})/,
    /C.{0,6}DIGO\s*(?:DE)?\s*BARRAS\s*[:\s-]*([0-9]{47,48})/,
    /UTILIZE\s+O\s+C.{0,6}DIGO\s*[:\s-]*([A-Z0-9]{6,25})/,
    /MATR.{0,6}CULA\s*[:\s-]*([0-9]{6,14}(?:[-/][0-9A-Z]{1,6}){1,8})/,
    /NOTA\s+FISCAL\s+N[ROº°]*\s*[:\s-]*([0-9.]{6,25})/,
    /([0-9]{11})\s+CADASTRE\s+SUA\s+FATURA/,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) {
      const normalized = normalizeBoletoNumber(match[1]);
      if (normalized) return normalized;
    }
  }
  const labeledBlockPatterns = [
    /LINHA\s*DIGIT[AÁ]VEL[^0-9]*([0-9\s.]{40,160})/,
    /C.{0,6}DIGO\s*DE\s*BARRAS[^0-9]*([0-9\s.]{40,160})/,
  ];
  for (const p of labeledBlockPatterns) {
    const m = source.match(p);
    const digits = (m?.[1]?.match(/\d/g) || []).join('');
    if (digits.length === 47 || digits.length === 48) return digits;
    if (digits.length > 48) return digits.slice(0, 48);
    if (digits.length > 47) return digits.slice(0, 47);
  }
  const barcodeMatch = source.match(/\b([0-9]{47,48})\b/);
  if (barcodeMatch?.[1]) return barcodeMatch[1];
  return '';
};

const isAddressLike = (value) => {
  const v = String(value || '').toUpperCase();
  if (!v) return false;
  if (v.includes(' AV ') || v.includes('AV.') || v.includes('AVENIDA') || v.includes('RUA') || v.includes('CEP')) return true;
  return false;
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
// GET /api/transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const { uid, limit, offset } = req.query;
    const parsedLimit = limit ? parseInt(limit) : 10000;
    const parsedOffset = offset ? parseInt(offset) : 0;

    const result = uid
      ? await pool.query('SELECT * FROM transactions WHERE uid = $1 ORDER BY vencimento DESC LIMIT $2 OFFSET $3', [uid, parsedLimit, parsedOffset])
      : await pool.query('SELECT * FROM transactions ORDER BY vencimento DESC LIMIT $1 OFFSET $2', [parsedLimit, parsedOffset]);

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
      const { uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id } = tx;
      
      const vDate = parseDateToPg(vencimento);
      const pDate = parseDateToPg(pagamento);

      try {
        await client.query(
          `INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [uid || 'guest', fornecedor, descricao || '-', empresa || 'Geral', vDate, pDate, valor, status || 'PENDENTE', banco || null, tipo || 'DESPESA', numero_boleto || null, conta_contabil_id || null]
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
    const { uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id } = req.body;

    
    // Convert DD/MM/YYYY back to YYYY-MM-DD
    const vDate = vencimento.split('/').reverse().join('-');
    const pDate = pagamento ? pagamento.split('/').reverse().join('-') : null;

    const result = await pool.query(
      `INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [uid || 'guest', fornecedor, descricao || '-', empresa || 'Geral', vDate, pDate, valor, status || 'PENDENTE', banco || null, tipo || 'DESPESA', numero_boleto || null, conta_contabil_id || null]
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
    const { fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, juros, numero_boleto, conta_contabil_id } = req.body;
    
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
        numero_boleto = $11,
        conta_contabil_id = $12,
        updated_at = NOW()
      WHERE id = $13 RETURNING *`,
      [status, pDate, fornecedor, descricao, empresa, vDate, valor, banco, tipo || 'DESPESA', juros || 0, numero_boleto || null, conta_contabil_id || null, id]
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

// Contas Contábeis API
app.get('/api/contas-contabeis', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contas_contabeis WHERE ativo = true ORDER BY codigo ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching contas contabeis:', error);
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

    // Prompt ultra-detalhado para máxima extração
    const promptBase = `Você é um especialista em boletos bancários brasileiros com 20 anos de experiência em automação financeira.

REGRAS CRÍTICAS (Siga rigorosamente):
1. FORNECEDOR (Beneficiário):
   - É quem RECEBE o dinheiro (Ex: SANESUL, ENERGISA, CLARO, Condomínio Edifício X).
   - NUNCA use o banco emissor (Sicredi, Bradesco, Itaú, Santander, Caixa, BB, Cora, Inter, Nubank, C6, Safra, etc).
   - Se encontrar "BANCO DO BRASIL" e "SANESUL", o fornecedor é SANESUL.
   - NUNCA use o "Pagador" ou "Sacado" como fornecedor.
   - NUNCA use um endereço (Rua, Av, CEP) como nome do fornecedor.

2. VALOR FINANCEIRO:
   - Use o "Valor Total a Pagar" ou "Total da Fatura".
   - NUNCA extraia "Multas", "Juros" ou "Atualização Monetária" como o valor principal.
   - Formato: use PONTO decimal (ex: 142.46).

3. VENCIMENTO:
   - Procure por "Vencimento" ou "Data de Vencimento".
   - Para ENERGISA/SANESUL: NUNCA use a "Data de Próxima Leitura". Use a data limite de pagamento.

CAMPOS ADICIONAIS:
- cnpj: CNPJ do fornecedor (só números).
- numero_boleto: Linha digitável ou código de barras (só números).

JSON FORMAT:
{"fornecedor":"","vencimento":"","valor":0,"cnpj":"","descricao":"","empresa":"","numero_boleto":""}`;

    let prompt;
    if (hasText) {
      prompt = `${promptBase}

TEXTO EXTRAÍDO DO PDF:
${extractedText}

Nome do arquivo: ${fileName || 'N/A'}`;
    } else {
      prompt = `${promptBase}

Nome do arquivo: ${fileName || 'N/A'}
Analise visualmente o PDF anexo e extraia os dados.`;
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
      model: 'gemini-2.0-flash',
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

    // Ensure valor is a number — detecta formato BR (1.234,56) e US (1,234.56)
    if (typeof extracted.valor === 'string') {
      const raw = String(extracted.valor).trim().replace(/[R$\s]/g, '');
      // Formato BR: 1.234,56 — vírgula é decimal
      if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(raw)) {
        extracted.valor = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
      // Formato US: 1,234.56 — ponto é decimal
      } else if (/^\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(raw)) {
        extracted.valor = parseFloat(raw.replace(/,/g, ''));
      // Só ponto como decimal: 632.86
      } else if (/^\d+\.\d{1,2}$/.test(raw)) {
        extracted.valor = parseFloat(raw);
      // Só vírgula como decimal: 632,86
      } else if (/^\d+,\d{1,2}$/.test(raw)) {
        extracted.valor = parseFloat(raw.replace(',', '.'));
      } else {
        extracted.valor = parseFloat(raw.replace(/[^0-9.]/g, ''));
      }
    }
    if (!Number.isFinite(extracted.valor) || extracted.valor <= 0) extracted.valor = 0;
    if (extracted.valor > 500000) extracted.valor = 0;

    // Fallback: extract fornecedor from filename if AI didn't find it
    if (!extracted.fornecedor || extracted.fornecedor === '' || extracted.fornecedor.toLowerCase() === 'não identificado') {
      if (fileName) {
        let name = fileName.replace(/\.pdf$/i, '').replace(/^(BOL|BOLETO|MAT)\s*/i, '').trim();
        extracted.fornecedor = name;
      }
    }

    const localNumero = extractLocalBoletoNumber(extractedText);
    const finalNumero = normalizeBoletoNumber(extracted.numero_boleto || '') || localNumero;
    if (finalNumero) extracted.numero_boleto = finalNumero;

    const srcUpper = String(extractedText || '').toUpperCase();
    
    // Hardcoded safety for common utilities
    if (srcUpper.includes('SANESUL') || srcUpper.includes('SANEAMENTO DE MATO GROSSO')) {
      extracted.fornecedor = 'SANESUL';
    } else if (srcUpper.includes('ENERGISA')) {
      extracted.fornecedor = 'ENERGISA';
    } else if (srcUpper.includes('CLARO') || srcUpper.includes('NET RESIDENCIAL')) {
      extracted.fornecedor = 'CLARO';
    } else if (srcUpper.includes('VIVO') || srcUpper.includes('TELEFONICA')) {
      extracted.fornecedor = 'VIVO';
    }

    // Clean address-like supplier names
    const isAddressLike = (text) => {
      if (!text) return false;
      const t = text.toUpperCase();
      return t.includes('AV.') || t.includes('AVENIDA') || t.includes('RUA ') || t.includes('CEP ') || t.includes('Nº ') || t.includes('RODOVIA');
    };

    if (isAddressLike(extracted.fornecedor)) {
      if (srcUpper.includes('ENERGISA')) extracted.fornecedor = 'ENERGISA';
      else if (srcUpper.includes('SANESUL')) extracted.fornecedor = 'SANESUL';
      else if (srcUpper.includes('CLARO')) extracted.fornecedor = 'CLARO';
      else if (srcUpper.includes('VIVO')) extracted.fornecedor = 'VIVO';
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

// ─── Contas Contábeis - POST / PUT ────────────────────────────────────────────
app.post('/api/contas-contabeis', async (req, res) => {
  try {
    const { codigo, nome, tipo } = req.body;
    if (!codigo || !nome || !tipo) return res.status(400).json({ error: 'codigo, nome e tipo são obrigatórios' });
    const result = await pool.query(
      `INSERT INTO contas_contabeis (codigo, nome, tipo) VALUES ($1, $2, $3) RETURNING *`,
      [codigo, nome, tipo]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating conta contabil:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/contas-contabeis/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nome, tipo, ativo } = req.body;
    const result = await pool.query(
      `UPDATE contas_contabeis SET
        codigo = COALESCE($1, codigo),
        nome   = COALESCE($2, nome),
        tipo   = COALESCE($3, tipo),
        ativo  = COALESCE($4, ativo)
      WHERE id = $5 RETURNING *`,
      [codigo, nome, tipo, ativo, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating conta contabil:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Suppliers merge ──────────────────────────────────────────────────────────
app.post('/api/suppliers/merge', async (req, res) => {
  try {
    const { target, aliases } = req.body;
    if (!target || !Array.isArray(aliases)) return res.status(400).json({ error: 'target e aliases são obrigatórios' });
    const client = await pool.connect();
    let updated = 0;
    let removed = 0;
    try {
      await client.query('BEGIN');
      for (const alias of aliases) {
        const upd = await client.query(
          `UPDATE transactions SET fornecedor = $1 WHERE fornecedor = $2`,
          [target, alias]
        );
        updated += upd.rowCount || 0;
        const del = await client.query(`DELETE FROM suppliers WHERE nome = $1`, [alias]);
        removed += del.rowCount || 0;
      }
      await client.query('COMMIT');
      res.json({ updated, removed });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error merging suppliers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/suppliers/merge-auto', async (req, res) => {
  try {
    // Agrupa fornecedores com mesmo nome normalizado e mantém o mais antigo
    const result = await pool.query(`SELECT id, nome FROM suppliers ORDER BY created_at ASC`);
    const rows = result.rows;
    const normalize = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
    const groups = new Map();
    for (const row of rows) {
      const key = normalize(row.nome);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    let updated = 0;
    let removed = 0;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [, group] of groups) {
        if (group.length <= 1) continue;
        const [keep, ...dupes] = group;
        for (const dupe of dupes) {
          const upd = await client.query(`UPDATE transactions SET fornecedor = $1 WHERE fornecedor = $2`, [keep.nome, dupe.nome]);
          updated += upd.rowCount || 0;
          const del = await client.query(`DELETE FROM suppliers WHERE id = $1`, [dupe.id]);
          removed += del.rowCount || 0;
        }
      }
      await client.query('COMMIT');
      res.json({ updated, removed });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error auto-merging suppliers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Setup tables ─────────────────────────────────────────────────────────────
app.post('/api/setup-tables', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contas_contabeis (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(20) NOT NULL,
        nome VARCHAR(255) NOT NULL,
        tipo VARCHAR(20) NOT NULL DEFAULT 'DESPESA',
        ativo BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    // Seed default accounts if empty
    const count = await pool.query('SELECT COUNT(*) FROM contas_contabeis');
    if (parseInt(count.rows[0].count) === 0) {
      const defaults = [
        ['3.1','Folha de Pagamento','DESPESA'],['3.2','Aluguel','DESPESA'],
        ['3.3','Água / Luz / Telefone','DESPESA'],['3.4','Material de Escritório','DESPESA'],
        ['3.5','Segurança','DESPESA'],['3.6','Editoras','DESPESA'],
        ['3.7','Impostos','DESPESA'],['3.8','Manutenção','DESPESA'],
        ['3.9','Tarifas Bancárias','DESPESA'],['3.10','Juros / Multas','DESPESA'],
        ['3.11','Outras Despesas','DESPESA'],['4.1','Mensalidades','RECEITA'],
        ['4.2','Repasses','RECEITA'],['4.3','Matrículas','RECEITA'],
        ['4.4','Permutas / Convênios','RECEITA'],['4.5','Aplicação Bancária','RECEITA'],
        ['4.6','Outras Receitas','RECEITA'],
      ];
      for (const [codigo, nome, tipo] of defaults) {
        await pool.query(`INSERT INTO contas_contabeis (codigo, nome, tipo) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [codigo, nome, tipo]);
      }
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Error setting up tables:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Roteador por query parameter (compatível com frontend) ───────────────────
// Suporta /api?route=transactions, /api?route=transactions-batch, etc.
app.get('/api', async (req, res) => {
  setCors(res);
  const { route, id, uid } = req.query;
  
  try {
    switch (route) {
      case 'transactions': {
        const { uid: queryUid, limit: queryLimit, offset: queryOffset } = req.query;
        const pLimit = queryLimit ? parseInt(queryLimit) : 10000;
        const pOffset = queryOffset ? parseInt(queryOffset) : 0;
        
        const txResult = queryUid
          ? await pool.query('SELECT * FROM transactions WHERE uid = $1 ORDER BY vencimento DESC LIMIT $2 OFFSET $3', [queryUid, pLimit, pOffset])
          : await pool.query('SELECT * FROM transactions ORDER BY vencimento DESC LIMIT $1 OFFSET $2', [pLimit, pOffset]);
          
        const txFormatted = txResult.rows.map(tx => ({
          ...tx,
          vencimento: tx.vencimento ? new Date(tx.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '',
          pagamento: tx.pagamento ? new Date(tx.pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined,
          valor: Number(tx.valor),
          juros: Number(tx.juros || 0),
        }));
        return res.json(txFormatted);
      }
        
      case 'stats': {
        const { uid: statsUid, year, period } = req.query;
        const sUid = statsUid || 'guest';
        
        const isRange = (val) => /^\d{4}-\d{4}$/.test(val);
        let dateFilter = '';
        
        if (year && year !== 'TODOS' && !isRange(year)) {
          const y = parseInt(year);
          dateFilter = `AND vencimento >= '${y}-01-01' AND vencimento <= '${y}-12-31'`;
        } else if (isRange(year) || isRange(period)) {
          const range = isRange(year) ? year : period;
          const [start, end] = range.split('-');
          dateFilter = `AND vencimento >= '${start}-01-01' AND vencimento <= '${end}-12-31'`;
        }

        const kpiRes = await pool.query(`
          SELECT 
            COALESCE(SUM(CASE WHEN tipo = 'RECEITA' THEN valor ELSE 0 END), 0) as total_receitas,
            COALESCE(SUM(CASE WHEN tipo != 'RECEITA' THEN valor + COALESCE(juros, 0) ELSE 0 END), 0) as total_despesas,
            COUNT(CASE WHEN status = 'PAGO' THEN 1 END) as count_pagos,
            COUNT(CASE WHEN status = 'PENDENTE' AND (vencimento >= CURRENT_DATE OR vencimento IS NULL) THEN 1 END) as count_pendentes,
            COUNT(CASE WHEN status = 'VENCIDO' OR (status = 'PENDENTE' AND vencimento < CURRENT_DATE) THEN 1 END) as count_vencidos,
            COUNT(*) as total_count
          FROM transactions
          WHERE uid = $1 ${dateFilter}`, [sUid]);

        const kpis = kpiRes.rows[0];

        let fluxRes;
        const activeRange = isRange(year) ? year : (isRange(period) ? period : null);

        if (year && year !== 'TODOS' && !activeRange) {
          const y = parseInt(year);
          fluxRes = await pool.query(`
            SELECT 
              EXTRACT(MONTH FROM vencimento) as month_num,
              COALESCE(SUM(CASE WHEN tipo = 'RECEITA' THEN valor ELSE 0 END), 0) as receitas,
              COALESCE(SUM(CASE WHEN tipo != 'RECEITA' THEN valor + COALESCE(juros, 0) ELSE 0 END), 0) as despesas
            FROM transactions
            WHERE uid = $1 AND vencimento >= '${y}-01-01' AND vencimento <= '${y}-12-31'
            GROUP BY EXTRACT(MONTH FROM vencimento) ORDER BY month_num`, [sUid]);
        } else if (activeRange) {
          const [start, end] = activeRange.split('-');
          fluxRes = await pool.query(`
            SELECT 
              EXTRACT(MONTH FROM vencimento) as month_num,
              COALESCE(SUM(CASE WHEN tipo = 'RECEITA' THEN valor ELSE 0 END), 0) as receitas,
              COALESCE(SUM(CASE WHEN tipo != 'RECEITA' THEN valor + COALESCE(juros, 0) ELSE 0 END), 0) as despesas
            FROM transactions
            WHERE uid = $1 AND vencimento >= '${start}-01-01' AND vencimento <= '${end}-12-31'
            GROUP BY EXTRACT(MONTH FROM vencimento) ORDER BY month_num`, [sUid]);
        } else {
          fluxRes = await pool.query(`
            SELECT 
              EXTRACT(MONTH FROM vencimento) as month_num,
              COALESCE(SUM(CASE WHEN tipo = 'RECEITA' THEN valor ELSE 0 END), 0) as receitas,
              COALESCE(SUM(CASE WHEN tipo != 'RECEITA' THEN valor + COALESCE(juros, 0) ELSE 0 END), 0) as despesas
            FROM transactions
            WHERE uid = $1 
              AND vencimento >= DATE_TRUNC('year', CURRENT_DATE)
              AND vencimento < DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year'
            GROUP BY EXTRACT(MONTH FROM vencimento) ORDER BY month_num`, [sUid]);
        }

        const supplierRes = await pool.query(`
          SELECT fornecedor as name, SUM(valor) as value
          FROM transactions
          WHERE uid = $1 ${dateFilter}
          GROUP BY fornecedor ORDER BY value DESC LIMIT 5`, [sUid]);

        return res.json({
          kpis: {
            total_receitas: Number(kpis.total_receitas),
            total_despesas: Number(kpis.total_despesas),
            count_pagos: parseInt(kpis.count_pagos),
            count_pendentes: parseInt(kpis.count_pendentes),
            count_vencidos: parseInt(kpis.count_vencidos),
            total_count: parseInt(kpis.total_count)
          },
          monthlyFlux: fluxRes.rows.map(r => ({
            month_num: parseInt(r.month_num),
            receitas: Number(r.receitas),
            despesas: Number(r.despesas)
          })),
          topSuppliers: supplierRes.rows.map(r => ({
            name: r.name,
            value: Number(r.value)
          }))
        });
      }
        
      case 'suppliers':
        const suppliersResult = uid
          ? await pool.query('SELECT * FROM suppliers WHERE uid = $1 ORDER BY nome ASC', [uid])
          : await pool.query('SELECT * FROM suppliers ORDER BY nome ASC');
        return res.json(suppliersResult.rows);
        
      case 'banks':
        const banksResult = uid
          ? await pool.query('SELECT * FROM banks WHERE uid = $1 AND ativo = true ORDER BY nome ASC', [uid])
          : await pool.query('SELECT * FROM banks WHERE ativo = true ORDER BY nome ASC');
        return res.json(banksResult.rows);
        
      case 'contas-contabeis':
        const contasResult = await pool.query('SELECT * FROM contas_contabeis WHERE ativo = true ORDER BY codigo ASC');
        return res.json(contasResult.rows);
        
      default:
        return res.status(404).json({ error: 'Route not found' });
    }
  } catch (e) {
    console.error('API error:', e);
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api', async (req, res) => {
  setCors(res);
  const { route } = req.query;
  
  try {
    switch (route) {
      case 'transactions':
        const { uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id } = req.body;
        const vDate = parseDateToPg(vencimento);
        const pDate = parseDateToPg(pagamento);
        
        const result = await pool.query(
          `INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
          [uid || 'guest', fornecedor, descricao || '-', empresa || 'Geral', vDate, pDate, valor, status || 'PENDENTE', banco || null, tipo || 'DESPESA', numero_boleto || null, conta_contabil_id || null]
        );
        return res.status(201).json(result.rows[0]);
        
      case 'transactions-batch':
        const transactions = req.body;
        if (!Array.isArray(transactions) || transactions.length === 0) {
          return res.status(400).json({ error: 'Invalid batch data' });
        }
        
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          for (const tx of transactions) {
            const { uid: txUid, fornecedor: txForn, descricao: txDesc, empresa: txEmp, vencimento: txVenc, pagamento: txPag, valor: txVal, status: txStatus, banco: txBank, tipo: txTipo, numero_boleto: txNum, conta_contabil_id: txConta } = tx;
            
            const vDateBatch = parseDateToPg(txVenc);
            const pDateBatch = parseDateToPg(txPag);
            
            await client.query(
              `INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, numero_boleto, conta_contabil_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [txUid || 'guest', txForn, txDesc || '-', txEmp || 'Geral', vDateBatch, pDateBatch, txVal, txStatus || 'PENDENTE', txBank || null, txTipo || 'DESPESA', txNum || null, txConta || null]
            );
          }
          
          await client.query('COMMIT');
          return res.status(201).json({ message: 'Batch created successfully', count: transactions.length });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
        
      case 'suppliers':
        const { uid: supUid, nome, cnpj, email, telefone } = req.body;
        const supResult = await pool.query(
          `INSERT INTO suppliers (uid, nome, cnpj, email, telefone)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [supUid || 'guest', nome, cnpj || null, email || null, telefone || null]
        );
        return res.status(201).json(supResult.rows[0]);
        
      case 'banks':
        const { uid: bankUid, nome: bankNome, agencia, conta, saldo } = req.body;
        const bankResult = await pool.query(
          `INSERT INTO banks (uid, nome, agencia, conta, saldo)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [bankUid || 'guest', bankNome, agencia || null, conta || null, saldo ?? 0]
        );
        return res.status(201).json(bankResult.rows[0]);
        
      case 'setup-tables':
        await pool.query(`
          CREATE TABLE IF NOT EXISTS contas_contabeis (
            id SERIAL PRIMARY KEY,
            codigo VARCHAR(20) NOT NULL,
            nome VARCHAR(255) NOT NULL,
            tipo VARCHAR(20) NOT NULL DEFAULT 'DESPESA',
            ativo BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `);
        const count = await pool.query('SELECT COUNT(*) FROM contas_contabeis');
        if (parseInt(count.rows[0].count) === 0) {
          const defaults = [
            ['3.1','Folha de Pagamento','DESPESA'],['3.2','Aluguel','DESPESA'],
            ['3.3','Água / Luz / Telefone','DESPESA'],['3.4','Material de Escritório','DESPESA'],
            ['3.5','Segurança','DESPESA'],['3.6','Editoras','DESPESA'],
            ['3.7','Impostos','DESPESA'],['3.8','Manutenção','DESPESA'],
            ['3.9','Tarifas Bancárias','DESPESA'],['3.10','Juros / Multas','DESPESA'],
            ['3.11','Outras Despesas','DESPESA'],['4.1','Mensalidades','RECEITA'],
            ['4.2','Repasses','RECEITA'],['4.3','Matrículas','RECEITA'],
            ['4.4','Permutas / Convênios','RECEITA'],['4.5','Aplicação Bancária','RECEITA'],
            ['4.6','Outras Receitas','RECEITA'],
          ];
          for (const [codigo, nome, tipo] of defaults) {
            await pool.query(`INSERT INTO contas_contabeis (codigo, nome, tipo) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [codigo, nome, tipo]);
          }
        }
        return res.json({ ok: true });
        
      default:
        return res.status(404).json({ error: 'Route not found' });
    }
  } catch (e) {
    console.error('API error:', e);
    return res.status(500).json({ error: e.message });
  }
});

app.put('/api', async (req, res) => {
  setCors(res);
  const { route, id } = req.query;
  
  try {
    if (route === 'transactions' && id) {
      const { fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, juros, numero_boleto, conta_contabil_id } = req.body;
      
      const pDate = pagamento ? parseDateToPg(pagamento) : null;
      const vDate = vencimento ? parseDateToPg(vencimento) : null;
      
      const result = await pool.query(
        `UPDATE transactions SET
          status = $1,
          pagamento = $2,
          fornecedor = $3,
          descricao = $4,
          empresa = $5,
          vencimento = $6,
          valor = $7,
          banco = $8,
          tipo = $9,
          juros = $10,
          numero_boleto = $11,
          conta_contabil_id = $12,
          updated_at = NOW()
        WHERE id = $13 RETURNING *`,
        [status, pDate, fornecedor, descricao, empresa, vDate, valor, banco, tipo || 'DESPESA', juros || 0, numero_boleto || null, conta_contabil_id || null, id]
      );
      
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      
      const tx = result.rows[0];
      return res.json({
        ...tx,
        vencimento: tx.vencimento ? new Date(tx.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '',
        pagamento: tx.pagamento ? new Date(tx.pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined,
        valor: Number(tx.valor),
        juros: Number(tx.juros || 0),
      });
    }
    
    return res.status(404).json({ error: 'Route not found' });
  } catch (e) {
    console.error('API error:', e);
    return res.status(500).json({ error: e.message });
  }
});

app.delete('/api', async (req, res) => {
  setCors(res);
  const { route, id } = req.query;
  
  try {
    if (route === 'transactions' && id) {
      await pool.query('DELETE FROM transactions WHERE id = $1', [id]);
      return res.status(204).send();
    }
    
    if (route === 'suppliers' && id) {
      await pool.query('DELETE FROM suppliers WHERE id = $1', [id]);
      return res.status(204).send();
    }
    
    if (route === 'banks' && id) {
      await pool.query('DELETE FROM banks WHERE id = $1', [id]);
      return res.status(204).send();
    }
    
    return res.status(404).json({ error: 'Route not found' });
  } catch (e) {
    console.error('API error:', e);
    return res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
