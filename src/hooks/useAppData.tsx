import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, apiAuth } from '../api';
import type { Transaction, Supplier, Bank, ContaContabil } from '../types';

// --------------------------------------------------------------
// Estado global da aplicação
// --------------------------------------------------------------
interface AppDataState {
  transactions: Transaction[];
  allTransactions: Transaction[];
  transactionPage: number;
  hasMoreTransactions: boolean;
  loadingTransactions: boolean;
  suppliers: Supplier[];
  banks: Bank[];
  contasContabeis: ContaContabil[];
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
}

interface AppDataProviderProps {
  children: React.ReactNode;
}

const AppDataContext = createContext<{
  state: AppDataState;
  actions: {
    login: (password: string) => Promise<boolean>;
    logout: () => void;
    fetchTransactions: (append?: boolean, year?: string, month?: string, search?: string, tipo?: string, options?: any) => Promise<void>;
    addTransaction: (tx: Partial<Transaction>) => Promise<void>;
    updateTransaction: (id: string, data: Partial<Transaction>) => Promise<void>;
    deleteTransaction: (id: string) => Promise<void>;
    loadMoreTransactions: () => Promise<void>;
    markAsPaid: (tx: Transaction, banco?: string) => Promise<void>;
    markAsPaidBatch: (txs: Transaction[]) => Promise<void>;
    importOFX: (ofxData: any[]) => Promise<void>;
    fixReceitasTipo: () => Promise<number>;
    dedupeMovimentos: () => Promise<number>;
    searchTransactions: (query: string) => Promise<void>;
    fetchSuppliers: (force?: boolean) => Promise<void>;
    addSupplier: (sup: Partial<Supplier>) => Promise<void>;
    updateSupplier: (id: string, data: Partial<Supplier>) => Promise<void>;
    deleteSupplier: (id: string) => Promise<void>;
    mergeSuppliers: (target: string, aliases: string[]) => Promise<{ updated: number; removed: number }>;
    mergeSuppliersAuto: () => Promise<{ updated: number; removed: number }>;
    syncSuppliers: () => Promise<void>;
    fetchBanks: (force?: boolean) => Promise<void>;
    addBank: (bank: Partial<Bank>) => Promise<void>;
    updateBank: (id: string, data: Partial<Bank>) => Promise<void>;
    deleteBank: (id: string) => Promise<void>;
    fetchContasContabeis: () => Promise<void>;
    fetchBoletoPatterns: (force?: boolean) => Promise<void>;
    saveBoletoPattern: (data: Record<string, any>) => Promise<void>;
    deleteBoletoPattern: (id: number) => Promise<void>;
    fetchStats: (year?: string, period?: string, empresa?: string, tipo?: string, status?: string) => Promise<void>;
    setupTables: () => Promise<void>;
  };
} | null>(null);

// --------------------------------------------------------------
// Provider
// --------------------------------------------------------------
export const AppDataProvider: React.FC<AppDataProviderProps> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [transactionPage, setTransactionPage] = useState(0);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [contasContabeis, setContasContabeis] = useState<ContaContabil[]>([]);
  const [boletoPatterns, setBoletoPatterns] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [activeFilters, setActiveFilters] = useState({
    year: 'TODOS',
    month: 'TODOS',
    search: '',
    tipo: 'TODOS',
    empresa: 'TODOS',
    status: 'TODOS',
    conta_contabil_id: undefined as number | undefined,
  });
  const fetchLock = useRef(false);

  // Verificar autenticação no mount
  useEffect(() => {
    if (apiAuth.isAuthenticated()) {
      setIsAuthorized(true);
      try {
        const uid = apiAuth.getUid();
        if (uid) {
          const payload = JSON.parse(atob((uid as string).split('.')[1]));
          setUserEmail(payload.email || null);
          setDisplayName(payload.display_name || payload.email || null);
        }
      } catch { /* ignore */ }
    }
  }, []);

  // Helper UID
  const getUid = (): string => apiAuth.getUid() || 'guest';

  // ────────────────────────────────────────────────────────────
  // Auth actions
  // ────────────────────────────────────────────────────────────
  const login = useCallback(async (password: string) => {
    try {
      const data = await apiAuth.login(password);
      if (data.token) {
        setIsAuthorized(true);
        try {
          const uid = apiAuth.getUid();
          if (uid) {
            const payload = JSON.parse(atob((uid as string).split('.')[1]));
            setUserEmail(payload.email || null);
            setDisplayName(payload.display_name || payload.email || null);
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
    setAllTransactions([]);
    setSuppliers([]);
    setBanks([]);
    setGlobalStats(null);
  }, []);

  // ────────────────────────────────────────────────────────────
  // Transactions
  // ────────────────────────────────────────────────────────────
  const fetchTransactions = useCallback(async (
    append = false,
    year?: string,
    month?: string,
    search?: string,
    tipo?: string,
    options?: { limit?: number; empresa?: string; status?: string; conta_contabil_id?: number }
  ) => {
    if (fetchLock.current) return;
    fetchLock.current = true;
    try {
      setLoadingTransactions(true);
      const limit = options?.limit || 100;
      const offset = append ? transactions.length : 0;
      const data = await api.getTransactions(
        limit, offset,
        year || activeFilters.year,
        month || activeFilters.month,
        search || activeFilters.search,
        tipo || activeFilters.tipo,
        options?.empresa || activeFilters.empresa,
        options?.status || activeFilters.status,
        options?.conta_contabil_id ?? activeFilters.conta_contabil_id
      );
      const newTxs = Array.isArray(data) ? data : [];
      if (append) {
        setTransactions((prev) => [...prev, ...newTxs]);
        setHasMoreTransactions(newTxs.length >= limit);
        setTransactionPage((prev) => prev + 1);
      } else {
        setTransactions(newTxs);
        setAllTransactions(newTxs);
        setTransactionPage(0);
        setHasMoreTransactions(newTxs.length >= limit);
      }
    } catch (err: any) {
      console.error('[fetchTransactions]', err.message);
      if (!append) setTransactions([]);
    } finally {
      setLoadingTransactions(false);
      fetchLock.current = false;
    }
  }, [transactions, activeFilters]);

  const loadMoreTransactions = useCallback(async () => {
    await fetchTransactions(true);
  }, [fetchTransactions]);

  const addTransaction = useCallback(async (tx: Partial<Transaction>) => {
    const data = await api.createTransaction({ ...tx, uid: getUid() } as any);
    setTransactions((prev) => [data, ...prev]);
    setAllTransactions((prev) => [data, ...prev]);
  }, []);

  const updateTransaction = useCallback(async (id: string, data: Partial<Transaction>) => {
    const updated = await api.updateTransaction(id, data as any);
    setTransactions((prev) => prev.map((tx) => (tx.id === id ? { ...tx, ...updated } : tx)));
    setAllTransactions((prev) => prev.map((tx) => (tx.id === id ? { ...tx, ...updated } : tx)));
  }, []);

  const deleteTransaction = useCallback(async (id: string) => {
    await api.deleteTransaction(id);
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
    setAllTransactions((prev) => prev.filter((tx) => tx.id !== id));
  }, []);

  const markAsPaid = useCallback(async (tx: Transaction, banco?: string) => {
    const hoje = new Date().toISOString().split('T')[0];
    const updated = await api.updateTransaction(tx.id as string, {
      status: 'PAGO',
      pagamento: hoje,
      banco: banco || tx.banco || 'Caixa',
    });
    setTransactions((prev) => prev.map((t) => (t.id === tx.id ? { ...t, ...updated } : t)));
    setAllTransactions((prev) => prev.map((t) => (t.id === tx.id ? { ...t, ...updated } : t)));
    if (banco) {
      setBanks((prev) => {
        const match = prev.find((b) => b.nome === banco);
        if (match) {
          return prev.map((b) => (b.nome === banco ? { ...b, saldo: Number(b.saldo) + Number(tx.valor) + Number(tx.juros || 0) } : b));
        }
        return prev;
      });
    }
  }, []);

  const markAsPaidBatch = useCallback(async (txs: Transaction[]) => {
    if (txs.length === 0) return;
    const banco = txs[0]?.banco || 'Caixa';
    const ids = txs.map((t) => t.id as string);
    await api.updateTransactionsBatch(ids, banco, new Date().toISOString().split('T')[0]);
    setTransactions((prev) =>
      prev.map((t) => (ids.includes(t.id as string) ? { ...t, status: 'PAGO', pagamento: new Date().toISOString().split('T')[0], banco } : t))
    );
    setAllTransactions((prev) =>
      prev.map((t) => (ids.includes(t.id as string) ? { ...t, status: 'PAGO', pagamento: new Date().toISOString().split('T')[0], banco } : t))
    );
  }, []);

  const importOFX = useCallback(async (ofxData: any[]) => {
    if (!ofxData || ofxData.length === 0) return;
    const novo = ofxData.filter((tx) => tx.novo);
    const batchData = novo.map((tx) => ({
      uid: getUid(),
      fornecedor: tx.fornecedor || tx.payee || 'Desconhecido',
      descricao: tx.descricao || tx.memo || '-',
      empresa: tx.empresa || 'Geral',
      vencimento: tx.vencimento || new Date().toISOString().split('T')[0],
      pagamento: tx.pagamento || undefined,
      valor: Number(tx.valor) || 0,
      tipo: tx.tipo || (Number(tx.valor) >= 0 ? 'RECEITA' : 'DESPESA'),
      status: tx.status || (tx.pagamento ? 'PAGO' : 'PENDENTE'),
      banco: tx.banco || 'Caixa',
      numero_boleto: tx.numero_boleto || tx.nosso_numero || undefined,
      conta_contabil_id: tx.conta_contabil_id || undefined,
    }));
    if (batchData.length === 0) return;
    try {
      await api.createTransactionsBatch(batchData);
    } catch (err: any) {
      console.error('[importOFX]', err.message);
    }
    await fetchTransactions();
  }, [fetchTransactions]);

  const fixReceitasTipo = useCallback(async () => {
    try {
      const res = await fetch('/api?route=fix-receitas-tipo', { method: 'POST' });
      const data = await res.json();
      return data.updated || 0;
    } catch {
      return 0;
    }
  }, []);

  const dedupeMovimentos = useCallback(async () => {
    try {
      const res = await fetch('/api?route=transactions-dedupe-movimentos', { method: 'DELETE' });
      const data = await res.json();
      return data.count || 0;
    } catch {
      return 0;
    }
  }, []);

  const searchTransactions = useCallback(async (query: string) => {
    await fetchTransactions(false, undefined, undefined, query);
  }, [fetchTransactions]);

  // ────────────────────────────────────────────────────────────
  // Fornecedores
  // ────────────────────────────────────────────────────────────
  const fetchSuppliers = useCallback(async (force = false) => {
    try {
      const data = await api.getSuppliers(force);
      setSuppliers(data);
    } catch (err: any) {
      console.error('[fetchSuppliers]', err.message);
    }
  }, []);

  const addSupplier = useCallback(async (sup: Partial<Supplier>) => {
    const data = await api.createSupplier(sup as any);
    setSuppliers((prev) => [...prev, data]);
  }, []);

  const updateSupplier = useCallback(async (id: string, data: Partial<Supplier>) => {
    const updated = await api.updateSupplier(id, data as any);
    setSuppliers((prev) => prev.map((s) => (s.id === Number(id) ? { ...s, ...updated } : s)));
  }, []);

  const deleteSupplier = useCallback(async (id: string) => {
    await api.deleteSupplier(id);
    setSuppliers((prev) => prev.filter((s) => String(s.id) !== id));
  }, []);

  const mergeSuppliers = useCallback(async (target: string, aliases: string[]) => {
    const result = await api.mergeSuppliers(target, aliases);
    await fetchSuppliers(true);
    return result;
  }, [fetchSuppliers]);

  const mergeSuppliersAuto = useCallback(async () => {
    const result = await api.mergeSuppliersAuto();
    await fetchSuppliers(true);
    return result;
  }, [fetchSuppliers]);

  const syncSuppliers = useCallback(async () => {
    await fetchSuppliers(true);
    await fetchTransactions();
  }, [fetchSuppliers, fetchTransactions]);

  // ────────────────────────────────────────────────────────────
  // Bancos
  // ────────────────────────────────────────────────────────────
  const fetchBanks = useCallback(async (force = false) => {
    try {
      const data = await api.getBanks(force);
      setBanks(data);
      if (data.length > 0) {
        setBalance(data.reduce((acc, b) => acc + (Number(b.saldo) || 0), 0));
      }
    } catch (err: any) {
      console.error('[fetchBanks]', err.message);
    }
  }, []);

  const addBank = useCallback(async (bank: Partial<Bank>) => {
    const data = await api.createBank(bank as any);
    setBanks((prev) => [...prev, data]);
  }, []);

  const updateBank = useCallback(async (id: string, data: Partial<Bank>) => {
    const updated = await api.updateBank(id, data as any);
    setBanks((prev) => prev.map((b) => (b.id === Number(id) ? { ...b, ...updated } : b)));
  }, []);

  const deleteBank = useCallback(async (id: string) => {
    await api.deleteBank(id);
    setBanks((prev) => prev.filter((b) => String(b.id) !== id));
  }, []);

  // ────────────────────────────────────────────────────────────
  // Contas contábeis
  // ────────────────────────────────────────────────────────────
  const fetchContasContabeis = useCallback(async () => {
    try {
      const data = await api.getContasContabeis();
      setContasContabeis(data);
    } catch (err: any) {
      console.error('[fetchContasContabeis]', err.message);
    }
  }, []);

  // ────────────────────────────────────────────────────────────
  // Boleto Patterns
  // ────────────────────────────────────────────────────────────
  const fetchBoletoPatterns = useCallback(async (force = false) => {
    try {
      const data = await api.getBoletoPatterns();
      setBoletoPatterns(data);
    } catch (err: any) {
      console.error('[fetchBoletoPatterns]', err.message);
    }
  }, []);

  const saveBoletoPattern = useCallback(async (data: { fornecedor: string; cnpj?: string; nome_beneficiario?: string; descricao?: string; empresa?: string; tipo?: string; conta_contabil_id?: number }) => {
    try {
      await api.saveBoletoPattern(data);
      await fetchBoletoPatterns(true);
    } catch (err: any) {
      console.error('[saveBoletoPattern]', err.message);
    }
  }, [fetchBoletoPatterns]);

  const deleteBoletoPattern = useCallback(async (id: number) => {
    try {
      await api.deleteBoletoPattern(id);
      await fetchBoletoPatterns(true);
    } catch (err: any) {
      console.error('[deleteBoletoPattern]', err.message);
    }
  }, [fetchBoletoPatterns]);

  // ────────────────────────────────────────────────────────────
  // Stats
  // ────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async (
    year?: string, period?: string, empresa?: string, tipo?: string, status?: string
  ) => {
    try {
      const data = await api.getStats(
        year || activeFilters.year, period,
        empresa || activeFilters.empresa,
        tipo || activeFilters.tipo,
        status || activeFilters.status,
        activeFilters.search
      );
      setGlobalStats(data);
    } catch (err: any) {
      console.error('[fetchStats]', err.message);
    }
  }, [activeFilters]);

  // ────────────────────────────────────────────────────────────
  // Setup
  // ────────────────────────────────────────────────────────────
  const setupTables = useCallback(async () => {
    try {
      await api.setupTables();
    } catch (err: any) {
      console.error('[setupTables]', err.message);
      throw err;
    }
  }, []);

  // ────────────────────────────────────────────────────────────
  // Carregamento inicial (auth-gated)
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) return;
    const load = async () => {
      await Promise.all([
        fetchSuppliers(),
        fetchBanks(),
        fetchContasContabeis(),
        fetchTransactions(),
        fetchStats(),
      ]);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  // ────────────────────────────────────────────────────────────
  // Context value
  // ────────────────────────────────────────────────────────────
  const contextValue = {
    state: {
      transactions, allTransactions, transactionPage, hasMoreTransactions,
      loadingTransactions, suppliers, banks, contasContabeis, boletoPatterns,
      globalStats, activeFilters, isAuthorized, userEmail, displayName, balance,
    },
    actions: {
      login, logout,
      fetchTransactions, addTransaction, updateTransaction, deleteTransaction,
      loadMoreTransactions, markAsPaid, markAsPaidBatch, importOFX,
      fixReceitasTipo, dedupeMovimentos, searchTransactions,
      fetchSuppliers, addSupplier, updateSupplier, deleteSupplier,
      mergeSuppliers, mergeSuppliersAuto, syncSuppliers,
      fetchBanks, addBank, updateBank, deleteBank,
      fetchContasContabeis,
      fetchBoletoPatterns, saveBoletoPattern, deleteBoletoPattern,
      fetchStats, setupTables,
    },
  };

  return (
    <AppDataContext.Provider value={contextValue}>
      {children}
    </AppDataContext.Provider>
  );
};

// ──────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────
export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return { ...context.state, ...context.actions };
};
