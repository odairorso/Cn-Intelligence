const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);
const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });

const extractedText = `202603*Gerado pela Agência Virtual WEB - SANESUL  DOCUMENTO   MATRÍCULA  < AUTENTICAÇÃO MECÂNICA NO VERSO >  EMPRESA DE SANEAMENTO DE MATO GROSSO DO SUL S.A.  CNPJ/MF 03.982.931/0001-20 - INSC. EST. 28.104.248-9  EMPRESA DE SANEAMENTO DE MATO GROSSO DO SUL S.A.  CNPJ/MF 03.982.931/0001-20 - INSC. EST. 28.104.248-9  RESIDENCIAL   COMERCIAL   INDUSTRIAL   PUBLICO   CICLO   SETOR/ROTA/SEQUÊNCIA MEDIDOR   TIPO ENTREGA   MÊS/ANO DATA LEITURA ATUAL   DATA LEITURA ANTERIOR   CONSUMO FATURADO LEITURA ATUAL   LEITURA ANTERIOR   MÉDIA  TOTAL A PAGAR VENCIMENTO  DOCUMENTO   VENCIMENTO   TOTAL A PAGAR  TARIFA DE ÁGUA/ESGOTO (m³)  PREÇO m³ VALOR FAIXA  VOL. X ECON.  CATEGORIA/ FAIXA DE  VIA CLIENTE  VIA EMPRESA  COMPOSIÇÃO DA GUIA/CONTA  OBSERVAÇÃO  HISTÓRICO DE CONSUMO FATURADO  SR. CAIXA ! AUTORIZAMOS O RECEBIMENTO DESTA CONTA ATÉ 15/04/2026  82690000001-7   42460110202-5   60415217872-8   35940655446-9  Rota  NÚMERO O.S.   SOLICITANTE   APROVAÇÃO  ÁGUA  ESGOTO  INSCRIÇÃO  LACRE  GUIA DE PAGAMENTO  217872359   40655446   ODAIR ROBERTO DOS SANTOS  TREVO,R, 00757, Q 14 L 07 NAVIRAI 1   0   0   0 A19LM0581567 0   0 PAGAMENTO DE DÉBITO(S)   142,46 52   008.007.0933 0 0  142,46 14/04/2026  GUIA DE PAGAMENTO  217.872.359   14/04/2026   142,46  0   ODAIR ROBERTO DOS SANTOS   ODAIR ROBERTO DOS SANTOS  40.570.00.008.154.0407.000  Situação: Água-Ativa | Esgoto-Potencial`;

const promptBase = `Você é um especialista em boletos bancários brasileiros com 20 anos de experiência.

REGRAS CRÍTICAS:
- fornecedor = quem RECEBE o dinheiro (beneficiário/cedente), NUNCA o banco emissor
- Bancos emissores (IGNORAR como fornecedor): Sicredi, Bradesco, Itaú, Santander, Caixa, BB, Cora, Inter, Nubank, C6, BTG, Safra, BV, Banrisul, Unicred
- valor = número decimal com PONTO como separador (ex: 632.86).
- ATENÇÃO VALOR UTILITY (Energisa/Claro/Sanesul): Use o "Valor Total a Pagar" ou "Total da Fatura". NUNCA extraia valores parciais, "Multas", "Juros", "Atualização Monetária" ou "Parcelas" como o valor principal. Se houver multa, ela já deve estar incluída no total que você vai extrair.
- Se valor aparecer como "632,86" retorne 632.86 — se "2.092,71" retorne 2092.71

CAMPOS:
1. fornecedor: Nome do beneficiário/cedente que emitiu o boleto — quem VAI RECEBER o dinheiro
   Procure por: "Beneficiário", "Cedente", "Sacador/Avalista", "Razão Social"
   ATENÇÃO: O campo "Pagador" ou "Sacado" é quem PAGA — NUNCA use como fornecedor
   ATENÇÃO 2: NUNCA use um endereço como fornecedor (ex: se encontrar "AV. GURY MARQUES", "RUA...", "CEP", isso é o endereço do fornecedor, o nome dele vem antes).
   Se o beneficiário for uma pessoa física (ex: "Valmir Lopes de Souza"), use o nome dela
   Exemplos corretos: HAPVIDA, SANESUL, ENERGISA, VSC CONTABILIDADE, Anhanguera Educacional Ltda
{"fornecedor":"","vencimento":"","valor":0,"cnpj":"","descricao":"","empresa":"","numero_boleto":""}`;

async function test() {
  const prompt = `${promptBase}\n\nTEXTO DO PDF:\n${extractedText}\n\nNome do arquivo: Sanesul.pdf`;
  const response = await model.generateContent(prompt);
  console.log('Result:', response.response.text());
}

test();
