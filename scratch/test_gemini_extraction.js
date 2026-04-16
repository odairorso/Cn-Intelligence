import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const text = fs.readFileSync('boletos_teste/ENERGISA.txt', 'utf-8');
  const srcUpper = text.toUpperCase();

  // Test local regex
  const dateMatch = srcUpper.match(/VENCIMENTO[:\s]+(\d{2}\/\d{2}\/\d{4})/);
  console.log('Local dateMatch:', dateMatch ? dateMatch[0] : 'No match');

  // Test mini prompt
  const miniPrompt = `Extraia do texto de boleto abaixo APENAS:
- vencimento: data de vencimento no formato DD/MM/AAAA (IMPORTANTE: Para faturas de energia, NUNCA use a data de 'Próxima Leitura' que costuma ser dia 07/05/2026! O Vencimento real nesta fatura é outro dia em Abril).
- valor: valor total em reais com ponto decimal (ex: 105.00)
- numero_boleto: Nosso Número ou Número do Documento (só dígitos)

TEXTO: ${text.slice(0, 5000)}

Responda APENAS JSON: {"vencimento":"","valor":0,"numero_boleto":""}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: miniPrompt,
    config: { responseMimeType: 'application/json', temperature: 0 },
  });

  console.log('Gemini Result:', response.text);
}

test();
