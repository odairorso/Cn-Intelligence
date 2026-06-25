import React, { useState, useRef, useEffect, useMemo, useDeferredValue } from 'react';
import {
  Search, ChevronLeft, ChevronRight, Check, Edit, Trash2, Plus, Loader2, RefreshCw,
} from 'lucide-react';
import type { Transaction } from '../types';
import {
  cn, toDisplayDate, dateSortKey, formatBRL, isRevenueTransaction,
} from '../lib/utils';
import { PAGE_SIZE } from '../lib/constants';

interface LancamentosTabProps {
  transactions: Transaction[];
  onMarkAsPaid: (tx: Transaction) => void;
  onMarkAsPaidBatch: (txs: Transaction[]) => void;
  deleteTransaction: (id: string) => void;
  setShowNewTxModal: (show: boolean) => void;
  setEditingTx: (tx: Transaction) => void;
  onLoadMore?: (append?: boolean, year?: string, month?: string, search?: string, status?: string) => void;
  isLoadingMore?: boolean;
  hasMoreTransactions?: boolean;
}

const LancamentosTab = React.memo(({
  transactions, onMarkAsPaid, onMarkAsPaidBatch, deleteTransaction, setShowNewTxModal, setEditingTx,
  onLoadMore, isLoadingMore, hasMoreTransactions
}: LancamentosTabProps) => {
  const [filter, setFilter] = useState(() => {
    try { return sessionStorage.getItem('cn_lancamentos_filter') || ''; } catch { return ''; }
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    try { return sessionStorage.getItem('cn_lancamentos_statusFilter') || 'TODOS'; } catch { return 'TODOS'; }
  });
  const [monthFilter, setMonthFilter] = useState(() => {
    try { return sessionStorage.getItem('cn_lancamentos_monthFilter') || 'TODOS'; } catch { return 'TODOS'; }
  });
  const [yearFilter, setYearFilter] = useState(() => {
    try { return sessionStorage.getItem('cn_lancamentos_yearFilter') || 'TODOS'; } catch { return 'TODOS'; }
  });
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>(() => {
    try { return (sessionStorage.getItem('cn_lancamentos_sortOrder') as 'desc' | 'asc') || 'desc'; } catch { return 'desc'; }
  });
  const [page, setPage] = useState(() => {
    try { return Number(sessionStorage.getItem('cn_lancamentos_page')) || 0; } catch { return 0; }
  });
  const [selectedMap, setSelectedMap] = useState<Map<string, Transaction>>(new Map());

  // Save states to sessionStorage on change
  useEffect(() => {
    try { sessionStorage.setItem('cn_lancamentos_filter', filter); } catch { /* ignore */ }
  }, [filter]);

  useEffect(() => {
    try { sessionStorage.setItem('cn_lancamentos_statusFilter', statusFilter); } catch { /* ignore */ }
  }, [statusFilter]);

  useEffect(() => {
    try { sessionStorage.setItem('cn_lancamentos_monthFilter', monthFilter); } catch { /* ignore */ }
  }, [monthFilter]);

  useEffect(() => {
    try { sessionStorage.setItem('cn_lancamentos_yearFilter', yearFilter); } catch { /* ignore */ }
  }, [yearFilter]);

  useEffect(() => {
    try { sessionStorage.setItem('cn_lancamentos_sortOrder', sortOrder); } catch { /* ignore */ }
  }, [sortOrder]);

  useEffect(() => {
    try { sessionStorage.setItem('cn_lancamentos_page', String(page)); } catch { /* ignore */ }
  }, [page]);

  // Deferred search: UI stays responsive while filtering heavy lists
  const deferredFilter = useDeferredValue(filter);
  const isFilterStale = filter !== deferredFilter;

  // Busca no servidor ao mudar filtros (debounce para o texto)
  // Usa ref para evitar busca no mount inicial se os filtros forem padrões
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      const hasActiveFilters = filter !== '' || statusFilter !== 'TODOS' || monthFilter !== 'TODOS' || yearFilter !== 'TODOS';
      if (!hasActiveFilters) {
        return;
      }
    }
    if (onLoadMore) {
      const timer = setTimeout(() => {
        onLoadMore(false, yearFilter, monthFilter, filter, statusFilter);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [filter, yearFilter, monthFilter, statusFilter]);

  // Extrair meses e anos únicos para os filtros
  const availableYears = useMemo(() => {
    const years = transactions.map(tx => {
      const dateParts = tx.vencimento.includes('-') ? tx.vencimento.split('-') : tx.vencimento.split('/');
      return tx.vencimento.includes('-') ? dateParts[0] : dateParts[2];
    }).filter(Boolean);
    const set = new Set<string>(years);
    const currentYear = new Date().getFullYear();
    for (let yr = currentYear; yr >= 2020; yr -= 1) {
      set.add(String(yr));
    }
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const availableMonths = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' }
  ];

  const filtered = useMemo(() => {
    const searchRaw = String(deferredFilter || '').trim();
    const removeAccents = (str: string) =>
      str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const searchNormalized = removeAccents(searchRaw);

    const parseMoneySearch = (input: string): number | null => {
      const raw = String(input || '').trim();
      if (!raw) return null;
      const cleaned = raw.replace(/[^\d,.\-]/g, '');
      if (!cleaned) return null;
      let n: number;
      if (cleaned.includes(',') && cleaned.includes('.')) {
        const lastComma = cleaned.lastIndexOf(',');
        const lastDot = cleaned.lastIndexOf('.');
        if (lastComma > lastDot) n = Number(cleaned.replace(/\./g, '').replace(',', '.'));
        else n = Number(cleaned.replace(/,/g, ''));
      } else if (cleaned.includes(',')) {
        n = Number(cleaned.replace(/\./g, '').replace(',', '.'));
      } else {
        n = Number(cleaned);
      }
      return Number.isFinite(n) ? n : null;
    };
    const moneySearch = parseMoneySearch(searchRaw);

    return transactions.filter(tx => {
      const matchesTextSearch = !searchNormalized ||
        removeAccents(tx.fornecedor || '').includes(searchNormalized) ||
        (tx.descricao && removeAccents(tx.descricao).includes(searchNormalized)) ||
        (tx.empresa && removeAccents(tx.empresa).includes(searchNormalized));

      const txValor = Number(tx.valor) || 0;
      const txJuros = Number(tx.juros || 0) || 0;
      const txTotal = txValor + txJuros;
      const matchesMoneySearch = moneySearch !== null && (
        Math.abs(txValor - moneySearch) < 0.01 ||
        Math.abs(txTotal - moneySearch) < 0.01
      );

      const matchesSearch = matchesTextSearch || matchesMoneySearch;
      const matchesStatus = statusFilter === 'TODOS' || tx.status === statusFilter;

      let matchesMonth = true;
      let matchesYear = true;

      if (monthFilter !== 'TODOS' || yearFilter !== 'TODOS') {
        const parts = tx.vencimento.split('/');
        if (parts.length === 3) {
          if (monthFilter !== 'TODOS') matchesMonth = parts[1] === monthFilter;
          if (yearFilter !== 'TODOS') matchesYear = parts[2] === yearFilter;
        }
      }

      return matchesSearch && matchesStatus && matchesMonth && matchesYear;
    }).sort((a, b) => {
      const keyA = dateSortKey(a.vencimento);
      const keyB = dateSortKey(b.vencimento);
      return sortOrder === 'desc' ? keyB - keyA : keyA - keyB;
    });
  }, [transactions, deferredFilter, statusFilter, monthFilter, yearFilter, sortOrder]);

  // Reset page when filters change, avoiding initial mount reset
  const isFirstPageResetRef = useRef(true);
  useEffect(() => {
    if (isFirstPageResetRef.current) {
      isFirstPageResetRef.current = false;
      return;
    }
    setPage(0);
  }, [deferredFilter, statusFilter, monthFilter, yearFilter, sortOrder]);
  // Preserve selection when filters change (do not clear)
  // The selection will automatically stay consistent with the filtered list.
  // If needed, we could prune IDs that are no longer in the filtered view elsewhere.
  // Clear selection only when transactions update (e.g. after batch pay)
  useEffect(() => {
    setSelectedMap(prev => {
      if (prev.size === 0) return prev;
      // Remove ids that are now PAGO
      const paidIds = new Set(transactions.filter(tx => tx.status === 'PAGO').map(tx => tx.id));
      const next = new Map<string, Transaction>(prev);
      let changed = false;
      for (const id of next.keys()) {
        if (paidIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [transactions]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSelect = (tx: Transaction) => {
    const isSelected = selectedMap.has(tx.id);
    const next = new Map<string, Transaction>(selectedMap);
    if (isSelected) {
      next.delete(tx.id);
    } else {
      next.set(tx.id, tx);
    }
    setSelectedMap(next);
  };

  const pendingOnPage = paginated.filter(tx => tx.status === 'PENDENTE');
  const allPagePendingSelected = pendingOnPage.length > 0 && pendingOnPage.every(tx => selectedMap.has(tx.id));

  const toggleSelectAll = () => {
    const next = new Map<string, Transaction>(selectedMap);
    if (allPagePendingSelected) {
      pendingOnPage.forEach(tx => next.delete(tx.id));
    } else {
      pendingOnPage.forEach(tx => next.set(tx.id, tx));
    }
    setSelectedMap(next);
  };

  const selectedTxs: Transaction[] = Array.from(selectedMap.values());
  const selectedTotal = selectedTxs.reduce((s, tx) => s + Number(tx.valor) + Number(tx.juros || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex flex-wrap gap-3 flex-grow max-w-4xl">
          <div className="bg-surface-variant/20 flex items-center px-4 py-2.5 rounded-sm border border-surface-variant flex-grow min-w-[200px] focus-within:border-primary/40 transition-all">
            <Search size={18} className="text-on-surface-variant" />
            <input
              type="text"
              placeholder="Buscar fornecedor, descrição, empresa ou valor (ex: 750,00)..."
              className="bg-transparent border-none text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:ring-0 p-0 outline-none w-full ml-3"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>


          <select
            className="bg-surface border border-white/10 text-on-surface text-sm rounded-sm px-4 py-2.5 outline-none focus:border-primary hover:bg-surface-variant/20 transition-all"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="TODOS" className="bg-surface text-on-surface">Todos Status</option>
            <option value="PAGO" className="bg-surface text-on-surface">PAGO</option>
            <option value="PENDENTE" className="bg-surface text-on-surface">PENDENTE</option>
            <option value="VENCIDO" className="bg-surface text-on-surface">VENCIDO</option>
          </select>

          <select
            className="bg-surface border border-white/10 text-on-surface text-sm rounded-sm px-4 py-2.5 outline-none focus:border-primary hover:bg-surface-variant/20 transition-all"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="TODOS" className="bg-surface text-on-surface">Todos os Meses</option>
            {availableMonths.map(m => (
              <option key={m.value} value={m.value} className="bg-surface text-on-surface">{m.label}</option>
            ))}
          </select>

          <select
            className="bg-surface border border-white/10 text-on-surface text-sm rounded-sm px-4 py-2.5 outline-none focus:border-primary hover:bg-surface-variant/20 transition-all"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="TODOS" className="bg-surface text-on-surface">Todos os Anos</option>
            {availableYears.map(y => (
              <option key={y} value={y || ''} className="bg-surface text-on-surface">{y}</option>
            ))}
          </select>

          <button
            onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
            className="bg-surface border border-white/10 text-on-surface-variant text-xs font-bold uppercase px-3 py-2.5 rounded-sm hover:bg-surface-variant/20 hover:text-on-surface transition-all whitespace-nowrap"
            title={sortOrder === 'desc' ? 'Mais recentes primeiro' : 'Mais antigos primeiro'}
          >
            {sortOrder === 'desc' ? '↓ Recentes' : '↑ Antigos'}
          </button>

        </div>
        <div className="flex gap-2">
          {selectedMap.size > 0 && (
            <button
              onClick={() => onMarkAsPaidBatch(selectedTxs)}
              className="bg-primary/20 border border-primary/40 text-primary px-5 py-2.5 rounded-sm text-sm font-black uppercase tracking-widest flex items-center gap-2 hover:bg-primary/30 transition-all whitespace-nowrap"
            >
              <Check size={18} strokeWidth={3} /> Receber {selectedMap.size} selecionado{selectedMap.size > 1 ? 's' : ''} – {formatBRL(selectedTotal)}
            </button>
          )}
          <button
            onClick={() => setShowNewTxModal(true)}
            className="bg-primary text-background px-6 py-2.5 rounded-sm text-sm font-black uppercase tracking-widest flex items-center gap-2 hover:bg-primary-dark transition-all whitespace-nowrap shadow-lg shadow-primary/10"
          >
            <Plus size={18} strokeWidth={3} /> Novo Lançamento
          </button>
        </div>

      </div>

      {/* Mobile: cards */}
      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <div className="glass-card p-8 text-center text-on-surface-variant italic text-sm">
            Nenhum lançamento encontrado.
          </div>
        ) : (
          paginated.map((tx) => (
            <div key={tx.id} className={cn(
              "glass-card p-4 border-l-4",
              tx.status === 'PAGO' && "border-primary/60",
              tx.status === 'PENDENTE' && "border-secondary/60",
              tx.status === 'VENCIDO' && "border-tertiary/60"
            )}>
              <div className="flex justify-between items-start gap-2 mb-2">
                {tx.status !== 'PAGO' && (
                  <input
                    type="checkbox"
                    checked={selectedMap.has(tx.id)}
                    onChange={() => toggleSelect(tx)}
                    className="mt-1 accent-primary cursor-pointer"
                  />
                )}
                <span className="font-semibold text-sm leading-tight flex-1">{tx.fornecedor}</span>
                <div className="flex flex-col items-end">
                  <span className={cn(
                    "font-bold text-sm whitespace-nowrap",
                    tx.valor < 0 ? "text-tertiary" : (isRevenueTransaction(tx) ? "text-success" : "text-primary")
                  )}>
                    {(Number(tx.valor || 0) + Number(tx.juros || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {Number(tx.juros) > 0 && (
                    <span className="text-[9px] text-tertiary font-normal">(inclui {Number(tx.juros).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })} juros)</span>
                  )}
                  {Number(tx.juros) < 0 && (
                    <span className="text-[9px] text-success font-normal">(desconto de {Number(Math.abs(tx.juros)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-on-surface-variant mb-3">
                <span><span className="font-bold text-on-surface">Venc:</span> {toDisplayDate(tx.vencimento)}</span>
                {tx.pagamento && <span><span className="font-bold text-on-surface">Pago:</span> {toDisplayDate(tx.pagamento)}</span>}
                <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">{tx.empresa}</span>
              </div>
              {tx.descricao && tx.descricao !== '-' && (
                <p className="text-[11px] text-on-surface-variant mb-3 truncate">{tx.descricao}</p>
              )}
              <div className="flex justify-between items-center">
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  tx.status === 'PAGO' && "bg-success/20 text-success border-success/30",
                  tx.status === 'PENDENTE' && "bg-secondary/20 text-secondary border-secondary/30",
                  tx.status === 'VENCIDO' && "bg-tertiary/20 text-tertiary border-tertiary/30"
                )}>
                  {tx.status}
                </span>
                <div className="flex gap-2">
                  {tx.status !== 'PAGO' && (
                    <button onClick={() => onMarkAsPaid(tx)} className="p-2 text-primary bg-primary/10 rounded-lg">
                      <Check size={16} />
                    </button>
                  )}
                  <button onClick={() => setEditingTx(tx)} className="p-2 text-on-surface-variant bg-surface-variant/40 rounded-lg">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => deleteTransaction(tx.id)} className="p-2 text-tertiary bg-tertiary/10 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="glass-card overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[980px]">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-surface-variant">
                <th className="px-4 py-4 w-10 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={allPagePendingSelected}
                    onChange={toggleSelectAll}
                    className="accent-primary cursor-pointer"
                    title="Selecionar todos pendentes desta página"
                  />
                </th>
                <th className="px-8 py-4 whitespace-nowrap min-w-[150px]">Fornecedor</th>
                <th className="px-8 py-4 whitespace-nowrap w-[250px]">Descrição</th>
                <th className="px-8 py-4 whitespace-nowrap w-36 text-right">Valor</th>
                <th className="px-8 py-4 whitespace-nowrap w-28 hidden lg:table-cell">Status</th>
                <th className="px-8 py-4 whitespace-nowrap w-28">Empresa</th>
                <th className="px-8 py-4 whitespace-nowrap w-32">
                  <span className="lg:hidden">Venc.</span>
                  <span className="hidden lg:inline">Vencimento</span>
                </th>
                <th className="px-8 py-4 whitespace-nowrap w-32 hidden xl:table-cell">Pagamento</th>
                <th className="px-8 py-4 whitespace-nowrap w-28 hidden xl:table-cell">Conta</th>
                <th className="px-8 py-4 whitespace-nowrap w-24 sticky right-0 bg-surface z-10 border-l border-surface-variant shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.3)]">Ações</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-surface-variant">
              {paginated.map((tx) => (
                <tr key={tx.id} className={cn("hover:bg-surface-variant/40 transition-colors", selectedMap.has(tx.id) && "bg-primary/5")}>
                  <td className="px-4 py-4">
                    {tx.status !== 'PAGO' && (
                      <input
                        type="checkbox"
                        checked={selectedMap.has(tx.id)}
                        onChange={() => toggleSelect(tx)}
                        className="accent-primary cursor-pointer"
                      />
                    )}
                  </td>
                  <td className="px-8 py-4 font-semibold max-w-[200px] truncate" title={tx.fornecedor}>{tx.fornecedor}</td>
                  <td className="px-8 py-4 text-on-surface-variant max-w-[250px] truncate" title={tx.descricao}>{tx.descricao}</td>
                  <td className={cn(
                    "px-8 py-4 font-bold text-right",
                    tx.valor < 0 ? "text-tertiary" : (isRevenueTransaction(tx) ? "text-success" : "text-primary")
                  )}>
                    {(Number(tx.valor) + Number(tx.juros || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {Number(tx.juros) > 0 && (
                      <p className="text-[9px] text-tertiary font-normal">(inclui {Number(tx.juros).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })} juros)</p>
                    )}
                    {Number(tx.juros) < 0 && (
                      <p className="text-[9px] text-success font-normal">(desconto de {Number(Math.abs(tx.juros)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })})</p>
                    )}
                  </td>
                  <td className="px-8 py-4 hidden lg:table-cell">
                    <span className={cn(
                      "text-[10px] font-bold px-3 py-1 rounded-full border",
                      tx.status === 'PAGO' && "bg-success/20 text-success border-success/30",
                      tx.status === 'PENDENTE' && "bg-secondary/20 text-secondary border-secondary/30",
                      tx.status === 'VENCIDO' && "bg-tertiary/20 text-tertiary border-tertiary/30"
                    )}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-8 py-4">
                    <span className="bg-primary/10 text-primary text-[10px] px-2 py-1 rounded truncate max-w-[80px] inline-block text-center" title={tx.empresa}>
                      {tx.empresa}
                    </span>
                  </td>
                  <td className="px-8 py-4 whitespace-nowrap">{toDisplayDate(tx.vencimento)}</td>
                  <td className="px-8 py-4 text-on-surface-variant whitespace-nowrap hidden xl:table-cell">{toDisplayDate(tx.pagamento) || '-'}</td>
                  <td className="px-8 py-4 text-[11px] uppercase tracking-wider text-on-surface-variant font-bold truncate max-w-[100px] hidden xl:table-cell" title={tx.banco}>{tx.banco || '-'}</td>
                  <td className="px-8 py-4 sticky right-0 bg-surface z-10 border-l border-surface-variant shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.3)] group-hover:bg-surface-variant/20 transition-colors">
                    <div className="flex gap-2 justify-end">
                      {tx.status !== 'PAGO' && (
                        <button
                          onClick={() => onMarkAsPaid(tx)}
                          className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors"
                          title="Marcar como pago"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => setEditingTx(tx)}
                        className="p-1.5 text-on-surface-variant hover:bg-surface-variant/60 rounded transition-colors"
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => deleteTransaction(tx.id)}
                        className="p-1.5 text-tertiary hover:bg-tertiary/10 rounded transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-2">
          <span className="text-xs text-on-surface-variant">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length} lançamentos (carregados)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg bg-surface-variant/40 text-on-surface-variant disabled:opacity-30 hover:bg-surface-variant/60 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold px-2">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="p-2 rounded-lg bg-surface-variant/40 text-on-surface-variant disabled:opacity-30 hover:bg-surface-variant/60 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Carregar mais do Banco de Dados */}
      <div className="flex justify-center pt-4 border-t border-surface-variant">
        {hasMoreTransactions ? (
          <button
            onClick={() => onLoadMore?.(true, yearFilter, monthFilter, filter, statusFilter)}
            disabled={isLoadingMore}
            className="flex items-center gap-2 px-6 py-3 bg-primary/10 text-primary rounded-xl text-sm font-bold hover:bg-primary/20 transition-all disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Carregando do Banco...
              </>
            ) : (
              <>
                <RefreshCw size={18} /> Carregar mais registros do Banco de Dados
              </>
            )}
          </button>
        ) : (
          <div className="text-xs text-on-surface bg-surface-variant/20 px-4 py-2.5 rounded-lg border border-surface-variant/30 flex items-center gap-2 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Todos os registros deste filtro foram carregados ({filtered.length} no total)
          </div>
        )}
      </div>
    </div>
  );
});

LancamentosTab.displayName = 'LancamentosTab';
export default LancamentosTab;
