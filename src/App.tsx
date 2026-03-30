import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  ChevronDown,
  Download,
  Plus,
  Trash2,
  Check,
  Search,
  BarChart3,
  PieChart as PieChartIcon,
  UserPlus,
  FileSpreadsheet,
  X,
  Edit,
  RefreshCw,
  CreditCard,
  FileUp,
  Loader2,
  Printer,
  Merge
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, Tooltip, 
  AreaChart, Area, CartesianGrid
} from 'recharts';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { motion, AnimatePresence } from 'motion/react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

import { Transaction, KPI, Supplier, TransactionStatus, Bank, ContaContabil } from './types';
import { api } from './api';
import { OFXImportTab } from './OFXImport';
import { useAppData } from './hooks/useAppData';
import {
  cn, toInputDate, toDisplayDate, dateSortKey,
  normalizeSupplierName, normalizeCompanyKey,
  isSupplierMatch, isRevenueTransaction, matchesAccountType, formatBRL,
} from './lib/utils';
import { DEFAULT_COMPANIES, DEFAULT_ACCOUNTS, PAGE_SIZE, MONTH_LABELS } from './lib/constants';
import { AnimatedNumber } from './components/AnimatedNumber';
import { GlobalSearch } from './components/GlobalSearch';

const defaultBrandLogo = new URL('../Logo Cn/WhatsApp Image 2021-02-10 at 10.34.53.jpeg', import.meta.url).href;

// --- Types ---
type Tab = 'dashboard' | 'lancamentos' | 'fornecedores' | 'relatorios' | 'receitas' | 'bancos' | 'extrato' | 'configuracoes';

type PdfImportDraft = {
  fileName: string;
  fornecedor: string;
  vencimento: string;
  valor: number;
  descricao: string;
  empresa: string;
  cnpj: string;
  numero_boleto: string;
  tipo?: 'RECEITA' | 'DESPESA';
  rawText: string;
  duplicate: boolean;
  conta_contabil_id?: number;
};

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
        <h3 className="text-xl lg:text-2xl xl:text-3xl font-black font-headline text-on-surface break-words leading-tight">
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
  const [empresaFilter, setEmpresaFilter] = useState('TODOS');

  // Empresas normalizadas — agrupa CN/Cn/cn → CN, FACEMS/Facems → FACEMS etc.
  const empresas = useMemo(() => {
    const map = new Map<string, string>(); // normalizado → label canônico
    transactions.forEach(tx => {
      if (!tx.empresa) return;
      const key = tx.empresa.trim().toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      // Só adiciona se ainda não existe, ou se o valor atual é mais "limpo" (todo maiúsculo)
      if (!map.has(key)) map.set(key, tx.empresa.trim().toUpperCase());
    });
    // Filtra entradas que claramente não são empresas (muito longas, contêm números, etc.)
    const valid = Array.from(map.entries())
      .filter(([key]) => key.length <= 30 && !/\d{3,}/.test(key) && !/[()[\]{}]/.test(key))
      .map(([, label]) => label)
      .sort();
    return ['TODOS', ...valid];
  }, [transactions]);

  // Filtra usando a chave normalizada para pegar todas as variações
  const filteredTx = useMemo(() => {
    if (empresaFilter === 'TODOS') return transactions;
    const key = empresaFilter.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return transactions.filter(tx =>
      (tx.empresa || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === key
    );
  }, [transactions, empresaFilter]);

  const statusChartData = [
    { name: 'Pagos', value: stats.pagos, color: '#10b981' },
    { name: 'Pendentes', value: stats.pendentes, color: '#f59e0b' },
    { name: 'Vencidos', value: stats.vencidos, color: '#ef4444' },
  ];

  // Gráfico receitas vs despesas por mês
  const monthlyFlux = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentYear = new Date().getFullYear();
    return months.map((month, idx) => {
      const monthTx = filteredTx.filter(tx => {
        const parts = tx.vencimento.split('/');
        return parts.length === 3 && parseInt(parts[1]) === idx + 1 && parts[2] === String(currentYear);
      });
      const receitas = monthTx.filter(tx => tx.tipo === 'RECEITA').reduce((a, tx) => a + tx.valor, 0);
      const despesas = monthTx.filter(tx => tx.tipo !== 'RECEITA').reduce((a, tx) => a + tx.valor, 0);
      const saldo = receitas - despesas;
      return { name: month, receitas, despesas, saldo };
    });
  }, [filteredTx]);

  // Top 5 fornecedores por valor
  const topSuppliers = useMemo(() => {
    const supplierMap = new Map<string, number>();
    filteredTx.forEach(tx => {
      const current = supplierMap.get(tx.fornecedor) || 0;
      supplierMap.set(tx.fornecedor, current + tx.valor);
    });
    return Array.from(supplierMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  }, [filteredTx]);

  // Stats filtrados
  const filteredStats = useMemo(() => {
    let total = 0, pagos = 0, pendentes = 0, vencidos = 0;
    const today = new Date(); today.setHours(0,0,0,0);
    for (const tx of filteredTx) {
      total += tx.valor;
      if (tx.status === 'PAGO') pagos++;
      else if (tx.status === 'VENCIDO') vencidos++;
      else {
        const parts = tx.vencimento?.split('/');
        if (parts?.length === 3) {
          const vDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
          if (vDate < today) vencidos++; else pendentes++;
        } else pendentes++;
      }
    }
    return { total, pagos, pendentes, vencidos };
  }, [filteredTx]);

  const totalTx = filteredTx.length || 1;
  const pagosPercent = Math.round((filteredStats.pagos / totalTx) * 100);
  const pendentesPercent = Math.round((filteredStats.pendentes / totalTx) * 100);
  const vencidosPercent = Math.round((filteredStats.vencidos / totalTx) * 100);

  // Índice de saúde financeira
  const healthScore = pagosPercent;
  const healthColor = healthScore >= 80 ? '#10b981' : healthScore >= 60 ? '#f59e0b' : '#ef4444';
  const healthLabel = healthScore >= 80 ? 'Saudável' : healthScore >= 60 ? 'Atenção' : 'Crítico';

  return (
    <div className="space-y-6">

      {/* Filtro por empresa */}
      <div className="flex flex-wrap items-center gap-2">
        {empresas.map(emp => (
          <button
            key={emp}
            onClick={() => setEmpresaFilter(emp)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
              empresaFilter === emp
                ? "bg-primary text-background border-primary"
                : "bg-white/5 text-on-surface-variant border-white/10 hover:border-primary/40 hover:text-on-surface"
            )}
          >
            {emp}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'VALOR TOTAL', value: filteredStats.total, format: 'currency' as const, color: '#3b82f6' },
          { label: 'REGISTROS', value: filteredTx.length, format: 'number' as const, color: '#3b82f6', desc: 'Volume operacional' },
          { label: 'PENDENTES', value: filteredStats.pendentes, format: 'number' as const, color: '#f59e0b', desc: 'Aguardando' },
          { label: 'PAGOS', value: filteredStats.pagos, format: 'number' as const, color: '#10b981', desc: 'Liquidados' },
          { label: 'VENCIDOS', value: filteredStats.vencidos, format: 'number' as const, color: '#ef4444', desc: 'Ação necessária' },
          { label: 'SAÚDE', value: healthScore, format: 'number' as const, color: healthColor, desc: healthLabel, suffix: '%' },
        ].map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="relative overflow-hidden glass-card p-5 group hover:border-primary/40 transition-all duration-300"
          >
            <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full" style={{ background: `radial-gradient(circle, ${kpi.color}18, transparent)` }} />
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/60 mb-2">{kpi.label}</p>
            <h3 className="text-lg xl:text-2xl font-black font-headline text-on-surface group-hover:text-primary transition-colors leading-tight">
              <AnimatedNumber value={kpi.value} format={kpi.format} duration={900} />
              {kpi.suffix}
            </h3>
            {kpi.desc && <p className="text-[9px] text-on-surface-variant/50 mt-1 font-medium">{kpi.desc}</p>}
          </motion.div>
        ))}
      </div>

      {/* Cards de Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Pagos', value: filteredStats.pagos, percent: pagosPercent, color: 'primary', icon: <CheckCircle size={20} className="text-primary" />, delay: 0.2 },
          { label: 'Pendentes', value: filteredStats.pendentes, percent: pendentesPercent, color: 'secondary', icon: <Calendar size={20} className="text-secondary" />, delay: 0.3 },
          { label: 'Vencidos', value: filteredStats.vencidos, percent: vencidosPercent, color: 'tertiary', icon: <TrendingUp size={20} className="text-tertiary" />, delay: 0.4 },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: item.delay }}
            className={`glass-card p-6 border-l-4 border-${item.color}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-${item.color}/20 flex items-center justify-center`}>{item.icon}</div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">{item.label}</p>
                  <p className={`text-2xl font-black text-${item.color}`}>
                    <AnimatedNumber value={item.value} duration={900} />
                  </p>
                </div>
              </div>
              <span className={`text-3xl font-black text-${item.color}/20`}>{item.percent}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${item.percent}%` }}
                transition={{ delay: item.delay + 0.3, duration: 0.8 }}
                className={`h-full bg-gradient-to-r from-${item.color} to-${item.color}/60 rounded-full`}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receitas vs Despesas */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-lg font-bold font-headline">Receitas vs Despesas</h4>
              <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest mt-1">Fluxo mensal {new Date().getFullYear()}</p>
            </div>
            <div className="flex items-center gap-4 text-[10px]">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#10b981]" /> Receitas</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-tertiary" /> Despesas</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyFlux} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="name" stroke="#c6c6cd" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis stroke="#c6c6cd" fontSize={10} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #ffffff15', borderRadius: '12px' }}
                itemStyle={{ color: '#dee2f7', fontSize: '12px' }}
                formatter={(v: number) => [v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), '']}
              />
              <Bar dataKey="receitas" fill="#10b981" radius={[3,3,0,0]} />
              <Bar dataKey="despesas" fill="#ef4444" radius={[3,3,0,0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Status Donut */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="glass-card p-6">
          <div className="mb-6">
            <h4 className="text-lg font-bold font-headline">Status dos Lançamentos</h4>
            <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest mt-1">Distribuição atual</p>
          </div>
          <div className="flex items-center justify-center relative">
            {filteredTx.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[260px] text-on-surface-variant opacity-20">
                <PieChartIcon size={64} /><p className="text-xs uppercase tracking-widest mt-4">Sem dados</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={70} outerRadius={95} paddingAngle={4} dataKey="value" cornerRadius={6}>
                      {statusChartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #ffffff15', borderRadius: '12px' }}
                      itemStyle={{ color: '#dee2f7' }}
                      formatter={(v: number) => [`${v} lançamentos`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-4xl font-black" style={{ color: healthColor }}>{pagosPercent}%</span>
                  <span className="text-[10px] uppercase text-on-surface-variant font-bold tracking-widest">{healthLabel}</span>
                </div>
              </>
            )}
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {statusChartData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                <span className="text-xs font-medium text-on-surface-variant">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Top Fornecedores + Últimos Lançamentos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }} className="glass-card p-6">
          <div className="mb-6">
            <h4 className="text-lg font-bold font-headline">Top Fornecedores</h4>
            <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest mt-1">Por volume financeiro</p>
          </div>
          {topSuppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-on-surface-variant opacity-40">
              <Building2 size={32} className="mb-3" /><p className="text-xs">Nenhum fornecedor</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topSuppliers.map((supplier, idx) => {
                const maxValue = topSuppliers[0]?.value || 1;
                const percent = Math.round((supplier.value / maxValue) * 100);
                return (
                  <div key={idx} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary">{idx + 1}</span>
                        <span className="text-sm font-semibold truncate max-w-[140px]">{supplier.name}</span>
                      </div>
                      <span className="text-xs font-bold text-primary">{formatBRL(supplier.value)}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ delay: 0.8 + idx * 0.1, duration: 0.6 }}
                        className="h-full bg-gradient-to-r from-primary to-primary/40 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="glass-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-lg font-bold font-headline">Últimos Lançamentos</h4>
              <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest mt-1">Atividade recente</p>
            </div>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">{filteredTx.length} total</span>
          </div>
          {filteredTx.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant opacity-40">
              <FileText size={48} className="mb-4" />
              <p className="text-sm font-medium">Nenhum lançamento encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTx.slice(0, 6).map((tx, idx) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 + idx * 0.05 }}
                  className="flex items-center justify-between p-4 bg-white/[0.03] rounded-xl border border-white/5 hover:bg-white/[0.06] hover:border-primary/20 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center",
                      tx.status === 'PAGO' && "bg-primary/20",
                      tx.status === 'PENDENTE' && "bg-secondary/20",
                      tx.status === 'VENCIDO' && "bg-tertiary/20"
                    )}>
                      {tx.status === 'PAGO' && <CheckCircle size={18} className="text-primary" />}
                      {tx.status === 'PENDENTE' && <Calendar size={18} className="text-secondary" />}
                      {tx.status === 'VENCIDO' && <TrendingUp size={18} className="text-tertiary" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-on-surface group-hover:text-white transition-colors">{tx.fornecedor}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/50">{tx.vencimento}</span>
                        <span className="w-1 h-1 rounded-full bg-white/20" />
                        <span className="text-[10px] font-bold text-primary/60 uppercase">{tx.empresa}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className={cn("text-sm font-black", tx.valor < 0 ? "text-tertiary" : "text-primary")}>
                        {formatBRL(tx.valor)}
                      </span>
                      <div className="mt-0.5">
                        <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                          tx.status === 'PAGO' && "bg-primary/20 text-primary",
                          tx.status === 'PENDENTE' && "bg-secondary/20 text-secondary",
                          tx.status === 'VENCIDO' && "bg-tertiary/20 text-tertiary"
                        )}>{tx.status}</span>
                      </div>
                    </div>
                    {tx.status !== 'PAGO' && (
                      <button onClick={() => onMarkAsPaid(tx)} className="p-2 bg-primary/10 text-primary rounded-lg opacity-0 group-hover:opacity-100 hover:bg-primary/20 transition-all">
                        <CheckCircle size={16} />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
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
                <th className="px-8 py-4 sticky right-0 bg-surface z-10 border-l border-white/5 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.3)]">Ações</th>
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
                    {(Number(tx.valor) + Number(tx.juros || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    {Number(tx.juros) > 0 && (
                      <p className="text-[9px] text-tertiary font-normal">(inclui {Number(tx.juros).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} juros)</p>
                    )}
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
                  <td className="px-8 py-4 sticky right-0 bg-surface z-10 border-l border-white/5 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.3)] group-hover:bg-surface-variant/20 transition-colors">
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
  const [mergeTarget, setMergeTarget] = useState<string>('');
  const [mergeAliases, setMergeAliases] = useState<string[]>([]);

  // Pre-calculate transaction count per supplier (optimized O(n) instead of O(n*m))
  const supplierTransactionCount = useMemo(() => {
    const countMap = new Map<string, number>();
    transactions.forEach(tx => {
      const key = normalizeSupplierName(tx.fornecedor);
      if (key) {
        countMap.set(key, (countMap.get(key) || 0) + 1);
      }
    });
    return countMap;
  }, [transactions]);

  // Fast lookup for transaction count
  const getTransactionCount = (supplierName: string): number => {
    const key = normalizeSupplierName(supplierName);
    return supplierTransactionCount.get(key) || 0;
  };

  const mergedSuppliers = useMemo(() => {
    const byKey = new Map<string, Supplier>();

    // Add real suppliers first
    suppliers.forEach((s) => {
      const key = normalizeSupplierName(s.nome);
      if (!key) return;
      byKey.set(key, s);
    });

    // Only add virtual suppliers from transactions if not already in suppliers
    // Limit to first 500 unique to avoid performance issues with large datasets
    let virtualCount = 0;
    const seenVirtual = new Set<string>();
    
    for (const tx of transactions) {
      if (virtualCount >= 500) break; // Limit virtual suppliers
      
      const key = normalizeSupplierName(tx.fornecedor);
      if (!key || byKey.has(key) || seenVirtual.has(key)) continue;
      
      seenVirtual.add(key);
      byKey.set(key, {
        id: `virtual-${key}`,
        uid: 'guest',
        nome: tx.fornecedor,
        cnpj: '',
        email: '',
        telefone: ''
      });
      virtualCount++;
    }

    return Array.from(byKey.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [suppliers, transactions]);

  const filteredSuppliers = useMemo(() => {
    const q = normalizeSupplierName(searchSupplier);
    if (!q) return mergedSuppliers;
    return mergedSuppliers.filter((s) => normalizeSupplierName(s.nome).includes(q));
  }, [mergedSuppliers, searchSupplier]);

  const duplicateGroups = useMemo(() => {
    const map = new Map<string, Set<string>>();
    
    // Only process suppliers, not virtual ones
    suppliers.forEach((s) => {
      if (s.id?.startsWith('virtual-')) return; // Skip virtual suppliers
      
      const key = normalizeSupplierName(s.nome);
      if (!key) return;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(s.nome);
    });
    
    const out: Array<{ key: string; names: string[] }> = [];
    map.forEach((set, key) => {
      if (set.size <= 1) return; // Skip singles
      const arr = Array.from(set.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      out.push({ key, names: arr });
    });
    
    return out.sort((a, b) => a.names[0].localeCompare(b.names[0], 'pt-BR'));
  }, [suppliers]);

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
          <button
            onClick={async () => {
              try {
                await api.mergeSuppliersAuto();
                window.location.reload();
              } catch (e) {
                console.error('Auto merge error', e);
              }
            }}
            className="bg-primary/10 text-primary px-4 py-2 rounded-sm text-xs font-bold flex items-center gap-2 hover:bg-primary/20 transition-colors"
            title="Unificar variações automaticamente"
          >
            <Merge size={14} /> Unificar Auto
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

      {duplicateGroups.length > 0 && (
        <div className="glass-card p-4">
          <h4 className="text-sm font-bold text-on-surface mb-3">Unificar Fornecedores Duplicados</h4>
          <div className="space-y-3">
            {duplicateGroups.map((g, idx) => (
              <div key={g.key} className="flex flex-wrap items-center gap-2 border border-white/10 rounded-lg p-3">
                <select
                  value={mergeTarget && g.names.includes(mergeTarget) ? mergeTarget : g.names[0]}
                  onChange={(e) => setMergeTarget(e.target.value)}
                  className="bg-surface-variant/20 border border-white/10 rounded px-2 py-1 text-xs"
                >
                  {g.names.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase">← manter</span>
                <div className="flex flex-wrap gap-2">
                  {g.names.map((n) => (
                    <label key={n} className="inline-flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={mergeAliases.includes(n)}
                        onChange={(e) => {
                          setMergeAliases((prev) => e.target.checked ? Array.from(new Set([...prev, n])) : prev.filter((x) => x !== n));
                        }}
                      />
                      <span className="px-2 py-1 rounded bg-surface-variant/20 border border-white/10">{n}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={async () => {
                    const target = mergeTarget && g.names.includes(mergeTarget) ? mergeTarget : g.names[0];
                    const toMerge = mergeAliases.filter((n) => n !== target && g.names.includes(n));
                    if (toMerge.length === 0) return;
                    try {
                      await api.mergeSuppliers(target, toMerge);
                      setMergeAliases([]);
                      setMergeTarget('');
                      await syncSuppliers();
                    } catch {
                    }
                  }}
                  className="ml-auto bg-primary/10 text-primary px-3 py-1.5 rounded text-xs font-bold border border-primary/20 hover:bg-primary/20"
                >
                  Unificar Selecionados
                </button>
              </div>
            ))}
            {duplicateGroups.length === 0 && (
              <p className="text-xs text-on-surface-variant">Sem duplicados detectados.</p>
            )}
          </div>
        </div>
      )}

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
                {getTransactionCount(s.nome)} Lançamentos
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
  const [selectedTipo, setSelectedTipo] = useState<string>('TODOS');

  const companies = useMemo(() => {
    const map = new Map<string, string>();
    for (const tx of transactions) {
      const companyKey = normalizeCompanyKey(tx.empresa);
      if (!map.has(companyKey)) map.set(companyKey, companyKey);
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [transactions]);

  const filteredData = useMemo(() => {
    return transactions.filter(tx => {
      const parts = tx.vencimento.includes('/') ? tx.vencimento.split('/') : tx.vencimento.split('-');
      const year = tx.vencimento.includes('/') ? parts[2] : parts[0];
      const month = tx.vencimento.includes('/') ? parts[1] : parts[1];
      const matchesYear = selectedYear === 'TODOS' || year === selectedYear;
      const matchesMonth = selectedMonth === 'TODOS' || month === selectedMonth;
      const matchesCompany = selectedCompany === 'TODOS' || normalizeCompanyKey(tx.empresa) === selectedCompany;
      const txTipo = tx.tipo || (isRevenueTransaction(tx) ? 'RECEITA' : 'DESPESA');
      const matchesTipo = selectedTipo === 'TODOS' || txTipo === selectedTipo;
      return matchesYear && matchesMonth && matchesCompany && matchesTipo;
    });
  }, [transactions, selectedYear, selectedMonth, selectedCompany, selectedTipo]);

  const periodTotals = useMemo(() => {
    let total = 0;
    let jurosTotal = 0;
    for (const tx of filteredData) {
      total += Number(tx.valor) + Number(tx.juros || 0);
      jurosTotal += Number(tx.juros || 0);
    }
    return { total, jurosTotal, count: filteredData.length };
  }, [filteredData]);

  const monthLabel = useMemo(() => {
    const months: Record<string, string> = { '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril', '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto', '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro' };
    return selectedMonth === 'TODOS' ? 'Todos os Meses' : months[selectedMonth] || selectedMonth;
  }, [selectedMonth]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tipoLabel = selectedTipo === 'TODOS' ? 'Fluxo de Caixa' : selectedTipo === 'RECEITA' ? 'Relatório de Receitas' : 'Relatório de Despesas';
    const now = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    const rows = filteredData.map((tx, i) => {
      const valorTotal = Number(tx.valor) + Number(tx.juros || 0);
      return `<tr>
        <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">${i + 1}</td>
        <td style="padding:6px 8px;border:1px solid #ccc">${tx.fornecedor}</td>
        <td style="padding:6px 8px;border:1px solid #ccc">${tx.descricao || '-'}</td>
        <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">${tx.empresa || '-'}</td>
        <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">${tx.vencimento}</td>
        <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">${tx.pagamento || '-'}</td>
        <td style="padding:6px 8px;border:1px solid #ccc;text-align:right">${Number(tx.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
        <td style="padding:6px 8px;border:1px solid #ccc;text-align:right">${Number(tx.juros || 0) > 0 ? Number(tx.juros).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
        <td style="padding:6px 8px;border:1px solid #ccc;text-align:right;font-weight:bold">${valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
        <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">${tx.status}</td>
      </tr>`;
    }).join('');

    printWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${tipoLabel} - ${monthLabel}/${selectedYear}</title>
  <style>
    @page { margin: 2cm 2.5cm; size: A4 landscape; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000; line-height: 1.5; }
    h1 { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 4px; text-transform: uppercase; }
    .subtitle { text-align: center; font-size: 11pt; margin-bottom: 6px; color: #333; }
    .info { text-align: center; font-size: 10pt; margin-bottom: 20px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10pt; }
    th { background: #f0f0f0; padding: 8px; border: 1px solid #ccc; text-align: left; font-weight: bold; text-transform: uppercase; font-size: 9pt; }
    .total-row td { font-weight: bold; background: #f9f9f9; }
    .footer { margin-top: 30px; font-size: 9pt; color: #666; text-align: center; }
    .signature { margin-top: 60px; text-align: center; }
    .signature-line { width: 300px; border-top: 1px solid #000; margin: 0 auto; padding-top: 4px; font-size: 10pt; }
  </style>
</head>
<body>
  <h1>${tipoLabel}</h1>
  <p class="subtitle">Colégio Naviraí - Grupo CN</p>
  <p class="info">Período: ${monthLabel} de ${selectedYear} | Empresa: ${selectedCompany === 'TODOS' ? 'Todas' : selectedCompany} | Emitido em: ${now}</p>
  
  <table>
    <thead>
      <tr>
        <th style="width:30px;text-align:center">#</th>
        <th>Fornecedor</th>
        <th>Descrição</th>
        <th style="text-align:center">Empresa</th>
        <th style="text-align:center">Vencimento</th>
        <th style="text-align:center">Pagamento</th>
        <th style="text-align:right">Valor</th>
        <th style="text-align:right">Juros</th>
        <th style="text-align:right">Total</th>
        <th style="text-align:center">Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="6" style="padding:8px;border:1px solid #ccc;text-align:right">TOTAL GERAL</td>
        <td style="padding:8px;border:1px solid #ccc;text-align:right">${filteredData.reduce((a,tx) => a + Number(tx.valor), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
        <td style="padding:8px;border:1px solid #ccc;text-align:right">${periodTotals.jurosTotal > 0 ? periodTotals.jurosTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
        <td style="padding:8px;border:1px solid #ccc;text-align:right;font-weight:bold">${periodTotals.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
        <td style="padding:8px;border:1px solid #ccc;text-align:center">${periodTotals.count} itens</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <p>Relatório gerado automaticamente pelo sistema Fluxo de Caixa CN</p>
  </div>
  <div class="signature">
    <div class="signature-line">Responsável</div>
  </div>
</body>
</html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="space-y-8">
      <div className="glass-card p-6 flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase">Tipo</label>
          <select 
            className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary text-on-surface"
            style={{ backgroundColor: '#1e1e2e' }}
            value={selectedTipo}
            onChange={e => setSelectedTipo(e.target.value)}
          >
            <option value="TODOS" className="bg-surface text-on-surface">Todos</option>
            <option value="RECEITA" className="bg-surface text-on-surface">Receitas</option>
            <option value="DESPESA" className="bg-surface text-on-surface">Despesas</option>
          </select>
        </div>
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
            {companies.map(c => <option key={c.value} value={c.value} className="bg-surface text-on-surface">{c.label}</option>)}
          </select>
        </div>
        <div className="flex-grow"></div>
        <button
          onClick={handlePrint}
          className="bg-primary text-background px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary-dark transition-all whitespace-nowrap"
        >
          <Printer size={16} /> Imprimir / PDF
        </button>
        <div className="text-right">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase">
            {selectedTipo === 'RECEITA' ? 'Receitas' : selectedTipo === 'DESPESA' ? 'Despesas' : 'Total'} no Período
          </p>
          <p className="text-xl font-bold text-primary">
            {periodTotals.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <p className="text-[11px] text-on-surface-variant mt-1">{periodTotals.count} lançamentos</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 md:px-8 md:py-6 border-b border-white/5 flex justify-between items-center">
          <h4 className="text-base md:text-lg font-bold font-headline">
            {selectedTipo === 'RECEITA' ? 'Receitas' : selectedTipo === 'DESPESA' ? 'Despesas' : 'Lançamentos'} no Período
          </h4>
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
                    {(Number(tx.valor) + Number(tx.juros || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-on-surface-variant">
                  <span>{tx.descricao}</span>
                  <span>Venc: {tx.vencimento}</span>
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
                <th className="px-8 py-4">#</th>
                <th className="px-8 py-4">Fornecedor</th>
                <th className="px-8 py-4">Descrição</th>
                <th className="px-8 py-4">Empresa</th>
                <th className="px-8 py-4">Vencimento</th>
                <th className="px-8 py-4">Pagamento</th>
                <th className="px-8 py-4 text-right">Valor</th>
                <th className="px-8 py-4 text-right">Juros</th>
                <th className="px-8 py-4 text-right">Total</th>
                <th className="px-8 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-white/5">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-8 py-12 text-center text-on-surface-variant italic">
                    Nenhum lançamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredData.map((tx, i) => (
                  <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-8 py-4 text-on-surface-variant text-xs">{i + 1}</td>
                    <td className="px-8 py-4 font-semibold">{tx.fornecedor}</td>
                    <td className="px-8 py-4 text-on-surface-variant">{tx.descricao}</td>
                    <td className="px-8 py-4">{tx.empresa}</td>
                    <td className="px-8 py-4">{tx.vencimento}</td>
                    <td className="px-8 py-4 text-on-surface-variant">{tx.pagamento || '-'}</td>
                    <td className="px-8 py-4 text-right">{Number(tx.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className="px-8 py-4 text-right text-tertiary text-xs">{Number(tx.juros || 0) > 0 ? Number(tx.juros).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                    <td className="px-8 py-4 text-right font-bold text-primary">
                      {(Number(tx.valor) + Number(tx.juros || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
            {filteredData.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-white/20 font-bold">
                  <td colSpan={6} className="px-8 py-4 text-right text-on-surface-variant uppercase text-xs tracking-widest">Total Geral</td>
                  <td className="px-8 py-4 text-right">{filteredData.reduce((a,tx) => a + Number(tx.valor), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td className="px-8 py-4 text-right text-tertiary">{periodTotals.jurosTotal > 0 ? periodTotals.jurosTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                  <td className="px-8 py-4 text-right text-primary text-lg">{periodTotals.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td className="px-8 py-4 text-xs text-on-surface-variant">{periodTotals.count} itens</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

interface ReceitasTabProps {
  transactions: Transaction[];
  onNewRevenue: () => void;
}

const ReceitasTab = ({ transactions, onNewRevenue }: ReceitasTabProps) => {
  const revenueTransactions = useMemo(
    () => transactions.filter(tx => isRevenueTransaction(tx)),
    [transactions]
  );

  const years = useMemo(() => {
    const y = revenueTransactions.map(tx => {
      const dateParts = tx.vencimento.includes('-') ? tx.vencimento.split('-') : tx.vencimento.split('/');
      return tx.vencimento.includes('-') ? dateParts[0] : dateParts[2];
    });
    return [...new Set(y)].filter(Boolean).sort().reverse();
  }, [revenueTransactions]);

  const [selectedYear, setSelectedYear] = useState<string>(() => {
    const y = revenueTransactions.map(tx => {
      const dateParts = tx.vencimento.includes('-') ? tx.vencimento.split('-') : tx.vencimento.split('/');
      return tx.vencimento.includes('-') ? dateParts[0] : dateParts[2];
    });
    const uniqueYears = [...new Set(y)].filter(Boolean).sort().reverse();
    return uniqueYears[0] || new Date().getFullYear().toString();
  });

  const [selectedMonth, setSelectedMonth] = useState<string>('TODOS');
  const [selectedCompany, setSelectedCompany] = useState<string>('TODOS');

  const companies = useMemo(() => {
    const map = new Map<string, string>();
    for (const tx of revenueTransactions) {
      const companyKey = normalizeCompanyKey(tx.empresa);
      if (!map.has(companyKey)) map.set(companyKey, companyKey);
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [revenueTransactions]);

  const filteredData = useMemo(() => {
    return revenueTransactions.filter(tx => {
      const parts = tx.vencimento.includes('/') ? tx.vencimento.split('/') : tx.vencimento.split('-');
      const year = tx.vencimento.includes('/') ? parts[2] : parts[0];
      const month = tx.vencimento.includes('/') ? parts[1] : parts[1];
      const matchesYear = selectedYear === 'TODOS' || year === selectedYear;
      const matchesMonth = selectedMonth === 'TODOS' || month === selectedMonth;
      const matchesCompany = selectedCompany === 'TODOS' || normalizeCompanyKey(tx.empresa) === selectedCompany;
      return matchesYear && matchesMonth && matchesCompany;
    });
  }, [revenueTransactions, selectedYear, selectedMonth, selectedCompany]);

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
      const companyKey = normalizeCompanyKey(tx.empresa);
      map.set(companyKey, (map.get(companyKey) || 0) + tx.valor);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const totalReceitas = useMemo(
    () => filteredData.reduce((acc, tx) => acc + tx.valor, 0),
    [filteredData]
  );

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
            {companies.map(c => <option key={c.value} value={c.value} className="bg-surface text-on-surface">{c.label}</option>)}
          </select>
        </div>
        <button
          onClick={onNewRevenue}
          className="bg-primary text-background px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary-dark transition-all whitespace-nowrap"
        >
          <Plus size={16} /> Nova Receita
        </button>
        <div className="text-right">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase">Receitas no Período</p>
          <p className="text-xl font-bold text-primary">
            {totalReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <p className="text-[11px] text-on-surface-variant mt-1">{filteredData.length} lançamentos de receita</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-8 min-h-[400px]">
          <h4 className="text-lg font-bold font-headline mb-6">Receitas Mensais ({selectedYear})</h4>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="name" stroke="#c6c6cd" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis
                stroke="#c6c6cd"
                fontSize={10}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#161b2a', border: 'none', borderRadius: '8px' }}
                itemStyle={{ color: '#dee2f7' }}
                formatter={(value: number) => [value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 'Receita']}
              />
              <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b98120" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-8 min-h-[400px]">
          <h4 className="text-lg font-bold font-headline mb-6">Receitas por Empresa</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={companyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="name" stroke="#c6c6cd" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis
                stroke="#c6c6cd"
                fontSize={10}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#161b2a', border: 'none', borderRadius: '8px' }}
                itemStyle={{ color: '#dee2f7' }}
                formatter={(value: number) => [value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 'Receita']}
              />
              <Bar dataKey="value" fill="#10b981" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 md:px-8 md:py-6 border-b border-white/5 flex justify-between items-center">
          <h4 className="text-base md:text-lg font-bold font-headline">Receitas no Período</h4>
          <span className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">
            {filteredData.length} registros
          </span>
        </div>

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
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-white/5">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-on-surface-variant italic">
                    Nenhuma receita encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredData.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-8 py-4 font-semibold">{tx.fornecedor}</td>
                    <td className="px-8 py-4 text-on-surface-variant">{tx.descricao}</td>
                    <td className="px-8 py-4">{normalizeCompanyKey(tx.empresa)}</td>
                    <td className="px-8 py-4">{tx.vencimento}</td>
                    <td className="px-8 py-4 text-on-surface-variant">{tx.pagamento || '-'}</td>
                    <td className="px-8 py-4 font-bold text-primary">
                      {tx.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
  contasContabeis: ContaContabil[];
  companyOptions: string[];
  setShowNewTxModal: (show: boolean) => void;
  onSuccess: () => void;
  initialTipo?: 'DESPESA' | 'RECEITA';
}

const NewTxModal = ({ suppliers, banks, contasContabeis, companyOptions, setShowNewTxModal, onSuccess, initialTipo = 'DESPESA' }: NewTxModalProps) => {
  const [formData, setFormData] = useState({
    fornecedor: suppliers[0]?.nome || '',
    descricao: '',
    empresa: companyOptions[0] || 'CN',
    vencimento: new Date().toISOString().split('T')[0],
    pagamento: '',
    valor: '',
    parcelas: '1',
    valorTipo: 'parcela' as 'parcela' | 'total',
    status: 'PENDENTE' as TransactionStatus,
    banco: '',
    tipo: initialTipo as 'RECEITA' | 'DESPESA',
    conta_contabil_id: undefined as number | undefined,
  });
  const [searchConta, setSearchConta] = useState('');
  const [showContaDropdown, setShowContaDropdown] = useState(false);

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
          tipo: formData.tipo,
          conta_contabil_id: formData.conta_contabil_id
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
                {companyOptions.map((company) => (
                  <option key={company} value={company} className="bg-[#161b2a]">{company}</option>
                ))}
              </select>

            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Tipo</label>
              <select 
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.tipo}
                onChange={e => setFormData({...formData, tipo: e.target.value as 'RECEITA' | 'DESPESA'})}
              >
                <option value="DESPESA" className="bg-[#161b2a] text-on-surface">Despesa</option>
                <option value="RECEITA" className="bg-[#161b2a] text-on-surface">Receita</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Conta Contábil</label>
            <div className="relative">
              <div 
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm cursor-pointer flex justify-between items-center"
                style={{ backgroundColor: '#161b2a' }}
                onClick={() => setShowContaDropdown(!showContaDropdown)}
              >
                <span className={formData.conta_contabil_id ? 'text-on-surface' : 'text-on-surface-variant'}>
                  {formData.conta_contabil_id 
                    ? contasContabeis.find(c => c.id === formData.conta_contabil_id)?.codigo + ' - ' + contasContabeis.find(c => c.id === formData.conta_contabil_id)?.nome
                    : 'Selecione a conta'}
                </span>
                <ChevronDown size={14} className="text-on-surface-variant" />
              </div>
              {showContaDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-[#161b2a] border border-white/10 rounded-lg shadow-xl max-h-60 overflow-hidden">
                  <div className="p-2 border-b border-white/10">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={14} />
                      <input
                        type="text"
                        placeholder="Buscar conta..."
                        value={searchConta}
                        onChange={(e) => setSearchConta(e.target.value)}
                        className="w-full bg-surface-variant/20 border border-white/10 rounded pl-8 pr-3 py-1.5 text-sm outline-none focus:border-primary"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-44 overflow-y-auto">
                    <div 
                      className="px-3 py-2 text-sm text-on-surface-variant hover:bg-white/5 cursor-pointer"
                      onClick={() => {
                        setFormData({...formData, conta_contabil_id: undefined});
                        setShowContaDropdown(false);
                        setSearchConta('');
                      }}
                    >
                      Selecione a conta
                    </div>
                    {contasContabeis
                      .filter(c => c.tipo === formData.tipo)
                      .filter(c => {
                        const q = searchConta.toLowerCase();
                        if (!q) return true;
                        return c.codigo.toLowerCase().includes(q) || c.nome.toLowerCase().includes(q);
                      })
                      .map(c => (
                        <div 
                          key={c.id}
                          className="px-3 py-2 text-sm hover:bg-white/5 cursor-pointer flex items-center gap-2"
                          style={{ backgroundColor: formData.conta_contabil_id === c.id ? 'rgba(59, 130, 246, 0.2)' : 'transparent' }}
                          onClick={() => {
                            setFormData({...formData, conta_contabil_id: c.id});
                            setShowContaDropdown(false);
                            setSearchConta('');
                          }}
                        >
                          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{c.codigo}</span>
                          <span>{c.nome}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
  contasContabeis: ContaContabil[];
  companyOptions: string[];
  onClose: () => void;
  onSave: (tx: Transaction) => void;
}

const EditTxModal = ({ transaction, suppliers, banks, contasContabeis, companyOptions, onClose, onSave }: EditTxModalProps) => {
  const [formData, setFormData] = useState({
    ...transaction,
    vencimento: toInputDate(transaction.vencimento),
    pagamento: toInputDate(transaction.pagamento),
    valor: transaction.valor.toString(),
    banco: transaction.banco || '',
    tipo: transaction.tipo || 'DESPESA',
    juros: transaction.juros || 0,
  });
  const [searchConta, setSearchConta] = useState('');
  const [showContaDropdown, setShowContaDropdown] = useState(false);

  useEffect(() => {
    setFormData({
      ...transaction,
      vencimento: toInputDate(transaction.vencimento),
      pagamento: toInputDate(transaction.pagamento),
      valor: transaction.valor.toString(),
      banco: transaction.banco || '',
      tipo: transaction.tipo || 'DESPESA',
      juros: transaction.juros || 0,
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
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.empresa}
                onChange={e => setFormData({...formData, empresa: e.target.value})}
              >
                {companyOptions.map((company) => (
                  <option key={company} value={company} className="bg-[#161b2a] text-on-surface">{company}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Tipo</label>
              <select 
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.tipo || 'DESPESA'}
                onChange={e => setFormData({...formData, tipo: e.target.value})}
              >
                <option value="DESPESA" className="bg-[#161b2a] text-on-surface">Despesa</option>
                <option value="RECEITA" className="bg-[#161b2a] text-on-surface">Receita</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Conta Contábil</label>
              <div className="relative">
                <div 
                  className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm cursor-pointer flex justify-between items-center"
                  style={{ backgroundColor: '#161b2a' }}
                  onClick={() => setShowContaDropdown(!showContaDropdown)}
                >
                  <span className={formData.conta_contabil_id !== undefined ? 'text-on-surface' : 'text-on-surface-variant'}>
                    {formData.conta_contabil_id !== undefined 
                      ? contasContabeis.find(c => c.id === formData.conta_contabil_id)?.codigo + ' - ' + contasContabeis.find(c => c.id === formData.conta_contabil_id)?.nome
                      : 'Selecione a conta'}
                  </span>
                  <ChevronDown size={14} className="text-on-surface-variant" />
                </div>
                {showContaDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-[#161b2a] border border-white/10 rounded-lg shadow-xl max-h-60 overflow-hidden">
                    <div className="p-2 border-b border-white/10">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={14} />
                        <input
                          type="text"
                          placeholder="Buscar conta..."
                          value={searchConta}
                          onChange={(e) => setSearchConta(e.target.value)}
                          className="w-full bg-surface-variant/20 border border-white/10 rounded pl-8 pr-3 py-1.5 text-sm outline-none focus:border-primary"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-44 overflow-y-auto">
                      <div 
                        className="px-3 py-2 text-sm text-on-surface-variant hover:bg-white/5 cursor-pointer"
                        onClick={() => {
                          setFormData({...formData, conta_contabil_id: undefined});
                          setShowContaDropdown(false);
                          setSearchConta('');
                        }}
                      >
                        Selecione a conta
                      </div>
                      {contasContabeis
                        .filter(c => matchesAccountType(c, formData.tipo))
                        .filter(c => {
                          const q = searchConta.toLowerCase();
                          if (!q) return true;
                          return c.codigo.toLowerCase().includes(q) || c.nome.toLowerCase().includes(q);
                        })
                        .map(c => (
                          <div 
                            key={c.id}
                            className="px-3 py-2 text-sm hover:bg-white/5 cursor-pointer flex items-center gap-2"
                            style={{ backgroundColor: formData.conta_contabil_id === c.id ? 'rgba(59, 130, 246, 0.2)' : 'transparent' }}
                            onClick={() => {
                              setFormData({...formData, conta_contabil_id: c.id});
                              setShowContaDropdown(false);
                              setSearchConta('');
                            }}
                          >
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{c.codigo}</span>
                            <span>{c.nome}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
              {contasContabeis.filter(c => matchesAccountType(c, formData.tipo)).length === 0 && (
                <p className="text-[10px] text-on-surface-variant mt-1">Nenhuma conta encontrada para {formData.tipo}. Cadastre em Configurações.</p>
              )}
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
            {formData.status === 'PAGO' && (
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Valor Pago (R$)</label>
                <input 
                  type="number" step="0.01"
                  className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                  value={formData.valorPago || ''}
                  placeholder={formData.valor}
                  onChange={e => {
                    const valorPago = Number(e.target.value) || 0;
                    const valorOriginal = Number(formData.valor) || 0;
                    const jurosCalculado = Math.max(0, valorPago - valorOriginal);
                    setFormData({...formData, valorPago: valorPago, juros: jurosCalculado});
                  }}
                />
                {formData.juros > 0 && (
                  <p className="text-[10px] text-tertiary mt-1 font-bold">
                    Juros: R$ {Number(formData.juros).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            )}
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
  const {
    transactions, suppliers, banks, contasContabeis, companyOptions, notification, isLoading,
    fetchTransactions, fetchSuppliers, fetchBanks, fetchContasContabeis,
    showNotification,
    markAsPaid, updateTransaction, deleteTransaction,
    deleteSupplier, syncSuppliers,
    deleteBank,
    addCompanyOption, removeCompanyOption, updateCompanyOption,
    setCompanyOptions,
  } = useAppData();

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [editingCompany, setEditingCompany] = useState<string | null>(null);
  const [editingCompanyName, setEditingCompanyName] = useState('');
  const [newContaContabil, setNewContaContabil] = useState({ codigo: '', nome: '', tipo: 'DESPESA' });
  const [searchContaContabil, setSearchContaContabil] = useState('');
  const [brandLogo, setBrandLogo] = useState<string>(() => {
    try { return localStorage.getItem('cn_brand_logo') || ''; } catch { return ''; }
  });

  const [showNewTxModal, setShowNewTxModal] = useState(false);
  const [newTxInitialTipo, setNewTxInitialTipo] = useState<'DESPESA' | 'RECEITA'>('DESPESA');
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [showNewBankModal, setShowNewBankModal] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [showPayModal, setShowPayModal] = useState<{ id: string; valor: number } | null>(null);
  const [showPdfImportModal, setShowPdfImportModal] = useState(false);
  const [pdfExtractedRows, setPdfExtractedRows] = useState<PdfImportDraft[]>([]);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const currentBrandLogo = brandLogo || defaultBrandLogo;

  const addContaContabil = async () => {
    if (!newContaContabil.codigo || !newContaContabil.nome) {
      showNotification('Informe o código e o nome da conta.', 'error');
      return;
    }
    try {
      await api.createContaContabil({
        codigo: newContaContabil.codigo,
        nome: newContaContabil.nome,
        tipo: newContaContabil.tipo as 'RECEITA' | 'DESPESA',
      });
      showNotification('Conta contábil adicionada!', 'success');
      setNewContaContabil({ codigo: '', nome: '', tipo: 'DESPESA' });
      fetchContasContabeis();
    } catch {
      showNotification('Erro ao adicionar conta contábil.', 'error');
    }
  };

  const deleteContaContabil = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta conta?')) return;
    try {
      await api.updateContaContabil(id, { ativo: false });
      showNotification('Conta contábil excluída!', 'success');
      fetchContasContabeis();
    } catch {
      showNotification('Erro ao excluir conta contábil.', 'error');
    }
  };

  const startEditCompany = (name: string) => {
    setEditingCompany(name);
    setEditingCompanyName(name);
  };

  const saveEditCompany = (originalName: string) => {
    const ok = updateCompanyOption(originalName, editingCompanyName);
    if (ok) {
      setEditingCompany(null);
      setEditingCompanyName('');
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotification('Selecione um arquivo de imagem válido.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setBrandLogo(dataUrl);
      try { localStorage.setItem('cn_brand_logo', dataUrl); } catch { /* ignore */ }
      showNotification('Logo atualizada com sucesso!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setBrandLogo('');
    try {
      localStorage.removeItem('cn_brand_logo');
    } catch {
    }
    showNotification('Logo removida.', 'info');
  };

  // --- Handlers ---

  const normalizeBoletoNumber = (value?: string) => {
    const raw = String(value || '').toUpperCase();
    if (!raw) return '';
    const tokens = raw
      .split(/[\s:;|,]+/)
      .map((token) => token.replace(/[^A-Z0-9]/g, ''))
      .filter(Boolean);
    const bestToken = tokens.find((token) => /\d{4,}/.test(token) && token.length >= 6 && token.length <= 30);
    if (bestToken) return bestToken;
    return raw.replace(/[^A-Z0-9]/g, '');
  };

  const boletoDuplicateKey = (fornecedor: string, vencimento: string, valor: number, numeroBoleto?: string, descricao?: string, empresa?: string) => {
    const normalizedNumber = normalizeBoletoNumber(numeroBoleto);
    if (normalizedNumber) return `BOLETO:${normalizedNumber}`;
    const desc = normalizeSupplierName(descricao || '');
    const emp = normalizeSupplierName(empresa || '');
    return `BASE:${normalizeSupplierName(fornecedor)}|${vencimento}|${Number(valor || 0).toFixed(2)}|${desc}|${emp}`;
  };

  const getExistingBoletoKeys = () =>
    new Set(
      transactions
        .map((tx) => boletoDuplicateKey(tx.fornecedor, tx.vencimento, tx.valor, tx.numero_boleto, tx.descricao, tx.empresa))
        .filter((key): key is string => Boolean(key))
    );

  const applyDuplicateFlags = (rows: PdfImportDraft[]) => {
    const existingKeys = getExistingBoletoKeys();
    const batchKeys = new Set<string>();
    return rows.map((row) => {
      const numero_boleto = normalizeBoletoNumber(row.numero_boleto);
      const key = boletoDuplicateKey(row.fornecedor, row.vencimento, row.valor, numero_boleto, row.descricao, row.empresa);
      const duplicate = existingKeys.has(key) || batchKeys.has(key);
      batchKeys.add(key);
      return { ...row, numero_boleto, duplicate };
    });
  };

  const updatePdfRow = (index: number, patch: Partial<PdfImportDraft>) => {
    setPdfExtractedRows((prev) =>
      applyDuplicateFlags(prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
    );
  };

  const extractLocalBoletoNumber = (text: string) => {
    const source = String(text || '').toUpperCase();
    const patterns = [
      /NOSSO\s*N[ÚU]MERO[:\s-]*([A-Z0-9./-]{6,40})/,
      /N[ROº°]*\s*DOCUMENTO[:\s-]*([A-Z0-9./-]{6,40})/,
      /NUMERO\s*DO\s*DOCUMENTO[:\s-]*([A-Z0-9./-]{6,40})/,
      /NR\.?\s*DOC[:\s-]*([A-Z0-9./-]{6,40})/,
      /N[º°]?\s*DOC[:\s-]*([A-Z0-9./-]{6,40})/,
      /DOCUMENTO[:\s-]*([0-9]{6,20})/,
      /COD(?:IGO)?\s*(?:DE)?\s*BARRAS[:\s-]*([0-9]{47,48})/,
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match?.[1]) {
        const normalized = normalizeBoletoNumber(match[1]);
        if (normalized) return normalized;
      }
    }
    const barcodeMatch = source.match(/\b([0-9]{47,48})\b/);
    if (barcodeMatch?.[1]) return barcodeMatch[1];
    return '';
  };

  const parseLinhaDigitavel = (text: string) => {
    const digits = (text.match(/\d/g) || []).join('');
    if (digits.length < 47) return null;
    const line = digits.slice(0, 47);
    const fator = Number(line.slice(5, 9));
    const valor = Number(line.slice(9, 19)) / 100;
    if (!Number.isFinite(fator)) return null;
    const base = new Date(Date.UTC(1997, 9, 7));
    const dueDate = new Date(base.getTime() + fator * 24 * 60 * 60 * 1000);
    const dd = String(dueDate.getUTCDate()).padStart(2, '0');
    const mm = String(dueDate.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = String(dueDate.getUTCFullYear());
    return { vencimento: `${dd}/${mm}/${yyyy}`, valor: Number.isFinite(valor) ? valor : 0 };
  };

  const shouldRejectSupplierName = (name: string) => {
    const value = String(name || '').trim().toUpperCase();
    if (!value) return true;
    if (value.includes('DATA DO DOCUMENTO') || value.includes('VENCIMENTO') || value.includes('NOSSO NUMERO')) return true;
    const onlyNumericLike = value.replace(/[^0-9]/g, '').length >= Math.max(8, value.length - 2);
    if (onlyNumericLike) return true;
    if ((value.match(/[A-Z]/g) || []).length < 3) return true;
    return false;
  };

  const resolveSupplierName = (detectedName: string, sourceText: string) => {
    const cleanDetected = String(detectedName || '').trim();
    const validDetected = shouldRejectSupplierName(cleanDetected) ? '' : cleanDetected;
    const normalizedDetected = normalizeSupplierName(validDetected);
    const normalizedSource = normalizeSupplierName(sourceText);

    if (normalizedDetected.includes('EDITORA') || normalizedSource.includes('EDITORA')) {
      const editoraMatch = suppliers
        .map((s) => ({ supplier: s, key: normalizeSupplierName(s.nome) }))
        .filter((x) => x.key.includes('EDITORA'))
        .sort((a, b) => b.key.length - a.key.length)[0];
      if (editoraMatch) return editoraMatch.supplier.nome;
    }

    if (validDetected) {
      const direct = suppliers.find((s) => isSupplierMatch(validDetected, s.nome));
      if (direct) return direct.nome;
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

  const extractBoletoData = (text: string, fileName: string): PdfImportDraft => {
    const normalizedText = text.toUpperCase().replace(/\s+/g, ' ');
    let fornecedor = 'Fornecedor não identificado';
    let vencimento = '';
    let valor = 0;

    const fornecedorPatterns = [
      /BENEFICIÁRIO[:\s]+([A-Z0-9\s.&/-]+?)(?:\s+CNPJ|\s+CPF|\d{2}\/\d{2}\/\d{4})/,
      /CEDENTE[:\s]+([A-Z0-9\s.&/-]+?)(?:\s+CNPJ|\s+CPF|\d{2}\/\d{2}\/\d{4})/,
      /VENDEDOR[:\s]+([A-Z0-9\s.&/-]+?)(?:\s+CNPJ|\s+CPF)/,
      /EMISSOR[:\s]+([A-Z0-9\s.&/-]+?)(?:\s+CNPJ|\s+CPF)/,
      /RAZÃO SOCIAL[:\s]+([A-Z0-9\s.&/-]+?)(?:\s+CNPJ|\s+CPF)/,
      /SACADO[:\s]+([A-Z0-9\s.&/-]+?)(?:\s+CNPJ|\s+CPF|\d{2}\/\d{2}\/\d{4})/,
    ];

    for (const pattern of fornecedorPatterns) {
      const match = normalizedText.match(pattern);
      if (match?.[1]) {
        const candidate = match[1].trim().replace(/\s+/g, ' ');
        if (!shouldRejectSupplierName(candidate)) { fornecedor = candidate; break; }
      }
    }

    if (fornecedor === 'Fornecedor não identificado') {
      const bestSupplier = suppliers
        .map((s) => ({ supplier: s, score: normalizedText.includes(normalizeSupplierName(s.nome)) ? normalizeSupplierName(s.nome).length : 0 }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (bestSupplier) fornecedor = bestSupplier.supplier.nome;
    }

    const datePatterns = [
      /VENCIMENTO[:\s]+(\d{2}\/\d{2}\/\d{4})/,
      /DATA DE VENCIMENTO[:\s]+(\d{2}\/\d{2}\/\d{4})/,
      /\b(\d{2}\/\d{2}\/\d{4})\b/,
    ];
    for (const pattern of datePatterns) {
      const match = normalizedText.match(pattern);
      if (match?.[1]) { vencimento = match[1]; break; }
    }

    const valuePatterns = [
      /VALOR\s+(?:DO\s+)?DOCUMENTO[:\s]+R?\$?\s*([\d.,]+)/,
      /VALOR\s+COBRADO[:\s]+R?\$?\s*([\d.,]+)/,
      /VALOR\s+TOTAL[:\s]+R?\$?\s*([\d.,]+)/,
      /VLR\s+PAGAR[:\s]+R?\$?\s*([\d.,]+)/,
      /R\$\s*([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})/,
    ];
    for (const pattern of valuePatterns) {
      const match = normalizedText.match(pattern);
      if (match?.[1]) {
        const parsed = Number(match[1].replace(/\./g, '').replace(',', '.'));
        if (!Number.isNaN(parsed) && parsed > 0) { valor = parsed; break; }
      }
    }

    const linhaInfo = parseLinhaDigitavel(normalizedText);
    if (linhaInfo) {
      if (!vencimento) vencimento = linhaInfo.vencimento;
      if (!valor && linhaInfo.valor > 0) valor = linhaInfo.valor;
    }

    const numeroBoleto = extractLocalBoletoNumber(normalizedText);

    return {
      fileName,
      fornecedor,
      vencimento,
      valor,
      descricao: '',
      empresa: '',
      cnpj: '',
      numero_boleto: numeroBoleto,
      tipo: 'DESPESA',
      rawText: text.slice(0, 500),
      duplicate: false,
    };
  };

  const extractBoletoWithGemini = async (text: string, fileName: string, pdfBase64?: string): Promise<PdfImportDraft> => {
    try {
      const response = await fetch('/api/extract-boleto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, fileName, pdfBase64 }),
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      console.log('[boleto] Gemini response:', data);

      const hasValidData = data.fornecedor && data.fornecedor !== 'Fornecedor não identificado' && (data.valor > 0 || data.vencimento);

      if (hasValidData) {
        const fallbackNumero = extractLocalBoletoNumber(text);
        const inferredFromDescricao = normalizeBoletoNumber(data.descricao || '');
        return {
          fileName,
          fornecedor: data.fornecedor || 'Fornecedor não identificado',
          vencimento: data.vencimento || '',
          valor: typeof data.valor === 'number' ? data.valor : 0,
          descricao: data.descricao || '',
          empresa: data.empresa || '',
          cnpj: data.cnpj || '',
          numero_boleto: normalizeBoletoNumber(data.numero_boleto || '') || fallbackNumero || inferredFromDescricao,
          tipo: 'DESPESA',
          rawText: text.slice(0, 500),
          duplicate: false,
        };
      }

      console.log('[boleto] Gemini returned empty data, using local fallback');
      const fallback = extractBoletoData(text, fileName);
      return { ...fallback, descricao: data.descricao || '', empresa: data.empresa || '', cnpj: data.cnpj || '', numero_boleto: data.numero_boleto || '', tipo: 'DESPESA' };
    } catch (err) {
      console.error('[boleto] API error, using local fallback:', err);
      const fallback = extractBoletoData(text, fileName);
      return { ...fallback, descricao: '', empresa: '', cnpj: '', numero_boleto: '', tipo: 'DESPESA' };
    }
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) return;
    const pdfFiles = files.filter((file) => file.type === 'application/pdf');
    if (!pdfFiles.length) {
      showNotification('Selecione pelo menos um arquivo PDF válido.', 'error');
      return;
    }

    setIsProcessingPdf(true);
    showNotification(`Processando ${pdfFiles.length} boleto(s) com IA...`, 'info');

    try {
      // Process all PDFs in parallel
      const extractedRows: PdfImportDraft[] = await Promise.all(
        pdfFiles.map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();

          // Convert PDF to base64
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const pdfBase64 = btoa(binary);

          // Extract text with PDF.js
          let fullText = '';
          try {
            let pdf: any;
            try {
              pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            } catch {
              pdf = await pdfjsLib.getDocument({ data: arrayBuffer, disableWorker: true } as any).promise;
            }
            const maxPages = Math.min(2, pdf.numPages || 0);
            for (let i = 1; i <= maxPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
            }
            console.log(`[boleto] PDF.js extracted ${fullText.length} chars from ${file.name}:`, fullText.slice(0, 200));
          } catch (pdfErr) {
            console.log(`[boleto] PDF.js failed for ${file.name}, relying on server-side extraction:`, pdfErr);
          }

          const data = await extractBoletoWithGemini(fullText, file.name, pdfBase64);
          data.fornecedor = resolveSupplierName(data.fornecedor, fullText);
          return data;
        })
      );

      if (!extractedRows.length) {
        showNotification('Nenhum dado foi extraído dos PDFs.', 'error');
        return;
      }

      setPdfExtractedRows(applyDuplicateFlags(extractedRows));
      setShowPdfImportModal(true);
      showNotification('Boletos lidos pela IA. Revise e confirme os lançamentos.', 'success');
    } catch (error) {
      console.error('Error processing PDF:', error);
      showNotification('Erro ao processar PDF. Tente novamente.', 'error');
    } finally {
      setIsProcessingPdf(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleConfirmPdfImport = async () => {
    try {
      const validRows = pdfExtractedRows
        .filter((row) => row.fornecedor && row.vencimento && row.valor > 0)
        .map((row) => ({ ...row, numero_boleto: normalizeBoletoNumber(row.numero_boleto) }));

      const recheckedRows = applyDuplicateFlags(validRows as PdfImportDraft[]);
      const nonDuplicateRows = recheckedRows.filter((row) => !row.duplicate);
      const blockedCount = recheckedRows.length - nonDuplicateRows.length;

      if (!nonDuplicateRows.length) {
        showNotification('Todos os boletos já foram lançados e foram bloqueados.', 'info');
        return;
      }

      const canonicalRows = nonDuplicateRows.map((row) => ({
        ...row,
        fornecedor: resolveSupplierName(row.fornecedor, row.rawText),
        tipo: row.tipo || 'DESPESA',
      }));

      const txList = canonicalRows.map((row) => ({
        uid: 'guest',
        fornecedor: row.fornecedor,
        descricao: row.descricao || `Importado de boleto PDF (${row.fileName})`,
        empresa: row.empresa || 'CN',
        vencimento: row.vencimento,
        pagamento: null as any,
        valor: row.valor,
        status: 'PENDENTE' as TransactionStatus,
        banco: null as any,
        numero_boleto: row.numero_boleto,
        conta_contabil_id: row.conta_contabil_id,
        tipo: row.tipo || 'DESPESA',
      }));

      if (txList.length === 1) {
        await api.createTransaction(txList[0]);
      } else {
        await api.createTransactionsBatch(txList as any);
      }

      const newSuppliers = canonicalRows
        .filter((row) => row.fornecedor !== 'Fornecedor não identificado')
        .filter((row) => !suppliers.some((s) => isSupplierMatch(row.fornecedor, s.nome)))
        .map((row) => ({
          uid: 'guest',
          nome: row.fornecedor,
          email: '',
          telefone: '',
          cnpj: '',
        }));

      if (newSuppliers.length) {
        await api.createSuppliersBatch(newSuppliers as any);
      }

      setShowPdfImportModal(false);
      setPdfExtractedRows([]);
      await fetchTransactions();
      await fetchSuppliers();
      showNotification(`${nonDuplicateRows.length} boleto(s) importado(s). ${blockedCount} bloqueado(s) por duplicidade.`, 'success');
    } catch (error) {
      console.error('Error creating transaction from PDF:', error);
      showNotification('Erro ao salvar lançamentos de boleto.', 'error');
    }
  };

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

  const handleMarkAsPaidClick = (tx: Transaction) => {
    if (banks.filter(b => b.ativo).length > 0) {
      setShowPayModal({ id: tx.id, valor: tx.valor });
    } else {
      markAsPaid(tx.id, '');
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const tx of transactions) {
      total += tx.valor;
      if (tx.status === 'PAGO') {
        pagos++;
      } else if (tx.status === 'VENCIDO') {
        vencidos++;
      } else {
        // Auto-detect: PENDENTE with past vencimento = VENCIDO
        const parts = tx.vencimento?.split('/');
        if (parts?.length === 3) {
          const vDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
          if (vDate < today) vencidos++;
          else pendentes++;
        } else {
          pendentes++;
        }
      }
      empresasSet.add(tx.empresa);
    }
    const kpis: KPI[] = [
      { label: 'VALOR TOTAL', value: total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), color: '#3b82f6' },
      { label: 'REGISTROS', value: transactions.length.toString(), description: 'Volume operacional', color: '#3b82f6' },
      { label: 'EMPRESAS', value: empresasSet.size.toString(), description: 'Unidades ativas', color: '#3b82f6' },
      { label: 'PENDENTES', value: pendentes.toString(), description: 'Aguardando conciliação', color: '#f59e0b' },
      { label: 'PAGOS', value: pagos.toString(), description: 'Liquidados', color: '#3b82f6' },
      { label: 'VENCIDOS', value: vencidos.toString(), description: 'Ação imediata necessária', color: '#ef4444' },
    ];
    return { total, pagos, pendentes, vencidos, kpis };
  }, [transactions]);

  // Skeleton de carregamento inicial
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background">
        <div className="flex items-center gap-3">
          <img src={currentBrandLogo} alt="Logo" className="h-10 w-10 object-contain rounded-sm border border-white/10 bg-white/5 p-1" />
          <h1 className="text-2xl font-black tracking-tighter premium-gradient-text font-headline">Fluxo Caixa CN</h1>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-[loading_1.2s_ease-in-out_infinite]" style={{ width: '60%', animation: 'pulse 1.2s ease-in-out infinite' }} />
          </div>
          <p className="text-xs text-on-surface-variant/50 uppercase tracking-widest font-bold">Carregando dados...</p>
        </div>
        {/* Skeleton cards */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-2xl px-8 mt-4">
          {[1,2,3].map(i => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="h-2 bg-white/10 rounded w-2/3 mb-3" />
              <div className="h-6 bg-white/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-surface/80 backdrop-blur-md border-b border-white/5 flex justify-between items-center w-full px-4 md:px-8 py-5 fixed top-0 z-50">
        <div className="flex items-center gap-4 md:gap-8">
          <div className="flex items-center gap-3">
            <img
              src={currentBrandLogo}
              alt="Logo Fluxo Caixa CN"
              className="h-9 w-9 md:h-10 md:w-10 object-contain rounded-sm border border-white/10 bg-white/5 p-1"
            />
            <h1 className="text-xl md:text-2xl font-black tracking-tighter premium-gradient-text font-headline">Fluxo Caixa CN</h1>
          </div>

          <nav className="hidden lg:flex gap-6">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={cn("transition-all duration-200 font-medium text-sm", activeTab === 'dashboard' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-white")}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('lancamentos')}
              className={cn("relative transition-all duration-200 font-medium text-sm", activeTab === 'lancamentos' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-white")}
            >
              Lançamentos
              {stats.vencidos > 0 && (
                <span className="absolute -top-2 -right-3 bg-tertiary text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
                  {stats.vencidos}
                </span>
              )}
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
              onClick={() => setActiveTab('receitas')}
              className={cn("transition-all duration-200 font-medium text-sm", activeTab === 'receitas' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-white")}
            >
              Receitas
            </button>
            <button 
              onClick={() => setActiveTab('bancos')}
              className={cn("transition-all duration-200 font-medium text-sm", activeTab === 'bancos' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-white")}
            >
              Bancos
            </button>
            <button 
              onClick={() => setActiveTab('extrato')}
              className={cn("transition-all duration-200 font-medium text-sm", activeTab === 'extrato' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-white")}
            >
              Extrato OFX
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
          <GlobalSearch
            transactions={transactions}
            suppliers={suppliers}
            banks={banks}
            onNavigate={setActiveTab}
          />
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
          onClick={() => setActiveTab('receitas')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'receitas' ? "text-primary scale-110" : "text-on-surface-variant opacity-60")}
        >
          <Wallet size={22} strokeWidth={activeTab === 'receitas' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Rec</span>
        </button>
        <button 
          onClick={() => setActiveTab('bancos')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'bancos' ? "text-primary scale-110" : "text-on-surface-variant opacity-60")}
        >
          <CreditCard size={22} strokeWidth={activeTab === 'bancos' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Bancos</span>
        </button>
        <button 
          onClick={() => setActiveTab('extrato')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'extrato' ? "text-primary scale-110" : "text-on-surface-variant opacity-60")}
        >
          <Download size={22} strokeWidth={activeTab === 'extrato' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">OFX</span>
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
              {activeTab === 'receitas' && '💸 Receitas'}
              {activeTab === 'bancos' && '🏦 Bancos'}
              {activeTab === 'extrato' && '📄 Importar Extrato OFX'}
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
            {activeTab === 'lancamentos' && (
              <>
                <button 
                  onClick={() => pdfInputRef.current?.click()}
                  className="bg-primary/15 text-primary px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-primary/25 transition-all border border-primary/25"
                >
                  {isProcessingPdf ? <Loader2 size={18} className="animate-spin" /> : <FileUp size={18} />}
                  Importar Boletos PDF
                </button>
                <input
                  type="file"
                  ref={pdfInputRef}
                  onChange={handlePdfUpload}
                  accept="application/pdf"
                  multiple
                  className="hidden"
                />
              </>
            )}
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
            {activeTab === 'receitas' && <ReceitasTab transactions={transactions} onNewRevenue={() => { setNewTxInitialTipo('RECEITA'); setShowNewTxModal(true); }} />}
            {activeTab === 'bancos' && (
              <BancosTab 
                banks={banks}
                transactions={transactions}
                setShowNewBankModal={setShowNewBankModal}
                setEditingBank={setEditingBank}
                deleteBank={deleteBank}
              />
            )}
            {activeTab === 'extrato' && (
              <OFXImportTab
                transactions={transactions}
                suppliers={suppliers}
                banks={banks}
                onSuccess={() => { fetchTransactions(); }}
                showNotification={showNotification}
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
                  <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-widest">Identidade Visual</h4>
                  <div className="space-y-4 max-w-md mx-auto">
                    <div className="glass-card p-4">
                      <p className="text-[11px] text-on-surface-variant mb-3">Logo exibida no topo do sistema.</p>
                      <div className="flex items-center justify-center gap-3">
                        <label className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-primary/20 transition-all border border-primary/20 cursor-pointer">
                          <Upload size={14} /> Subir Logo
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleLogoUpload}
                          />
                        </label>
                        {brandLogo && (
                          <button
                            onClick={clearLogo}
                            className="bg-tertiary/10 text-tertiary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-tertiary/20 transition-all border border-tertiary/20"
                          >
                            <X size={14} /> Remover
                          </button>
                        )}
                      </div>
                      <div className="mt-4 flex justify-center">
                        <img
                          src={currentBrandLogo}
                          alt="Prévia da logo"
                          className="h-20 w-20 object-contain rounded-sm border border-white/10 bg-white/5 p-2"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-white/5">
                  <h4 className="text-sm font-bold text-secondary mb-4 uppercase tracking-widest">Empresas</h4>
                  <div className="space-y-4 max-w-xl mx-auto">
                    <div className="glass-card p-4">
                      <p className="text-[11px] text-on-surface-variant mb-3">Gerencie a lista de empresas usada nos lançamentos e na automação de boletos.</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newCompanyName}
                          onChange={(e) => setNewCompanyName(e.target.value)}
                          placeholder="Ex: POLO NOVO"
                          className="flex-1 bg-surface-variant/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                        <button
                          onClick={() => addCompanyOption(newCompanyName)}
                          className="bg-secondary/20 text-secondary px-4 py-2 rounded-lg text-xs font-bold border border-secondary/30 hover:bg-secondary/30 transition-all"
                        >
                          Adicionar
                        </button>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {companyOptions.map((company) => (
                          <span key={company} className="inline-flex items-center gap-2 bg-surface-variant/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold">
                            {editingCompany === company ? (
                              <>
                                <input
                                  value={editingCompanyName}
                                  onChange={(e) => setEditingCompanyName(e.target.value)}
                                  className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-primary w-36"
                                />
                                <button
                                  onClick={() => saveEditCompany(company)}
                                  className="text-primary hover:text-primary/80"
                                >
                                  Salvar
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingCompany(null);
                                    setEditingCompanyName('');
                                  }}
                                  className="text-on-surface-variant hover:text-on-surface"
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <span>{company}</span>
                                <button
                                  onClick={() => startEditCompany(company)}
                                  className="text-secondary hover:text-secondary/80"
                                >
                                  <Edit size={12} />
                                </button>
                                <button
                                  onClick={() => removeCompanyOption(company)}
                                  className="text-tertiary hover:text-tertiary/80"
                                >
                                  <X size={12} />
                                </button>
                              </>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-white/5">
                  <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-widest">Plano de Contas</h4>
                  <div className="space-y-4 max-w-3xl mx-auto">
                    <div className="glass-card p-4">
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-3">
                          <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Código</p>
                          <input
                            value={newContaContabil.codigo}
                            onChange={(e) => setNewContaContabil(prev => ({ ...prev, codigo: e.target.value }))}
                            placeholder="Ex: 3.1"
                            className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                        </div>
                        <div className="col-span-6">
                          <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Nome</p>
                          <input
                            value={newContaContabil.nome}
                            onChange={(e) => setNewContaContabil(prev => ({ ...prev, nome: e.target.value }))}
                            placeholder="Ex: Folha de Pagamento"
                            className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                        </div>
                        <div className="col-span-3">
                          <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Tipo</p>
                          <select
                            value={newContaContabil.tipo}
                            onChange={(e) => setNewContaContabil(prev => ({ ...prev, tipo: e.target.value as 'DESPESA' | 'RECEITA' }))}
                            className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                          >
                            <option value="DESPESA">DESPESA</option>
                            <option value="RECEITA">RECEITA</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end mt-3">
                        <button
                          onClick={async () => {
                            try {
                              if (!newContaContabil.codigo || !newContaContabil.nome) {
                                showNotification('Preencha código e nome.', 'error');
                                return;
                              }
                              await api.createContaContabil({
                                codigo: newContaContabil.codigo,
                                nome: newContaContabil.nome,
                                tipo: newContaContabil.tipo as any,
                              });
                              setNewContaContabil({ codigo: '', nome: '', tipo: 'DESPESA' });
                              await fetchContasContabeis();
                              showNotification('Conta contábil cadastrada!', 'success');
                            } catch (e) {
                              showNotification('Erro ao cadastrar conta.', 'error');
                            }
                          }}
                          className="bg-secondary/10 text-secondary px-4 py-2 rounded-lg text-xs font-bold border border-secondary/20 hover:bg-secondary/20 transition-all"
                        >
                          Cadastrar Conta
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await api.setupTables();
                              await fetchContasContabeis();
                              showNotification('Plano de contas padrão carregado.', 'success');
                            } catch {
                              showNotification('Erro ao carregar plano padrão.', 'error');
                            }
                          }}
                          className="ml-3 bg-primary/10 text-primary px-4 py-2 rounded-lg text-xs font-bold border border-primary/20 hover:bg-primary/20 transition-all"
                        >
                          Carregar Padrão
                        </button>
                      </div>
                    </div>
                    <div className="glass-card p-4">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-[11px] font-bold uppercase text-on-surface-variant mb-2">Despesas</p>
                          <div className="space-y-1 max-h-64 overflow-auto pr-1">
                            {contasContabeis.filter(c => matchesAccountType(c, 'DESPESA')).map((c) => (
                              <div key={c.id} className="flex items-center justify-between border border-white/10 rounded-lg px-3 py-2">
                                <span className="text-xs">{c.codigo} - {c.nome}</span>
                                <label className="text-[10px] flex items-center gap-2">
                                  <span className="text-on-surface-variant">{c.ativo ? 'Ativa' : 'Inativa'}</span>
                                  <input
                                    type="checkbox"
                                    checked={c.ativo}
                                    onChange={async (e) => {
                                      try {
                                        await api.updateContaContabil(c.id, { ativo: e.target.checked });
                                        await fetchContasContabeis();
                                      } catch {
                                        showNotification('Erro ao atualizar conta.', 'error');
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase text-on-surface-variant mb-2">Receitas</p>
                          <div className="space-y-1 max-h-64 overflow-auto pr-1">
                            {contasContabeis.filter(c => matchesAccountType(c, 'RECEITA')).map((c) => (
                              <div key={c.id} className="flex items-center justify-between border border-white/10 rounded-lg px-3 py-2">
                                <span className="text-xs">{c.codigo} - {c.nome}</span>
                                <label className="text-[10px] flex items-center gap-2">
                                  <span className="text-on-surface-variant">{c.ativo ? 'Ativa' : 'Inativa'}</span>
                                  <input
                                    type="checkbox"
                                    checked={c.ativo}
                                    onChange={async (e) => {
                                      try {
                                        await api.updateContaContabil(c.id, { ativo: e.target.checked });
                                        await fetchContasContabeis();
                                      } catch {
                                        showNotification('Erro ao atualizar conta.', 'error');
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-8 border-t border-white/5">
                  <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-widest">Contas Contábeis</h4>
                  <div className="space-y-4 max-w-xl mx-auto">
                    <div className="glass-card p-4">
                      <p className="text-[11px] text-on-surface-variant mb-3">Gerencie as contas contábeis usadas na classificação de lançamentos.</p>
                      
                      {/* Botão Carregar Padrão */}
                      <button
                        onClick={async () => {
                          try {
                            await api.setupTables();
                            await fetchContasContabeis();
                            showNotification('Contas padrão carregadas!', 'success');
                          } catch (error) {
                            showNotification('Erro ao carregar contas padrão.', 'error');
                          }
                        }}
                        className="w-full mb-4 bg-primary/10 text-primary px-4 py-2 rounded-lg text-xs font-bold border border-primary/20 hover:bg-primary/20 transition-all"
                      >
                        Carregar Padrão (atualiza contas antigas)
                      </button>
                      
                      <div className="flex gap-2 mb-4">
                        <input
                          type="text"
                          value={newContaContabil.codigo}
                          onChange={(e) => setNewContaContabil({ ...newContaContabil, codigo: e.target.value })}
                          placeholder="Código (ex: 3.10)"
                          className="w-24 bg-surface-variant/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                        <input
                          type="text"
                          value={newContaContabil.nome}
                          onChange={(e) => setNewContaContabil({ ...newContaContabil, nome: e.target.value })}
                          placeholder="Nome da conta"
                          className="flex-1 bg-surface-variant/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                        <select
                          value={newContaContabil.tipo}
                          onChange={(e) => setNewContaContabil({ ...newContaContabil, tipo: e.target.value })}
                          className="bg-surface-variant/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        >
                          <option value="DESPESA">Despesa</option>
                          <option value="RECEITA">Receita</option>
                        </select>
                        <button
                          onClick={addContaContabil}
                          className="bg-primary/20 text-primary px-4 py-2 rounded-lg text-xs font-bold border border-primary/30 hover:bg-primary/30 transition-all"
                        >
                          Adicionar
                        </button>
                      </div>
                      
                      {/* Caixa de Busca */}
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={14} />
                        <input
                          type="text"
                          placeholder="Buscar conta..."
                          value={searchContaContabil || ''}
                          onChange={(e) => setSearchContaContabil(e.target.value)}
                          className="w-full bg-surface-variant/20 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {contasContabeis
                          .filter(c => {
                            const q = (searchContaContabil || '').toLowerCase();
                            if (!q) return true;
                            return c.codigo.toLowerCase().includes(q) || c.nome.toLowerCase().includes(q);
                          })
                          .map((conta) => (
                          <div key={conta.id} className="flex items-center justify-between bg-surface-variant/10 border border-white/5 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-bold px-2 py-1 rounded ${conta.tipo === 'RECEITA' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {conta.codigo}
                              </span>
                              <span className="text-sm">{conta.nome}</span>
                            </div>
                            <button
                              onClick={() => deleteContaContabil(conta.id)}
                              className="text-tertiary hover:text-tertiary/80"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {contasContabeis.length === 0 && (
                          <p className="text-center text-xs text-on-surface-variant py-4">Nenhuma conta contábil cadastrada.</p>
                        )}
                      </div>
                    </div>
                  </div>
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

      {showPdfImportModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg md:text-xl font-bold font-headline flex items-center gap-2">
                <FileUp className="text-primary" size={20} /> Automação de Boletos
              </h3>
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                {pdfExtractedRows.length} arquivo(s)
              </span>
            </div>

            <div className="p-4 max-h-[60vh] overflow-auto">
              <div className="space-y-3">
                {pdfExtractedRows.map((row, index) => (
                  <div key={`${row.fileName}-${index}`} className={cn("border rounded-xl p-3", row.duplicate ? "border-tertiary/40 bg-tertiary/5" : "border-white/10 bg-surface-variant/10")}>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-3">
                        <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Arquivo</p>
                        <p className="text-xs text-on-surface-variant truncate">
                          {row.fileName.length > 55 ? `boleto_${index + 1}.pdf` : row.fileName}
                        </p>
                      </div>
                      <div className="md:col-span-3">
                        <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Fornecedor</p>
                        <input
                          list="supplier-suggestions"
                          value={row.fornecedor}
                          onChange={(e) => updatePdfRow(index, { fornecedor: e.target.value })}
                          onBlur={(e) => updatePdfRow(index, { fornecedor: resolveSupplierName(e.target.value, row.rawText) })}
                          className="w-full bg-surface-variant/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Vencimento</p>
                        <input
                          value={row.vencimento}
                          onChange={(e) => updatePdfRow(index, { vencimento: e.target.value })}
                          placeholder="DD/MM/AAAA"
                          className="w-full bg-surface-variant/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Valor</p>
                        <input
                          type="number"
                          step="0.01"
                          value={row.valor}
                          onChange={(e) => updatePdfRow(index, { valor: Number(e.target.value) })}
                          className="w-full bg-surface-variant/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div className="md:col-span-2 flex md:justify-end items-end">
                        <span className={cn(
                          "text-[10px] font-bold uppercase px-2 py-1 rounded border",
                          !row.numero_boleto
                            ? "text-secondary border-secondary/40 bg-secondary/10"
                            : row.duplicate
                              ? "text-tertiary border-tertiary/40 bg-tertiary/10"
                              : "text-primary border-primary/40 bg-primary/10"
                        )}>
                          {!row.numero_boleto ? 'Sem número' : row.duplicate ? 'Duplicado' : 'Novo'}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-2">
                      <div className="md:col-span-5">
                        <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Descrição</p>
                        <input
                          value={row.descricao}
                          onChange={(e) => updatePdfRow(index, { descricao: e.target.value })}
                          placeholder="Descrição do boleto"
                          className="w-full bg-surface-variant/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div className="md:col-span-4">
                        <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Número do Boleto</p>
                        <input
                          value={row.numero_boleto || ''}
                          onChange={(e) => updatePdfRow(index, { numero_boleto: e.target.value })}
                          placeholder="Nosso número / Nro documento"
                          className="w-full bg-surface-variant/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Tipo</p>
                        <select
                          value={row.tipo || 'DESPESA'}
                          onChange={(e) => updatePdfRow(index, { tipo: e.target.value as 'RECEITA' | 'DESPESA', conta_contabil_id: undefined })}
                          className="w-full bg-surface-variant/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary text-on-surface"
                          style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}
                        >
                          <option value="DESPESA" style={{ backgroundColor: '#1e1e2e' }}>Despesa</option>
                          <option value="RECEITA" style={{ backgroundColor: '#1e1e2e' }}>Receita</option>
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Empresa</p>
                        <select
                          value={row.empresa}
                          onChange={(e) => updatePdfRow(index, { empresa: e.target.value })}
                          className="w-full bg-surface-variant/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary text-on-surface"
                          style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}
                        >
                          <option value="" style={{ backgroundColor: '#1e1e2e' }}>Selecione</option>
                          {companyOptions.map((company) => (
                            <option key={company} value={company} style={{ backgroundColor: '#1e1e2e' }}>{company}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Conta Contábil</p>
                        <select
                          value={row.conta_contabil_id || ''}
                          onChange={(e) => updatePdfRow(index, { conta_contabil_id: e.target.value ? Number(e.target.value) : undefined })}
                          className="w-full bg-surface-variant/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary text-on-surface"
                          style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}
                        >
                          <option value="" style={{ backgroundColor: '#1e1e2e' }}>Selecione a conta</option>
                          {contasContabeis
                            .filter((conta) => matchesAccountType(conta, (row.tipo || 'DESPESA') as 'RECEITA' | 'DESPESA'))
                            .map((conta) => (
                            <option key={conta.id} value={conta.id} style={{ backgroundColor: '#1e1e2e' }}>
                              {conta.codigo} - {conta.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      {row.cnpj && (
                        <div className="md:col-span-5 flex items-end">
                          <p className="text-xs text-on-surface-variant">CNPJ: {row.cnpj}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <datalist id="supplier-suggestions">
                  {suppliers.map((supplier) => (
                    <option key={supplier.id || supplier.nome} value={supplier.nome} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPdfImportModal(false);
                  setPdfExtractedRows([]);
                }}
                className="px-4 py-2 rounded-lg text-sm font-bold text-on-surface-variant hover:text-white hover:bg-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPdfImport}
                className="bg-primary text-background px-5 py-2 rounded-lg text-sm font-black uppercase tracking-widest hover:bg-primary-dark transition-all"
              >
                Confirmar Importação
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewTxModal && (
        <NewTxModal 
          suppliers={suppliers}
          banks={banks}
          contasContabeis={contasContabeis}
          companyOptions={companyOptions}
          setShowNewTxModal={setShowNewTxModal} 
          onSuccess={() => {
            fetchTransactions();
            showNotification('Lançamento salvo com sucesso!', 'success');
          }}
          initialTipo={newTxInitialTipo}
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
          contasContabeis={contasContabeis}
          companyOptions={companyOptions}
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
