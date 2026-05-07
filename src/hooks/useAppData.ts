import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { Transaction, Supplier, Bank, ContaContabil, TransactionStatus } from '../types';
import { toDisplayDate, dateSortKey, normalizeSupplierName } from '../lib/utils';
import { DEFAULT_COMPANIES, DEFAULT_ACCOUNTS } from '../lib/constants';

export type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
  message: string;
  type: NotificationType;
}

export interface GlobalStats {
  kpis: {
    total_receitas: number;
    total_despesas: number;
    count_pagos: number;
    count_pendentes: number;
    count_vencidos: number;
    total_count: number;
  };
  monthlyFlux: Array<{
    month_num: number;
    receitas: number;
    despesas: number;
  }>;
  topSuppliers: Array<{
    name: string;
    value: number;
  }>;
}

export function useAppData() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [contasContabeis, setContasContabeis] = useState<ContaContabil[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cn_authorized') === 'true';
    } catch {
      return false;
    }
  });
  const transactionsLengthRef = useRef(0);
  const [boletoPatterns, setBoletoPatterns] = useState<Array<{
    id: number;
    cnpj: string;
    nome_normalizado: string;
    fornecedor: string;
    descricao: string;
    empresa: string;
    tipo: string;
    confirmacoes: number;
  }>>([]);
  const [companyOptions, setCompanyOptions] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('cn_company_options');
      if (!raw) return DEFAULT_COMPANIES;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return DEFAULT_COMPANIES;
      const normalized = Array.from(new Set(
        parsed.map((item: unknown) => String(item || '').trim().toUpperCase()).filter(Boolean)
      ));
      return normalized.length ? normalized : DEFAULT_COMPANIES;
    } catch {
      return DEFAULT_COMPANIES;
    }
  });

  // ─── Notification ─────────────────────────────────────────────────────────
  const showNotification = useCallback((message: string, type: NotificationType = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const coerceMoney = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const raw = String(value ?? '').trim();
    if (!raw) return 0;
    const cleaned = raw.replace(/[^\d,.\-]/g, '');
    if (!cleaned) return 0;
    if (cleaned.includes(',') && cleaned.includes('.')) {
      const n = Number(cleaned.replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    }
    if (cleaned.includes(',')) {
      const n = Number(cleaned.replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    }
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  };

  // ─── Fetchers ─────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async (year?: string, period?: string, empresa?: string, tipo?: string, status?: string, search?: string) => {
    if (!isAuthorized) return;
    try {
      const stats = await api.getStats('guest', year, period, empresa, tipo, status, search);
      setGlobalStats(stats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [isAuthorized]);

  const fetchTransactions = useCallback(async (
    append = false,
    year?: string,
    month?: string,
    search?: string,
    tipo?: string,
    options?: { limit?: number; empresa?: string; status?: string; conta_contabil_id?: number }
  ) => {
    if (!isAuthorized) return;
    try {
      if (append) setIsLoadingMore(true);

      const normalizedYear = year && year !== 'TODOS' ? year : undefined;
      const normalizedMonth = month && month !== 'TODOS' ? month : undefined;
      const normalizedTipo = tipo && tipo !== 'TODOS' ? tipo : undefined;
      const normalizedEmpresa = options?.empresa && options.empresa !== 'TODOS' ? options.empresa : undefined;
      const normalizedStatus = options?.status && options.status !== 'TODOS' ? options.status : undefined;
      const normalizedContaContabilId = typeof options?.conta_contabil_id === 'number' ? options.conta_contabil_id : undefined;
      const limit =
        options?.limit ??
        (normalizedYear || normalizedMonth || search || normalizedTipo || normalizedEmpresa || normalizedStatus || normalizedContaContabilId ? 200 : 50);
      const offset = append ? transactionsLengthRef.current : 0;

      const data = await api.getTransactions(
        'guest',
        limit,
        offset,
        normalizedYear,
        normalizedMonth,
        search,
        normalizedTipo,
        normalizedEmpresa,
        normalizedStatus,
        normalizedContaContabilId
      );
      const normalized = data.map((tx) => {
        const raw = tx as any;
        return {
          ...tx,
          valor: coerceMoney(raw.valor),
          juros: coerceMoney(raw.juros),
          vencimento: toDisplayDate(tx.vencimento),
          pagamento: tx.pagamento ? toDisplayDate(tx.pagamento) : undefined,
        } as Transaction;
      });

      if (append) {
        setTransactions(prev => {
          const next = [
            ...prev,
            ...normalized
          ].sort((a, b) => dateSortKey(b.vencimento) - dateSortKey(a.vencimento));
          transactionsLengthRef.current = next.length;
          return next;
        });
      } else {
        transactionsLengthRef.current = normalized.length;
        setTransactions(
          normalized.sort((a, b) => dateSortKey(b.vencimento) - dateSortKey(a.vencimento))
        );
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      if (append) setIsLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  const fetchSuppliers = useCallback(async (fresh = false) => {
    if (!isAuthorized) return;
    try {
      const data = await api.getSuppliers('guest', fresh);
      setSuppliers(data);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  }, [isAuthorized]);

  const fetchBanks = useCallback(async () => {
    if (!isAuthorized) return;
    try {
      const data = await api.getBanks('guest');
      setBanks(data);
    } catch (error) {
      console.error('Failed to fetch banks:', error);
    }
  }, [isAuthorized]);

  const fetchContasContabeis = useCallback(async () => {
    if (!isAuthorized) return;
    try {
      let data = await api.getContasContabeis();
      if (!Array.isArray(data) || data.length === 0) {
        // Removido setupTables automático aqui para economizar banda.
        // Se as contas não carregarem, o sistema usa o padrão local.
      }
      if (Array.isArray(data) && data.length > 0) {
        setContasContabeis(data);
      } else {
        setContasContabeis(DEFAULT_ACCOUNTS);
        showNotification('Usando plano de contas padrão local (API indisponível).', 'info');
      }
    } catch (error) {
      console.error('Failed to fetch contas contabeis:', error);
      setContasContabeis(DEFAULT_ACCOUNTS);
      showNotification('API indisponível. Carregamos plano de contas padrão local.', 'info');
    }
  }, [showNotification, isAuthorized]);

  const fetchBoletoPatterns = useCallback(async () => {
    if (!isAuthorized) return;
    try {
      const data = await api.getBoletoPatterns();
      setBoletoPatterns(data);
    } catch (error) {
      console.error('Failed to fetch boleto patterns:', error);
    }
  }, [isAuthorized]);

  const deleteBoletoPattern = useCallback(async (id: number) => {
    try {
      await api.deleteBoletoPattern(id);
      showNotification('Padrão de boleto excluído.', 'info');
      fetchBoletoPatterns();
    } catch (error) {
      console.error('Failed to delete boleto pattern:', error);
      showNotification('Erro ao excluir padrão.', 'error');
    }
  }, [showNotification, fetchBoletoPatterns]);

  // ─── Initial load — em paralelo (executa apenas quando autorizado) ───
  useEffect(() => {
    if (!isAuthorized) {
      setIsLoading(false); // Se não autorizado, para o loading inicial para mostrar tela de login
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
          let timeoutId: number | undefined;
          const timeout = new Promise<never>((_, reject) => {
            timeoutId = window.setTimeout(() => reject(new Error('TIMEOUT')), ms);
          });
          try {
            return await Promise.race([promise, timeout]);
          } finally {
            if (timeoutId !== undefined) window.clearTimeout(timeoutId);
          }
        };

        await Promise.all([
          withTimeout(fetchTransactions(), 20000),
          withTimeout(fetchStats(), 20000),
        ]);

        fetchSuppliers().catch(() => {});
        fetchBanks().catch(() => {});
        fetchContasContabeis().catch(() => {});
        fetchBoletoPatterns().catch(() => {});
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e || '');
        if (msg === 'TIMEOUT') {
          showNotification('A API está demorando para responder. Verifique sua internet e tente novamente.', 'error');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    /* 
    setupTables movido para execução manual ou via script para economizar banda no Pooler.
    */
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]); // Executa quando isAuthorized muda para true

  // ─── Auto-merge suppliers (max 1x a cada 6h) ─────────────────────────────
  /*
  useEffect(() => {
    if (!suppliers.length) return;
    const key = 'cn_auto_merge_suppliers_last';
    try {
      const last = Number(localStorage.getItem(key) || 0);
      if (Date.now() - last < 6 * 60 * 60 * 1000) return;
    } catch { // ignore // }
    let cancelled = false;
    (async () => {
      try {
        await api.mergeSuppliersAuto();
        if (cancelled) return;
        await fetchSuppliers();
        if (cancelled) return;
        // Não chama fetchTransactions aqui para evitar loop de reinicialização
        localStorage.setItem(key, String(Date.now()));
      } catch (e) {
        console.error('Auto-merge suppliers failed:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [suppliers.length, fetchSuppliers]);
  */

  // ─── Persist company options ──────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem('cn_company_options', JSON.stringify(companyOptions));
    } catch { /* ignore */ }
  }, [companyOptions]);

  // ─── Transaction actions ──────────────────────────────────────────────────
  const markAsPaid = useCallback(async (id: string, banco: string, dataPagamento?: string) => {
    // dataPagamento vem do modal como YYYY-MM-DD
    const displayDate = dataPagamento ? toDisplayDate(dataPagamento) : '';

    setTransactions(prev =>
      prev.map(tx => tx.id === id ? { ...tx, status: 'PAGO' as TransactionStatus, pagamento: displayDate, banco } : tx)
    );
    showNotification('Lançamento marcado como pago!', 'success');
    
    // Enviamos a data original (YYYY-MM-DD) para a API
    api.updateTransaction(id, { status: 'PAGO', pagamento: dataPagamento, banco }).then(() => {
      fetchStats();
    }).catch(err => {
      console.error('Failed to mark as paid:', err);
      fetchTransactions();
    });
  }, [showNotification, fetchTransactions, fetchStats]);

  const markAsPaidBatch = useCallback(async (ids: string[], banco: string, dataPagamento?: string) => {
    // dataPagamento vem do modal como YYYY-MM-DD
    const displayDate = dataPagamento ? toDisplayDate(dataPagamento) : '';

    setTransactions(prev =>
      prev.map(tx => ids.includes(tx.id) ? { ...tx, status: 'PAGO' as TransactionStatus, pagamento: displayDate, banco } : tx)
    );
    showNotification(`${ids.length} lançamento(s) marcado(s) como pago!`, 'success');
    
    const payload = { status: 'PAGO' as TransactionStatus, pagamento: dataPagamento, banco };
    const chunkSize = 25;
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize));

    let failed = 0;
    try {
      for (const chunk of chunks) {
        const results = await Promise.allSettled(chunk.map(id => api.updateTransaction(id, payload)));
        failed += results.filter(r => r.status === 'rejected').length;
      }

      if (failed > 0) {
        showNotification(`Falha ao registrar ${failed} de ${ids.length} pagamentos.`, 'error');
        fetchTransactions();
        return;
      }

      fetchStats();
      fetchTransactions();
    } catch (err) {
      console.error('Failed to mark batch as paid:', err);
      fetchTransactions();
    }
  }, [showNotification, fetchTransactions, fetchStats]);

  const updateTransaction = useCallback(async (updatedTx: Transaction) => {
    const { id, ...data } = updatedTx;
    if (!id) return;
    try {
      const saved = await api.updateTransaction(id, data);
      const normalizedSaved = {
        ...saved,
        vencimento: toDisplayDate(saved.vencimento),
        pagamento: saved.pagamento ? toDisplayDate(saved.pagamento) : undefined,
      } as Transaction;
      setTransactions(prev =>
        prev
          .map(tx => tx.id === id ? { ...tx, ...normalizedSaved } as Transaction : tx)
          .sort((a, b) => dateSortKey(b.vencimento) - dateSortKey(a.vencimento))
      );
      showNotification('Lançamento atualizado!', 'success');
      fetchStats();
    } catch (err) {
      console.error('Failed to update transaction:', err);
      showNotification('Erro ao atualizar lançamento.', 'error');
      fetchTransactions();
    }
  }, [showNotification, fetchTransactions, fetchStats]);

  const deleteTransaction = useCallback(async (id: string) => {
    setTransactions(prev => prev.filter(tx => tx.id !== id));
    showNotification('Lançamento excluído.', 'info');
    api.deleteTransaction(id).then(() => {
      fetchStats();
    }).catch(err => {
      console.error('Failed to delete transaction:', err);
      fetchTransactions();
    });
  }, [showNotification, fetchTransactions, fetchStats]);

  // ─── Supplier actions ─────────────────────────────────────────────────────
  const deleteSupplier = useCallback(async (id: string) => {
    try {
      await api.deleteSupplier(id);
      showNotification('Fornecedor excluído.', 'info');
      fetchSuppliers();
    } catch (error) {
      console.error('Failed to delete supplier:', error);
    }
  }, [showNotification, fetchSuppliers]);

  const updateSupplier = useCallback(async (id: string, data: Partial<Supplier>) => {
    const prev = suppliers.find((s) => s.id === id);
    try {
      const updated = await api.updateSupplier(id, data);
      setSuppliers((list) => list.map((s) => (s.id === id ? updated : s)));

      const prevName = String(prev?.nome || '').trim();
      const nextName = String(updated?.nome || '').trim();
      if (prevName && nextName && prevName !== nextName) {
        const prevKey = normalizeSupplierName(prevName);
        setTransactions((list) =>
          list.map((tx) => {
            const txKey = normalizeSupplierName(tx.fornecedor);
            if (!txKey || txKey !== prevKey) return tx;
            return { ...tx, fornecedor: nextName };
          })
        );
      }

      showNotification('Fornecedor atualizado!', 'success');
      return updated;
    } catch (error) {
      console.error('Failed to update supplier:', error);
      showNotification('Erro ao atualizar fornecedor.', 'error');
      throw error;
    }
  }, [showNotification, suppliers]);

  const syncSuppliers = useCallback(async () => {
    const transactionSuppliers = new Set<string>(transactions.map(tx => tx.fornecedor));
    const existingNames = new Set<string>(suppliers.map(s => s.nome));

    // Coletar todos os fornecedores novos primeiro
    const newSuppliers = Array.from(transactionSuppliers)
      .filter(nome => !existingNames.has(nome) && nome !== 'Desconhecido')
      .map(nome => ({
        uid: 'guest',
        nome,
        email: '',
        telefone: '',
        cnpj: ''
      }));

    if (newSuppliers.length > 0) {
      // Enviar todos de uma vez (batch) ao invés de um por um
      try {
        await api.createSuppliersBatch(newSuppliers as any);
        showNotification(`${newSuppliers.length} novos fornecedores sincronizados!`, 'success');
        fetchSuppliers();
      } catch (error) {
        console.error('Failed to sync suppliers batch:', error);
        showNotification('Erro ao sincronizar fornecedores.', 'error');
      }
    } else {
      showNotification('Todos os fornecedores já estão cadastrados.', 'info');
    }
  }, [transactions, suppliers, showNotification, fetchSuppliers]);

  // ─── Bank actions ─────────────────────────────────────────────────────────
  const deleteBank = useCallback(async (id: string) => {
    try {
      await api.deleteBank(id);
      showNotification('Banco excluído.', 'info');
      fetchBanks();
    } catch (error) {
      console.error('Failed to delete bank:', error);
    }
  }, [showNotification, fetchBanks]);

  // ─── Company options ──────────────────────────────────────────────────────
  const normalizeCompanyName = (name: string) => String(name || '').trim().toUpperCase();

  const addCompanyOption = useCallback((name: string) => {
    const normalized = normalizeCompanyName(name);
    if (!normalized) { showNotification('Informe um nome de empresa válido.', 'error'); return; }
    if (companyOptions.includes(normalized)) { showNotification('Essa empresa já existe.', 'info'); return; }
    setCompanyOptions(prev => [...prev, normalized]);
    showNotification(`Empresa ${normalized} adicionada.`, 'success');
  }, [companyOptions, showNotification]);

  const removeCompanyOption = useCallback((name: string) => {
    const normalized = normalizeCompanyName(name);
    const next = companyOptions.filter(item => item !== normalized);
    if (!next.length) { showNotification('Mantenha pelo menos uma empresa na lista.', 'error'); return; }
    setCompanyOptions(next);
    showNotification(`Empresa ${normalized} removida.`, 'info');
  }, [companyOptions, showNotification]);

  const updateCompanyOption = useCallback((original: string, newName: string) => {
    const normalized = normalizeCompanyName(newName);
    if (!normalized) { showNotification('Informe um nome de empresa válido.', 'error'); return false; }
    if (normalized !== original && companyOptions.includes(normalized)) {
      showNotification('Já existe uma empresa com esse nome.', 'error'); return false;
    }
    setCompanyOptions(prev => prev.map(item => item === original ? normalized : item));
    showNotification('Empresa atualizada com sucesso.', 'success');
    return true;
  }, [companyOptions, showNotification]);

  const login = useCallback((password: string) => {
    // Senha simples para bloquear bots. Você pode mudar aqui.
    if (password === 'CN2024') {
      setIsAuthorized(true);
      localStorage.setItem('cn_authorized', 'true');
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setIsAuthorized(false);
    localStorage.removeItem('cn_authorized');
  }, []);

  return {
    // State
    transactions, globalStats, suppliers, banks, contasContabeis, companyOptions, notification, isLoading, isLoadingMore, boletoPatterns, isAuthorized,
    // Fetchers
    fetchTransactions, fetchSuppliers, fetchBanks, fetchContasContabeis, fetchBoletoPatterns, fetchStats,
    // Actions
    showNotification, login, logout,
    markAsPaid, markAsPaidBatch, updateTransaction, deleteTransaction,
    deleteSupplier, syncSuppliers,
    updateSupplier,
    deleteBank,
    addCompanyOption, removeCompanyOption, updateCompanyOption,
    setCompanyOptions,
    deleteBoletoPattern,
  };
}
