import { GoogleGenAI } from '@google/genai';
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
  const uid = req.authUid;
  if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const result = ExtractBoletoSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: result.error.flatten().fieldErrors });
    }

    const { text, fileName, pdfBase64 } = result.data;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: 'IA não configurada no servidor (GEMINI_API_KEY ausente).',
        code: 'AI_NOT_CONFIGURED'
      });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const generateContentWithFallback = async (contents) => {
      const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', process.env.GEMINI_MODEL].filter(Boolean);
      let lastErr = null;
      for (const modelName of modelsToTry) {
        try {
          // No @google/genai a chamada é direta em ai.models.generateContent
          return await ai.models.generateContent({
            model: modelName,
            contents: contents
          });
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

    // Identificação básica do beneficiário para busca de padrão
    let rawBenefName = '';
    if (srcUpper.includes('SANESUL')) rawBenefName = 'SANESUL';
    else if (srcUpper.includes('ENERGISA')) rawBenefName = 'ENERGISA';
    else if (srcUpper.includes('CLARO')) rawBenefName = 'CLARO';
    else if (srcUpper.includes('VIVO')) rawBenefName = 'VIVO';

    const rawCnpj = allCnpjs[0] || '';
    const pattern = await lookupPattern(rawCnpj, normName(rawBenefName));

    // Busca as contas contábeis cadastradas para o prompt da IA
    let contasContabeisText = '';
    try {
      const contasRows = await sql`SELECT id, codigo, nome, tipo FROM contas_contabeis WHERE ativo = true ORDER BY codigo`;
      if (contasRows.length > 0) {
        contasContabeisText = '\n\nCONTAS CONTÁBEIS DISPONÍVEIS:\n' + contasRows.map(c => `- ID ${c.id}: ${c.codigo} - ${c.nome} (${c.tipo})`).join('\n');
      }
    } catch { /* ignore if fails */ }

    let extracted = null;
    let geminiError = null;

    try {
      const prompt = `Analise este boleto bancário (arquivo: ${fileName}).
      
      REGRAS DE EXTRAÇÃO (MUITO IMPORTANTE):
      1. FORNECEDOR (BENEFICIÁRIO): Identifique quem recebe o dinheiro.
         - NÃO USE o Pagador/Sacado (Ex: ignore nomes como ELAINE CRISTINA CAMACHO CAVALCANTE).
         - USE o Cedente/Beneficiário/Emissor (Ex: Porto Seguro, Energisa, Sanesul, Claro).
      2. VENCIMENTO: Data no formato DD/MM/AAAA.
         - Para ENERGISA/SANESUL: NUNCA use a data de leitura anterior/atual ou de leitura próxima. Use a data limite de pagamento/vencimento.
      3. VALOR: Valor total (numérico).
         - Use o "Valor Total a Pagar" ou "Total da Fatura". NUNCA use sub-valores de taxas, ICMS ou distribuição como valor total.
      4. CNPJ: CNPJ do Beneficiário (quem recebe).
      5. NÚMERO DO BOLETO: Use o campo "Número do Documento" que aparece no corpo/ficha do boleto (campo específico, geralmente alfanumérico curto como "0002a1rvwn").
         - NÃO use a linha digitável (aquele número gigante com 47+ dígitos que aparece no topo).
         - NÃO use o código de barras numérico.
         - Se não houver "Número do Documento" explícito, retorne o "Nosso Número" ou deixe vazio.
      6. DESCRIÇÃO: Uma breve descrição baseada no conteúdo (ex: "Seguro Auto", "Conta de Energia").
      7. CONTA CONTÁBIL (conta_contabil_id): Baseado na descrição e fornecedor, sugira o ID NUMÉRICO da conta contábil mais adequada. Retorne apenas o ID numérico ou null se não souber.${contasContabeisText}`;

      const parts = [];
      if (pdfBase64) {
        parts.push({
          inlineData: {
            data: pdfBase64,
            mimeType: 'application/pdf'
          }
        });
      }
      parts.push({ text: prompt + (extractedText ? `\n\nTexto extraído (OCR):\n${extractedText.slice(0, 5000)}` : '') });

      const contents = [{ role: 'user', parts }];

      const resultGemini = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              fornecedor: { type: 'string' },
              vencimento: { type: 'string' },
              valor: { type: 'number' },
              cnpj: { type: 'string' },
              numero_boleto: { type: 'string' },
              descricao: { type: 'string' },
              conta_contabil_id: { type: 'number', nullable: true }
            },
            required: ['fornecedor', 'vencimento', 'valor']
          }
        }
      });

      const responseText = resultGemini.text || resultGemini.response?.text?.() || '';
      if (responseText) {
        let cleanedText = responseText.trim();
        if (cleanedText.startsWith('```')) {
          cleanedText = cleanedText.replace(/^```(?:json)?\n?/i, '').replace(/```$/, '').trim();
        }
        extracted = JSON.parse(cleanedText);
      } else {
        throw new Error('Resposta vazia da IA');
      }
    } catch (e) {
      console.error('Erro na extração com Gemini:', e.message);
      geminiError = e.message;
    }

    if (extracted) {
      // Limpeza rigorosa no fornecedor
      if (extracted.fornecedor) {
        extracted.fornecedor = extracted.fornecedor
          .replace(/\d{4,}/g, '')
          .replace(/boleto/gi, '')
          .replace(/\b(ELAI|ELAINE|CRISTINA|CAMACHO|CAVALCANTE)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (!extracted.fornecedor || extracted.fornecedor.length < 3) {
          extracted.fornecedor = 'Fornecedor não identificado';
        }
      }

      // Se a IA funcionou, aplicamos o padrão do banco (se existir) para garantir consistência
      const finalCnpj = extracted.cnpj || rawCnpj;
      const finalName = extracted.fornecedor || rawBenefName;
      const dbPattern = await lookupPattern(finalCnpj, normName(finalName));

      if (dbPattern) {
        extracted.fornecedor = dbPattern.fornecedor || extracted.fornecedor;
        extracted.empresa = dbPattern.empresa || extracted.empresa;
        extracted.tipo = dbPattern.tipo || extracted.tipo || 'DESPESA';
        extracted.conta_contabil_id = dbPattern.conta_contabil_id || extracted.conta_contabil_id;
        extracted._from_pattern = true;
        if (dbPattern.descricao && (!extracted.descricao || extracted.descricao === 'Fatura de Energia Elétrica' || extracted.descricao === 'Importado via IA')) {
          extracted.descricao = `${fileName} - ${dbPattern.descricao}`;
        }
      }

      return res.json({
        ...extracted,
        descricao: extracted.descricao || `${fileName} - Importado via IA`
      });
    }

    // Se a IA falhou, usamos o fallback de padrão se existir
    if (pattern && pattern.fornecedor && pattern.fornecedor !== 'Fornecedor não identificado' && extractedText.length > 100) {
      const dateMatch = srcUpper.match(/VENCIMENTO[:\s]+(\d{2}\/\d{2}\/\d{4})/);
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
        conta_contabil_id: pattern.conta_contabil_id,
        _from_pattern: true,
        _gemini_error: geminiError
      });
    }

    throw new Error(geminiError || 'Falha na resposta da IA');
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

    const result = SaveBoletoPatternSchema.safeParse({ ...(req.body || {}), uid });
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
