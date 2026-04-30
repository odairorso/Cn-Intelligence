require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

async function testVision() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const fileName = 'BOL MAT EDUARDO - RADIOLOGIA - 26.01.pdf';
  const filePath = path.join('./boletos_teste', fileName);
  
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }

  const pdfBuffer = fs.readFileSync(filePath);
  const pdfBase64 = pdfBuffer.toString('base64');

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

  const prompt = `${promptBase}\n\nNome do arquivo: ${fileName}\nAnalise visualmente o PDF anexo e extraia os dados.`;

  const contents = [
    { text: prompt },
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: pdfBase64,
      },
    },
  ];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    console.log('--- GEMINI RESPONSE ---');
    console.log(response.text);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testVision();
