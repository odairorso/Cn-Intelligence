import type { Supplier } from '../types';
import { normalizeSupplierName, parseMoneyToNumber } from './utils';

export type PdfImportDraft = {
  fileName: string;
  fornecedor: string;
  vencimento: string;
  valor: number;
  descricao: string;
  empresa: string;
  cnpj: string;
  numero_boleto: string;
  tipo?: 'RECEITA' | 'DESPESA';
  conta_contabil_id?: number;
  rawText: string;
  duplicate: boolean;
  ai_error?: string;
};

export const normalizeBoletoNumber = (value?: string) => {
  if (value === null || value === undefined || value === '') return '';
  const clean = String(value).replace(/[^A-Z0-9]/g, '');
  if (clean.length === 47 || clean.length === 48 || clean.length === 44) {
    return clean;
  }
  const raw = String(value || '').toUpperCase();
  if (!raw) return '';
  const tokens = raw
    .split(/[\s:;|,]+/)
    .map((token) => token.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);
  const bestToken = tokens.find((token) => /\d{4,}/.test(token) && token.length >= 6 && token.length <= 30);
  if (bestToken) return bestToken;
  return clean;
};

export const extractLocalBoletoNumber = (text: string) => {
  const source = String(text || '').toUpperCase();
  const patterns = [
    // APENAS Número do Documento — exatamente o que está no boleto, com letras
    /N[UÚ]MERO\s*DO\s*DOCUMENTO\s*[:\s-]*([A-Z0-9][A-Z0-9./ -]{3,39})/,
    /NR\s*DO\s*DOCUMENTO\s*[:\s-]*([A-Z0-9][A-Z0-9./ -]{3,39})/,
    /N[ROº°]*\s*DOCUMENTO\s*[:\s-]*([A-Z0-9][A-Z0-9./ -]{3,39})/,
    /NR\.?\s*DOC\.?\s*[:\s-]*([A-Z0-9][A-Z0-9./ -]{3,39})/,
    /N[º°\.]\s*DOC\.?\s*[:\s-]*([A-Z0-9][A-Z0-9./ -]{3,39})/,
    /NUMERO\s*DOCUMENTO\s*[:\s-]*([A-Z0-9][A-Z0-9./ -]{3,39})/,
    /NUM\.\s*DOC\.?\s*[:\s-]*([A-Z0-9][A-Z0-9./ -]{3,39})/,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) {
      const raw = match[1].trim().replace(/\s+/g, ' ');
      if (raw.length >= 4) return raw;
    }
  }
  return '';
};

export const parseLinhaDigitavel = (text: string) => {
  const src = String(text || '');

  const candidates: string[] = src.match(/\b\d{47,48}\b/g) || [];

  if (!candidates.length) {
    const fragmentPattern = /\d{5}\.\d{5}\s+\d{5}\.\d{6}\s+\d{5}\.\d{6}\s+\d\s+\d{14}/;
    const fragMatch = src.match(fragmentPattern);
    if (fragMatch) {
      const assembled = fragMatch[0].replace(/[^0-9]/g, '');
      if (assembled.length === 47 || assembled.length === 48) candidates.push(assembled);
    }
  }

  if (!candidates.length) return null;
  const raw = candidates[0];
  const line = raw.length >= 47 ? raw.slice(0, 47) : raw;
  const fator = Number(line.slice(5, 9));
  const valor = Number(line.slice(9, 19)) / 100;
  if (!Number.isFinite(fator) || fator <= 0) return null;
  if (!Number.isFinite(valor) || valor <= 0 || valor > 500000) return null;
  const base = new Date(Date.UTC(1997, 9, 7));
  const dueDate = new Date(base.getTime() + fator * 24 * 60 * 60 * 1000);
  const dd = String(dueDate.getUTCDate()).padStart(2, '0');
  const mm = String(dueDate.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = String(dueDate.getUTCFullYear());
  return { vencimento: `${dd}/${mm}/${yyyy}`, valor: Number.isFinite(valor) ? valor : 0 };
};

export const shouldRejectSupplierName = (name: string) => {
  const value = String(name || '').trim().toUpperCase();
  if (!value || value.length < 4) return true;
  if (value.includes('DATA DO DOCUMENTO') || value.includes('VENCIMENTO') || value.includes('NOSSO NUMERO')) return true;
  if (value.includes('AGENCIA') || value.includes('CÓDIGO') || value.includes('CODIGO') || value.includes('BENEFICI')) return true;
  if (value.includes('LOCAL DE PAGAMENTO') || value.includes('PAGAVEL') || value.includes('INSTRUCOES')) return true;
  if (value.includes('ESPECIE') || value.includes('CARTEIRA') || value.includes('USO DO BANCO')) return true;
  if (value.includes('AVENIDA') || value.includes(' AV ') || value.includes('AV.') || value.includes('RUA') || value.includes('CEP')) return true;
  const onlyNumericLike = value.replace(/[^0-9]/g, '').length >= Math.max(8, value.length - 2);
  if (onlyNumericLike) return true;
  if ((value.match(/[A-Z]/g) || []).length < 3) return true;
  return false;
};

export const looksLikePersonName = (value: string) => {
  const s = String(value || '').trim();
  if (!s) return false;
  if (/\d/.test(s)) return false;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.length > 6) return false;
  const upper = s.toUpperCase();
  const corporateTokens = [
    ' LTDA', 'LTDA ', ' EIRELI', ' S/A', ' SA ', 'MEI', ' EPP', ' ME ',
    ' CIA', 'COMPANHIA', 'COOPERATIVA', 'ASSOCIACAO', 'FUNDAÇÃO', 'FUNDACAO',
    'INSTITUTO', 'UNIVERSIDADE', 'FACULDADE', 'COLEGIO', 'ESCOLA',
    'HOSPITAL', 'CLINICA', 'BANCO', 'PREFEITURA', 'SECRETARIA',
  ];
  if (corporateTokens.some((t) => upper.includes(t))) return false;
  return true;
};

export const supplierFromFileName = (fileName: string): string => {
  let name = String(fileName || '').replace(/\.pdf$/i, '');
  name = name.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  name = name.replace(/^\d{10,}\s*/i, '').trim();
  name = name.replace(/^\d{6,}\s*/i, '').trim();
  name = name.replace(/^(?:BOLETO|BOL|MAT|MATRICULA|PAGAMENTO|PAGAR)\b[\s\-_:]*/i, '').trim();
  while (/^(BOL|BOLETO|MAT)\b/i.test(name)) {
    name = name.replace(/^(BOL|BOLETO|MAT)\b[\s\-_:]*/i, '').trim();
  }
  name = name.replace(/^\d{6,}\s*/i, '').trim();
  name = name.replace(/[\s\-_:]*(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)$/i, '').trim();
  return name;
};

export const resolveSupplierName = (detectedName: string, sourceText: string, suppliers: Supplier[]) => {
  const cleanDetected = String(detectedName || '').trim();
  const validDetected = shouldRejectSupplierName(cleanDetected) ? '' : cleanDetected;
  const normalizedDetected = normalizeSupplierName(validDetected);
  const normalizedSource = normalizeSupplierName(sourceText);

  if (validDetected && normalizedDetected) {
    const exact = suppliers.find((s) => normalizeSupplierName(s.nome) === normalizedDetected);
    if (exact) return exact.nome;
  }

  if (normalizedDetected.includes('ENERGISA') || normalizedSource.includes('ENERGISA')) {
    const energisaMatch = suppliers
      .map((s) => ({ supplier: s, key: normalizeSupplierName(s.nome) }))
      .filter((x) => x.key.includes('ENERGISA'))
      .sort((a, b) => b.key.length - a.key.length)[0];
    if (energisaMatch) return energisaMatch.supplier.nome;
    return 'ENERGISA';
  }

  if (normalizedDetected.includes('SANESUL') || normalizedSource.includes('SANESUL')) {
    const sanesulMatch = suppliers
      .map((s) => ({ supplier: s, key: normalizeSupplierName(s.nome) }))
      .filter((x) => x.key.includes('SANESUL'))
      .sort((a, b) => b.key.length - a.key.length)[0];
    if (sanesulMatch) return sanesulMatch.supplier.nome;
    return 'SANESUL';
  }

  if (normalizedDetected.includes('INVIO') || normalizedSource.includes('INVIO')) {
    const invMatch = suppliers
      .map((s) => ({ supplier: s, key: normalizeSupplierName(s.nome) }))
      .filter((x) => x.key.includes('INVIO'))
      .sort((a, b) => b.key.length - a.key.length)[0];
    if (invMatch) return invMatch.supplier.nome;
    return validDetected || 'INVIOLAVEL';
  }

  if (validDetected) {
    const best = suppliers
      .map((s) => ({ supplier: s, key: normalizeSupplierName(s.nome) }))
      .filter((x) => x.key && (x.key.includes(normalizedDetected) || normalizedDetected.includes(x.key)))
      .sort((a, b) => b.key.length - a.key.length)[0];
    if (best && normalizedDetected.length >= 6) return best.supplier.nome;
  }

  if ((normalizedDetected === 'EDITORA' || !validDetected) && normalizedSource.includes('EDITORA')) {
    const editoraCandidates = suppliers
      .map((s) => ({ supplier: s, key: normalizeSupplierName(s.nome) }))
      .filter((x) => x.key.includes('EDITORA'))
      .sort((a, b) => b.key.length - a.key.length);
    if (editoraCandidates.length === 1) return editoraCandidates[0].supplier.nome;
  }

  if (!validDetected || validDetected === 'Fornecedor não identificado') {
    const byText = suppliers
      .map((s) => ({ supplier: s, key: normalizeSupplierName(s.nome) }))
      .filter((x) => x.key.length >= 5 && normalizedSource.includes(x.key))
      .sort((a, b) => b.key.length - a.key.length)[0];
    if (byText) return byText.supplier.nome;
  }

  return validDetected || 'Fornecedor não identificado';
};

export const extractBoletoData = (text: string, fileName: string, suppliers: Supplier[]): PdfImportDraft => {
  const normalizedText = text.toUpperCase().replace(/\s+/g, ' ');
  const normalizedTextKey = normalizeSupplierName(normalizedText);
  const sanitizeBoletoValor = (v: number) => (Number.isFinite(v) && v > 0 && v <= 500000 ? v : 0);
  
  const hasPorto = /PORTO\s*SEGURO/i.test(normalizedText);
  const hasBradesco = /BRADESCO/i.test(normalizedText) && /SEGUROS/i.test(normalizedText);
  const hasEnergisa = /ENERGISA/i.test(normalizedText);
  const hasSanesul = /SANESUL/i.test(normalizedText);

  if (hasPorto || hasBradesco || hasEnergisa || hasSanesul) {
    let detectedName = 'Fornecedor não identificado';
    if (hasPorto) detectedName = 'PORTO SEGURO';
    else if (hasBradesco) detectedName = 'BRADESCO SEGUROS';
    else if (hasEnergisa) detectedName = 'ENERGISA';
    else if (hasSanesul) detectedName = 'SANESUL';
    
    let localVenc = '';
    const vencMatch = normalizedText.match(/(?:VENCIMENTO|VENCE|PAGAR\s*AT[EÉ])[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
    if (vencMatch) {
      localVenc = vencMatch[1];
    } else {
      const allDates = normalizedText.match(/(\d{2}\/\d{2}\/\d{4})/g);
      if (allDates && allDates.length > 0) {
        localVenc = allDates[allDates.length - 1];
      }
    }

    let localValor = 0;
    const valorMatch = normalizedText.match(/(?:TOTAL|PAGAR|VALOR|COBRADO)[:\s]*R?\$?[:\s]*([\d.,]+)/i);
    if (valorMatch) {
      localValor = parseMoneyToNumber(valorMatch[1]);
    }

    return {
      fileName,
      fornecedor: detectedName,
      vencimento: localVenc, 
      valor: sanitizeBoletoValor(localValor),
      descricao: `${detectedName} - Importado Automático`,
      empresa: '',
      cnpj: '',
      numero_boleto: extractLocalBoletoNumber(normalizedText),
      tipo: 'DESPESA',
      rawText: text.slice(0, 500),
      duplicate: false,
    };
  }

  let fornecedor = 'Fornecedor não identificado';
  let vencimento = '';
  let valor = 0;

  const fornecedorPatterns = [
    /BENEFICI[AÁ]RIO[:\s]+([\w\u00C0-\u017E\s.&/-]+?)(?:\s+CNPJ|\s+CPF|\d{2}\/\d{2}\/\d{4})/i,
    /CEDENTE[:\s]+([\w\u00C0-\u017E\s.&/-]+?)(?:\s+CNPJ|\s+CPF|\d{2}\/\d{2}\/\d{4})/i,
    /VENDEDOR[:\s]+([\w\u00C0-\u017E\s.&/-]+?)(?:\s+CNPJ|\s+CPF)/i,
    /EMISSOR[:\s]+([\w\u00C0-\u017E\s.&/-]+?)(?:\s+CNPJ|\s+CPF)/i,
    /RAZ[AÃ]O SOCIAL[:\s]+([\w\u00C0-\u017E\s.&/-]+?)(?:\s+CNPJ|\s+CPF)/i,
    /([\w\u00C0-\u017E][\w\u00C0-\u017E\s.&/,-]{5,60})\s+\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2}/i,
  ];

  for (const pattern of fornecedorPatterns) {
    const match = normalizedText.match(pattern);
    if (match?.[1]) {
      const candidate = match[1].trim().replace(/\s+/g, ' ');
      if (!shouldRejectSupplierName(candidate)) { fornecedor = candidate; break; }
    }
  }

  const bestSupplier = suppliers
    .map((s) => {
      const normS = normalizeSupplierName(s.nome);
      if (!normS || normS.length < 3) return { supplier: s, score: 0 };
      const hasMatch = normalizedTextKey.includes(normS);
      let score = hasMatch ? normS.length : 0;
      if (hasMatch && (normS === 'CLARO' || normS === 'ENERGISA')) score += 1000;
      return { supplier: s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  if (bestSupplier) {
    if (
      fornecedor === 'Fornecedor não identificado' ||
      shouldRejectSupplierName(fornecedor) ||
      looksLikePersonName(fornecedor)
    ) {
      fornecedor = bestSupplier.supplier.nome;
    }
  }

  const lowerRaw = normalizedText.toLowerCase();
  if (lowerRaw.includes('porto seguro')) {
    fornecedor = 'PORTO SEGURO';
  } else if (lowerRaw.includes('bradesco') && lowerRaw.includes('seguros')) {
    fornecedor = 'BRADESCO SEGUROS';
  }

  if (fornecedor === 'Fornecedor não identificado') {
    const fromFile = supplierFromFileName(fileName);
    if (fromFile && !looksLikePersonName(fromFile) && !shouldRejectSupplierName(fromFile)) {
      fornecedor = fromFile;
    }
  }

  const datePatterns = [
    /VENCIMENTO[:\s]+(\d{2}\/\d{2}\/\d{4})/,
    /DATA DE VENCIMENTO[:\s]+(\d{2}\/\d{2}\/\d{4})/,
    /(\d{2}\/\d{2}\/\d{4})[\s\n]+R\$/i,
    /R\$[\s\n]*[\d.,]+[\s\n]+(\d{2}\/\d{2}\/\d{4})/i,
    /\b(\d{2}\/\d{2}\/\d{4})\b/,
  ];
  for (const pattern of datePatterns) {
    const match = normalizedText.match(pattern);
    if (match?.[1]) {
      if (fornecedor.includes('ENERGISA') && match[1] === '07/05/2026') continue;
      vencimento = match[1];
      break;
    }
  }

  const linhaInfo = parseLinhaDigitavel(normalizedText);
  if (linhaInfo) {
    if (!vencimento) vencimento = linhaInfo.vencimento;
    if (linhaInfo.valor > 0) {
      valor = sanitizeBoletoValor(linhaInfo.valor);
    }
  }

  if (!valor) {
    const textWithoutFees = normalizedText
      .replace(/(?:MORA|MULTA|JUROS|\bPOR\s+DIA\b)[^\n]{0,80}/gi, '')
      .replace(/(?:TAXA|ENCARGO)[^\n]{0,60}/gi, '');

    const valuePatterns = [
      { re: /VALOR\s+(?:DO\s+)?DOCUMENTO[:\s]+R?\$?\s*([\d.,]+)/, src: normalizedText },
      { re: /VALOR\s+COBRADO[:\s]+R?\$?\s*([\d.,]+)/, src: normalizedText },
      { re: /VALOR\s+TOTAL[:\s]+R?\$?\s*([\d.,]+)/, src: normalizedText },
      { re: /VLR\s+PAGAR[:\s]+R?\$?\s*([\d.,]+)/, src: normalizedText },
      { re: /VALOR\s+([\d]{1,3}(?:[.,][\d]{3})*[.,][\d]{2})\s*\(=\)\s*VALOR\s+DO\s+DOCUMENTO/i, src: normalizedText },
      { re: /\(=\)\s*VALOR\s+DO\s+DOCUMENTO\s+([\d.,]+)/i, src: normalizedText },
      { re: /R\$\s*([\d]{1,3}(?:[.,][\d]{3})*[.,][\d]{2})/, src: textWithoutFees },
    ];

    const parseBrValue = (raw: string): number => {
      const s = raw.trim();
      if (/^\d{1,3}(\.\d{3})+(,\d{2})$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
      if (/^\d{1,3}(,\d{3})+(\.\d{2})$/.test(s)) return Number(s.replace(/,/g, ''));
      if (/^\d+\.\d{1,2}$/.test(s)) return Number(s);
      if (/^\d+,\d{1,2}$/.test(s)) return Number(s.replace(',', '.'));
      return Number(s.replace(/[^0-9.]/g, ''));
    };

    for (const { re, src } of valuePatterns) {
      const match = src.match(re);
      if (match?.[1]) {
        const parsed = parseBrValue(match[1]);
        if (!Number.isNaN(parsed) && parsed > 0) { valor = sanitizeBoletoValor(parsed); break; }
      }
    }

    if (!valor) {
      const allBrValues = [...textWithoutFees.matchAll(/(?<![,\d])(\d{1,3}(?:\.\d{3})*,\d{2})(?![,\d])/g)]
        .map(m => m[1])
        .filter(v => { const n = Number(v.replace(/\./g, '').replace(',', '.')); return n > 5; });
      const freq = new Map<string, number>();
      allBrValues.forEach(v => freq.set(v, (freq.get(v) || 0) + 1));
      const repeated = [...freq.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]);
      if (repeated.length) {
        const best = repeated[0][0];
        const parsed = Number(best.replace(/\./g, '').replace(',', '.'));
        if (!Number.isNaN(parsed) && parsed > 0) valor = sanitizeBoletoValor(parsed);
      }
    }
  }

  if (normalizedText.includes('SANESUL')) {
    const m = normalizedText.match(/VENCIMENTO\s+(\d{2}\/\d{2}\/\d{4})/);
    if (m?.[1]) vencimento = m[1];

    if (!valor) {
      const m2 = normalizedText.match(/TOTAL\s+A\s+PAGAR[^0-9]{0,180}(\d{1,3}(?:\.\d{3})*,\d{2})/);
      if (m2?.[1]) {
        const parsed = Number(m2[1].replace(/\./g, '').replace(',', '.'));
        if (Number.isFinite(parsed) && parsed > 0) valor = sanitizeBoletoValor(parsed);
      }
    }

    if (fornecedor === 'Fornecedor não identificado' || shouldRejectSupplierName(fornecedor)) {
      const sanesulMatch = suppliers
        .map((s) => ({ supplier: s, key: normalizeSupplierName(s.nome) }))
        .filter((x) => x.key.includes('SANESUL'))
        .sort((a, b) => b.key.length - a.key.length)[0];
      fornecedor = sanesulMatch ? sanesulMatch.supplier.nome : 'SANESUL';
    }
  }

  if (normalizedText.includes('ENERGISA')) {
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const textForEnergisa = normalizedText.replace(/PRÓXIMA\s+LEITURA\s+PREVISTA\s+PARA\s+\d{2}\/\d{2}\/\d{4}/gi, '');

    if (valor > 0) {
      const valorBr = valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const m = textForEnergisa.match(new RegExp(`(\\d{2}\\/\\d{2}\\/\\d{4})\\s+R\\$\\s*${escapeRegExp(valorBr)}`));
      if (m?.[1]) vencimento = m[1];
    }
    if (!vencimento) {
      const m = textForEnergisa.match(/(\d{2}\/\d{2}\/\d{4})\s+R\$\s*[\d.,]+\s+(?:JANEIRO|FEVEREIRO|MARÇO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s*\/\s*\d{4}/);
      if (m?.[1]) vencimento = m[1];
    }
  }

  const numeroBoleto = extractLocalBoletoNumber(normalizedText);

  const pagadorMatch = normalizedText.match(/PAGADOR\s+([\w\u00C0-\u017E\s.'-]{5,80})(?=\s+\d{3}\.|\s+CPF|\s+CNPJ|\s+\d{2,3}\.\d{3})/i);
  const sacadoMatch = normalizedText.match(/SACADO\s+([\w\u00C0-\u017E\s.'-]{5,80})(?=\s+\d{3}\.|\s+CPF|\s+CNPJ|\s+\d{2,3}\.\d{3})/i);
  const pagadorNome = ((pagadorMatch?.[1] || sacadoMatch?.[1] || '')).trim().replace(/\s+/g, ' ');

  return {
    fileName,
    fornecedor,
    vencimento,
    valor: sanitizeBoletoValor(valor),
    descricao: pagadorNome || supplierFromFileName(fileName) || fileName.replace(/\.pdf$/i, '').trim(),
    empresa: '',
    cnpj: '',
    numero_boleto: numeroBoleto,
    tipo: 'DESPESA',
    rawText: text.slice(0, 500),
    duplicate: false,
  };
};
