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
import { db, auth, DEFAULT_USER_UID } from './firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs,
  doc, 
  query, 
  where,
  getDocFromServer,
  Timestamp,
  writeBatch
} from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut,
  User
} from './firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    const self = this as any;
    if (self.state.hasError) {
      let message = "Ocorreu um erro inesperado.";
      try {
        const errInfo = JSON.parse(self.state.error.message);
        if (errInfo.error.includes('Missing or insufficient permissions')) {
          message = "Você não tem permissão para realizar esta operação. Verifique as regras de segurança.";
        }
      } catch (e) {
        // Not a JSON error
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-on-surface p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Ops! Algo deu errado.</h2>
          <p className="text-on-surface-variant mb-6">{message}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-primary text-background px-6 py-2 rounded-lg font-bold"
          >
            Recarregar Aplicativo
          </button>
        </div>
      );
    }
    return self.props.children;
  }
}

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
      className="glass-card p-6 border-l-4"
      style={{ borderLeftColor: kpi.color }}
    >
      <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 font-headline">
        {kpi.label}
      </p>
      <h3 className="text-2xl font-bold font-headline text-on-surface">
        {kpi.value}
      </h3>
      {kpi.trend && (
        <div className="mt-2 text-[10px] text-primary flex items-center gap-1">
          <TrendingUp size={14} /> {kpi.trend}
        </div>
      )}
      {kpi.description && (
        <p className="mt-2 text-[10px] text-on-surface-variant">
          {kpi.description}
        </p>
      )}
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
                        <Cell key={`cell-${index}`} fill={[ '#78dc77', '#fabd00', '#ffb3b0' ][index]} />
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
                <div key={tx.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border-l-2 border-primary/40">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{tx.fornecedor}</span>
                    <span className="text-[10px] text-on-surface-variant">{tx.vencimento}</span>
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

const LancamentosTab = ({ transactions, markAsPaid, deleteTransaction, setShowNewTxModal, setEditingTx }: LancamentosTabProps) => {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  
  const filtered = useMemo(() => {
    return transactions
      .filter(tx => {
        const matchesSearch = tx.fornecedor.toLowerCase().includes(filter.toLowerCase()) || 
                             tx.descricao.toLowerCase().includes(filter.toLowerCase());
        const matchesStatus = statusFilter === 'TODOS' || tx.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const dateA = a.vencimento.split('/').reverse().join('');
        const dateB = b.vencimento.split('/').reverse().join('');
        return dateB.localeCompare(dateA);
      });
  }, [transactions, filter, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex gap-3 flex-grow max-w-2xl">
          <div className="bg-surface-variant/20 flex items-center px-4 py-2.5 rounded-xl gap-3 border border-white/5 flex-grow">
            <Search size={18} className="text-on-surface-variant" />
            <input 
              type="text" 
              placeholder="Buscar fornecedor ou descrição..."
              className="bg-transparent border-none text-sm text-on-surface focus:ring-0 p-0 outline-none w-full"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <select 
            className="bg-surface-variant/20 border border-white/5 text-on-surface text-sm rounded-xl px-4 py-2.5 outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="TODOS">Todos Status</option>
            <option value="PAGO">PAGO</option>
            <option value="PENDENTE">PENDENTE</option>
            <option value="VENCIDO">VENCIDO</option>
          </select>
        </div>
        <button 
          onClick={() => setShowNewTxModal(true)}
          className="bg-primary text-background px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Plus size={18} /> Novo Lançamento
        </button>
      </div>

      <div className="glass-card overflow-hidden">
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
              {filtered.map((tx) => (
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
              <Area type="monotone" dataKey="value" stroke="#78dc77" fill="#78dc7720" />
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
              <Bar dataKey="value" fill="#78dc77" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center">
          <h4 className="text-lg font-bold font-headline">Lançamentos no Período</h4>
          <span className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">
            {filteredData.length} registros encontrados
          </span>
        </div>
        <div className="overflow-x-auto">
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

interface ImportPreviewModalProps {
  previewData: any[];
  headers: string[];
  onConfirm: () => void;
  onCancel: () => void;
  importProgress?: { current: number; total: number } | null;
}

const ImportPreviewModal = ({ previewData, headers, onConfirm, onCancel, importProgress }: ImportPreviewModalProps) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const getStatusColor = (status: string) => {
    const s = String(status).toUpperCase();
    if (s.includes('PAGO')) return 'bg-green-500/80 text-white font-bold';
    if (s.includes('VENCIDO')) return 'bg-red-500/80 text-white font-bold';
    return 'bg-yellow-500/80 text-black font-bold';
  };

  const progressPercent = importProgress ? Math.round((importProgress.current / importProgress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-6 w-full max-w-3xl border border-white/10 shadow-2xl overflow-y-auto max-h-[85vh]"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold font-headline">
            {importProgress ? 'Importando...' : 'Preview da Importação'}
          </h3>
          {!importProgress && (
            <button 
              onClick={onCancel}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>
        
        {importProgress ? (
          <div className="py-12 text-center">
            <div className="text-4xl font-bold text-primary mb-4">{progressPercent}%</div>
            <div className="w-full bg-surface rounded-full h-4 mb-2">
              <div 
                className="bg-primary h-4 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-on-surface-variant">
              Processando {importProgress.current} de {importProgress.total} registros...
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-on-surface-variant mb-4">
              Os seguintes dados serão importados ({previewData.length} registros):
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-xs font-bold text-on-surface-variant uppercase">Fornecedor</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-on-surface-variant uppercase">Descrição</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-on-surface-variant uppercase">Vencimento</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-on-surface-variant uppercase">Valor</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-on-surface-variant uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, idx) => (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-4">{row.fornecedor}</td>
                      <td className="py-3 px-4 text-on-surface-variant">{row.descricao}</td>
                      <td className="py-3 px-4">{row.vencimento}</td>
                      <td className="py-3 px-4 text-right font-mono">{formatCurrency(row.valor)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-4 mt-6">
              <button 
                onClick={onCancel}
                className="flex-1 px-4 py-3 rounded-lg border border-white/10 text-sm font-bold hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={onConfirm}
                className="flex-1 px-4 py-3 rounded-lg bg-primary text-background text-sm font-bold hover:opacity-90 transition-opacity"
              >
                Confirmar Importação
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

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
    if (!auth.currentUser) return;

    const isLocal = auth.currentUser.uid === 'local-user-123';
    const vencimentoFormatted = formData.vencimento.split('-').reverse().join('/');
    const pagamentoFormatted = formData.status === 'PAGO' 
      ? (formData.pagamento ? formData.pagamento.split('-').reverse().join('/') : new Date().toLocaleDateString('pt-BR')) 
      : undefined;

    try {
      if (isLocal) {
        const newTx: Transaction = {
          id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          fornecedor: formData.fornecedor,
          descricao: formData.descricao,
          empresa: formData.empresa,
          vencimento: vencimentoFormatted,
          pagamento: pagamentoFormatted,
          valor: Number(formData.valor),
          status: formData.status
        };
        const txs = JSON.parse(window.localStorage.getItem('local_transactions') || '[]');
        txs.push(newTx);
        window.localStorage.setItem('local_transactions', JSON.stringify(txs));
      } else {
        const newTx = {
          uid: auth.currentUser.uid,
          ...formData,
          valor: Number(formData.valor),
          vencimento: vencimentoFormatted,
          pagamento: pagamentoFormatted,
          createdAt: Timestamp.now()
        };
        await addDoc(collection(db, 'transactions'), newTx);
      }
      setShowNewTxModal(false);
      window.location.reload();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 w-full max-w-md border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]"
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
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-background text-sm font-bold hover:opacity-90"
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
      pagamento: formData.status === 'PAGO' ? formData.pagamento.split('-').reverse().join('/') : undefined,
      valor: parseFloat(formData.valor)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 w-full max-w-lg border border-white/10 shadow-2xl"
      >
        <h3 className="text-xl font-bold font-headline mb-6">Editar Lançamento</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Fornecedor</label>
            <select 
              className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
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
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-sm font-bold hover:bg-white/5"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-background text-sm font-bold hover:opacity-90"
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
    if (!auth.currentUser) return;

    const isLocal = auth.currentUser.uid === 'local-user-123';

    try {
      if (isLocal) {
        const newSupplier: Supplier = {
          id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          ...formData
        };
        const sups = JSON.parse(window.localStorage.getItem('local_suppliers') || '[]');
        sups.push(newSupplier);
        window.localStorage.setItem('local_suppliers', JSON.stringify(sups));
      } else {
        const newSupplier = {
          ...formData,
          uid: auth.currentUser.uid,
          createdAt: Timestamp.now()
        };
        await addDoc(collection(db, 'suppliers'), newSupplier);
      }
      setShowNewSupplierModal(false);
      window.location.reload();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'suppliers');
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
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
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
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [showNewTxModal, setShowNewTxModal] = useState(false);
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importRawData, setImportRawData] = useState<any[]>([]);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const isLocalMode = user?.uid === 'local-user-123';

  const localStore = {
    saveTransactions: (txs: Transaction[]) => {
      window.localStorage.setItem('local_transactions', JSON.stringify(txs));
    },
    loadTransactions: (): Transaction[] => {
      const data = window.localStorage.getItem('local_transactions');
      return data ? JSON.parse(data) : [];
    },
    saveSuppliers: (sups: Supplier[]) => {
      window.localStorage.setItem('local_suppliers', JSON.stringify(sups));
    },
    loadSuppliers: (): Supplier[] => {
      const data = window.localStorage.getItem('local_suppliers');
      return data ? JSON.parse(data) : [];
    },
    generateId: () => 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  };

  // --- Firebase Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Erro ao fazer login:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  // --- Data Sync ---
  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setSuppliers([]);
      return;
    }

    if (isLocalMode) {
      const txs = localStore.loadTransactions();
      const sups = localStore.loadSuppliers();
      setTransactions(txs);
      setSuppliers(sups);
      return;
    }

    const qTransactions = query(collection(db, 'transactions'), where('uid', '==', user.uid));
    const unsubscribeTransactions = onSnapshot(qTransactions, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(txs.sort((a, b) => b.id.localeCompare(a.id)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    const qSuppliers = query(collection(db, 'suppliers'), where('uid', '==', user.uid));
    const unsubscribeSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      const sups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(sups);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'suppliers');
    });

    return () => {
      unsubscribeTransactions();
      unsubscribeSuppliers();
    };
  }, [user, isLocalMode]);

  // --- Handlers ---

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        showNotification('Processando arquivo Excel...', 'info');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        const allSheetsData: any[] = [];
        const sheetNames = workbook.SheetNames;
        
        for (const sheetName of sheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[];
          for (const row of jsonData) {
            row._sheetName = sheetName;
          }
          allSheetsData.push(...jsonData);
        }

        if (allSheetsData.length === 0) {
          showNotification('A planilha parece estar vazia.', 'error');
          return;
        }

        const getRowValue = (row: any, keys: string[]) => {
          const rowKeys = Object.keys(row);
          for (const key of keys) {
            const foundKey = rowKeys.find(rk => rk.trim().toUpperCase() === key.toUpperCase());
            if (foundKey) {
              const val = row[foundKey];
              if (val !== undefined && val !== null && val !== '') return val;
            }
          }
          for (const key of keys) {
            const foundKey = rowKeys.find(rk => rk.toUpperCase().includes(key.toUpperCase()));
            if (foundKey) {
              const val = row[foundKey];
              if (val !== undefined && val !== null && val !== '') return val;
            }
          }
          return undefined;
        };

        const parseValor = (val: any): number => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          const str = String(val).replace(/[R$\s]/g, '').trim();
          if (str === '' || str.toUpperCase() === 'TOTAL') return 0;
          if (str.includes(',') && str.includes('.')) {
            const parts = str.split(',');
            if (parts.length === 2) {
              return Number(parts[0].replace(/\./g, '') + '.' + parts[1]);
            }
          }
          if (str.includes(',')) {
            return Number(str.replace(/\./g, '').replace(',', '.'));
          }
          const n = Number(str.replace(/\./g, ''));
          return isNaN(n) ? 0 : n;
        };

        const formatDate = (val: any): string => {
          if (!val) return '';
          if (val instanceof Date) return val.toLocaleDateString('pt-BR');
          const str = String(val).trim();
          if (!str) return '';
          if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) return str;
          if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
            const [y, m, d] = str.split('-');
            return `${d}/${m}/${y}`;
          }
          return str;
        };

        const headers = Object.keys(allSheetsData[0] || {}).slice(0, 10);

        const previewRows: any[] = [];
        let previewCount = 0;
        for (const row of allSheetsData) {
          if (previewCount >= 5) break;
          
          const rawFornecedor = getRowValue(row, ['Fornecedor', 'fornecedor', 'FORNECEDOR', 'FORNECEDORES', 'Fornecedores', 'FORNECEDOR_NOME', 'Nome', 'NOME', 'Favorecido', 'FAVORECIDO', 'CLIENTE', 'Cliente']);
          const rawDescricao = getRowValue(row, ['Descricao', 'descricao', 'DESCRIÇÃO', 'OBSERVACAO', 'Observacao', 'OBS', 'Obs', 'DETALHE', 'Detalhe']);
          
          const fornecedorStr = String(rawFornecedor || '').trim().toUpperCase();
          if (!rawFornecedor || fornecedorStr === '' || fornecedorStr.includes('TOTAL') || fornecedorStr.includes('FORNECEDOR') || fornecedorStr.includes('CLIENTE')) {
            if (!rawDescricao) continue;
          }

          const rawValor = getRowValue(row, ['Valor', 'valor', 'VALOR', 'VALOR TOTAL', 'Valor Total', 'Total', 'total', 'VALOR_TOTAL', 'Quantia', 'Preço', 'Preco']);
          const sanitizedValor = parseValor(rawValor);

          const rawPagamento = getRowValue(row, ['DATA PAGAMENTO', 'Data Pagamento', 'pagamento', 'PAGAMENTO', 'Data Pago', 'DATA PAGO', 'Pago em', 'PAGO EM']);
          const rawStatus = String(getRowValue(row, ['Status', 'status', 'SITUAÇÃO', 'Situacao', 'SITUACAO', 'Situação', 'PAGO', 'Pago', 'SIT 2', 'SIT2']) || '').toUpperCase();
          let status: TransactionStatus = 'PENDENTE';
          
          if (rawStatus.includes('PAGO') || (rawPagamento && String(rawPagamento).trim() !== '')) {
            status = 'PAGO';
          } else if (rawStatus.includes('VENCIDO')) {
            status = 'VENCIDO';
          }

          const rawVencimento = getRowValue(row, ['Vencimento', 'vencimento', 'VENCIMENTO', 'DATA VENCIMENTO', 'Data Vencimento', 'Data', 'DATA', 'Venc', 'VENC']);

          previewRows.push({
            fornecedor: String(rawFornecedor || 'Sem fornecedor').trim(),
            descricao: String(rawDescricao || '-'),
            vencimento: formatDate(rawVencimento),
            valor: sanitizedValor,
            status: status
          });
          previewCount++;
        }

        setImportRawData(allSheetsData);
        setPreviewData(previewRows);
        setShowImportPreview(true);
        showNotification(`${sheetNames.length} abas encontradas com ${allSheetsData.length} linhas. Verifique o preview.`, 'info');
      } catch (err) {
        console.error('Erro ao processar arquivo:', err);
        showNotification('Erro ao processar o arquivo. Verifique o formato.', 'error');
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmImport = async () => {
    if (!user || importRawData.length === 0) return;

    try {
      showNotification('Importando lançamentos... Por favor, aguarde.', 'info');
      
      const getRowValue = (row: any, keys: string[]) => {
        const rowKeys = Object.keys(row);
        for (const key of keys) {
          const foundKey = rowKeys.find(rk => rk.trim().toUpperCase() === key.toUpperCase());
          if (foundKey) {
            const val = row[foundKey];
            if (val !== undefined && val !== null && val !== '') return val;
          }
        }
        for (const key of keys) {
          const foundKey = rowKeys.find(rk => rk.toUpperCase().includes(key.toUpperCase()));
          if (foundKey) {
            const val = row[foundKey];
            if (val !== undefined && val !== null && val !== '') return val;
          }
        }
        return undefined;
      };

      const parseValor = (val: any): number => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const str = String(val).replace(/[R$\s]/g, '').trim();
        if (str === '' || str.toUpperCase() === 'TOTAL') return 0;
        if (str.includes(',') && str.includes('.')) {
          const parts = str.split(',');
          if (parts.length === 2) {
            return Number(parts[0].replace(/\./g, '') + '.' + parts[1]);
          }
        }
        if (str.includes(',')) {
          return Number(str.replace(/\./g, '').replace(',', '.'));
        }
        const n = Number(str.replace(/\./g, ''));
        return isNaN(n) ? 0 : n;
      };

      const formatDate = (val: any): string => {
        if (!val) return '';
        if (val instanceof Date) return val.toLocaleDateString('pt-BR');
        const str = String(val).trim();
        if (!str) return '';
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) return str;
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
          const [y, m, d] = str.split('-');
          return `${d}/${m}/${y}`;
        }
        return str;
      };

      const newSuppliers: Supplier[] = [];
      let totalImported = 0;
      const totalRows = importRawData.length;

      if (isLocalMode) {
        const existingTxs = localStore.loadTransactions();
        const existingSups = localStore.loadSuppliers();
        const localSuppliersSet = new Set(existingSups.map(s => s.nome));
        
        let processedCount = 0;
        for (const row of importRawData) {
          processedCount++;
          if (processedCount % 100 === 0) {
            setImportProgress({ current: processedCount, total: totalRows });
            await new Promise(r => setTimeout(r, 0));
          }
          
          const rawFornecedor = getRowValue(row, ['Fornecedor', 'fornecedor', 'FORNECEDOR', 'FORNECEDORES', 'Fornecedores', 'FORNECEDOR_NOME', 'Nome', 'NOME', 'Favorecido', 'FAVORECIDO', 'CLIENTE', 'Cliente']);
          const rawDescricao = getRowValue(row, ['Descricao', 'descricao', 'DESCRIÇÃO', 'OBSERVACAO', 'Observacao', 'OBS', 'Obs', 'DETALHE', 'Detalhe']);
          
          const fornecedorStr = String(rawFornecedor || '').trim().toUpperCase();
          if (!rawFornecedor || fornecedorStr === '' || fornecedorStr.includes('TOTAL') || fornecedorStr.includes('FORNECEDOR') || fornecedorStr.includes('CLIENTE')) {
            if (!rawDescricao) continue;
          }

          const rawValor = getRowValue(row, ['Valor', 'valor', 'VALOR', 'VALOR TOTAL', 'Valor Total', 'Total', 'total', 'VALOR_TOTAL', 'Quantia', 'Preço', 'Preco']);
          const sanitizedValor = parseValor(rawValor);
          const fornecedorNome = String(rawFornecedor || 'Sem fornecedor').trim();
          const rawPagamento = getRowValue(row, ['DATA PAGAMENTO', 'Data Pagamento', 'pagamento', 'PAGAMENTO', 'Data Pago', 'DATA PAGO', 'Pago em', 'PAGO EM']);
          const rawStatus = String(getRowValue(row, ['Status', 'status', 'SITUAÇÃO', 'Situacao', 'SITUACAO', 'Situação', 'PAGO', 'Pago', 'SIT 2', 'SIT2']) || '').toUpperCase();
          
          let status: TransactionStatus = 'PENDENTE';
          if (rawStatus.includes('PAGO') || (rawPagamento && String(rawPagamento).trim() !== '')) {
            status = 'PAGO';
          } else if (rawStatus.includes('VENCIDO')) {
            status = 'VENCIDO';
          }
          
          const pagamentoDate = (status === 'PAGO' && rawPagamento) ? formatDate(rawPagamento) : undefined;
          const rawVencimento = getRowValue(row, ['Vencimento', 'vencimento', 'VENCIMENTO', 'DATA VENCIMENTO', 'Data Vencimento', 'Data', 'DATA', 'Venc', 'VENC']);
          const rawEmpresa = getRowValue(row, ['Empresa', 'empresa', 'EMPRESA', 'UNIDADE', 'Unidade', 'LOJA', 'Loja']);

          const newTx: Transaction = {
            id: localStore.generateId(),
            fornecedor: fornecedorNome,
            descricao: String(rawDescricao || '-'),
            empresa: String(rawEmpresa || 'Geral'),
            vencimento: formatDate(rawVencimento),
            valor: sanitizedValor,
            status: status,
            pagamento: pagamentoDate,
            mes: String(row._sheetName || '')
          };
          existingTxs.push(newTx);
          totalImported++;

          if (!localSuppliersSet.has(fornecedorNome) && fornecedorNome !== 'Desconhecido') {
            const newSup: Supplier = {
              id: localStore.generateId(),
              nome: fornecedorNome,
              email: '',
              telefone: '',
              cnpj: '',
              endereco: '',
              cidade: '',
              estado: '',
              categoria: '',
              observacoes: ''
            };
            existingSups.push(newSup);
            localSuppliersSet.add(fornecedorNome);
            newSuppliers.push(newSup);
          }
        }

        localStore.saveTransactions(existingTxs);
        localStore.saveSuppliers(existingSups);
        setTransactions(existingTxs);
        setSuppliers(existingSups);
        setImportProgress(null);
      } else {
        const localSuppliersSet = new Set(suppliers.map(s => s.nome));
        let batch = writeBatch(db);
        let count = 0;

        for (const row of importRawData) {
          const rawFornecedor = getRowValue(row, ['Fornecedor', 'fornecedor', 'FORNECEDOR', 'FORNECEDORES', 'Fornecedores', 'FORNECEDOR_NOME', 'Nome', 'NOME', 'Favorecido', 'FAVORECIDO', 'CLIENTE', 'Cliente']);
          const rawDescricao = getRowValue(row, ['Descricao', 'descricao', 'DESCRIÇÃO', 'OBSERVACAO', 'Observacao', 'OBS', 'Obs', 'DETALHE', 'Detalhe']);
          
          const fornecedorStr = String(rawFornecedor || '').trim().toUpperCase();
          if (!rawFornecedor || fornecedorStr === '' || fornecedorStr.includes('TOTAL') || fornecedorStr.includes('FORNECEDOR') || fornecedorStr.includes('CLIENTE')) {
            if (!rawDescricao) continue;
          }

          const rawValor = getRowValue(row, ['Valor', 'valor', 'VALOR', 'VALOR TOTAL', 'Valor Total', 'Total', 'total', 'VALOR_TOTAL', 'Quantia', 'Preço', 'Preco']);
          const sanitizedValor = parseValor(rawValor);
          const fornecedorNome = String(rawFornecedor || 'Sem fornecedor').trim();
          const rawPagamento = getRowValue(row, ['DATA PAGAMENTO', 'Data Pagamento', 'pagamento', 'PAGAMENTO', 'Data Pago', 'DATA PAGO', 'Pago em', 'PAGO EM']);
          const rawStatus = String(getRowValue(row, ['Status', 'status', 'SITUAÇÃO', 'Situacao', 'SITUACAO', 'Situação', 'PAGO', 'Pago', 'SIT 2', 'SIT2']) || '').toUpperCase();
          
          let status: TransactionStatus = 'PENDENTE';
          if (rawStatus.includes('PAGO') || (rawPagamento && String(rawPagamento).trim() !== '')) {
            status = 'PAGO';
          } else if (rawStatus.includes('VENCIDO')) {
            status = 'VENCIDO';
          }
          
          const pagamentoDate = (status === 'PAGO' && rawPagamento) ? formatDate(rawPagamento) : undefined;
          const rawVencimento = getRowValue(row, ['Vencimento', 'vencimento', 'VENCIMENTO', 'DATA VENCIMENTO', 'Data Vencimento', 'Data', 'DATA', 'Venc', 'VENC']);
          const rawEmpresa = getRowValue(row, ['Empresa', 'empresa', 'EMPRESA', 'UNIDADE', 'Unidade', 'LOJA', 'Loja']);

          const txRef = doc(collection(db, 'transactions'));
          const txData: any = {
            uid: user.uid,
            fornecedor: fornecedorNome,
            descricao: String(rawDescricao || '-'),
            empresa: String(rawEmpresa || 'Geral'),
            vencimento: formatDate(rawVencimento),
            valor: sanitizedValor,
            status: status,
            createdAt: Timestamp.now()
          };
          
          if (pagamentoDate) {
            txData.pagamento = pagamentoDate;
          }
          
          batch.set(txRef, txData);
          count++;
          totalImported++;

          if (!localSuppliersSet.has(fornecedorNome) && fornecedorNome !== 'Desconhecido') {
            const supRef = doc(collection(db, 'suppliers'));
            batch.set(supRef, {
              uid: user.uid,
              nome: fornecedorNome,
              email: '',
              telefone: '',
              cnpj: '',
              endereco: '',
              cidade: '',
              estado: '',
              categoria: '',
              observacoes: '',
              createdAt: Timestamp.now()
            });
            localSuppliersSet.add(fornecedorNome);
            count++;
          }

          if (count >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }

        if (count > 0) {
          await batch.commit();
        }
      }

      setShowImportPreview(false);
      setPreviewData([]);
      setImportRawData([]);
      setImportProgress(null);
      showNotification(`${totalImported} lançamentos importados com sucesso!`, 'success');
    } catch (err) {
      console.error('Erro ao importar:', err);
      setImportProgress(null);
      showNotification('Erro ao importar os dados. Tente novamente.', 'error');
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      if (isLocalMode) {
        const txs = localStore.loadTransactions();
        const idx = txs.findIndex(t => t.id === id);
        if (idx !== -1) {
          txs[idx].status = 'PAGO';
          txs[idx].pagamento = new Date().toLocaleDateString('pt-BR');
          localStore.saveTransactions(txs);
          setTransactions(txs);
        }
      } else {
        await updateDoc(doc(db, 'transactions', id), {
          status: 'PAGO',
          pagamento: new Date().toLocaleDateString('pt-BR')
        });
      }
      showNotification('Lançamento marcado como pago!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${id}`);
    }
  };

  const updateTransaction = async (updatedTx: Transaction) => {
    try {
      if (isLocalMode) {
        const txs = localStore.loadTransactions();
        const idx = txs.findIndex(t => t.id === updatedTx.id);
        if (idx !== -1) {
          txs[idx] = updatedTx;
          localStore.saveTransactions(txs);
          setTransactions(txs);
        }
      } else {
        const { id, ...data } = updatedTx;
        await updateDoc(doc(db, 'transactions', id), data);
      }
      showNotification('Lançamento atualizado!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${updatedTx.id}`);
    }
  };

  const syncSuppliers = async () => {
    if (!user) return;
    
    if (isLocalMode) {
      showNotification('No modo local, fornecedores são sincronizados automaticamente.', 'info');
      return;
    }
    
    const transactionSuppliers = new Set<string>(transactions.map(tx => tx.fornecedor));
    const existingNames = new Set<string>(suppliers.map(s => s.nome));
    let count = 0;

    for (const nome of transactionSuppliers) {
      if (!existingNames.has(nome) && nome !== 'Desconhecido') {
        await addDoc(collection(db, 'suppliers'), {
          uid: user.uid,
          nome: nome,
          email: '',
          telefone: '',
          cnpj: '',
          endereco: '',
          cidade: '',
          estado: '',
          categoria: '',
          observacoes: '',
          createdAt: Timestamp.now()
        });
        count++;
      }
    }

    if (count > 0) {
      showNotification(`${count} novos fornecedores sincronizados!`, 'success');
    } else {
      showNotification('Todos os fornecedores já estão cadastrados.', 'info');
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      if (isLocalMode) {
        const txs = localStore.loadTransactions().filter(t => t.id !== id);
        localStore.saveTransactions(txs);
        setTransactions(txs);
      } else {
        await deleteDoc(doc(db, 'transactions', id));
      }
      showNotification('Lançamento excluído.', 'info');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
    }
  };

  const cleanEmptyTransactions = async () => {
    try {
      if (isLocalMode) {
        const txs = localStore.loadTransactions();
        const beforeCount = txs.length;
        const cleaned = txs.filter(tx => {
          if (tx.valor <= 0) return false;
          if (!tx.fornecedor || tx.fornecedor.trim() === '') return false;
          const forn = tx.fornecedor.toUpperCase();
          if (forn === 'CLIENTE' || forn === 'SEM FORNECEDOR') return false;
          if (forn.includes('DESCRIÇÃO') || forn.includes('FORNECEDOR')) return false;
          if (tx.descricao && (tx.descricao.toUpperCase().includes('VENCIMENTO') || tx.descricao.toUpperCase().includes('PAGAMENTO'))) return false;
          return true;
        });
        const removed = beforeCount - cleaned.length;
        localStore.saveTransactions(cleaned);
        setTransactions(cleaned);
        showNotification(`${removed} lançamentos vazios/removidos. ${cleaned.length} registros mantidos.`, 'success');
      } else {
        const q = query(collection(db, 'transactions'), where('uid', '==', user.uid));
        const snapshot = await getDocs(q);
        let removed = 0;
        const batch = writeBatch(db);
        snapshot.forEach(docSnap => {
          const tx = docSnap.data();
          if (tx.valor <= 0 || !tx.fornecedor || tx.fornecedor.trim() === '' || tx.fornecedor === 'Sem fornecedor' || tx.fornecedor.toUpperCase() === 'CLIENTE') {
            batch.delete(docSnap.ref);
            removed++;
          }
        });
        await batch.commit();
        showNotification(`${removed} lançamentos vazios removidos.`, 'success');
      }
    } catch (error) {
      console.error('Erro ao limpar lançamentos vazios:', error);
      showNotification('Erro ao limpar lançamentos vazios.', 'error');
    }
  };

  const deleteSupplier = async (id: string) => {
    try {
      if (isLocalMode) {
        const sups = localStore.loadSuppliers().filter(s => s.id !== id);
        localStore.saveSuppliers(sups);
        setSuppliers(sups);
      } else {
        await deleteDoc(doc(db, 'suppliers', id));
      }
      showNotification('Fornecedor excluído.', 'info');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `suppliers/${id}`);
    }
  };

  const resetSystem = async () => {
    if (!user) return;
    const msg = isLocalMode 
      ? 'ATENÇÃO: Isso apagará TODOS os seus lançamentos e fornecedores locais. Deseja continuar?'
      : 'ATENÇÃO: Isso apagará TODOS os seus lançamentos e fornecedores da nuvem. Deseja continuar?';
    if (!window.confirm(msg)) return;
    
    try {
      showNotification('Iniciando limpeza de dados...', 'info');
      
      if (isLocalMode) {
        window.localStorage.setItem('local_transactions', JSON.stringify([]));
        window.localStorage.setItem('local_suppliers', JSON.stringify([]));
        setTransactions([]);
        setSuppliers([]);
      } else {
        const txQuery = query(collection(db, 'transactions'), where('uid', '==', user.uid));
        const txSnapshot = await getDocs(txQuery);
        
        const supQuery = query(collection(db, 'suppliers'), where('uid', '==', user.uid));
        const supSnapshot = await getDocs(supQuery);
        
        const allDocs = [...txSnapshot.docs, ...supSnapshot.docs];
        
        if (allDocs.length === 0) {
          showNotification('Nenhum dado encontrado para apagar.', 'info');
          return;
        }

        let batch = writeBatch(db);
        let count = 0;
        for (const docSnap of allDocs) {
          batch.delete(docSnap.ref);
          count++;
          if (count === 500) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) await batch.commit();
      }
      
      showNotification('Sistema resetado com sucesso!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'reset-total');
    }
  };

  // --- Computed Stats ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const year = tx.vencimento.substring(tx.vencimento.length - 4);
      const month = tx.vencimento.substring(3, 5);
      const yearMatch = filterPeriod === 'all' || year === filterPeriod;
      const monthMatch = filterMonth === 'all' || month === filterMonth;
      return yearMatch && monthMatch;
    });
  }, [transactions, filterPeriod, filterMonth]);

  const stats = useMemo(() => {
    const total = filteredTransactions.reduce((acc, tx) => acc + tx.valor, 0);
    const pagos = filteredTransactions.filter(tx => tx.status === 'PAGO').length;
    const pendentes = filteredTransactions.filter(tx => tx.status === 'PENDENTE').length;
    const vencidos = filteredTransactions.filter(tx => tx.status === 'VENCIDO').length;
    
    const kpis: KPI[] = [
      { label: 'VALOR TOTAL', value: total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), color: '#78dc77' },
      { label: 'REGISTROS', value: filteredTransactions.length.toString(), description: 'Volume operacional', color: '#78dc77' },
      { label: 'EMPRESAS', value: [...new Set(filteredTransactions.map(t => t.empresa))].length.toString(), description: 'Unidades ativas', color: '#78dc77' },
      { label: 'PENDENTES', value: pendentes.toString(), description: 'Aguardando conciliação', color: '#fabd00' },
      { label: 'PAGOS', value: pagos.toString(), description: 'Liquidados', color: '#78dc77' },
      { label: 'VENCIDOS', value: vencidos.toString(), description: 'Ação imediata necessária', color: '#ffb3b0' },
    ];

    return { total, pagos, pendentes, vencidos, kpis };
  }, [filteredTransactions]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCw className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!user) {
    const handleLocalLogin = () => {
      const mockUser = {
        uid: 'local-user-123',
        email: 'local@test.com',
        displayName: 'Usuário Local',
        photoURL: null,
        emailVerified: true,
        isAnonymous: false,
        providerData: []
      } as any;
      setUser(mockUser);
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-12 max-w-md w-full text-center space-y-8 border border-white/10 shadow-2xl"
        >
          <div className="space-y-4">
            <h1 className="text-4xl font-extrabold font-headline tracking-tighter text-white">CN Intelligence</h1>
            <p className="text-on-surface-variant">Gestão financeira avançada para o Grupo CN.</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full bg-primary text-background py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-lg"
          >
            <LayoutDashboard size={20} /> Entrar com Google
          </button>
          <button 
            onClick={handleLocalLogin}
            className="w-full bg-secondary/20 text-secondary py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-secondary/30 transition-all border border-secondary/30"
          >
            <FileSpreadsheet size={18} /> Acesso Local (Teste)
          </button>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Acesso restrito a colaboradores autorizados</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-white/5 flex justify-between items-center w-full px-4 md:px-8 py-4 fixed top-0 z-50">
        <div className="flex items-center gap-4 md:gap-8">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white font-headline">CN Intelligence</h1>
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
          <button 
            onClick={handleLogout}
            className="p-2 text-on-surface-variant hover:bg-white/5 rounded-full transition-colors flex items-center gap-2"
            title="Sair"
          >
            <Settings size={20} />
            <span className="text-xs font-bold hidden md:block">SAIR</span>
          </button>
          <div className="h-8 w-8 rounded-full bg-surface-variant overflow-hidden border border-white/10">
            <img 
              src={user.photoURL || "https://picsum.photos/seed/user/64/64"} 
              alt={user.displayName || "User"} 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </header>

      {/* Mobile Navigation (Bottom Bar) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-white/10 z-50 flex justify-around items-center py-3 px-2">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'dashboard' ? "text-primary" : "text-on-surface-variant")}
        >
          <LayoutDashboard size={20} />
          <span className="text-[10px] font-bold uppercase">Dash</span>
        </button>
        <button 
          onClick={() => setActiveTab('lancamentos')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'lancamentos' ? "text-primary" : "text-on-surface-variant")}
        >
          <FileText size={20} />
          <span className="text-[10px] font-bold uppercase">Lanç</span>
        </button>
        <button 
          onClick={() => setActiveTab('fornecedores')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'fornecedores' ? "text-primary" : "text-on-surface-variant")}
        >
          <Building2 size={20} />
          <span className="text-[10px] font-bold uppercase">Forn</span>
        </button>
        <button 
          onClick={() => setActiveTab('relatorios')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'relatorios' ? "text-primary" : "text-on-surface-variant")}
        >
          <BarChart3 size={20} />
          <span className="text-[10px] font-bold uppercase">Relat</span>
        </button>
        <button 
          onClick={() => setActiveTab('configuracoes')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'configuracoes' ? "text-primary" : "text-on-surface-variant")}
        >
          <Settings size={20} />
          <span className="text-[10px] font-bold uppercase">Config</span>
        </button>
      </nav>

      <main className="flex-grow pt-24 pb-24 lg:pb-12 px-4 md:px-8 max-w-[1600px] mx-auto w-full">
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div>
            <h2 className="text-4xl font-extrabold font-headline text-on-surface mb-3 tracking-tight">
              {activeTab === 'dashboard' && '💰 Dashboard Fluxo de Caixa'}
              {activeTab === 'lancamentos' && '📋 Gestão de Lançamentos'}
              {activeTab === 'fornecedores' && '🏢 Fornecedores'}
              {activeTab === 'relatorios' && '📈 Relatórios Financeiros'}
              {activeTab === 'configuracoes' && '⚙️ Configurações'}
            </h2>
            <div className="flex flex-wrap gap-3">
              <span className="bg-surface-variant/20 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary border border-primary/20 flex items-center gap-2">
                <LayoutDashboard size={14} /> {filterPeriod === 'all' ? 'TODOS' : filterPeriod}{filterMonth !== 'all' ? '/' + filterMonth : ''}
              </span>
              <span className="bg-surface-variant/20 px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant flex items-center gap-2">
                <CheckCircle size={14} /> {filteredTransactions.length} de {transactions.length} registros
              </span>
              <span className="bg-surface-variant/20 px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant flex items-center gap-2">
                <Calendar size={14} /> {[...new Set(filteredTransactions.map(t => t.vencimento.substring(0, 7)))].length} períodos
              </span>
            </div>
            
          </div>

          {/* Actions + Filtro */}
          <div className="flex flex-wrap gap-3 items-center">
            <select 
              value={filterPeriod}
              onChange={e => { setFilterPeriod(e.target.value); setFilterMonth('all'); }}
              className="bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm font-medium focus:border-primary outline-none"
            >
              <option value="all">Todos os Anos</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
            <select 
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm font-medium focus:border-primary outline-none"
            >
              <option value="all">Todos os Meses</option>
              <option value="01">Janeiro</option>
              <option value="02">Fevereiro</option>
              <option value="03">Março</option>
              <option value="04">Abril</option>
              <option value="05">Maio</option>
              <option value="06">Junho</option>
              <option value="07">Julho</option>
              <option value="08">Agosto</option>
              <option value="09">Setembro</option>
              <option value="10">Outubro</option>
              <option value="11">Novembro</option>
              <option value="12">Dezembro</option>
            </select>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-surface-variant/20 text-on-surface px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-surface-variant/40 transition-all border border-white/5"
            >
              <FileSpreadsheet size={18} className="text-primary" /> Importar
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
                transactions={filteredTransactions} 
                markAsPaid={markAsPaid} 
                deleteTransaction={deleteTransaction} 
                setShowNewTxModal={setShowNewTxModal} 
                setEditingTx={setEditingTx}
              />
            )}
            {activeTab === 'fornecedores' && (
              <FornecedoresTab 
                suppliers={suppliers} 
                transactions={filteredTransactions} 
                deleteSupplier={deleteSupplier} 
                setShowNewSupplierModal={setShowNewSupplierModal} 
                syncSuppliers={syncSuppliers}
              />
            )}
            {activeTab === 'relatorios' && <RelatoriosTab transactions={filteredTransactions} />}
            {activeTab === 'configuracoes' && (
              <div className="glass-card p-10 text-center space-y-6">
                <Settings size={48} className="mx-auto text-on-surface-variant opacity-20" />
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Configurações do Sistema</h3>
                  <p className="text-on-surface-variant max-w-md mx-auto">
                    Aqui você poderá gerenciar usuários, permissões e integrações bancárias em futuras atualizações.
                  </p>
                </div>
                
                <div className="pt-8 border-t border-white/5 space-y-6">
                  <div className="bg-surface-variant/20 p-6 rounded-xl border border-white/5">
                    <h4 className="text-sm font-bold text-secondary mb-4 uppercase tracking-widest">Limpeza de Dados</h4>
                    <button 
                      onClick={cleanEmptyTransactions}
                      className="bg-secondary/10 text-secondary px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-secondary/20 transition-all mx-auto border border-secondary/20"
                    >
                      <Trash2 size={18} /> Limpar Registros Vazios
                    </button>
                    <p className="text-[10px] text-on-surface-variant mt-3">
                      Remove lançamentos sem valor, cabeçalhos e dados inválidos.
                    </p>
                  </div>
                
                  <div>
                    <h4 className="text-sm font-bold text-tertiary mb-4 uppercase tracking-widest">Zona de Perigo</h4>
                    <button 
                      onClick={resetSystem}
                      className="bg-tertiary/10 text-tertiary px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-tertiary/20 transition-all mx-auto border border-tertiary/20"
                    >
                      <Trash2 size={18} /> Resetar Todo o Sistema
                    </button>
                    <p className="text-[10px] text-on-surface-variant mt-3">
                      Isso apagará todos os seus lançamentos e fornecedores salvos.
                    </p>
                  </div>
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

      {showImportPreview && (
        <ImportPreviewModal
          previewData={previewData}
          headers={Object.keys(importRawData[0] || {})}
          onConfirm={confirmImport}
          onCancel={() => {
            setShowImportPreview(false);
            setPreviewData([]);
            setImportRawData([]);
            setImportProgress(null);
          }}
          importProgress={importProgress}
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
