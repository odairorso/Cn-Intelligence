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
  RefreshCw
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

import { Transaction, KPI, ChartData, Supplier, TransactionStatus } from './types';
import { api } from './api';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type Tab = 'dashboard' | 'lancamentos' | 'fornecedores' | 'relatorios' | 'configuracoes';

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
  markAsPaid: (id: string) => void;
}

const DashboardTab = ({ stats, transactions, markAsPaid }: DashboardTabProps) => {
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
                    <span className="text-sm font-bold">
                      {tx.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    {tx.status !== 'PAGO' && (
                      <button 
                        onClick={() => markAsPaid(tx.id)}
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
  markAsPaid: (id: string) => void;
  deleteTransaction: (id: string) => void;
  setShowNewTxModal: (show: boolean) => void;
  setEditingTx: (tx: Transaction) => void;
}

const PAGE_SIZE = 50;

const LancamentosTab = ({ transactions, markAsPaid, deleteTransaction, setShowNewTxModal, setEditingTx }: LancamentosTabProps) => {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [monthFilter, setMonthFilter] = useState('TODOS');
  const [yearFilter, setYearFilter] = useState('TODOS');
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
    });
  }, [transactions, filter, statusFilter, monthFilter, yearFilter]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [filter, statusFilter, monthFilter, yearFilter]);

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
                <span className="font-bold text-sm whitespace-nowrap">
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
                    <button onClick={() => markAsPaid(tx.id)} className="p-2 text-primary bg-primary/10 rounded-lg">
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
                  <td className="px-8 py-4">
                    <div className="flex gap-2">
                      {tx.status !== 'PAGO' && (
                        <button
                          onClick={() => markAsPaid(tx.id)}
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
}

const FornecedoresTab = ({ suppliers, transactions, deleteSupplier, setShowNewSupplierModal, syncSuppliers }: FornecedoresTabProps) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-4">
        <h3 className="text-xl font-bold font-headline">Gestão de Fornecedores</h3>
        <button 
          onClick={syncSuppliers}
          className="bg-white/5 text-on-surface-variant px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-white/10 transition-colors"
          title="Sincronizar fornecedores dos lançamentos"
        >
          <RefreshCw size={14} /> Sincronizar
        </button>
      </div>
      <button 
        onClick={() => setShowNewSupplierModal(true)}
        className="bg-primary text-background px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-opacity"
      >
        <UserPlus size={18} /> Novo Fornecedor
      </button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {suppliers.map(s => (
        <div key={s.id} className="glass-card p-6 flex flex-col gap-4 relative group">
          <button 
            onClick={() => deleteSupplier(s.id)}
            className="absolute top-4 right-4 p-2 text-tertiary opacity-0 group-hover:opacity-100 transition-opacity hover:bg-tertiary/10 rounded"
          >
            <Trash2 size={16} />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
              {s.nome.charAt(0)}
            </div>
            <div>
              <h4 className="font-bold text-on-surface">{s.nome}</h4>
              <p className="text-xs text-on-surface-variant">{s.cnpj || 'CNPJ não informado'}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2 text-on-surface-variant">
              <FileText size={14} /> {s.email || 'E-mail não informado'}
            </p>
            <p className="flex items-center gap-2 text-on-surface-variant">
              <HelpCircle size={14} /> {s.telefone || 'Telefone não informado'}
            </p>
          </div>
          <div className="mt-auto pt-4 border-t border-white/5">
            <p className="text-xs font-bold text-primary uppercase tracking-widest">
              {transactions.filter(tx => tx.fornecedor === s.nome).length} Lançamentos
            </p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

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
      const dateParts = tx.vencimento.includes('-') ? tx.vencimento.split('-') : tx.vencimento.split('/');
      const year = tx.vencimento.includes('-') ? dateParts[0] : dateParts[2];
      const month = tx.vencimento.includes('-') ? dateParts[1] : dateParts[1];
      
      const matchesYear = selectedYear === 'TODOS' || year === selectedYear;
      const matchesMonth = selectedMonth === 'TODOS' || month === selectedMonth;
      const matchesCompany = selectedCompany === 'TODOS' || tx.empresa === selectedCompany;
      
      return matchesYear && matchesMonth && matchesCompany;
    });
  }, [transactions, selectedYear, selectedMonth, selectedCompany]);

  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const data = months.map((name, index) => {
      const monthNum = (index + 1).toString().padStart(2, '0');
      const value = filteredData
        .filter(tx => {
          const dateParts = tx.vencimento.includes('-') ? tx.vencimento.split('-') : tx.vencimento.split('/');
          const m = tx.vencimento.includes('-') ? dateParts[1] : dateParts[1];
          return m === monthNum;
        })
        .reduce((acc, tx) => acc + tx.valor, 0);
      return { name, value };
    });
    return data;
  }, [filteredData]);

  const companyData = useMemo(() => {
    const data = companies.map(name => {
      const value = filteredData
        .filter(tx => tx.empresa === name)
        .reduce((acc, tx) => acc + tx.valor, 0);
      return { name, value };
    });
    return data.sort((a, b) => b.value - a.value);
  }, [filteredData, companies]);

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

// --- Modals ---

interface NewTxModalProps {
  suppliers: Supplier[];
  setShowNewTxModal: (show: boolean) => void;
}

const NewTxModal = ({ suppliers, setShowNewTxModal }: NewTxModalProps) => {
  const [formData, setFormData] = useState({
    fornecedor: suppliers[0]?.nome || '',
    descricao: '',
    empresa: 'CN',
    vencimento: new Date().toISOString().split('T')[0],
    pagamento: '',
    valor: '',
    status: 'PENDENTE' as TransactionStatus
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const newTx = {
        uid: 'guest',
        ...formData,
        valor: Number(formData.valor),
        vencimento: formData.vencimento.split('-').reverse().join('/'),
        pagamento: formData.status === 'PAGO' ? (formData.pagamento ? formData.pagamento.split('-').reverse().join('/') : new Date().toLocaleDateString('pt-BR')) : null,
      };
      await api.createTransaction(newTx);
      setShowNewTxModal(false);
      window.location.reload(); // Recarrega para ver as mudanças
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
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Fornecedor</label>
            <select 
              className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
              value={formData.fornecedor}
              onChange={e => setFormData({...formData, fornecedor: e.target.value})}
            >
              {suppliers.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
            </select>
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
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as TransactionStatus})}
              >
                <option value="PENDENTE">PENDENTE</option>
                <option value="PAGO">PAGO</option>
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
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setShowNewTxModal(false)}
              className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-sm font-bold hover:bg-white/5"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-3 rounded-sm bg-primary text-background text-sm font-black uppercase tracking-widest hover:bg-primary-dark transition-all"
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
  onClose: () => void;
  onSave: (tx: Transaction) => void;
}

const EditTxModal = ({ transaction, suppliers, onClose, onSave }: EditTxModalProps) => {
  const [formData, setFormData] = useState({
    ...transaction,
    // Convert dates from DD/MM/YYYY to YYYY-MM-DD for input[type="date"]
    vencimento: transaction.vencimento.split('/').reverse().join('-'),
    pagamento: transaction.pagamento ? transaction.pagamento.split('/').reverse().join('-') : '',
    valor: transaction.valor.toString()
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...transaction,
      ...formData,
      vencimento: formData.vencimento.split('-').reverse().join('/'),
      pagamento: formData.status === 'PAGO' ? formData.pagamento.split('-').reverse().join('/') : null,
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
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Fornecedor</label>
            <select 
              className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all"
              value={formData.fornecedor}
              onChange={e => setFormData({...formData, fornecedor: e.target.value})}
            >

              <option value={transaction.fornecedor}>{transaction.fornecedor}</option>
              {suppliers.filter(s => s.nome !== transaction.fornecedor).map(s => (
                <option key={s.id} value={s.nome}>{s.nome}</option>
              ))}
            </select>
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
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as TransactionStatus})}
              >
                <option value="PENDENTE">PENDENTE</option>
                <option value="PAGO">PAGO</option>
                <option value="VENCIDO">VENCIDO</option>
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

interface NewSupplierModalProps {
  setShowNewSupplierModal: (show: boolean) => void;
}

const NewSupplierModal = ({ setShowNewSupplierModal }: NewSupplierModalProps) => {
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
      window.location.reload();
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
              className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-sm font-bold hover:bg-white/5"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-background text-sm font-bold hover:opacity-90"
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
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(true);

  const [showNewTxModal, setShowNewTxModal] = useState(false);
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchTransactions = async () => {
    try {
      const data = await api.getTransactions('guest');
      const parseDate = (d: string) => {
        const parts = d.split('/');
        return parts.length === 3 ? new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime() : 0;
      };
      setTransactions(data.sort((a: any, b: any) => parseDate(b.vencimento) - parseDate(a.vencimento)));
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

  useEffect(() => {
    fetchTransactions();
    fetchSuppliers();
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
          const rawFornecedor = getRowValue(row, ['FORNECEDOR', 'FORNECEDORES', 'FORNECEDOR_NOME', 'NOME', 'FAVORECIDO', 'CLIENTE', 'OBSERVAÇAO']);
          if (!rawFornecedor || String(rawFornecedor).toUpperCase().includes('TOTAL')) continue;

          const rawValor = getRowValue(row, ['VALOR', 'VALOR TOTAL', 'TOTAL', 'VALOR_TOTAL', 'QUANTIA', 'PREÇO', 'PRECO', 'SAIDA', 'SAÍDA', 'PAGAMENTO']);
          const sanitizedValor = parseValor(rawValor);
          
          if (sanitizedValor === 0 && !rawValor) continue;
          if (String(rawFornecedor).toUpperCase() === 'FORNECEDOR' || String(rawFornecedor).toUpperCase() === 'CLIENTE') continue;

          const formatDate = (val: any, sheetName?: string) => {
            if (!val) return undefined;
            if (val instanceof Date) {
              const dt = new Date(val);
              let day = dt.getUTCDate();
              let month = dt.getUTCMonth() + 1;
              let year = dt.getUTCFullYear();
              
              if (month > 12) {
                let temp = month;
                month = day;
                day = temp;
              }
              
              if (month > 12) month = 12;
              if (day > 31) day = 28;
              
              return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
            }
            const str = String(val).trim();
            if (str.includes('/')) {
              const parts = str.split('/');
              if (parts.length === 3) {
                let p0 = Number(parts[0]);
                let p1 = Number(parts[1]);
                let p2 = parts[2];
                
                if (p2.length === 2) p2 = '20' + p2;
                
                let day = p0;
                let month = p1;
                
                if (p0 > 12) {
                  day = p0;
                  month = p1;
                } else if (p1 > 12) {
                  day = p1;
                  month = p0;
                } else {
                  if (sheetName && sheetName.toUpperCase().includes('MAR')) {
                     if (p0 === 3) { month = p0; day = p1; }
                     else if (p1 === 3) { month = p1; day = p0; }
                     else { day = p0; month = p1; }
                  } else {
                     day = p0;
                     month = p1;
                  }
                }
                
                if (month > 12) {
                  let temp = month;
                  month = day;
                  day = temp;
                }
                
                if (month > 12) month = 12;
                if (day > 31) day = 28;
                
                return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${p2}`;
              }
            }
            return str;
          };

          const fornecedorNome = String(rawFornecedor).trim();
          
          const rawVencimento = getRowValue(row, ['VENCIMENTO', 'DATA VENCIMENTO', 'DATA', 'VENC']);
          const rawPagamento = getRowValue(row, ['DATA PAGAMENTO', 'PAGAMENTO', 'DATA PAGO', 'PAGO EM']);

          const vencimentoDate = formatDate(rawVencimento, row._aba_origem);
          const pagamentoDate = rawPagamento ? formatDate(rawPagamento, row._aba_origem) : undefined;
          
          const rawStatus = String(getRowValue(row, ['STATUS', 'SITUAÇÃO', 'SITUACAO', 'PAGO', 'SIT 2']) || '').toUpperCase();
          let status: TransactionStatus = 'PENDENTE';
          
          if (pagamentoDate || rawStatus.includes('PAGO')) {
            status = 'PAGO';
          } else if (rawStatus.includes('VENCIDO')) {
            status = 'VENCIDO';
          }

          const rawDescricao = getRowValue(row, ['DESCRIÇÃO', 'DESCRICAO', 'OBSERVACAO', 'OBSERVAÇÃO', 'OBS 1', 'OBS 2', 'OBS', 'DETALHE']);
          const rawEmpresa = getRowValue(row, ['EMPRESA', 'UNIDADE', 'LOJA', 'OBS 2', 'GRUPO']);

          txBatch.push({
            uid: 'guest',
            fornecedor: fornecedorNome,


            descricao: String(rawDescricao || '-'),
            empresa: String(rawEmpresa || 'Geral'),
            vencimento: vencimentoDate,
            pagamento: pagamentoDate || undefined,
            valor: sanitizedValor,
            status: status
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

  const markAsPaid = async (id: string) => {
    const today = new Date().toLocaleDateString('pt-BR');
    // Optimistic update — sem re-fetch
    setTransactions(prev => prev.map(tx =>
      tx.id === id ? { ...tx, status: 'PAGO' as TransactionStatus, pagamento: today } : tx
    ));
    showNotification('Lançamento marcado como pago!', 'success');
    api.updateTransaction(id, { status: 'PAGO', pagamento: today }).catch(err => {
      console.error('Failed to mark as paid:', err);
      fetchTransactions(); // rollback se falhar
    });
  };

  const updateTransaction = async (updatedTx: Transaction) => {
    const { id, ...data } = updatedTx;
    if (!id) return;
    // Optimistic update — sem re-fetch
    setTransactions(prev => prev.map(tx => tx.id === id ? updatedTx : tx));
    showNotification('Lançamento atualizado!', 'success');
    api.updateTransaction(id, data).catch(err => {
      console.error('Failed to update transaction:', err);
      fetchTransactions(); // rollback se falhar
    });
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
    const total = transactions.reduce((acc, tx) => acc + tx.valor, 0);
    const pagos = transactions.filter(tx => tx.status === 'PAGO').length;
    const pendentes = transactions.filter(tx => tx.status === 'PENDENTE').length;
    const vencidos = transactions.filter(tx => tx.status === 'VENCIDO').length;
    
    const kpis: KPI[] = [
      { label: 'VALOR TOTAL', value: total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), color: '#10b981' },
      { label: 'REGISTROS', value: transactions.length.toString(), description: 'Volume operacional', color: '#10b981' },
      { label: 'EMPRESAS', value: [...new Set(transactions.map(t => t.empresa))].length.toString(), description: 'Unidades ativas', color: '#10b981' },
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
                markAsPaid={markAsPaid} 
              />
            )}
            {activeTab === 'lancamentos' && (
              <LancamentosTab 
                transactions={transactions} 
                markAsPaid={markAsPaid} 
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
              />
            )}
            {activeTab === 'relatorios' && <RelatoriosTab transactions={transactions} />}
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
      {showNewTxModal && (
        <NewTxModal 
          suppliers={suppliers} 
          setShowNewTxModal={setShowNewTxModal} 
        />
      )}
      {showNewSupplierModal && (
        <NewSupplierModal 
          setShowNewSupplierModal={setShowNewSupplierModal} 
        />
      )}

      {editingTx && (
        <EditTxModal 
          transaction={editingTx}
          suppliers={suppliers}
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
