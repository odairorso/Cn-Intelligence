import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api, apiAuth, decodeJwtPayload } from '../api';
import type { Transaction, Supplier, Bank, ContaContabil } from '../types';
import { DEFAULT_COMPANIES } from '../lib/constants';
import { normalizeCompanyKey } from '../lib/utils';

// ── Cache helpers (localStorage) ─────────────────────────────────────────────
const CACHE_PREFIX = 'cn_cache_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function getCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function setCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch { /* ignore */ }
}

function clearCache(key: string): void {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch { /* ignore */ }
}


const API_BASE = '/api';

// --------------------------------------------------------------
// Estado global da aplicação
// --------------------------------------------------------------
interface AppDataState {
  transactions: Transaction[];
  transactionPage: number;
  hasMoreTransactions: boolean;
  loadingTransactions: boolean;
  suppliers: Supplier[];
  banks: Bank[];
  contasContabeis: ContaContabil[];
  boletoPatterns: any[];
  globalStats: any;
  activeFilters: {
    year: string;
    month: string;
    search: string;
    tipo: string;
    empresa: string;
    status: string;
    conta_contabil_id: number | undefined;
  };
  isAuthorized: boolean;
  userEmail: string | null;
  displayName: string | null;
  balance: number;
  companyOptions: string[];
  notification: { message: string; type: 'success' | 'error' | 'info' } | null;
  isLoading: boolean;
  isLoadingMore: boolean;
}

interface AppDataProviderProps {
  children: React.ReactNode;
}

type AppDataActions = {
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  fetchTransactions: (append?: boolean, year?: string, month?: string, search?: string, tipo?: string, options?: any) => Promise<void>;
  addTransaction: (tx: Partial<Transaction>) => Promise<void>;
  updateTransaction: (id: string, data: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  loadMoreTransactions: () => Promise<void>;
  markAsPaid: (tx: Transaction, banco?: string) => Promise<void>;
  markAsPaidBatch: (ids: string[], banco?: string, dataPagamento?: string) => Promise<void>;
  importOFX: (ofxData: any[]) => Promise<void>;
  fixReceitasTipo: () => Promise<number>;
  dedupeMovimentos: () => Promise<number>;
  searchTransactions: (query: string) => Promise<void>;
  fetchSuppliers: (force?: boolean) => Promise<void>;
  addSupplier: (supplier: Omit<Supplier, 'id'>) => Promise<void>;
  updateSupplier: (id: string, data: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  mergeSuppliers: (target: string, aliases: string[]) => Promise<{ updated: number; removed: number }>;
  mergeSuppliersAuto: () => Promise<{ updated: number; removed: number }>;
  syncSuppliers: () => Promise<void>;
  fetchBanks: (force?: boolean) => Promise<void>;
  addBank: (bank: Omit<Bank, 'id'>) => Promise<void>;
  updateBank: (id: string, data: Partial<Bank>) => Promise<void>;
  deleteBank: (id: string) => Promise<void>;
  fetchContasContabeis: () => Promise<void>;
  fetchBoletoPatterns: (force?: boolean) => Promise<void>;
  saveBoletoPattern: (data: Record<string, any>) => Promise<void>;
  deleteBoletoPattern: (id: number) => Promise<void>;
  fetchStats: (year?: string, period?: string, empresa?: string, tipo?: string, status?: string, search?: string, startDate?: string, endDate?: string) => Promise<void>;
  setupTables: () => Promise<void>;
  exportBackup: () => Promise<void>;
  addCompanyOption: (name: string) => void;
  removeCompanyOption: (name: string) => void;
  updateCompanyOption: (oldName: string, newName: string) => void;
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  extractBoleto: (text?: string, fileName?: string) => Promise<void>;
  importBoletoOFX: (ofxData: any[]) => Promise<void>;
};

type AppDataContextValue = {
  state: AppDataState;
  actions: AppDataActions;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

// Contextos separados para subscriptions otimizadas
// - useDataContext: apenas dados (transactions, suppliers, etc.)
// - useUIContext: apenas UI (auth, loading, notificações, etc.)
const DataSubContext = createContext<Pick<AppDataState, 'transactions' | 'suppliers' | 'banks' | 'contasContabeis' | 'boletoPatterns' | 'globalStats' | 'loadingTransactions' | 'isLoadingMore' | 'hasMoreTransactions'> | null>(null);
const UISubContext = createContext<Pick<AppDataState, 'isAuthorized' | 'userEmail' | 'displayName' | 'companyOptions' | 'notification' | 'isLoading' | 'balance' | 'activeFilters'> | null>(null);

// Hooks otimizados: só re-renderizam quando o contexto específico muda
export const useDataContext = () => {
  const ctx = useContext(DataSubContext);
  if (!ctx) throw new Error('useDataContext must be used within AppDataProvider');
  return ctx;
};

export const useUIContext = () => {
  const ctx = useContext(UISubContext);
  if (!ctx) throw new Error('useUIContext must be used within AppDataProvider');
  return ctx;
};

// --------------------------------------------------------------
// Helper: obter UID do JWT (sem fallback para 'guest')
// --------------------------------------------------------------
const getAuthenticatedUid = (): string | null => {
  return apiAuth.getUid();
};

export const AppDataProvider = ({ children }: AppDataProviderProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionPage, setTransactionPage] = useState(0);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [contasContabeis, setContasContabeis] = useState<ContaContabil[]>([]);
  const [boletoPatterns, setBoletoPatterns] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [activeFilters, setActiveFilters] = useState({
    year: 'TODOS',
    month: 'TODOS',
    search: '',
    tipo: 'TODOS',
    empresa: 'TODOS',
    status: 'TODOS',
    conta_contabil_id: undefined as number | undefined,
  });
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [companyOptions, setCompanyOptions] = useState<string[]>(() => {
    try {
      const keys = ['cn_company_options', 'cn_companyOptions', 'companyOptions', 'cn_companies'];
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      return DEFAULT_COMPANIES;
    } catch {
      return DEFAULT_COMPANIES;
    }
  });
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const companiesRef = useRef<string[]>(companyOptions);
  const abortControllerRef = useRef<AbortController | null>(null);
  const transactionPageRef = useRef(0);

  companiesRef.current = companyOptions;

  // --------------------------------------------------------------
  // Persistência
  // --------------------------------------------------------------
  const saveCompanies = (list: string[]) => {
    companiesRef.current = list;
    setCompanyOptions(list);
    try { localStorage.setItem('cn_company_options', JSON.stringify(list)); } catch { /* ignore */ }
  };

  const loadCompanies = () => {
    try {
      const keys = ['cn_company_options', 'cn_companyOptions', 'companyOptions', 'cn_companies'];
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCompanyOptions(parsed);
          companiesRef.current = parsed;
          return;
        }
      }
    } catch { /* ignore */ }
  };

  // --------------------------------------------------------------
  // Verificar autenticação no mount
  // --------------------------------------------------------------
  useEffect(() => {
    loadCompanies();
    if (apiAuth.isAuthenticated()) {
      setIsAuthorized(true);
      const uid = getAuthenticatedUid();
      if (uid) {
        try {
          const token = apiAuth.getToken();
          if (token) {
            const payload = decodeJwtPayload(token);
            if (payload) {
              setUserEmail(payload.email || null);
              setDisplayName(payload.display_name || payload.email || null);
            }
          }
        } catch { /* ignore */ }
      }
    }
  }, []);

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const addCompanyOption = useCallback((name: string) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    const key = normalizeCompanyKey(trimmed);
    const existing = companiesRef.current || [];
    if (existing.some((c) => normalizeCompanyKey(c) === key)) return;
    saveCompanies([...existing, trimmed]);
  }, []);

  const removeCompanyOption = useCallback((name: string) => {
    const key = normalizeCompanyKey(name);
    const existing = companiesRef.current || [];
    saveCompanies(existing.filter((c) => normalizeCompanyKey(c) !== key));
  }, []);

  const updateCompanyOption = useCallback((oldName: string, newName: string) => {
    const fromKey = normalizeCompanyKey(oldName);
    const to = String(newName || '').trim();
    if (!to) return;
    const toKey = normalizeCompanyKey(to);
    const existing = companiesRef.current || [];
    const idx = existing.findIndex((c) => normalizeCompanyKey(c) === fromKey);
    if (idx === -1) return;
    if (existing.some((c, i) => i !== idx && normalizeCompanyKey(c) === toKey)) return;
    const next = existing.slice();
    next[idx] = to;
    saveCompanies(next);
  }, []);

  // --------------------------------------------------------------
  // Auth actions
  // --------------------------------------------------------------
  const login = useCallback(async (password: string) => {
    try {
      const data = await apiAuth.login(password);
      if (data.token) {
        setIsAuthorized(true);
        try {
          const uid = getAuthenticatedUid();
          if (uid) {
            const token = apiAuth.getToken();
            if (token) {
              const payload = decodeJwtPayload(token);
              if (payload) {
                setUserEmail(payload.email || null);
                setDisplayName(payload.display_name || payload.email || null);
              }
            }
          }
        } catch { /* ignore */ }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    apiAuth.logout();
    setIsAuthorized(false);
    setUserEmail(null);
    setDisplayName(null);
    setTransactions([]);
    setSuppliers([]);
    setBanks([]);
    setContasContabeis([]);
    setGlobalStats(null);
    setTransactionPage(0);
    setHasMoreTransactions(true);
    setNotification(null);
  }, []);

  // --------------------------------------------------------------
  // Fetch Transactions
  // --------------------------------------------------------------
  const fetchTransactions = useCallback(async (append = false, year?: string, month?: string, search?: string, tipo?: string, options?: any) => {
    if (!apiAuth.isAuthenticated()) {
      showNotification('Faça login para acessar os dados.', 'error');
      return;
    }
    try {
      setLoadingTransactions(true);
      const limit = options?.limit || 100;
      const offset = append ? transactionPageRef.current * limit : 0;
      const data = await api.getTransactions(
        limit,
        offset,
        year,
        month,
        search,
        tipo,
        options?.empresa,
        options?.status,
        options?.conta_contabil_id,
        options?.startDate,
        options?.endDate
      );
      const list = Array.isArray(data) ? data : [];
      if (append) {
        setTransactions((prev) => [...prev, ...list]);
        transactionPageRef.current += 1;
        setTransactionPage(transactionPageRef.current);
      } else {
        setTransactions(list);
        transactionPageRef.current = 1;
        setTransactionPage(1);
      }
      setHasMoreTransactions(list.length >= limit);
    } catch (err: any) {
      if (err.message?.includes('Autenticação')) {
        setIsAuthorized(false);
        showNotification('Sessão expirada. Faça login novamente.', 'error');
      } else {
        showNotification(err.message || 'Erro ao carregar transações.', 'error');
      }
    } finally {
      setLoadingTransactions(false);
    }
  }, [showNotification]);

  const loadMoreTransactions = useCallback(async () => {
    if (loadingTransactions || !hasMoreTransactions) return;
    setIsLoadingMore(true);
    try {
      await fetchTransactions(true);
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchTransactions, loadingTransactions, hasMoreTransactions]);



  // --------------------------------------------------------------
  // Mark as Paid
  // --------------------------------------------------------------
  const markAsPaid = useCallback(async (id: string, banco?: string, pagamento?: string) => {
    const today = new Date().toISOString().split('T')[0];
    const dataPagamento = pagamento || today;
    const updated = await api.updateTransaction(id, {
      status: 'PAGO',
      banco: banco,
      pagamento: dataPagamento,
    });
    setTransactions((prev) => prev.map((t) => (String(t.id) === String(id) ? { ...t, ...updated } : t)));
    showNotification('Marcado como pago!', 'success');
  }, [showNotification]);

  const markAsPaidBatch = useCallback(async (ids: string[], banco?: string, dataPagamento?: string) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const today = new Date().toISOString().split('T')[0];
    const dataPag = dataPagamento || today;
    await api.updateTransactionsBatch(ids.map(String), banco || '', dataPag);
    
    setTransactions((prev) => prev.map((t) => {
      if (ids.map(String).includes(String(t.id))) {
        return { ...t, status: 'PAGO', banco: banco || t.banco, pagamento: dataPag };
      }
      return t;
    }));
    showNotification(`${ids.length} lançamento(s) marcados como pagos!`, 'success');
  }, [showNotification]);

  // --------------------------------------------------------------
  // Fix Receitas Tipo
  // --------------------------------------------------------------
  const fixReceitasTipo = useCallback(async () => {
    if (!apiAuth.isAuthenticated()) return 0;
    try {
      const res = await fetchWithSecurity(`${API_BASE}?route=fix-receitas-tipo`, { method: 'POST' });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.updated || 0;
    } catch {
      return 0;
    }
  }, []);

  const dedupeMovimentos = useCallback(async () => {
    if (!apiAuth.isAuthenticated()) return 0;
    try {
      const res = await fetchWithSecurity(`${API_BASE}?route=transactions-dedupe-movimentos`, { method: 'DELETE' });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.count || 0;
    } catch {
      return 0;
    }
  }, []);

  // --------------------------------------------------------------
  // Search Transactions
  // --------------------------------------------------------------
  const searchTransactions = useCallback(async (query: string) => {
    await fetchTransactions(false, undefined, undefined, query);
  }, [fetchTransactions]);

  // --------------------------------------------------------------
  // Fetch Suppliers
  // --------------------------------------------------------------
  const fetchSuppliers = useCallback(async (force = false) => {
    if (!apiAuth.isAuthenticated()) return;
    try {
      const cacheKey = `suppliers_${apiAuth.getUid()}`;
      if (!force) {
        const cached = getCache<Supplier[]>(cacheKey);
        if (cached) {
          setSuppliers(cached);
          return;
        }
      }
      const data = await api.getSuppliers(force);
      const list = Array.isArray(data) ? data : [];
      setSuppliers(list);
      setCache(cacheKey, list);
    } catch (err: any) {
      if (err.message?.includes('Autenticação')) setIsAuthorized(false);
      else showNotification(err.message || 'Erro ao carregar fornecedores.', 'error');
    }
  }, [showNotification]);

  const addSupplier = useCallback(async (supplier: Omit<Supplier, 'id'>) => {
    await api.createSupplier(supplier);
    clearCache(`suppliers_${apiAuth.getUid()}`);
    await fetchSuppliers(true);
    showNotification('Fornecedor criado!', 'success');
  }, [fetchSuppliers, showNotification]);

  const updateSupplier = useCallback(async (id: string, data: Partial<Supplier>) => {
    await api.updateSupplier(id, data);
    clearCache(`suppliers_${apiAuth.getUid()}`);
    await fetchSuppliers(true);
    showNotification('Fornecedor atualizado!', 'success');
  }, [fetchSuppliers, showNotification]);

  const deleteSupplier = useCallback(async (id: string) => {
    await api.deleteSupplier(id);
    clearCache(`suppliers_${apiAuth.getUid()}`);
    await fetchSuppliers(true);
    showNotification('Fornecedor excluído!', 'success');
  }, [fetchSuppliers, showNotification]);

  const mergeSuppliers = useCallback(async (target: string, aliases: string[]) => {
    const result = await api.mergeSuppliers(target, aliases);
    clearCache(`suppliers_${apiAuth.getUid()}`);
    await fetchSuppliers(true);
    showNotification('Fornecedores mesclados!', 'success');
    return result;
  }, [fetchSuppliers, showNotification]);

  const mergeSuppliersAuto = useCallback(async () => {
    const result = await api.mergeSuppliersAuto();
    clearCache(`suppliers_${apiAuth.getUid()}`);
    await fetchSuppliers(true);
    showNotification('Merge automático concluído!', 'success');
    return result;
  }, [fetchSuppliers, showNotification]);

  const syncSuppliers = useCallback(async () => {
    clearCache(`suppliers_${apiAuth.getUid()}`);
    await fetchSuppliers(true);
    await fetchTransactions();
  }, [fetchSuppliers, fetchTransactions]);

  // --------------------------------------------------------------
  // Add/Update/Delete Transaction (with Suppliers Cache Sync)
  // --------------------------------------------------------------
  const addTransaction = useCallback(async (tx: Partial<Transaction>) => {
    const data = await api.createTransaction(tx as any);
    setTransactions((prev) => [data, ...prev]);
    clearCache(`suppliers_${apiAuth.getUid()}`);
    await fetchSuppliers(true);
    showNotification('Lançamento criado com sucesso!', 'success');
  }, [fetchSuppliers, showNotification]);

  const updateTransaction = useCallback(async (id: string, data: Partial<Transaction>) => {
    const updated = await api.updateTransaction(id, data);
    setTransactions((prev) => prev.map((t) => (String(t.id) === String(id) ? { ...t, ...updated } : t)));
    clearCache(`suppliers_${apiAuth.getUid()}`);
    await fetchSuppliers(true);
    showNotification('Lançamento atualizado!', 'success');
  }, [fetchSuppliers, showNotification]);

  const deleteTransaction = useCallback(async (id: string) => {
    await api.deleteTransaction(id);
    setTransactions((prev) => prev.filter((t) => String(t.id) !== id));
    clearCache(`suppliers_${apiAuth.getUid()}`);
    await fetchSuppliers(true);
    showNotification('Lançamento excluído!', 'success');
  }, [fetchSuppliers, showNotification]);

  // --------------------------------------------------------------
  // Fetch Banks
  // --------------------------------------------------------------
  const fetchBanks = useCallback(async (force = false) => {
    if (!apiAuth.isAuthenticated()) return;
    try {
      const cacheKey = `banks_${apiAuth.getUid()}`;
      if (!force) {
        const cached = getCache<Bank[]>(cacheKey);
        if (cached) {
          setBanks(cached);
          setBalance(cached.reduce((acc: number, b: Bank) => acc + (Number(b.saldo) || 0), 0));
          return;
        }
      }
      const data = await api.getBanks(force);
      const list = Array.isArray(data) ? data : [];
      setBanks(list);
      setBalance(list.reduce((acc, b) => acc + (Number(b.saldo) || 0), 0));
      setCache(cacheKey, list);
    } catch (err: any) {
      if (err.message?.includes('Autenticação')) setIsAuthorized(false);
      else showNotification(err.message || 'Erro ao carregar bancos.', 'error');
    }
  }, [showNotification]);

  const addBank = useCallback(async (bank: Omit<Bank, 'id'>) => {
    await api.createBank(bank);
    clearCache(`banks_${apiAuth.getUid()}`);
    await fetchBanks(true);
    showNotification('Banco criado!', 'success');
  }, [fetchBanks, showNotification]);

  const updateBank = useCallback(async (id: string, data: Partial<Bank>) => {
    await api.updateBank(id, data);
    clearCache(`banks_${apiAuth.getUid()}`);
    await fetchBanks(true);
    showNotification('Banco atualizado!', 'success');
  }, [fetchBanks, showNotification]);

  const deleteBank = useCallback(async (id: string) => {
    await api.deleteBank(id);
    clearCache(`banks_${apiAuth.getUid()}`);
    await fetchBanks(true);
    showNotification('Banco excluído!', 'success');
  }, [fetchBanks, showNotification]);

  // --------------------------------------------------------------
  // Fetch Contas Contábeis
  // --------------------------------------------------------------
  const fetchContasContabeis = useCallback(async () => {
    if (!apiAuth.isAuthenticated()) return;
    try {
      const data = await api.getContasContabeis();
      setContasContabeis(Array.isArray(data) ? data : []);
    } catch (err: any) {
      if (err.message?.includes('Autenticação')) setIsAuthorized(false);
      else showNotification(err.message || 'Erro ao carregar contas contábeis.', 'error');
    }
  }, [showNotification]);

  const fetchBoletoPatterns = useCallback(async (_force = false) => {
    if (!apiAuth.isAuthenticated()) return;
    try {
      const data = await api.getBoletoPatterns();
      setBoletoPatterns(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('[fetchBoletoPatterns]', err.message);
      setBoletoPatterns([]);
    }
  }, []);

  const saveBoletoPattern = useCallback(async (data: Record<string, any>) => {
    await api.saveBoletoPattern(data as any);
    await fetchBoletoPatterns(true);
  }, [fetchBoletoPatterns]);

  const deleteBoletoPattern = useCallback(async (id: number) => {
    await api.deleteBoletoPattern(id);
    await fetchBoletoPatterns(true);
  }, [fetchBoletoPatterns]);

  // --------------------------------------------------------------
  // Fetch Stats
  // --------------------------------------------------------------
  const fetchStats = useCallback(async (
    year?: string,
    period?: string,
    empresa?: string,
    tipo?: string,
    status?: string,
    search?: string,
    startDate?: string,
    endDate?: string
  ) => {
    if (!apiAuth.isAuthenticated()) return;
    try {
      const data = await api.getStats(year, period, empresa, tipo, status, search, startDate, endDate);
      setGlobalStats(data);
    } catch (err: any) {
      if (err.message?.includes('Autenticação')) setIsAuthorized(false);
      else console.error('Erro ao buscar stats:', err.message);
    }
  }, []);

  // --------------------------------------------------------------
  // Setup Tables / Export Backup
  // --------------------------------------------------------------
  const setupTables = useCallback(async () => {
    await api.setupTables();
    showNotification('Tabelas criadas com sucesso!', 'success');
  }, [showNotification]);

  const exportBackup = useCallback(async () => {
    const blob = await api.exportBackup();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-cn-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Backup exportado!', 'success');
  }, [showNotification]);

  // --------------------------------------------------------------
  // Boleto / OFX
  // --------------------------------------------------------------
  const extractBoleto = useCallback(async (text?: string, fileName?: string) => {
    const data = await api.extractBoleto(text, fileName);
    return data;
  }, []);
  const importOFX = useCallback(async (ofxData: any[]) => {
    if (!apiAuth.isAuthenticated()) {
      showNotification('Faça login para importar.', 'error');
      return;
    }
    if (!ofxData.length) return;
    try {
      const txList = ofxData.map((row) => ({
        uid: apiAuth.getUid() || 'guest',
        fornecedor: row.fornecedor,
        descricao: `${row.descricao} [OFX:${row.fitid}]`,
        empresa: row.empresa,
        vencimento: row.vencimento,
        pagamento: row.status === 'PAGO' ? row.vencimento : (null as any),
        valor: Math.abs(row.trnamt),
        status: row.status,
        banco: row.banco || (null as any),
        tipo: row.tipo,
      }));

      if (txList.length === 1) {
        await api.createTransaction(txList[0]);
      } else {
        await api.createTransactionsBatch(txList as any);
      }

      clearCache(`suppliers_${apiAuth.getUid()}`);
      await fetchSuppliers(true);
      await fetchTransactions();
      showNotification(`${txList.length} lançamento(s) importado(s) com sucesso!`, 'success');
    } catch (err: any) {
      console.error(err);
      const isDuplicate = err.message && (
        err.message.includes('Boleto já lançado') ||
        err.message.includes('Lançamento duplicado')
      );
      const msg = isDuplicate 
        ? 'Este boleto já foi lançado no sistema.'
        : 'Erro ao importar lançamentos. Tente novamente.';
      showNotification(msg, isDuplicate ? 'info' : 'error');
    }
  }, [fetchSuppliers, fetchTransactions, showNotification]);

  const importBoletoOFX = useCallback(async (ofxData: any[]) => {
    await importOFX(ofxData);
  }, [importOFX]);

  useEffect(() => {
    if (!isAuthorized) return;
    setIsLoading(true);
    Promise.all([
      fetchSuppliers(),
      fetchBanks(),
      fetchContasContabeis(),
      fetchBoletoPatterns(),
      fetchTransactions(),
      fetchStats(),
    ])
      .finally(() => setIsLoading(false));
  }, [isAuthorized, fetchBanks, fetchBoletoPatterns, fetchContasContabeis, fetchStats, fetchSuppliers, fetchTransactions]);

  // --------------------------------------------------------------
  // Provider - optimized with useMemo to prevent unnecessary re-renders
  // --------------------------------------------------------------
  const stateValue = useMemo(() => ({
    transactions, transactionPage, hasMoreTransactions,
    loadingTransactions, suppliers, banks, contasContabeis, boletoPatterns, globalStats,
    activeFilters, isAuthorized, userEmail, displayName, balance,
    companyOptions, notification, isLoading, isLoadingMore,
  }), [
    transactions, transactionPage, hasMoreTransactions,
    loadingTransactions, suppliers, banks, contasContabeis, boletoPatterns, globalStats,
    activeFilters, isAuthorized, userEmail, displayName, balance,
    companyOptions, notification, isLoading, isLoadingMore,
  ]);

  const actions = useMemo(() => ({
    login,
    logout,
    fetchTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    loadMoreTransactions,
    markAsPaid,
    markAsPaidBatch,
    importOFX,
    fixReceitasTipo,
    dedupeMovimentos,
    searchTransactions,
    fetchSuppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    mergeSuppliers,
    mergeSuppliersAuto,
    syncSuppliers,
    fetchBanks,
    addBank,
    updateBank,
    deleteBank,
    fetchContasContabeis,
    fetchBoletoPatterns,
    saveBoletoPattern,
    deleteBoletoPattern,
    fetchStats,
    setupTables,
    exportBackup,
    addCompanyOption,
    removeCompanyOption,
    updateCompanyOption,
    showNotification,
    extractBoleto,
    importBoletoOFX,
  }), [
    login, logout, fetchTransactions, addTransaction, updateTransaction,
    deleteTransaction, loadMoreTransactions, markAsPaid, markAsPaidBatch,
    importOFX, fixReceitasTipo, dedupeMovimentos, searchTransactions,
    fetchSuppliers, addSupplier, updateSupplier, deleteSupplier,
    mergeSuppliers, mergeSuppliersAuto, syncSuppliers,
    fetchBanks, addBank, updateBank, deleteBank,
    fetchContasContabeis, fetchBoletoPatterns, saveBoletoPattern,
    deleteBoletoPattern, fetchStats, setupTables, exportBackup,
    addCompanyOption, removeCompanyOption, updateCompanyOption,
    showNotification, extractBoleto, importBoletoOFX,
  ]);

  const contextValue = useMemo(() => ({ state: stateValue, actions }), [stateValue, actions]);

  // Sub-contexts for optimized subscriptions
  const dataSubValue = useMemo(() => ({
    transactions, suppliers, banks, contasContabeis, boletoPatterns, globalStats,
    loadingTransactions, isLoadingMore, hasMoreTransactions,
  }), [
    transactions, suppliers, banks, contasContabeis, boletoPatterns, globalStats,
    loadingTransactions, isLoadingMore, hasMoreTransactions,
  ]);

  const uiSubValue = useMemo(() => ({
    isAuthorized, userEmail, displayName, companyOptions, notification, isLoading,
    balance, activeFilters,
  }), [
    isAuthorized, userEmail, displayName, companyOptions, notification, isLoading,
    balance, activeFilters,
  ]);

  return (
    <AppDataContext.Provider value={contextValue}>
      <DataSubContext.Provider value={dataSubValue}>
        <UISubContext.Provider value={uiSubValue}>
          {children}
        </UISubContext.Provider>
      </DataSubContext.Provider>
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within an AppDataProvider');
  return { ...ctx.state, ...ctx.actions };
};

export const fetchWithSecurity = (url: string, options: RequestInit = {}) => {
  const token = apiAuth.getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>) || {},
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const securityToken = import.meta.env.VITE_CN_SECURITY_TOKEN;
  if (securityToken) headers['x-cn-security'] = securityToken;
  return fetch(url, { ...options, headers });
};
