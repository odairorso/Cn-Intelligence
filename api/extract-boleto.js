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

    const textInstruction = `Você é um especialista em extrair dados de boletos bancários brasileiros.
Analise o PDF de boleto anexo (ou o texto extraído abaixo) e o nome do arquivo.
Extraia os seguintes campos:

1. fornecedor: Nome do beneficiário/empresa que emitiu o boleto. Se não encontrar, use o nome do arquivo como referência.
2. vencimento: Data de vencimento no formato DD/MM/AAAA
3. valor: Valor do boleto (apenas número, usar ponto como decimal)
4. cnpj: CNPJ do beneficiário se disponível
5. descricao: Descrição do serviço/produto, ou o que o boleto se refere
6. empresa: Qual empresa do grupo CN o boleto pertence (CN, FACEMS, LAB, CEI, UNOPAR). Se não identificar, deixe vazio.

Nome do arquivo: ${fileName || 'N/A'}

${text ? `Texto extraído do PDF:\n${text}` : 'Nenhum texto extraído - analise o PDF anexo.'}

Responda APENAS com JSON válido no formato:
{
  "fornecedor": "",
  "vencimento": "",
  "valor": 0,
  "cnpj": "",
  "descricao": "",
  "empresa": ""
}`;

    let contents;
    if (pdfBase64) {
      contents = [
        { text: textInstruction },
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64,
          },
        },
      ];
    } else {
      contents = textInstruction;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
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
        // Remove extension and common prefixes
        let name = fileName.replace(/\.pdf$/i, '').replace(/^(BOL|BOLETO|MAT)\s*/i, '').trim();
        extracted.fornecedor = name;
      }
    }

    res.status(200).json(extracted);
  } catch (error) {
    console.error('Error extracting boleto data:', error.message);
    // Fallback: return basic data from filename
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
