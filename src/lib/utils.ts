import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ContaContabil } from '../types';

// ─── Tailwind merge helper ────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export const todayInputDate = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const parseMoneyToNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  const cleaned = raw.replace(/[R$\s]/g, '');
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  const hasComma = lastComma !== -1;
  const hasDot = lastDot !== -1;

  if (hasComma && hasDot) {
    const decimalIsComma = lastComma > lastDot;
    const decimalSep = decimalIsComma ? ',' : '.';
    const thousandSep = decimalIsComma ? '.' : ',';
    const withoutThousands = cleaned.split(thousandSep).join('');
    const normalized = withoutThousands.split(decimalSep).join('.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  if (hasComma) {
    const normalized = cleaned.split('.').join('').split(',').join('.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  if (hasDot) {
    const parts = cleaned.split('.');
    if (parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2) {
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    }
    const normalized = parts.join('');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

/** Converte qualquer formato de data para YYYY-MM-DD (input[type=date]) */
export const toInputDate = (value?: string | null): string => {
  if (!value) return '';
  const v = String(value).trim();
  if (v.match(/^\d{8}$/)) {
    const dd = v.slice(0, 2);
    const mm = v.slice(2, 4);
    const yyyy = v.slice(4, 8);
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  if (v.match(/^\d{6}$/)) {
    const dd = v.slice(0, 2);
    const mm = v.slice(2, 4);
    const yyyy = '20' + v.slice(4, 6);
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  if (v.includes('/')) {
    const [dd, mm, yyyy] = v.split('/');
    if (dd && mm && yyyy) return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  if (v.match(/^\d{4}-\d{2}-\d{2}/)) return v.slice(0, 10);
  if (v.includes('T')) return v.slice(0, 10);
  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) {
    const yyyy = parsed.getUTCFullYear();
    const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
};

/** Converte qualquer formato de data para DD/MM/YYYY (exibição) */
export const toDisplayDate = (value?: string | null): string => {
  if (!value) return '';
  const v = String(value).trim();
  if (v.includes('/')) return v;
  if (v.match(/^\d{4}-\d{2}-\d{2}/)) {
    const [yyyy, mm, dd] = v.slice(0, 10).split('-');
    return `${dd}/${mm}/${yyyy}`;
  }
  if (v.includes('T')) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }
  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  return v;
};

/** Retorna timestamp numérico para ordenação de datas */
export const dateSortKey = (value?: string | null): number => {
  if (!value) return 0;
  const v = String(value).trim();
  if (v.includes('/')) {
    const [dd, mm, yyyy] = v.split('/');
    return new Date(`${yyyy}-${mm}-${dd}`).getTime();
  }
  return new Date(v).getTime() || 0;
};

// ─── LRU Cache ────────────────────────────────────────────────────────────────

class LRUCache<K, V> {
  private max: number;
  private map: Map<K, V>;
  private keysOrder: K[];

  constructor(max: number) {
    this.max = max;
    this.map = new Map();
    this.keysOrder = [];
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    this.touch(key);
    return this.map.get(key);
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.touch(key);
    } else {
      this.keysOrder.push(key);
      if (this.keysOrder.length > this.max) {
        const oldest = this.keysOrder.shift()!;
        this.map.delete(oldest);
      }
    }
    this.map.set(key, value);
  }

  private touch(key: K): void {
    const idx = this.keysOrder.indexOf(key);
    if (idx !== -1) {
      this.keysOrder.splice(idx, 1);
      this.keysOrder.push(key);
    }
  }
}

// ─── Supplier name normalization ──────────────────────────────────────────────

const normalizeCache = new LRUCache<string, string>(2000);

export const normalizeSupplierName = (value: string): string => {
  const cacheKey = String(value || '');
  if (normalizeCache.has(cacheKey)) return normalizeCache.get(cacheKey)!;

  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  normalizeCache.set(cacheKey, normalized);
  return normalized;
};

export const normalizeCompanyKey = (value: string): string => {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || 'GERAL';
};

// ─── Supplier matching ────────────────────────────────────────────────────────

const matchCache = new LRUCache<string, boolean>(5000);

export const isSupplierMatch = (transactionSupplier: string, supplierName: string): boolean => {
  const cacheKey = `${transactionSupplier}|${supplierName}`;
  if (matchCache.has(cacheKey)) return matchCache.get(cacheKey)!;

  const tx = normalizeSupplierName(transactionSupplier);
  const sp = normalizeSupplierName(supplierName);

  let result = false;
  if (!tx || !sp) {
    result = false;
  } else if (tx === sp) {
    result = true;
  } else if (tx.length >= 5 && sp.length >= 5) {
    result = tx.substring(0, 5) === sp.substring(0, 5);
  }

  matchCache.set(cacheKey, result);
  return result;
};

// ─── Transaction type helpers ─────────────────────────────────────────────────

export const isRevenueTransaction = (tx: { fornecedor?: string; descricao?: string; tipo?: string; valor?: number }): boolean => {
  // Se o valor for negativo, é sempre uma despesa (saída/estorno)
  if (typeof tx.valor === 'number' && tx.valor < 0) return false;

  const tipo = String(tx.tipo || '').toUpperCase();
  if (tipo === 'RECEITA') return true;
  if (tipo === 'DESPESA') return false;

  const desc = normalizeSupplierName(tx.descricao ?? '');
  const forn = normalizeSupplierName(tx.fornecedor ?? '');

  // Palavras-chave que indicam RECEITA de forma inequívoca
  const revenueKeywords = [
    'MENSALIDADE', 
    'REPASSE', 
    'RECEBIMENTO', 
    'EDUCBANK', 
    'KROTON', 
    'REDE FEMENINA', 
    'PIX RECEBIDO', 
    'TRANSFERENCIA RECEBIDA',
    'APLICACAO FINANCEIRA'
  ];
  
  // Palavras-chave que indicam DESPESA (ex: impostos que contém "RECEITA" no nome)
  const expenseKeywords = [
    'RECEITA FEDERAL',
    'SIMPLES NACIONAL',
    'DARF',
    'GPS',
    'FGTS',
    'PAGAMENTO',
    'COMPRA',
    'SERVICO',
    'FORNECEDOR'
  ];

  // Se o fornecedor ou descrição contém palavras de despesa, é despesa
  if (expenseKeywords.some(k => desc.includes(k) || forn.includes(k))) return false;

  // Se contém palavras de receita, é receita
  return revenueKeywords.some(k => desc.includes(k) || forn.includes(k));
};

export const matchesAccountType = (acc: ContaContabil, tipo: 'RECEITA' | 'DESPESA'): boolean => {
  const t = String(acc.tipo || '').toUpperCase();
  const desire = String(tipo || '').toUpperCase();
  if (desire === 'DESPESA') return ['DESPESA', 'DEBITO', 'DÉBITO'].includes(t);
  return ['RECEITA', 'CREDITO', 'CRÉDITO'].includes(t);
};

// ─── Currency formatter ───────────────────────────────────────────────────────
export const formatBRL = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
