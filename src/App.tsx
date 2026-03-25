import React, { Component, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Building2, 
  Settings, 
  Bell, 
  Wallet, 
  HelpCircle, 
  TrendingUp, 
  CheckCircle, 
  Calendar, 
  Upload,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
  Plus,
  Trash2,
  Check,
  Search,
  BarChart3,
  PieChart as PieChartIcon,
  UserPlus,
  FileSpreadsheet,
  Menu,
  X,
  Edit,
  RefreshCw,
  CreditCard
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, Tooltip, 
  AreaChart, Area, Legend, CartesianGrid
} from 'recharts';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { Transaction, KPI, ChartData, Supplier, TransactionStatus, Bank } from './types';
import { api } from './api';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const toInputDate = (value?: string | null) => {
  if (!value) return '';
  const v = String(value).trim();
  if (v.includes('/')) {
    const [dd, mm, yyyy] = v.split('/');
    if (dd && mm && yyyy) return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
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

const toDisplayDate = (value?: string | null) => {
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

const dateSortKey = (value?: string | null) => {
  if (!value) return 0;
  const v = String(value).trim();
  if (v.includes('/')) {
    const [dd, mm, yyyy] = v.split('/');
    return new Date(`${yyyy}-${mm}-${dd}`).getTime();
  }
  return new Date(v).getTime() || 0;
};

const normalizeSupplierName = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const levenshteinDistance = (a: string, b: string) => {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
};

const isSupplierMatch = (transactionSupplier: string, supplierName: string) => {
  const tx = normalizeSupplierName(transactionSupplier);
  const sp = normalizeSupplierName(supplierName);
  if (!tx || !sp) return false;
  if (tx === sp) return true;
  if (tx.includes(sp) || sp.includes(tx)) return true;
  if (tx.slice(0, 3) !== sp.slice(0, 3)) return false;
  return levenshteinDistance(tx, sp) <= 2;
};

// --- Types ---
type Tab = 'dashboard' | 'lancamentos' | 'fornecedores' | 'relatorios' | 'bancos' | 'configuracoes';

// --- Components ---

function KPIComponent({ kpi, index }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="glass-card p-6 border-t-2"
      style={{ borderTopColor: kpi.color }}
    >
      <div className="flex flex-col">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-on-surface-variant/80 mb-2 font-headline">
          {kpi.label}
        </p>
        <h3 className="text-3xl font-black font-headline text-on-surface">
          {kpi.value}
        </h3>
        {kpi.trend && (
          <div className="mt-3 text-[10px] font-bold text-primary flex items-center gap-1.5 bg-primary/10 w-fit px-2 py-0.5 rounded-full">
            <TrendingUp size={12} /> {kpi.trend}
          </div>
        )}
        {kpi.description && (
          <p className="mt-2 text-[10px] text-on-surface-variant/60 font-medium">
            {kpi.description}
          </p>
        )}
      </div>
    </motion.div>
  );
}


// --- Tab Components ---

interface DashboardTabProps {
  stats: any;
  transactions: Transaction[];
  onMarkAsPaid: (tx: Transaction) => void;
}

const DashboardTab = ({ stats, transactions, onMarkAsPaid }: DashboardTabProps) => {
  const statusChartData = [
    { name: 'Pagos', value: stats.pagos },
    { name: 'Pendentes', value: stats.pendentes },
    { name: 'Vencidos', value: stats.vencidos },
  ];

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
        {stats.kpis.map((kpi: any, i: number) => (
          <KPIComponent key={i} kpi={kpi} index={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-8 min-h-[400px] flex flex-col">
          <h4 className="text-lg font-bold font-headline mb-6">Status dos Lançamentos</h4>
          <div className="flex-grow flex items-center justify-center relative">
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-on-surface-variant opacity-20">
                <PieChartIcon size={64} />
                <p className="text-xs uppercase tracking-widest mt-4">Sem dados</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusChartData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={[ '#10b981', '#f59e0b', '#ef4444' ][index]} />
                      ))}

                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#161b2a', border: 'none', borderRadius: '8px' }}
                      itemStyle={{ color: '#dee2f7' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold">
                    {Math.round((stats.pagos / (transactions.length || 1)) * 100)}%
                  </span>
                  <span className="text-[10px] uppercase text-on-surface-variant font-bold">Pagos</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="glass-card p-8 min-h-[400px]">
          <h4 className="text-lg font-bold font-headline mb-6">Últimos Lançamentos</h4>
          <div className="space-y-4">
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10 text-on-surface-variant opacity-40">
                <FileText size={48} className="mb-4" />
                <p className="text-sm font-medium">Nenhum lançamento encontrado</p>
                <p className="text-[10px] uppercase tracking-widest mt-1">Importe sua planilha para começar</p>
              </div>
            ) : (
              transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-4 bg-white/5 rounded-sm border-l-2 border-primary/40 hover:bg-white/10 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-on-surface">{tx.fornecedor}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60">{tx.vencimento}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className={cn("text-sm font-bold", tx.valor < 0 ? "text-tertiary" : "text-primary")}>
                      {tx.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    {tx.status !== 'PAGO' && (
                      <button 
                        onClick={() => onMarkAsPaid(tx)}
                        className="p-1.5 bg-primary/20 text-primary rounded-full hover:bg-primary/40 transition-colors"
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface LancamentosTabProps {
  transactions: Transaction[];
  onMarkAsPaid: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  setShowNewTxModal: (show: boolean) => void;
  setEditingTx: (tx: Transaction) => void;
}

const PAGE_SIZE = 50;

const LancamentosTab = ({ transactions, onMarkAsPaid, deleteTransaction, setShowNewTxModal, setEditingTx }: LancamentosTabProps) => {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [monthFilter, setMonthFilter] = useState('TODOS');
  const [yearFilter, setYearFilter] = useState('TODOS');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(0);
  
  // Extrair meses e anos únicos para os filtros
  const availableYears = useMemo(() => {
    const years = transactions.map(tx => {
      const parts = tx.vencimento.split('/');
      return parts.length === 3 ? parts[2] : null;
    }).filter(Boolean);
    return [...new Set(years)].sort().reverse();
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
    const searchLower = filter.toLowerCase();
    return transactions.filter(tx => {
      const matchesSearch = tx.fornecedor.toLowerCase().includes(searchLower) || 
                           (tx.descricao && tx.descricao.toLowerCase().includes(searchLower));
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
  }, [transactions, filter, statusFilter, monthFilter, yearFilter, sortOrder]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [filter, statusFilter, monthFilter, yearFilter, sortOrder]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex flex-wrap gap-3 flex-grow max-w-4xl">
          <div className="bg-surface-variant/20 flex items-center px-4 py-2.5 rounded-sm border border-white/5 flex-grow min-w-[200px] focus-within:border-primary/40 transition-all">
            <Search size={18} className="text-on-surface-variant" />
            <input 
              type="text" 
              placeholder="Buscar fornecedor ou descrição..."
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
        <button 
          onClick={() => setShowNewTxModal(true)}
          className="bg-primary text-background px-6 py-2.5 rounded-sm text-sm font-black uppercase tracking-widest flex items-center gap-2 hover:bg-primary-dark transition-all whitespace-nowrap shadow-lg shadow-primary/10"
        >
          <Plus size={18} strokeWidth={3} /> Novo Lançamento
        </button>

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
                <span className="font-semibold text-sm leading-tight flex-1">{tx.fornecedor}</span>
                <span className={cn("font-bold text-sm whitespace-nowrap", tx.valor < 0 ? "text-tertiary" : "text-primary")}>
                  {tx.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-on-surface-variant mb-3">
                <span><span className="font-bold text-on-surface">Venc:</span> {tx.vencimento}</span>
                {tx.pagamento && <span><span className="font-bold text-on-surface">Pago:</span> {tx.pagamento}</span>}
                <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">{tx.empresa}</span>
              </div>
              {tx.descricao && tx.descricao !== '-' && (
                <p className="text-[11px] text-on-surface-variant mb-3 truncate">{tx.descricao}</p>
              )}
              <div className="flex justify-between items-center">
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  tx.status === 'PAGO' && "bg-primary/20 text-primary border-primary/30",
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
                  <button onClick={() => setEditingTx(tx)} className="p-2 text-on-surface-variant bg-white/5 rounded-lg">
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
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-white/5">
                <th className="px-8 py-4">Fornecedor</th>
                <th className="px-8 py-4">Descrição</th>
                <th className="px-8 py-4">Empresa</th>
                <th className="px-8 py-4">Vencimento</th>
                <th className="px-8 py-4">Pagamento</th>
                <th className="px-8 py-4">Conta</th>
                <th className="px-8 py-4">Valor</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Ações</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-white/5">
              {paginated.map((tx) => (
                <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-8 py-4 font-semibold">{tx.fornecedor}</td>
                  <td className="px-8 py-4 text-on-surface-variant">{tx.descricao}</td>
                  <td className="px-8 py-4">
                    <span className="bg-primary/10 text-primary text-[10px] px-2 py-1 rounded">
                      {tx.empresa}
                    </span>
                  </td>
                  <td className="px-8 py-4">{tx.vencimento}</td>
                  <td className="px-8 py-4 text-on-surface-variant">{tx.pagamento || '-'}</td>
                  <td className="px-8 py-4 text-[11px] uppercase tracking-wider text-on-surface-variant font-bold">{tx.banco || '-'}</td>
                  <td className={cn("px-8 py-4 font-bold", tx.valor < 0 ? "text-tertiary" : "text-primary")}>
                    {tx.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-8 py-4">
                    <span className={cn(
                      "text-[10px] font-bold px-3 py-1 rounded-full border",
                      tx.status === 'PAGO' && "bg-primary/20 text-primary border-primary/30",
                      tx.status === 'PENDENTE' && "bg-secondary/20 text-secondary border-secondary/30",
                      tx.status === 'VENCIDO' && "bg-tertiary/20 text-tertiary border-tertiary/30"
                    )}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex gap-2">
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
                        className="p-1.5 text-on-surface-variant hover:bg-white/10 rounded transition-colors"
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
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length} lançamentos
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg bg-white/5 text-on-surface-variant disabled:opacity-30 hover:bg-white/10 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold px-2">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="p-2 rounded-lg bg-white/5 text-on-surface-variant disabled:opacity-30 hover:bg-white/10 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface FornecedoresTabProps {
  suppliers: Supplier[];
  transactions: Transaction[];
  deleteSupplier: (id: string) => void;
  setShowNewSupplierModal: (show: boolean) => void;
  syncSuppliers: () => void;
  onSelectSupplier: (s: Supplier) => void;
}

const FornecedoresTab = ({ suppliers, transactions, deleteSupplier, setShowNewSupplierModal, syncSuppliers, onSelectSupplier }: FornecedoresTabProps) => {
  const [searchSupplier, setSearchSupplier] = useState('');

  const mergedSuppliers = useMemo(() => {
    const byKey = new Map<string, Supplier>();

    suppliers.forEach((s) => {
      const key = normalizeSupplierName(s.nome);
      if (!key) return;
      byKey.set(key, s);
    });

    transactions.forEach((tx) => {
      const key = normalizeSupplierName(tx.fornecedor);
      if (!key || byKey.has(key)) return;
      byKey.set(key, {
        id: `virtual-${key}`,
        uid: 'guest',
        nome: tx.fornecedor,
        cnpj: '',
        email: '',
        telefone: ''
      });
    });

    return Array.from(byKey.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [suppliers, transactions]);

  const filteredSuppliers = useMemo(() => {
    const q = normalizeSupplierName(searchSupplier);
    if (!q) return mergedSuppliers;
    return mergedSuppliers.filter((s) => normalizeSupplierName(s.nome).includes(q));
  }, [mergedSuppliers, searchSupplier]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-bold font-headline">Gestão de Fornecedores</h3>
          <button 
            onClick={syncSuppliers}
            className="bg-white/5 text-on-surface-variant px-4 py-2 rounded-sm text-xs font-bold flex items-center gap-2 hover:bg-white/10 transition-colors"
            title="Sincronizar fornecedores dos lançamentos"
          >
            <RefreshCw size={14} /> Sincronizar
          </button>
        </div>
        <button 
          onClick={() => setShowNewSupplierModal(true)}
          className="bg-primary text-background px-6 py-2.5 rounded-sm text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-primary-dark transition-all"
        >
          <UserPlus size={18} /> Novo Fornecedor
        </button>
      </div>

      <div className="glass-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={16} />
          <input
            value={searchSupplier}
            onChange={(e) => setSearchSupplier(e.target.value)}
            placeholder="Buscar fornecedor..."
            className="w-full bg-surface-variant/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSuppliers.map(s => (
          <div key={s.id || normalizeSupplierName(s.nome)} className="glass-card p-6 flex flex-col gap-4 relative group cursor-pointer hover:border-primary/40" onClick={() => onSelectSupplier(s)}>
            {s.id && !String(s.id).startsWith('virtual-') && (
              <button 
                onClick={(e) => { e.stopPropagation(); deleteSupplier(s.id); }}
                className="absolute top-4 right-4 p-2 text-tertiary opacity-0 group-hover:opacity-100 transition-opacity hover:bg-tertiary/10 rounded-sm"
              >
                <Trash2 size={16} />
              </button>
            )}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-sm bg-primary/20 flex items-center justify-center text-primary font-bold text-xl border border-primary/10">
                {s.nome.charAt(0)}
              </div>
              <div>
                <h4 className="font-bold text-on-surface">{s.nome}</h4>
                <p className="text-[10px] font-black text-on-surface-variant/60 tracking-wider mt-0.5">{s.cnpj || 'CNPJ NÃO INFORMADO'}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm mt-2">
              <p className="flex items-center gap-2 text-on-surface-variant/80 text-xs font-medium">
                <FileText size={14} className="opacity-40" /> {s.email || 'E-mail não informado'}
              </p>
              <p className="flex items-center gap-2 text-on-surface-variant/80 text-xs font-medium">
                <HelpCircle size={14} className="opacity-40" /> {s.telefone || 'Telefone não informado'}
              </p>
            </div>
            <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                {transactions.filter(tx => isSupplierMatch(tx.fornecedor, s.nome)).length} Lançamentos
              </p>
              <button className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest hover:text-primary transition-colors">
                Detalhes →
              </button>
            </div>
          </div>
        ))}
        {filteredSuppliers.length === 0 && (
          <div className="col-span-full text-center text-on-surface-variant py-12 italic">
            Nenhum fornecedor encontrado para a busca.
          </div>
        )}
      </div>
    </div>
  );
};


interface RelatoriosTabProps {
  transactions: Transaction[];
}

const RelatoriosTab = ({ transactions }: RelatoriosTabProps) => {
  const years = useMemo(() => {
    const y = transactions.map(tx => {
      const dateParts = tx.vencimento.includes('-') ? tx.vencimento.split('-') : tx.vencimento.split('/');
      return tx.vencimento.includes('-') ? dateParts[0] : dateParts[2];
    });
    return [...new Set(y)].filter(Boolean).sort().reverse();
  }, [transactions]);

  const [selectedYear, setSelectedYear] = useState<string>(() => {
    const y = transactions.map(tx => {
      const dateParts = tx.vencimento.includes('-') ? tx.vencimento.split('-') : tx.vencimento.split('/');
      return tx.vencimento.includes('-') ? dateParts[0] : dateParts[2];
    });
    const uniqueYears = [...new Set(y)].filter(Boolean).sort().reverse();
    return uniqueYears[0] || new Date().getFullYear().toString();
  });

  const [selectedMonth, setSelectedMonth] = useState<string>('TODOS');
  const [selectedCompany, setSelectedCompany] = useState<string>('TODOS');

  const companies = useMemo(() => {
    return [...new Set(transactions.map(tx => tx.empresa))].sort();
  }, [transactions]);

  const filteredData = useMemo(() => {
    return transactions.filter(tx => {
      const parts = tx.vencimento.includes('/') ? tx.vencimento.split('/') : tx.vencimento.split('-');
      const year = tx.vencimento.includes('/') ? parts[2] : parts[0];
      const month = tx.vencimento.includes('/') ? parts[1] : parts[1];
      const matchesYear = selectedYear === 'TODOS' || year === selectedYear;
      const matchesMonth = selectedMonth === 'TODOS' || month === selectedMonth;
      const matchesCompany = selectedCompany === 'TODOS' || tx.empresa === selectedCompany;
      return matchesYear && matchesMonth && matchesCompany;
    });
  }, [transactions, selectedYear, selectedMonth, selectedCompany]);

  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const data = Array.from({ length: 12 }, (_, i) => ({ name: months[i], value: 0 }));
    for (const tx of filteredData) {
      const parts = tx.vencimento.includes('/') ? tx.vencimento.split('/') : tx.vencimento.split('-');
      const m = tx.vencimento.includes('/') ? parts[1] : parts[1];
      const idx = parseInt(m, 10) - 1;
      if (idx >= 0 && idx < 12) data[idx].value += tx.valor;
    }
    return data;
  }, [filteredData]);

  const companyData = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of filteredData) {
      map.set(tx.empresa, (map.get(tx.empresa) || 0) + tx.valor);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  return (
    <div className="space-y-8">
      <div className="glass-card p-6 flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase">Ano</label>
          <select 
            className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary text-on-surface"
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
          >
            <option value="TODOS" className="bg-surface text-on-surface">Todos</option>
            {years.map(y => <option key={y} value={y} className="bg-surface text-on-surface">{y}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase">Mês</label>
          <select 
            className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary text-on-surface"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          >
            <option value="TODOS" className="bg-surface text-on-surface">Todos</option>
            <option value="01" className="bg-surface text-on-surface">Janeiro</option>
            <option value="02" className="bg-surface text-on-surface">Fevereiro</option>
            <option value="03" className="bg-surface text-on-surface">Março</option>
            <option value="04" className="bg-surface text-on-surface">Abril</option>
            <option value="05" className="bg-surface text-on-surface">Maio</option>
            <option value="06" className="bg-surface text-on-surface">Junho</option>
            <option value="07" className="bg-surface text-on-surface">Julho</option>
            <option value="08" className="bg-surface text-on-surface">Agosto</option>
            <option value="09" className="bg-surface text-on-surface">Setembro</option>
            <option value="10" className="bg-surface text-on-surface">Outubro</option>
            <option value="11" className="bg-surface text-on-surface">Novembro</option>
            <option value="12" className="bg-surface text-on-surface">Dezembro</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase">Empresa</label>
          <select 
            className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary text-on-surface"
            value={selectedCompany}
            onChange={e => setSelectedCompany(e.target.value)}
          >
            <option value="TODOS" className="bg-surface text-on-surface">Todas</option>
            {companies.map(c => <option key={c} value={c} className="bg-surface text-on-surface">{c}</option>)}
          </select>
        </div>
        <div className="flex-grow"></div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase">Total no Período</p>
          <p className="text-xl font-bold text-primary">
            {filteredData.reduce((acc, tx) => acc + tx.valor, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-8 min-h-[400px]">
          <h4 className="text-lg font-bold font-headline mb-6">Fluxo Mensal ({selectedYear})</h4>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="name" stroke="#c6c6cd" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis 
                stroke="#c6c6cd" 
                fontSize={10} 
                axisLine={false} 
                tickLine={false}
                tickFormatter={(value) => `R$ ${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#161b2a', border: 'none', borderRadius: '8px' }}
                itemStyle={{ color: '#dee2f7' }}
                formatter={(value: number) => [value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 'Valor']}
              />
              <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b98120" strokeWidth={3} />

            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-8 min-h-[400px]">
          <h4 className="text-lg font-bold font-headline mb-6">Despesas por Empresa</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={companyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="name" stroke="#c6c6cd" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis 
                stroke="#c6c6cd" 
                fontSize={10} 
                axisLine={false} 
                tickLine={false}
                tickFormatter={(value) => `R$ ${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#161b2a', border: 'none', borderRadius: '8px' }}
                itemStyle={{ color: '#dee2f7' }}
                formatter={(value: number) => [value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 'Valor']}
              />
              <Bar dataKey="value" fill="#10b981" radius={[2, 2, 0, 0]} />

            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 md:px-8 md:py-6 border-b border-white/5 flex justify-between items-center">
          <h4 className="text-base md:text-lg font-bold font-headline">Lançamentos no Período</h4>
          <span className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">
            {filteredData.length} registros
          </span>
        </div>

        {/* Mobile: cards */}
        <div className="divide-y divide-white/5 md:hidden">
          {filteredData.length === 0 ? (
            <p className="px-6 py-10 text-center text-on-surface-variant italic text-sm">
              Nenhum lançamento encontrado.
            </p>
          ) : (
            filteredData.map((tx) => (
              <div key={tx.id} className="px-4 py-3 flex flex-col gap-1">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-semibold text-sm flex-1 leading-tight">{tx.fornecedor}</span>
                  <span className="font-bold text-sm whitespace-nowrap">
                    {tx.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-on-surface-variant">
                  <span>Venc: {tx.vencimento}</span>
                  {tx.pagamento && <span>Pago: {tx.pagamento}</span>}
                  <span className={cn(
                    "font-bold",
                    tx.status === 'PAGO' && "text-primary",
                    tx.status === 'PENDENTE' && "text-secondary",
                    tx.status === 'VENCIDO' && "text-tertiary"
                  )}>{tx.status}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop: table */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-white/5">
                <th className="px-8 py-4">Fornecedor</th>
                <th className="px-8 py-4">Descrição</th>
                <th className="px-8 py-4">Vencimento</th>
                <th className="px-8 py-4">Pagamento</th>
                <th className="px-8 py-4">Valor</th>
                <th className="px-8 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-white/5">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-on-surface-variant italic">
                    Nenhum lançamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredData.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-8 py-4 font-semibold">{tx.fornecedor}</td>
                    <td className="px-8 py-4 text-on-surface-variant">{tx.descricao}</td>
                    <td className="px-8 py-4">{tx.vencimento}</td>
                    <td className="px-8 py-4 text-on-surface-variant">{tx.pagamento || '-'}</td>
                    <td className="px-8 py-4 font-bold">
                      {tx.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-8 py-4">
                      <span className={cn(
                        "text-[10px] font-bold px-3 py-1 rounded-full border",
                        tx.status === 'PAGO' && "bg-primary/20 text-primary border-primary/30",
                        tx.status === 'PENDENTE' && "bg-secondary/20 text-secondary border-secondary/30",
                        tx.status === 'VENCIDO' && "bg-tertiary/20 text-tertiary border-tertiary/30"
                      )}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface BancosTabProps {
  banks: Bank[];
  transactions: Transaction[];
  setShowNewBankModal: (show: boolean) => void;
  setEditingBank: (bank: Bank) => void;
  deleteBank: (id: string) => void;
}

const BancosTab = ({ banks, transactions, setShowNewBankModal, setEditingBank, deleteBank }: BancosTabProps) => {
  const bankTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    banks.forEach(bank => {
      totals[bank.nome] = 0;
    });
    transactions.filter(tx => tx.status === 'PAGO' && tx.banco).forEach(tx => {
      if (tx.banco && totals[tx.banco] !== undefined) {
        totals[tx.banco] += tx.valor;
      }
    });
    return totals;
  }, [banks, transactions]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold font-headline">Contas Bancárias</h3>
          <p className="text-sm text-on-surface-variant mt-1">Gerencie suas contas bancárias e acompanhe os saldos</p>
        </div>
        <button 
          onClick={() => setShowNewBankModal(true)}
          className="bg-primary text-background px-6 py-2.5 rounded-sm text-sm font-black uppercase tracking-widest flex items-center gap-2 hover:bg-primary-dark transition-all shadow-lg shadow-primary/10"
        >
          <Plus size={18} strokeWidth={3} /> Nova Conta
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {banks.map(bank => (
          <div key={bank.id} className="glass-card p-6 relative group">
            <button 
              onClick={() => setEditingBank(bank)}
              className="absolute top-4 right-14 p-2 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 rounded-sm"
            >
              <Edit size={16} />
            </button>
            <button 
              onClick={() => deleteBank(bank.id)}
              className="absolute top-4 right-4 p-2 text-tertiary opacity-0 group-hover:opacity-100 transition-opacity hover:bg-tertiary/10 rounded-sm"
            >
              <Trash2 size={16} />
            </button>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-sm bg-primary/20 flex items-center justify-center text-primary">
                <CreditCard size={24} />
              </div>
              <div>
                <h4 className="font-bold text-on-surface">{bank.nome}</h4>
                <p className="text-[10px] text-on-surface-variant/60">
                  {bank.ativo ? 'Ativo' : 'Inativo'}
                </p>
                {(bank.agencia || bank.conta) && (
                  <p className="text-[10px] text-on-surface-variant/60 mt-1">
                    {bank.agencia ? `Ag ${bank.agencia}` : ''}{bank.agencia && bank.conta ? ' • ' : ''}{bank.conta ? `Conta ${bank.conta}` : ''}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-on-surface-variant">Saldo Inicial</span>
                <span className="text-sm font-bold" style={{ color: Number(bank.saldo) < 0 ? '#ef4444' : undefined }}>
                  {Number(bank.saldo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-on-surface-variant">Total Pago</span>
                <span className="text-sm font-bold text-tertiary" style={{ color: (bankTotals[bank.nome] || 0) < 0 ? '#ef4444' : undefined }}>
                  {bankTotals[bank.nome]?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}
                </span>
              </div>
              <div className="pt-2 border-t border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-primary">Saldo Atual</span>
                  <span className="text-lg font-black" style={{ color: (Number(bank.saldo) - (bankTotals[bank.nome] || 0)) < 0 ? '#ef4444' : '#3b82f6' }}>
                    {(Number(bank.saldo) - (bankTotals[bank.nome] || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {banks.length === 0 && (
          <div className="col-span-full glass-card p-12 text-center">
            <CreditCard size={48} className="mx-auto text-on-surface-variant opacity-20 mb-4" />
            <p className="text-on-surface-variant">Nenhuma conta bancária cadastrada</p>
            <p className="text-xs text-on-surface-variant/60 mt-1">Clique em "Nova Conta" para adicionar</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Modals ---

interface NewBankModalProps {
  setShowNewBankModal: (show: boolean) => void;
  onSuccess: () => void;
}

const NewBankModal = ({ setShowNewBankModal, onSuccess }: NewBankModalProps) => {
  const [formData, setFormData] = useState({
    nome: '',
    agencia: '',
    conta: '',
    saldo: '',
    ativo: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createBank({
        uid: 'guest',
        nome: formData.nome,
        agencia: formData.agencia || undefined,
        conta: formData.conta || undefined,
        saldo: Number(formData.saldo) || 0,
        ativo: formData.ativo
      });
      setShowNewBankModal(false);
      onSuccess();
    } catch (error) {
      console.error('Failed to create bank:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-10 w-full max-w-md border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
      >
        <h3 className="text-xl font-bold font-headline mb-6">Nova Conta Bancária</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Nome do Banco</label>
            <input 
              type="text"
              list="bank-suggestions"
              className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
              value={formData.nome}
              onChange={e => setFormData({...formData, nome: e.target.value})}
              placeholder="Ex: Sicredi Matriz, Itaú PJ, Caixa CEI"
              required
            />
            <datalist id="bank-suggestions">
              <option value="Sicredi CN" />
              <option value="BB Cei" />
              <option value="BB Facems" />
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Agência</label>
              <input 
                type="text"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.agencia}
                onChange={e => setFormData({...formData, agencia: e.target.value})}
                placeholder="Ex: 1234"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Conta</label>
              <input 
                type="text"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.conta}
                onChange={e => setFormData({...formData, conta: e.target.value})}
                placeholder="Ex: 12345-6"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Saldo Inicial (R$)</label>
            <input 
              type="number" step="0.01"
              className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
              value={formData.saldo}
              onChange={e => setFormData({...formData, saldo: e.target.value})}
            />
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox"
                className="w-4 h-4 rounded border-white/20 bg-surface-variant/20 text-primary focus:ring-primary"
                checked={formData.ativo}
                onChange={e => setFormData({...formData, ativo: e.target.checked})}
              />
              <span className="text-sm text-on-surface">Conta ativa</span>
            </label>
          </div>
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setShowNewBankModal(false)}
              className="flex-1 px-4 py-3 rounded-sm border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all text-on-surface-variant"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-3 rounded-sm bg-primary text-background text-xs font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/10"
            >
              Salvar Banco
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

interface EditBankModalProps {
  bank: Bank;
  onClose: () => void;
  onSuccess: () => void;
}

const EditBankModal = ({ bank, onClose, onSuccess }: EditBankModalProps) => {
  const [formData, setFormData] = useState({
    nome: bank.nome || '',
    agencia: bank.agencia || '',
    conta: bank.conta || '',
    saldo: String(bank.saldo ?? 0),
    ativo: bank.ativo ?? true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bank.id) return;
    try {
      await api.updateBank(bank.id, {
        nome: formData.nome,
        agencia: formData.agencia || undefined,
        conta: formData.conta || undefined,
        saldo: Number(formData.saldo) || 0,
        ativo: formData.ativo
      });
      onClose();
      onSuccess();
    } catch (error) {
      console.error('Failed to update bank:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-10 w-full max-w-md border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
      >
        <h3 className="text-xl font-bold font-headline mb-6">Editar Conta Bancária</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Nome do Banco</label>
            <input 
              type="text"
              className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
              value={formData.nome}
              onChange={e => setFormData({...formData, nome: e.target.value})}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Agência</label>
              <input 
                type="text"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.agencia}
                onChange={e => setFormData({...formData, agencia: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Conta</label>
              <input 
                type="text"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.conta}
                onChange={e => setFormData({...formData, conta: e.target.value})}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Saldo Inicial (R$)</label>
            <input 
              type="number" step="0.01"
              className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
              value={formData.saldo}
              onChange={e => setFormData({...formData, saldo: e.target.value})}
            />
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox"
                className="w-4 h-4 rounded border-white/20 bg-surface-variant/20 text-primary focus:ring-primary"
                checked={formData.ativo}
                onChange={e => setFormData({...formData, ativo: e.target.checked})}
              />
              <span className="text-sm text-on-surface">Conta ativa</span>
            </label>
          </div>
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-sm border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all text-on-surface-variant"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-3 rounded-sm bg-primary text-background text-xs font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/10"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

interface SelectBankModalProps {
  transactionId: string;
  valor: number;
  banks: Bank[];
  onClose: () => void;
  onConfirm: (banco: string) => void;
}

const SelectBankModal = ({ transactionId, valor, banks, onClose, onConfirm }: SelectBankModalProps) => {
  const [selectedBank, setSelectedBank] = useState('');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-10 w-full max-w-md border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
      >
        <h3 className="text-xl font-bold font-headline mb-2">Confirmar Pagamento</h3>
        <p className="text-sm text-on-surface-variant mb-6">
          Selecione o banco para registrar o pagamento de <span className="font-bold text-primary">{valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </p>
        
        <div className="space-y-3 mb-6">
          {banks.filter(b => b.ativo).map(bank => (
            <button
              key={bank.id}
              onClick={() => setSelectedBank(bank.nome)}
              className={cn(
                "w-full p-4 rounded-lg border text-left transition-all",
                selectedBank === bank.nome 
                  ? "border-primary bg-primary/10" 
                  : "border-white/10 hover:border-primary/40"
              )}
            >
              <div className="flex items-center gap-3">
                <CreditCard size={20} className={selectedBank === bank.nome ? "text-primary" : "text-on-surface-variant"} />
                <span className={selectedBank === bank.nome ? "text-primary font-bold" : "text-on-surface"}>
                  {bank.nome}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-sm border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all text-on-surface-variant"
          >
            Cancelar
          </button>
          <button 
            onClick={() => selectedBank && onConfirm(selectedBank)}
            disabled={!selectedBank}
            className="flex-1 px-4 py-3 rounded-sm bg-primary text-background text-xs font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmar
          </button>
        </div>
      </motion.div>
    </div>
  );
};

interface NewTxModalProps {
  suppliers: Supplier[];
  banks: Bank[];
  setShowNewTxModal: (show: boolean) => void;
  onSuccess: () => void;
}

const NewTxModal = ({ suppliers, banks, setShowNewTxModal, onSuccess }: NewTxModalProps) => {
  const [formData, setFormData] = useState({
    fornecedor: suppliers[0]?.nome || '',
    descricao: '',
    empresa: 'CN',
    vencimento: new Date().toISOString().split('T')[0],
    pagamento: '',
    valor: '',
    parcelas: '1',
    valorTipo: 'parcela' as 'parcela' | 'total',
    status: 'PENDENTE' as TransactionStatus,
    banco: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const parcelas = Math.max(1, Number(formData.parcelas) || 1);
      const addMonthsToInputDate = (baseDate: string, monthsToAdd: number) => {
        const [year, month, day] = baseDate.split('-').map(Number);
        const dt = new Date(Date.UTC(year, (month || 1) - 1 + monthsToAdd, day || 1));
        const yyyy = dt.getUTCFullYear();
        const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(dt.getUTCDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };

      const newTxList = Array.from({ length: parcelas }, (_, i) => {
        const vencimentoParcela = addMonthsToInputDate(formData.vencimento, i);
        const pagamentoParcela = formData.status === 'PAGO'
          ? (formData.pagamento ? addMonthsToInputDate(formData.pagamento, i) : new Date().toISOString().split('T')[0])
          : '';

        return {
          uid: 'guest',
          fornecedor: formData.fornecedor,
          descricao: parcelas > 1 ? `${formData.descricao} (${i + 1}/${parcelas})` : formData.descricao,
          empresa: formData.empresa,
          vencimento: toDisplayDate(vencimentoParcela),
          pagamento: formData.status === 'PAGO' ? toDisplayDate(pagamentoParcela) : null,
          valor: Number(formData.valorTipo === 'total' ? (Number(formData.valor) / parcelas).toFixed(2) : formData.valor),
          status: formData.status,
          banco: formData.status === 'PAGO' ? formData.banco : null,
        };
      });

      if (newTxList.length === 1) {
        await api.createTransaction(newTxList[0]);
      } else {
        await api.createTransactionsBatch(newTxList);
      }
      setShowNewTxModal(false);
      onSuccess();
    } catch (error) {
      console.error('Failed to create transaction:', error);
    }
  };


  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-10 w-full max-w-lg border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-y-auto max-h-[90vh]"

      >
        <h3 className="text-xl font-bold font-headline mb-6">Novo Lançamento</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Fornecedor</label>
              <select 
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.fornecedor}
                onChange={e => setFormData({...formData, fornecedor: e.target.value})}
              >
                {suppliers.map(s => <option key={s.id} value={s.nome} className="bg-[#161b2a] text-on-surface">{s.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Banco / Conta</label>
              <select 
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.banco}
                onChange={e => setFormData({...formData, banco: e.target.value})}
              >
                <option value="" className="bg-[#161b2a] text-on-surface">Não informado</option>
                {banks.filter(b => b.ativo).map(b => (
                  <option key={b.id} value={b.nome} className="bg-[#161b2a] text-on-surface">{b.nome}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Descrição</label>
            <input 
              type="text" required
              className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
              value={formData.descricao}
              onChange={e => setFormData({...formData, descricao: e.target.value})}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Empresa</label>
              <select 
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.empresa}
                onChange={e => setFormData({...formData, empresa: e.target.value})}
              >
                <option className="bg-[#161b2a]">CN</option>
                <option className="bg-[#161b2a]">FACEMS</option>
                <option className="bg-[#161b2a]">LAB</option>
                <option className="bg-[#161b2a]">CEI</option>
                <option className="bg-[#161b2a]">UNOPAR</option>
              </select>

            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Status</label>
              <select 
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as TransactionStatus})}
              >
                <option value="PENDENTE" className="bg-[#161b2a] text-on-surface">PENDENTE</option>
                <option value="PAGO" className="bg-[#161b2a] text-on-surface">PAGO</option>
              </select>

            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Vencimento</label>
              <input 
                type="date" required
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.vencimento}
                onChange={e => setFormData({...formData, vencimento: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Valor (R$)</label>
              <input 
                type="number" step="0.01" required
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.valor}
                onChange={e => setFormData({...formData, valor: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Parcelas</label>
              <input
                type="number"
                min={1}
                step={1}
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.parcelas}
                onChange={e => setFormData({ ...formData, parcelas: e.target.value })}
              />
            </div>
          </div>
          {Number(formData.parcelas) > 1 && (
            <div className="flex items-center gap-3 p-3 bg-surface-variant/10 rounded-lg border border-white/5">
              <span className="text-xs font-bold text-on-surface-variant uppercase">Tipo do valor:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="valorTipo"
                  value="parcela"
                  checked={formData.valorTipo === 'parcela'}
                  onChange={() => setFormData({ ...formData, valorTipo: 'parcela' })}
                  className="accent-primary"
                />
                <span className="text-xs text-on-surface">Por parcela</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="valorTipo"
                  value="total"
                  checked={formData.valorTipo === 'total'}
                  onChange={() => setFormData({ ...formData, valorTipo: 'total' })}
                  className="accent-primary"
                />
                <span className="text-xs text-on-surface">Valor total (divide)</span>
              </label>
              {formData.valorTipo === 'total' && formData.valor && (
                <span className="text-[10px] text-primary ml-auto">
                  = R$ {(Number(formData.valor) / Number(formData.parcelas)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/parcela
                </span>
              )}
            </div>
          )}
          {formData.status === 'PAGO' && (
            <>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Data de Pagamento</label>
                <input 
                  type="date" required
                  className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                  value={formData.pagamento}
                  onChange={e => setFormData({...formData, pagamento: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Banco</label>
                <select 
                  className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                  style={{ backgroundColor: '#161b2a' }}
                  value={formData.banco}
                  onChange={e => setFormData({...formData, banco: e.target.value})}
                  required
                >
                  <option value="" className="bg-[#161b2a] text-on-surface">Selecione...</option>
                  {banks.filter(b => b.ativo).map(b => (
                    <option key={b.id} value={b.nome} className="bg-[#161b2a] text-on-surface">{b.nome}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setShowNewTxModal(false)}
              className="flex-1 px-4 py-3 rounded-sm border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all text-on-surface-variant"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-3 rounded-sm bg-primary text-background text-xs font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/10"
            >
              Salvar Lançamento
            </button>
          </div>

        </form>
      </motion.div>
    </div>
  );
};

interface EditTxModalProps {
  transaction: Transaction;
  suppliers: Supplier[];
  banks: Bank[];
  onClose: () => void;
  onSave: (tx: Transaction) => void;
}

const EditTxModal = ({ transaction, suppliers, banks, onClose, onSave }: EditTxModalProps) => {
  const [formData, setFormData] = useState({
    ...transaction,
    vencimento: toInputDate(transaction.vencimento),
    pagamento: toInputDate(transaction.pagamento),
    valor: transaction.valor.toString(),
    banco: transaction.banco || ''
  });

  useEffect(() => {
    setFormData({
      ...transaction,
      vencimento: toInputDate(transaction.vencimento),
      pagamento: toInputDate(transaction.pagamento),
      valor: transaction.valor.toString(),
      banco: transaction.banco || ''
    });
  }, [transaction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...transaction,
      ...formData,
      vencimento: toDisplayDate(formData.vencimento),
      pagamento: formData.status === 'PAGO' && formData.pagamento ? toDisplayDate(formData.pagamento) : null,
      valor: parseFloat(formData.valor)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-10 w-full max-w-lg border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"

      >
        <h3 className="text-xl font-bold font-headline mb-6">Editar Lançamento</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Fornecedor</label>
              <select 
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.fornecedor}
                onChange={e => setFormData({...formData, fornecedor: e.target.value})}
              >
                <option value={transaction.fornecedor} className="bg-[#161b2a] text-on-surface">{transaction.fornecedor}</option>
                {suppliers.filter(s => s.nome !== transaction.fornecedor).map(s => (
                  <option key={s.id} value={s.nome} className="bg-[#161b2a] text-on-surface">{s.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Banco / Conta</label>
              <select 
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.banco}
                onChange={e => setFormData({...formData, banco: e.target.value})}
              >
                <option value="" className="bg-[#161b2a] text-on-surface">Não informado</option>
                {banks.map(b => (
                  <option key={b.id} value={b.nome} className="bg-[#161b2a] text-on-surface">{b.nome}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Descrição</label>
            <input 
              type="text" required
              className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all"
              value={formData.descricao}
              onChange={e => setFormData({...formData, descricao: e.target.value})}
            />

          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Empresa</label>
              <select 
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.empresa}
                onChange={e => setFormData({...formData, empresa: e.target.value})}
              >
                <option>CN</option>
                <option>FACEMS</option>
                <option>LAB</option>
                <option>CEI</option>
                <option>UNOPAR</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Status</label>
              <select 
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                style={{ backgroundColor: '#161b2a' }} // Forçar fundo escuro em alguns navegadores
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as TransactionStatus})}
              >
                <option value="PENDENTE" className="bg-[#161b2a] text-on-surface">PENDENTE</option>
                <option value="PAGO" className="bg-[#161b2a] text-on-surface">PAGO</option>
                <option value="VENCIDO" className="bg-[#161b2a] text-on-surface">VENCIDO</option>
              </select>

            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Vencimento</label>
              <input 
                type="date" required
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.vencimento}
                onChange={e => setFormData({...formData, vencimento: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Valor (R$)</label>
              <input 
                type="number" step="0.01" required
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.valor}
                onChange={e => setFormData({...formData, valor: e.target.value})}
              />
            </div>
          </div>
          {formData.status === 'PAGO' && (
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Data de Pagamento</label>
              <input 
                type="date" required
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.pagamento}
                onChange={e => setFormData({...formData, pagamento: e.target.value})}
              />
            </div>
          )}
          <div className="flex gap-3 pt-6">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-sm border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all text-on-surface-variant"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-3 rounded-sm bg-primary text-background text-xs font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/10"
            >
              Salvar Alterações
            </button>
          </div>

        </form>
      </motion.div>
    </div>
  );
};

const SupplierDetailModal = ({ supplier, transactions, onClose }: { supplier: Supplier, transactions: Transaction[], onClose: () => void }) => {
  const txDateToNumber = (value: string) => {
    if (!value) return 0;
    if (value.includes('/')) {
      const [dd, mm, yyyy] = value.split('/');
      return new Date(`${yyyy}-${mm}-${dd}`).getTime();
    }
    if (value.includes('-')) {
      return new Date(value).getTime();
    }
    return 0;
  };

  const supplierTransactions = useMemo(() => 
    transactions.filter(t => isSupplierMatch(t.fornecedor, supplier.nome))
    .sort((a, b) => {
      return txDateToNumber(b.vencimento) - txDateToNumber(a.vencimento);
    }),
  [transactions, supplier]);

  const kpis = useMemo(() => {
    const total = supplierTransactions.reduce((acc, t) => acc + t.valor, 0);
    const pago = supplierTransactions.filter(t => t.status === 'PAGO').reduce((acc, t) => acc + t.valor, 0);
    const aberto = total - pago;
    return { total, pago, aberto };
  }, [supplierTransactions]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header Detalhes */}
        <div className="p-8 border-b border-white/5 flex justify-between items-start bg-surface-variant/10">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-sm bg-primary/20 flex items-center justify-center text-primary font-black text-2xl border border-primary/20 shadow-lg shadow-primary/10">
              {supplier.nome.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-black font-headline premium-gradient-text tracking-tighter uppercase">{supplier.nome}</h2>
              <p className="text-xs font-bold text-on-surface-variant/60 tracking-[0.2em] mt-1">{supplier.cnpj || 'CNPJ NÃO INFORMADO'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-sm transition-colors text-on-surface-variant">
            <X size={24} />
          </button>
        </div>

        {/* KPIs Internos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5">
          <div className="p-6 bg-surface/40">
            <p className="text-[10px] font-black uppercase text-on-surface-variant/40 tracking-widest mb-1">Total Movimentado</p>
            <p className="text-xl font-black font-headline">{kpis.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
          <div className="p-6 bg-surface/40">
            <p className="text-[10px] font-black uppercase text-primary/60 tracking-widest mb-1">Total Liquidado</p>
            <p className="text-xl font-black font-headline text-primary">{kpis.pago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
          <div className="p-6 bg-surface/40">
            <p className="text-[10px] font-black uppercase text-secondary/60 tracking-widest mb-1">Saldo em Aberto</p>
            <p className="text-xl font-black font-headline text-secondary">{kpis.aberto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
        </div>

        {/* Lista de Histórico */}
        <div className="flex-grow overflow-y-auto p-8">
          <h4 className="text-xs font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-6">Histórico Financeiro</h4>
          <div className="space-y-3">
            {supplierTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-4 bg-white/5 rounded-sm border-l-2 hover:bg-white/10 transition-all group" style={{ borderLeftColor: tx.status === 'PAGO' ? '#10b981' : '#f59e0b' }}>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-on-surface group-hover:text-white">{tx.descricao}</span>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-tighter">{tx.vencimento}</span>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <span className="text-[10px] font-black text-primary/60 uppercase">{tx.empresa}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <span className={cn("text-sm font-black font-headline", tx.valor < 0 ? "text-tertiary" : "text-primary")}>{tx.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  <span className={cn(
                    "text-[9px] font-black px-2 py-0.5 rounded-sm border uppercase tracking-widest",
                    tx.status === 'PAGO' ? "bg-primary/20 text-primary border-primary/30" : "bg-secondary/20 text-secondary border-secondary/30"
                  )}>
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
            {supplierTransactions.length === 0 && (
              <p className="text-sm text-on-surface-variant text-center py-12">Nenhum lançamento encontrado para este fornecedor.</p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

interface NewSupplierModalProps {
  setShowNewSupplierModal: (show: boolean) => void;
  onSuccess: () => void;
}

const NewSupplierModal = ({ setShowNewSupplierModal, onSuccess }: NewSupplierModalProps) => {



  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cnpj: '',
    endereco: '',
    cidade: '',
    estado: '',
    categoria: '',
    observacoes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const newSupplier = {
        ...formData,
        uid: 'guest'
      };
      await api.createSupplier(newSupplier);
      setShowNewSupplierModal(false);
      onSuccess();

    } catch (error) {
      console.error('Failed to create supplier:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 w-full max-w-2xl border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <h3 className="text-xl font-bold font-headline mb-6">Novo Fornecedor</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Nome do Fornecedor</label>
              <input 
                type="text" required
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all"
                value={formData.nome}
                onChange={e => setFormData({...formData, nome: e.target.value})}
              />

            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">CNPJ</label>
              <input 
                type="text"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.cnpj}
                onChange={e => setFormData({...formData, cnpj: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">E-mail</label>
              <input 
                type="email"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Telefone</label>
              <input 
                type="text"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.telefone}
                onChange={e => setFormData({...formData, telefone: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Endereço</label>
            <input 
              type="text"
              className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
              value={formData.endereco}
              onChange={e => setFormData({...formData, endereco: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Cidade</label>
              <input 
                type="text"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.cidade}
                onChange={e => setFormData({...formData, cidade: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Estado</label>
              <input 
                type="text"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.estado}
                onChange={e => setFormData({...formData, estado: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Categoria</label>
              <input 
                type="text"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.categoria}
                onChange={e => setFormData({...formData, categoria: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Observações</label>
            <textarea 
              className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary h-24 resize-none"
              value={formData.observacoes}
              onChange={e => setFormData({...formData, observacoes: e.target.value})}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setShowNewSupplierModal(false)}
              className="flex-1 px-4 py-3 rounded-sm border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all text-on-surface-variant"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-3 rounded-sm bg-primary text-background text-xs font-black uppercase tracking-widest hover:opacity-90 shadow-lg shadow-primary/10 transition-all"
            >
              Cadastrar Fornecedor
            </button>
          </div>

        </form>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(true);

  const [showNewTxModal, setShowNewTxModal] = useState(false);
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [showNewBankModal, setShowNewBankModal] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [showPayModal, setShowPayModal] = useState<{ id: string; valor: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchTransactions = async () => {
    try {
      const data = await api.getTransactions('guest');
      const normalized = data.map((tx: any) => ({
        ...tx,
        vencimento: toDisplayDate(tx.vencimento),
        pagamento: tx.pagamento ? toDisplayDate(tx.pagamento) : undefined,
      }));
      setTransactions(normalized.sort((a: any, b: any) => dateSortKey(b.vencimento) - dateSortKey(a.vencimento)));
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const data = await api.getSuppliers('guest');
      setSuppliers(data);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const fetchBanks = async () => {
    try {
      const data = await api.getBanks('guest');
      setBanks(data);
    } catch (error) {
      console.error('Failed to fetch banks:', error);
    }
  };

  useEffect(() => {
    api.setupTables().catch(console.error).finally(() => {
      fetchTransactions();
      fetchSuppliers();
      fetchBanks();
    });
  }, []);

  // --- Handlers ---

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        showNotification('Processando arquivo... Por favor, aguarde.', 'info');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        let allDataMatrix: any[] = [];

        // Colunas consideradas "cabeçalho padrão"
        const KNOWN_COLS = ['FORNECEDOR','FORNECEDORES','NOME','FAVORECIDO','CLIENTE','VALOR','VENCIMENTO','DATA','PAGAMENTO','SITUAÇÃO','SITUACAO'];

        // Heurística de mapeamento posicional para abas sem cabeçalho padrão
        const isDateSerial = (v: any) => typeof v === 'number' && v > 40000 && v < 70000;
        const buildPositionalRow = (row: any[], sheetName: string): any => {
          const r: any = { _aba_origem: sheetName };
          const strings = row.map((v, i) => ({ v, i })).filter(x => typeof x.v === 'string' && String(x.v).trim() !== '');
          const dates   = row.map((v, i) => ({ v, i })).filter(x => isDateSerial(x.v));
          const nums    = row.map((v, i) => ({ v, i })).filter(x => typeof x.v === 'number' && !isDateSerial(x.v) && x.v > 0);
          if (strings[0]) r['FORNECEDOR']  = strings[0].v;
          if (strings[1]) r['DESCRIÇÃO']   = strings[1].v;
          if (dates[0])   r['VENCIMENTO']  = dates[0].v;
          if (dates[1])   r['DATA PAGAMENTO'] = dates[1].v;
          if (nums[0])    r['VALOR']       = nums[0].v;
          if (strings[2]) r['EMPRESA']     = strings[2].v;
          // último string pode ser status
          const last = strings[strings.length - 1];
          if (last && last !== strings[0] && last !== strings[1] && last !== strings[2]) r['SITUAÇÃO'] = last.v;
          return r;
        };

        // Iterar sobre todas as abas do Excel
        for (const sheetName of workbook.SheetNames) {
          // Ignora abas de sumário que não são lançamentos
          if (['CASHFLOW'].includes(sheetName.trim().toUpperCase())) continue;

          const worksheet = workbook.Sheets[sheetName];

          // Ler como matriz para evitar cruzamento de colunas
          const sheetMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as any[][];

          if (sheetMatrix.length < 1) continue; // Pula abas vazias

          // Verifica se a primeira linha contém colunas padrão
          const firstRowUpper = sheetMatrix[0].map(h => String(h || '').trim().toUpperCase());
          const hasStandardHeader = firstRowUpper.some(h => KNOWN_COLS.includes(h));

          if (hasStandardHeader) {
            // Fluxo normal: primeira linha = cabeçalho
            const headers = firstRowUpper;
            for (let i = 1; i < sheetMatrix.length; i++) {
              const row = sheetMatrix[i];
              if (!row || row.length === 0) continue;
              const rowData: any = { _aba_origem: sheetName };
              headers.forEach((header, index) => {
                if (header && row[index] !== undefined && row[index] !== null && row[index] !== '') {
                  rowData[header] = row[index];
                }
              });
              allDataMatrix.push(rowData);
            }
          } else {
            // Aba sem cabeçalho padrão (ex: ABRIL, Manutençao): mapeia todas as linhas por posição
            for (let i = 0; i < sheetMatrix.length; i++) {
              const row = sheetMatrix[i];
              if (!row || row.length === 0) continue;
              const rowData = buildPositionalRow(row, sheetName);
              if (rowData['FORNECEDOR']) allDataMatrix.push(rowData);
            }
          }
        }

        console.log(`Planilha lida. Total de linhas: ${allDataMatrix.length}`);

        if (allDataMatrix.length === 0) {
          showNotification('A planilha parece estar vazia em todas as abas.', 'error');
          return;
        }

        const getRowValue = (row: any, keys: string[]) => {
          for (const key of keys) {
            const foundKey = Object.keys(row).find(rk => rk === key.toUpperCase());
            if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
              return row[foundKey];
            }
          }
          // Partial match apenas para descrição e observações
          if (keys.includes('DESCRIÇÃO') || keys.includes('OBSERVACAO')) {
            for (const key of keys) {
              const foundKey = Object.keys(row).find(rk => rk.toUpperCase().includes(key.toUpperCase()));
              if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
                return row[foundKey];
              }
            }
          }
          return undefined;
        };

        const parseValor = (val: any): number => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          const str = String(val).replace(/[R$\s]/g, '').trim();
          if (str === '' || str.toUpperCase() === 'TOTAL') return 0;
          
          // Trata formatos como 1.500,00 ou 1500,00 ou 1500.00
          if (str.includes(',') && str.includes('.')) {
             // Ex: 1.500,00 -> remove ponto, troca virgula por ponto
             return Number(str.replace(/\./g, '').replace(',', '.'));
          } else if (str.includes(',')) {
             // Ex: 1500,00
             return Number(str.replace(',', '.'));
          } else if ((str.match(/\./g) || []).length > 1) {
             // Ex: 1.500.000 -> remove todos os pontos
             return Number(str.replace(/\./g, ''));
          }
          
          const n = Number(str);
          return isNaN(n) ? 0 : n;
        };

        const localSuppliers = new Set(suppliers.map(s => s.nome));
        
        let txBatch: Omit<Transaction, 'id'>[] = [];
        let supBatch: Omit<Supplier, 'id'>[] = [];
        let totalImported = 0;
        let totalFinanceiro = 0;

        for (const row of allDataMatrix) {
          const rawFornecedor = getRowValue(row, ['FORNECEDOR', 'FORNECEDORES', 'FORNECEDOR_NOME', 'NOME', 'FAVORECIDO', 'CLIENTE']);
          if (!rawFornecedor || String(rawFornecedor).toUpperCase().includes('TOTAL')) continue;

          const rawValor = getRowValue(row, ['VALOR', 'VALOR TOTAL', 'TOTAL', 'VALOR_TOTAL', 'QUANTIA', 'PREÇO', 'PRECO', 'SAIDA', 'SAÍDA', 'PAGAMENTO']);
          const sanitizedValor = parseValor(rawValor);
          
          if (sanitizedValor === 0 && !rawValor) continue;
          if (String(rawFornecedor).toUpperCase() === 'FORNECEDOR' || String(rawFornecedor).toUpperCase() === 'CLIENTE') continue;

          const formatDate = (val: any) => {
            if (!val) return undefined;
            
            if (val instanceof Date) {
              const dt = new Date(val);
              let day = dt.getUTCDate();
              let month = dt.getUTCMonth() + 1;
              let year = dt.getUTCFullYear();
              if (!Number.isFinite(year) || year < 1990 || year > 2035) return undefined;
              return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
            }

            if (typeof val === 'number') {
              const excelEpoch = Date.UTC(1899, 11, 30);
              const dt = new Date(excelEpoch + val * 24 * 60 * 60 * 1000);
              const y = dt.getUTCFullYear();
              const m = dt.getUTCMonth() + 1;
              const d = dt.getUTCDate();
              if (!Number.isFinite(y) || y < 1990 || y > 2035) return undefined;
              return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
            }

            const str = String(val).trim();
            if (str.includes('/')) {
              const parts = str.split('/');
              if (parts.length === 3) {
                let p0 = Number(parts[0]);
                let p1 = Number(parts[1]);
                let p2 = parts[2];
                if (p2.length === 2) p2 = '20' + p2;
                const y = Number(p2);
                if (!Number.isFinite(y) || y < 1990 || y > 2035) return undefined;
                return `${String(p0).padStart(2, '0')}/${String(p1).padStart(2, '0')}/${p2}`;
              }
            }
            return undefined;
          };


          const fornecedorNome = String(rawFornecedor).trim();
          
          const rawVencimento = getRowValue(row, ['VENCIMENTO', 'DATA VENCIMENTO', 'VENC']);
          const rawPagamento = getRowValue(row, ['DATA PAGAMENTO', 'PAGAMENTO', 'DATA PAGO', 'PAGO EM']);

          const vencimentoDate = formatDate(rawVencimento);
          const pagamentoDate = rawPagamento ? formatDate(rawPagamento) : undefined;
          if (!vencimentoDate) continue;
          
          const rawStatus = String(getRowValue(row, ['STATUS', 'SITUAÇÃO', 'SITUACAO', 'PAGO', 'SIT 2']) || '').toUpperCase();
          let status: TransactionStatus = 'PENDENTE';
          
          if (pagamentoDate || rawStatus.includes('PAGO')) {
            status = 'PAGO';
          } else if (rawStatus.includes('VENCIDO')) {
            status = 'VENCIDO';
          }

          const rawDescricao = getRowValue(row, ['DESCRIÇÃO', 'DESCRICAO', 'OBSERVACAO', 'OBSERVAÇÃO', 'OBS 1', 'OBS 2', 'OBS', 'DETALHE']);
          const rawEmpresa = getRowValue(row, ['EMPRESA', 'UNIDADE', 'LOJA', 'OBS 2', 'GRUPO']);

          const rawBanco = getRowValue(row, ['BANCO', 'CONTA', 'INSTITUIÇÃO', 'INSTITUICAO']);

          txBatch.push({
            uid: 'guest',
            fornecedor: fornecedorNome,
            descricao: String(rawDescricao || '-'),
            empresa: String(rawEmpresa || 'Geral'),
            vencimento: vencimentoDate,
            pagamento: pagamentoDate || undefined,
            valor: sanitizedValor,
            status: status,
            banco: rawBanco ? String(rawBanco) : undefined
          });
          
          totalImported++;
          totalFinanceiro += sanitizedValor;

          // Handle supplier
          if (!localSuppliers.has(fornecedorNome) && fornecedorNome !== 'Desconhecido') {
            supBatch.push({
              uid: 'guest',
              nome: fornecedorNome,


              email: '',
              telefone: '',
              cnpj: ''
            });
            localSuppliers.add(fornecedorNome);
          }

          // Lotes menores (250) e usar await com try-catch individual por lote para evitar queda
          if (txBatch.length >= 250) {
            try {
              console.log(`Enviando lote de ${txBatch.length} transações...`);
              await api.createTransactionsBatch(txBatch);
              txBatch = [];
            } catch (err) {
              console.error('Erro no lote de transações', err);
              txBatch = [];
            }
          }
          if (supBatch.length >= 250) {
            try {
              await api.createSuppliersBatch(supBatch);
              supBatch = [];
            } catch (err) {
              console.error('Erro no lote de fornecedores', err);
              supBatch = [];
            }
          }
        }

        console.log(`Total mapeado para envio: ${totalImported} linhas. Financeiro: R$ ${totalFinanceiro}`);

        // Lotes finais
        if (txBatch.length > 0) {
          try {
            console.log(`Enviando lote final de ${txBatch.length} transações...`);
            await api.createTransactionsBatch(txBatch);
          } catch(err) { console.error(err); }
        }
        if (supBatch.length > 0) {
          try {
            await api.createSuppliersBatch(supBatch);
          } catch(err) { console.error(err); }
        }

        showNotification(`${totalImported} lançamentos processados na importação!`, 'success');
        fetchTransactions();
        fetchSuppliers();
      } catch (err) {
        console.error('Erro ao processar arquivo:', err);
        showNotification('Erro ao processar o arquivo. Verifique o formato.', 'error');
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const markAsPaid = async (id: string, banco: string) => {
    const today = new Date().toLocaleDateString('pt-BR');
    setTransactions(prev => prev.map(tx =>
      tx.id === id ? { ...tx, status: 'PAGO' as TransactionStatus, pagamento: today, banco } : tx
    ));
    showNotification('Lançamento marcado como pago!', 'success');
    api.updateTransaction(id, { status: 'PAGO', pagamento: today, banco }).catch(err => {
      console.error('Failed to mark as paid:', err);
      fetchTransactions();
    });
  };

  const handleMarkAsPaidClick = (tx: Transaction) => {
    if (banks.filter(b => b.ativo).length > 0) {
      setShowPayModal({ id: tx.id, valor: tx.valor });
    } else {
      markAsPaid(tx.id, '');
    }
  };

  const updateTransaction = async (updatedTx: Transaction) => {
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
  };

  const syncSuppliers = async () => {
    const transactionSuppliers = new Set<string>(transactions.map(tx => tx.fornecedor));
    const existingNames = new Set<string>(suppliers.map(s => s.nome));
    let count = 0;

    for (const nome of transactionSuppliers) {
      if (!existingNames.has(nome) && nome !== 'Desconhecido') {
        await api.createSupplier({
          uid: 'guest',
          nome: nome,
          email: '',
          telefone: '',
          cnpj: ''
        });
        count++;
      }
    }

    if (count > 0) {
      showNotification(`${count} novos fornecedores sincronizados!`, 'success');
      fetchSuppliers();
    } else {
      showNotification('Todos os fornecedores já estão cadastrados.', 'info');
    }
  };

  const deleteTransaction = async (id: string) => {
    // Optimistic update — sem re-fetch
    setTransactions(prev => prev.filter(tx => tx.id !== id));
    showNotification('Lançamento excluído.', 'info');
    api.deleteTransaction(id).catch(err => {
      console.error('Failed to delete transaction:', err);
      fetchTransactions(); // rollback se falhar
    });
  };

  const deleteSupplier = async (id: string) => {
    try {
      await api.deleteSupplier(id);
      showNotification('Fornecedor excluído.', 'info');
      fetchSuppliers();
    } catch (error) {
      console.error('Failed to delete supplier:', error);
    }
  };

  const deleteBank = async (id: string) => {
    try {
      await api.deleteBank(id);
      showNotification('Banco excluído.', 'info');
      fetchBanks();
    } catch (error) {
      console.error('Failed to delete bank:', error);
    }
  };

  const resetSystem = async () => {
    if (!window.confirm('ATENÇÃO: Isso apagará TODOS os seus lançamentos e fornecedores da nuvem. Deseja continuar?')) return;
    
    try {
      showNotification('Iniciando limpeza de dados...', 'info');
      
      await api.resetDatabase();
      
      showNotification('Sistema resetado com sucesso!', 'success');
      fetchTransactions();
      fetchSuppliers();
    } catch (error) {
      console.error('Failed to reset system:', error);
      showNotification('Erro ao resetar o sistema.', 'error');
    }
  };

  // --- Computed Stats ---
  const stats = useMemo(() => {
    let total = 0;
    let pagos = 0;
    let pendentes = 0;
    let vencidos = 0;
    const empresasSet = new Set<string>();
    for (const tx of transactions) {
      total += tx.valor;
      if (tx.status === 'PAGO') pagos++;
      else if (tx.status === 'VENCIDO') vencidos++;
      else pendentes++;
      empresasSet.add(tx.empresa);
    }
    const kpis: KPI[] = [
      { label: 'VALOR TOTAL', value: total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), color: '#10b981' },
      { label: 'REGISTROS', value: transactions.length.toString(), description: 'Volume operacional', color: '#10b981' },
      { label: 'EMPRESAS', value: empresasSet.size.toString(), description: 'Unidades ativas', color: '#10b981' },
      { label: 'PENDENTES', value: pendentes.toString(), description: 'Aguardando conciliação', color: '#f59e0b' },
      { label: 'PAGOS', value: pagos.toString(), description: 'Liquidados', color: '#10b981' },
      { label: 'VENCIDOS', value: vencidos.toString(), description: 'Ação imediata necessária', color: '#ef4444' },
    ];
    return { total, pagos, pendentes, vencidos, kpis };
  }, [transactions]);

  // Removida a tela de loading de isAuthReady para permitir a renderização direta
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-surface/80 backdrop-blur-md border-b border-white/5 flex justify-between items-center w-full px-4 md:px-8 py-5 fixed top-0 z-50">
        <div className="flex items-center gap-4 md:gap-8">
          <h1 className="text-xl md:text-2xl font-black tracking-tighter premium-gradient-text font-headline">CN INTELLIGENCE</h1>

          <nav className="hidden lg:flex gap-6">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={cn("transition-all duration-200 font-medium text-sm", activeTab === 'dashboard' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-white")}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('lancamentos')}
              className={cn("transition-all duration-200 font-medium text-sm", activeTab === 'lancamentos' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-white")}
            >
              Lançamentos
            </button>
            <button 
              onClick={() => setActiveTab('fornecedores')}
              className={cn("transition-all duration-200 font-medium text-sm", activeTab === 'fornecedores' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-white")}
            >
              Fornecedores
            </button>
            <button 
              onClick={() => setActiveTab('relatorios')}
              className={cn("transition-all duration-200 font-medium text-sm", activeTab === 'relatorios' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-white")}
            >
              Relatórios
            </button>
            <button 
              onClick={() => setActiveTab('bancos')}
              className={cn("transition-all duration-200 font-medium text-sm", activeTab === 'bancos' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-white")}
            >
              Bancos
            </button>
            <button 
              onClick={() => setActiveTab('configuracoes')}
              className={cn("transition-all duration-200 font-medium text-sm", activeTab === 'configuracoes' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-white")}
            >
              Configurações
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <button className="p-2 text-on-surface-variant hover:bg-white/5 rounded-full transition-colors hidden sm:block">
            <Bell size={20} />
          </button>
        </div>
      </header>

      {/* Mobile Navigation (Bottom Bar) */}
      <nav className="lg:hidden fixed bottom-6 left-6 right-6 bg-surface/90 backdrop-blur-xl border border-white/10 z-50 flex justify-around items-center py-4 px-4 rounded-sm shadow-2xl">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'dashboard' ? "text-primary scale-110" : "text-on-surface-variant opacity-60")}
        >
          <LayoutDashboard size={22} strokeWidth={activeTab === 'dashboard' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Dash</span>
        </button>
        <button 
          onClick={() => setActiveTab('lancamentos')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'lancamentos' ? "text-primary scale-110" : "text-on-surface-variant opacity-60")}
        >
          <FileText size={22} strokeWidth={activeTab === 'lancamentos' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Lanç</span>
        </button>
        <button 
          onClick={() => setActiveTab('fornecedores')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'fornecedores' ? "text-primary scale-110" : "text-on-surface-variant opacity-60")}
        >
          <Building2 size={22} strokeWidth={activeTab === 'fornecedores' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Forn</span>
        </button>
        <button 
          onClick={() => setActiveTab('relatorios')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'relatorios' ? "text-primary scale-110" : "text-on-surface-variant opacity-60")}
        >
          <BarChart3 size={22} strokeWidth={activeTab === 'relatorios' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Relat</span>
        </button>
        <button 
          onClick={() => setActiveTab('bancos')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'bancos' ? "text-primary scale-110" : "text-on-surface-variant opacity-60")}
        >
          <CreditCard size={22} strokeWidth={activeTab === 'bancos' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Bancos</span>
        </button>
        <button 
          onClick={() => setActiveTab('configuracoes')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'configuracoes' ? "text-primary scale-110" : "text-on-surface-variant opacity-60")}
        >
          <Settings size={22} strokeWidth={activeTab === 'configuracoes' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Config</span>
        </button>
      </nav>


      <main className="flex-grow pt-24 pb-24 lg:pb-12 px-4 md:px-8 max-w-[1600px] mx-auto w-full">
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div>
            <h2 className="text-2xl md:text-4xl font-extrabold font-headline text-on-surface mb-3 tracking-tight">
              {activeTab === 'dashboard' && '💰 Dashboard Fluxo de Caixa'}
              {activeTab === 'lancamentos' && '📋 Gestão de Lançamentos'}
              {activeTab === 'fornecedores' && '🏢 Fornecedores'}
              {activeTab === 'relatorios' && '📈 Relatórios Financeiros'}
              {activeTab === 'bancos' && '🏦 Bancos'}
              {activeTab === 'configuracoes' && '⚙️ Configurações'}
            </h2>
            <div className="flex flex-wrap gap-3">
              <span className="bg-surface-variant/20 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary border border-primary/20 flex items-center gap-2">
                <LayoutDashboard size={14} /> Grupo CN 2024-2025
              </span>
              <span className="bg-surface-variant/20 px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant flex items-center gap-2">
                <CheckCircle size={14} /> {transactions.length} registros
              </span>
              <span className="bg-surface-variant/20 px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant flex items-center gap-2">
                <Calendar size={14} /> {[...new Set(transactions.map(t => t.vencimento.substring(0, 7)))].length} períodos
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-surface-variant/20 text-on-surface px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-surface-variant/40 transition-all border border-white/5"
            >
              <FileSpreadsheet size={18} className="text-primary" /> Importar CSV
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
            />
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && (
              <DashboardTab 
                stats={stats} 
                transactions={transactions} 
                onMarkAsPaid={handleMarkAsPaidClick} 
              />
            )}
            {activeTab === 'lancamentos' && (
              <LancamentosTab 
                transactions={transactions} 
                onMarkAsPaid={handleMarkAsPaidClick} 
                deleteTransaction={deleteTransaction} 
                setShowNewTxModal={setShowNewTxModal} 
                setEditingTx={setEditingTx}
              />
            )}
            {activeTab === 'fornecedores' && (
              <FornecedoresTab 
                suppliers={suppliers} 
                transactions={transactions} 
                deleteSupplier={deleteSupplier} 
                setShowNewSupplierModal={setShowNewSupplierModal} 
                syncSuppliers={syncSuppliers}
                onSelectSupplier={setDetailSupplier}
              />
            )}

            {activeTab === 'relatorios' && <RelatoriosTab transactions={transactions} />}
            {activeTab === 'bancos' && (
              <BancosTab 
                banks={banks}
                transactions={transactions}
                setShowNewBankModal={setShowNewBankModal}
                setEditingBank={setEditingBank}
                deleteBank={deleteBank}
              />
            )}
            {activeTab === 'configuracoes' && (
              <div className="glass-card p-10 text-center space-y-6">
                <Settings size={48} className="mx-auto text-on-surface-variant opacity-20" />
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Configurações do Sistema</h3>
                  <p className="text-on-surface-variant max-w-md mx-auto">
                    Aqui você poderá gerenciar usuários, permissões e integrações bancárias em futuras atualizações.
                  </p>
                </div>
                
                <div className="pt-8 border-t border-white/5">
                  <h4 className="text-sm font-bold text-tertiary mb-4 uppercase tracking-widest">Limpeza de Dados</h4>
                  <div className="space-y-4 max-w-md mx-auto">
                    <div className="glass-card p-4 flex items-center justify-between">
                      <div className="text-left">
                        <p className="text-sm font-bold text-on-surface">Limpar Duplicados</p>
                        <p className="text-[10px] text-on-surface-variant">Remove lançamentos com fornecedor + vencimento + valor + empresa iguais, mantendo apenas o mais antigo.</p>
                      </div>
                      <button 
                        onClick={async () => {
                          if (!window.confirm('Isso removerá duplicados mantendo apenas o registro mais antigo. Continuar?')) return;
                          try {
                            const result = await api.cleanDuplicates();
                            showNotification(`${result.deleted} duplicados removidos!`, 'success');
                            fetchTransactions();
                          } catch (error) {
                            showNotification('Erro ao limpar duplicados.', 'error');
                          }
                        }}
                        className="bg-secondary/10 text-secondary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-secondary/20 transition-all border border-secondary/20 whitespace-nowrap ml-4"
                      >
                        <Trash2 size={14} /> Limpar Duplicados
                      </button>
                    </div>

                    <div className="glass-card p-4 flex items-center justify-between">
                      <div className="text-left">
                        <p className="text-sm font-bold text-on-surface">Limpar Dados Suspeitos</p>
                        <p className="text-[10px] text-on-surface-variant">Remove valores &gt; R$ 500k, &lt; R$ 0.01, nulos, ou com fornecedor inválido.</p>
                      </div>
                      <button 
                        onClick={async () => {
                          if (!window.confirm('Isso removerá dados suspeitos (valores extremos ou inválidos). Continuar?')) return;
                          try {
                            const result = await api.cleanSuspicious();
                            showNotification(`${result.deleted} registros suspeitos removidos!`, 'success');
                            fetchTransactions();
                          } catch (error) {
                            showNotification('Erro ao limpar dados suspeitos.', 'error');
                          }
                        }}
                        className="bg-tertiary/10 text-tertiary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-tertiary/20 transition-all border border-tertiary/20 whitespace-nowrap ml-4"
                      >
                        <Trash2 size={14} /> Limpar Suspeitos
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-white/5">
                  <h4 className="text-sm font-bold text-tertiary mb-4 uppercase tracking-widest">Zona de Perigo</h4>
                  <button 
                    onClick={resetSystem}
                    className="bg-tertiary/10 text-tertiary px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-tertiary/20 transition-all mx-auto border border-tertiary/20"
                  >
                    <Trash2 size={18} /> Resetar Todo o Sistema
                  </button>
                  <p className="text-[10px] text-on-surface-variant mt-3">
                    Isso apagará todos os seus lançamentos e fornecedores salvos na nuvem.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {detailSupplier && (
          <SupplierDetailModal 
            supplier={detailSupplier}
            transactions={transactions}
            onClose={() => setDetailSupplier(null)}
          />
        )}
      </AnimatePresence>

      {showNewTxModal && (
        <NewTxModal 
          suppliers={suppliers}
          banks={banks}
          setShowNewTxModal={setShowNewTxModal} 
          onSuccess={() => {
            fetchTransactions();
            showNotification('Lançamento salvo com sucesso!', 'success');
          }}
        />
      )}

      {showNewSupplierModal && (
        <NewSupplierModal 
          setShowNewSupplierModal={setShowNewSupplierModal} 
          onSuccess={() => {
            fetchSuppliers();
            showNotification('Fornecedor cadastrado com sucesso!', 'success');
          }}
        />
      )}

      {showNewBankModal && (
        <NewBankModal 
          setShowNewBankModal={setShowNewBankModal} 
          onSuccess={() => {
            fetchBanks();
            showNotification('Banco cadastrado com sucesso!', 'success');
          }}
        />
      )}

      {editingBank && (
        <EditBankModal
          bank={editingBank}
          onClose={() => setEditingBank(null)}
          onSuccess={() => {
            fetchBanks();
            showNotification('Banco atualizado com sucesso!', 'success');
          }}
        />
      )}

      {showPayModal && (
        <SelectBankModal 
          transactionId={showPayModal.id}
          valor={showPayModal.valor}
          banks={banks}
          onClose={() => setShowPayModal(null)}
          onConfirm={(banco) => {
            markAsPaid(showPayModal.id, banco);
            setShowPayModal(null);
          }}
        />
      )}


      {editingTx && (
        <EditTxModal 
          transaction={editingTx}
          suppliers={suppliers}
          banks={banks}
          onClose={() => setEditingTx(null)}
          onSave={updateTransaction}
        />
      )}

      {/* Footer */}
      <footer className="bg-surface border-t border-white/5 hidden lg:flex flex-col md:flex-row justify-between items-center px-8 w-full py-6 mt-auto">
        <div className="mb-4 md:mb-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Dashboard Fluxo de Caixa - Grupo CN | Dados atualizados em tempo real | © 2025
          </p>
        </div>
        <div className="flex gap-6">
          <a href="#" className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant hover:text-primary transition-all">Privacy Policy</a>
          <a href="#" className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant hover:text-primary transition-all">Terms of Service</a>
          <a href="#" className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant hover:text-primary transition-all">System Status</a>
        </div>
      </footer>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "fixed bottom-24 lg:bottom-8 right-8 z-[100] px-6 py-3 rounded-xl shadow-2xl border flex items-center gap-3",
              notification.type === 'success' && "bg-primary/20 border-primary/40 text-primary",
              notification.type === 'error' && "bg-tertiary/20 border-tertiary/40 text-tertiary",
              notification.type === 'info' && "bg-secondary/20 border-secondary/40 text-secondary"
            )}
          >
            {notification.type === 'success' && <CheckCircle size={18} />}
            {notification.type === 'error' && <X size={18} />}
            {notification.type === 'info' && <HelpCircle size={18} />}
            <span className="text-sm font-bold">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
