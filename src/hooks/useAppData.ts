import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { Transaction, Supplier, Bank, ContaContabil, TransactionStatus } from '../types';
import { toDisplayDate, dateSortKey } from '../lib/utils';
import { DEFAULT_COMPANIES, DEFAULT_ACCOUNTS } from '../lib/constants';

export type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
  message: string;
  type: NotificationType;
}

export function useAppData() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [contasContabeis, setContasContabeis] = useState<ContaContabil[]>([]);
  const [notification, setNotification] = useState<Notification | null>(null);
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

  // ─── Fetchers ─────────────────────────────────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    try {
      const data = await api.getTransactions('guest');
      const normalized = data.map((tx) => ({
        ...tx,
        vencimento: toDisplayDate(tx.vencimento),
        pagamento: tx.pagamento ? toDisplayDate(tx.pagamento) : undefined,
      }));
      setTransactions(
        normalized.sort((a, b) => dateSortKey(b.vencimento) - dateSortKey(a.vencimento))
      );
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  }, []);

  const fetchSuppliers = useCallback(async () => {
    try {
      const data = await api.getSuppliers('guest');
      setSuppliers(data);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  }, []);

  const fetchBanks = useCallback(async () => {
    try {
      const data = await api.getBanks('guest');
      setBanks(data);
    } catch (error) {
      console.error('Failed to fetch banks:', error);
    }
  }, []);

  const fetchContasContabeis = useCallback(async () => {
    try {
      let data = await api.getContasContabeis();
      if (!Array.isArray(data) || data.length === 0) {
        try {
          await api.setupTables();
          data = await api.getContasContabeis();
        } catch { /* ignore */ }
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
  }, [showNotification]);

  // ─── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    api.setupTables().catch(console.error).finally(() => {
      fetchTransactions();
      fetchSuppliers();
      fetchBanks();
      fetchContasContabeis();
    });
  }, [fetchTransactions, fetchSuppliers, fetchBanks, fetchContasContabeis]);

  // ─── Auto-merge suppliers (max 1x a cada 6h) ─────────────────────────────
  useEffect(() => {
    if (!suppliers.length) return;
    const key = 'cn_auto_merge_suppliers_last';
    try {
      const last = Number(localStorage.getItem(key) || 0);
      if (Date.now() - last < 6 * 60 * 60 * 1000) return;
    } catch { /* ignore */ }
    (async () => {
      try {
        await api.mergeSuppliersAuto();
        await fetchSuppliers();
        await fetchTransactions();
        localStorage.setItem(key, String(Date.now()));
      } catch (e) {
        console.error('Auto-merge suppliers failed:', e);
      }
    })();
  }, [suppliers.length, fetchSuppliers, fetchTransactions]);

  // ─── Persist company options ──────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem('cn_company_options', JSON.stringify(companyOptions));
    } catch { /* ignore */ }
  }, [companyOptions]);

  // ─── Transaction actions ──────────────────────────────────────────────────
  const markAsPaid = useCallback(async (id: string, banco: string) => {
    const today = new Date().toLocaleDateString('pt-BR');
    setTransactions(prev =>
      prev.map(tx => tx.id === id ? { ...tx, status: 'PAGO' as TransactionStatus, pagamento: today, banco } : tx)
    );
    showNotification('Lançamento marcado como pago!', 'success');
    api.updateTransaction(id, { status: 'PAGO', pagamento: today, banco }).catch(err => {
      console.error('Failed to mark as paid:', err);
      fetchTransactions();
    });
  }, [showNotification, fetchTransactions]);

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
    } catch (err) {
      console.error('Failed to update transaction:', err);
      showNotification('Erro ao atualizar lançamento.', 'error');
      fetchTransactions();
    }
  }, [showNotification, fetchTransactions]);

  const deleteTransaction = useCallback(async (id: string) => {
    setTransactions(prev => prev.filter(tx => tx.id !== id));
    showNotification('Lançamento excluído.', 'info');
    api.deleteTransaction(id).catch(err => {
      console.error('Failed to delete transaction:', err);
      fetchTransactions();
    });
  }, [showNotification, fetchTransactions]);

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

  const syncSuppliers = useCallback(async () => {
    const transactionSuppliers = new Set<string>(transactions.map(tx => tx.fornecedor));
    const existingNames = new Set<string>(suppliers.map(s => s.nome));
    let count = 0;
    for (const nome of transactionSuppliers) {
      if (!existingNames.has(nome) && nome !== 'Desconhecido') {
        await api.createSupplier({ uid: 'guest', nome, email: '', telefone: '', cnpj: '' });
        count++;
      }
    }
    if (count > 0) {
      showNotification(`${count} novos fornecedores sincronizados!`, 'success');
      fetchSuppliers();
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

  return {
    // State
    transactions, suppliers, banks, contasContabeis, companyOptions, notification,
    // Fetchers
    fetchTransactions, fetchSuppliers, fetchBanks, fetchContasContabeis,
    // Actions
    showNotification,
    markAsPaid, updateTransaction, deleteTransaction,
    deleteSupplier, syncSuppliers,
    deleteBank,
    addCompanyOption, removeCompanyOption, updateCompanyOption,
    setCompanyOptions,
  };
}
