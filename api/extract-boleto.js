import { GoogleGenAI } from '@google/genai';

export const maxDuration = 30; // 30 seconds limit for serverless

export default async function handler(req, res) {
  // CORS check
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, fileName, pdfBase64 } = req.body;
    if (!text && !fileName && !pdfBase64) {
      return res.status(400).json({ error: 'text, fileName or pdfBase64 required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const extractedText = text || '';
    const hasText = extractedText.length > 10;

    let prompt;
    if (hasText) {
      prompt = `Você é um especialista em extrair dados de boletos bancários brasileiros.
Analise o texto abaixo extraído de um PDF de boleto bancário e extraia os campos solicitados.

TEXTO DO PDF:
${extractedText}

Nome do arquivo: ${fileName || 'N/A'}

Extraia os seguintes campos:
1. fornecedor: Nome do beneficiário/empresa que emitiu o boleto. Procure por "Beneficiário", "Cedente", "Razão Social". Se não encontrar, use o nome do arquivo.
2. vencimento: Data de vencimento no formato DD/MM/AAAA. Procure por "Vencimento", "Vcto".
3. valor: Valor do boleto em reais (apenas número, usar ponto como decimal). Procure por "Valor", "Valor do Documento", "Valor Cobrado", "Vlr Pagar".
4. cnpj: CNPJ do beneficiário se disponível.
5. descricao: Descrição do serviço ou referência do boleto.
6. empresa: Qual empresa do grupo CN pertence (CN, FACEMS, LAB, CEI, UNOPAR). Se não identificar, deixe vazio.

Responda APENAS com JSON válido:
{"fornecedor":"","vencimento":"","valor":0,"cnpj":"","descricao":"","empresa":""}`;
    } else {
      prompt = `Você é um especialista em extrair dados de boletos bancários brasileiros.
Analise visualmente o PDF de boleto bancário anexo (pode ser uma imagem/scan) e extraia os campos abaixo.

Nome do arquivo: ${fileName || 'N/A'}

Extraia os seguintes campos:
1. fornecedor: Nome do beneficiário/empresa que emitiu o boleto.
2. vencimento: Data de vencimento no formato DD/MM/AAAA.
3. valor: Valor do boleto em reais (apenas número, usar ponto como decimal).
4. cnpj: CNPJ do beneficiário se disponível.
5. descricao: Descrição do serviço ou referência do boleto.
6. empresa: Qual empresa do grupo CN pertence (CN, FACEMS, LAB, CEI, UNOPAR). Se não identificar, deixe vazio.

Responda APENAS com JSON válido:
{"fornecedor":"","vencimento":"","valor":0,"cnpj":"","descricao":"","empresa":""}`;
    }

    let contents;
    if (!hasText && pdfBase64) {
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
    if (rawText) {
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    }
    const extracted = JSON.parse(rawText || '{}');

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

    res.status(200).json(extracted);
  } catch (error) {
    console.error('[boleto] Error extracting boleto data:', error.message);
    const { fileName } = req.body;
    let fornecedor = 'Fornecedor não identificado';
    if (fileName) {
      fornecedor = fileName.replace(/\.pdf$/i, '').replace(/^(BOL|BOLETO|MAT)\s*/i, '').trim();
    }
    res.status(200).json({
      fornecedor,
      vencimento: '',
      valor: 0,
      cnpj: '',
      descricao: fileName || '',
      empresa: '',
    });
  }
}
