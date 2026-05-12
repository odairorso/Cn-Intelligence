import { GoogleGenerativeAI as GoogleGenAI } from '@google/genai';
import { sql } from '../_db.js';
import {
  normName,
  cleanCnpj,
  isValidCnpj,
  normSupplier,
  normalizeBoletoNumber,
  extractLocalBoletoNumber,
  isAddressLike,
  supplierFromFileName
} from '../_utils.js';
import { ExtractBoletoSchema, SaveBoletoPatternSchema } from '../_schemas.js';

// Auxiliar: busca padrão aprendido no banco
async function lookupPattern(cnpj, nomeNormalizado) {
  try {
    const cnpjClean = cleanCnpj(cnpj);
    if (isValidCnpj(cnpjClean)) {
      const r = await sql`SELECT * FROM boleto_patterns WHERE cnpj = ${cnpjClean} LIMIT 1`;
      if (r.length) return r[0];
    }
    if (nomeNormalizado && nomeNormalizado.length >= 5) {
      const r = await sql`SELECT * FROM boleto_patterns WHERE nome_normalizado = ${nomeNormalizado} LIMIT 1`;
      if (r.length) return r[0];
    }
  } catch { /* tabela pode não existir */ }
  return null;
}

// POST /api?route=extract-boleto
export async function handleExtractBoleto(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    // Não exige autenticação para extração rápida de boleto via upload
    const result = ExtractBoletoSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: result.error.flatten().fieldErrors });
    }

    const { text, fileName, pdfBase64 } = result.data;

    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');

    const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);
    const generateContentWithFallback = async (contents, config) => {
      const modelsToTry = [process.env.GEMINI_MODEL, 'gemini-2.0-flash', 'gemini-1.5-flash'].filter(Boolean);
      let lastErr = null;
      for (const modelName of modelsToTry) {
        try {
          const model = ai.getGenerativeModel({ model: modelName });
          return await model.generateContent(contents);
        } catch (e) {
          lastErr = e;
          if (String(e?.message).includes('404')) continue;
          throw e;
        }
      }
      throw lastErr;
    };

    const extractedText = text || '';
    const srcUpper = extractedText.toUpperCase();
    const allCnpjs = Array.from(new Set([...srcUpper.matchAll(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14}/g)].map(m => cleanCnpj(m[0])).filter(isValidCnpj)));

    // Identificação básica do beneficiário
    let rawBenefName = '';
    if (srcUpper.includes('SANESUL')) rawBenefName = 'SANESUL';
    else if (srcUpper.includes('ENERGISA')) rawBenefName = 'ENERGISA';
    else if (srcUpper.includes('CLARO')) rawBenefName = 'CLARO';
    else if (srcUpper.includes('VIVO')) rawBenefName = 'VIVO';

    const rawCnpj = allCnpjs[0] || '';
    const pattern = await lookupPattern(rawCnpj, normName(rawBenefName));

    if (pattern && extractedText.length > 100) {
      const dateMatch = srcUpper.match(/VENCIMENTO[:\\s]+(\d{2}\/\d{2}\/\d{4})/);
      const valorMatch = srcUpper.match(/VALOR[^0-9]*([\d.,]+)/);
      const numero = extractLocalBoletoNumber(srcUpper);

      return res.json({
        fornecedor: pattern.fornecedor,
        vencimento: dateMatch?.[1] || '',
        valor: parseFloat(valorMatch?.[1]?.replace(/\./g, '').replace(',', '.') || '0'),
        cnpj: rawCnpj,
        descricao: `${fileName} - ${pattern.descricao || ''}`,
        empresa: pattern.empresa,
        tipo: pattern.tipo,
        numero_boleto: numero,
        _from_pattern: true
      });
    }

    // Chamada completa ao Gemini se não houver padrão
    const prompt = `Extraia dados deste boleto: ${fileName}\n\nTexto:\n${extractedText.slice(0, 5000)}\n\nRetorne JSON: {"fornecedor":"","vencimento":"","valor":0,"cnpj":"","numero_boleto":""}`;
    const resultGemini = await generateContentWithFallback(prompt);
    const extracted = JSON.parse(resultGemini.response.text().replace(/```json|```/gi, '').trim());

    return res.json(extracted);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// GET /api?route=boleto-patterns
export async function handleBoletoPatterns(req, res) {
  const uid = req.authUid;
  if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

  try {
    const rows = await sql`SELECT * FROM boleto_patterns ORDER BY confirmacoes DESC, fornecedor ASC`;
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// POST /api?route=save-boleto-pattern
export async function handleSaveBoletoPattern(req, res) {
  const uid = req.authUid;

  try {
    if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

    const result = SaveBoletoPatternSchema.safeParse({ uid, ...req.body });
    if (!result.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: result.error.flatten().fieldErrors });
    }

    const { cnpj, nome_beneficiario, fornecedor, descricao, empresa, tipo, conta_contabil_id } = result.data;
    const cnpjClean = cleanCnpj(cnpj || '');
    const nomeNorm = normName(nome_beneficiario || fornecedor);

    await sql`
      INSERT INTO boleto_patterns (uid, cnpj, nome_normalizado, fornecedor, descricao, empresa, tipo, conta_contabil_id)
      VALUES (${uid}, ${cnpjClean || null}, ${nomeNorm}, ${fornecedor}, ${descricao}, ${empresa}, ${tipo}, ${conta_contabil_id})
      ON CONFLICT (nome_normalizado) DO UPDATE SET confirmacoes = boleto_patterns.confirmacoes + 1, ultima_confirmacao = NOW()`;
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// DELETE /api?route=boleto-patterns&id=xxx
export async function handleDeleteBoletoPattern(req, res) {
  const uid = req.authUid;

  const { id } = req.query;
  try {
    if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });
    await sql`DELETE FROM boleto_patterns WHERE id = ${id} AND uid = ${uid}`;
    return res.status(204).end();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}