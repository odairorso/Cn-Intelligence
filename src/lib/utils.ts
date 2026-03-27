import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ContaContabil } from '../types';

// ─── Tailwind merge helper ────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Converte qualquer formato de data para YYYY-MM-DD (input[type=date]) */
export const toInputDate = (value?: string | null): string => {
  if (!value) return '';
  const v = String(value).trim();
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

// ─── Supplier name normalization ──────────────────────────────────────────────

const normalizeCache = new Map<string, string>();

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

  if (normalizeCache.size > 10000) normalizeCache.clear();
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

const matchCache = new Map<string, boolean>();

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

  if (matchCache.size > 50000) matchCache.clear();
  matchCache.set(cacheKey, result);
  return result;
};

// ─── Transaction type helpers ─────────────────────────────────────────────────

export const isRevenueTransaction = (tx: { fornecedor?: string; descricao?: string; tipo?: string }): boolean => {
  if (tx.tipo === 'RECEITA') return true;
  if (tx.tipo === 'DESPESA') return false;
  const descricao = normalizeSupplierName(tx.descricao ?? '');
  return (
    descricao.includes('REPASSE') ||
    descricao.includes('MENSALIDADE') ||
    descricao.includes('EDUCBANK') ||
    descricao.includes('KROTON') ||
    descricao.includes('REDE FEMENINA')
  );
};

export const matchesAccountType = (acc: ContaContabil, tipo: 'RECEITA' | 'DESPESA'): boolean => {
  const t = String(acc.tipo || '').toUpperCase();
  const desire = String(tipo || '').toUpperCase();
  if (desire === 'DESPESA') return ['DESPESA', 'DEBITO', 'DÉBITO'].includes(t);
  return ['RECEITA', 'CREDITO', 'CRÉDITO'].includes(t);
};

// ─── Currency formatter ───────────────────────────────────────────────────────
export const formatBRL = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
