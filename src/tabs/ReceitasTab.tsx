import React from 'react';
import { Transaction } from '../types';
import { cn, isRevenueTransaction, normalizeCompanyKey, dateSortKey, toDisplayDate } from '../lib/utils';
import { api } from '../api';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Plus } from 'lucide-react';
import { motion } from 'motion/react';

interface ReceitasTabProps {
  transactions: Transaction[];
  onNewRevenue: () => void;
}

// Cache em memória persistido durante o tempo de vida da aba/aplicativo
let receitasBaseCache: Transaction[] | null = null;

const ReceitasTab = ({ transactions, onNewRevenue }: ReceitasTabProps) => {
  const MIN_YEAR = 2024;
  const [receitasBase, setReceitasBase] = React.useState<Transaction[]>([]);
  const [isLoadingReceitas, setIsLoadingReceitas] = React.useState(false);

  const loadReceitasBase = React.useCallback(async (forceRefetch = false) => {
    if (receitasBaseCache && !forceRefetch) {
      setReceitasBase(receitasBaseCache);
      return;
    }
    setIsLoadingReceitas(true);
    try {
      const limit = 2000;
      let offset = 0;
      const acc: Transaction[] = [];

      for (;;) {
        const page = await api.getTransactions(limit, offset, undefined, undefined, undefined, 'RECEITA');
        if (!Array.isArray(page) || page.length === 0) break;

        const normalized = page.map((tx) => ({
          ...tx,
          valor: Number((tx as any).valor) || 0,
          juros: Number((tx as any).juros || 0) || 0,
          vencimento: toDisplayDate((tx as any).vencimento),
          pagamento: (tx as any).pagamento ? toDisplayDate((tx as any).pagamento) : undefined,
        })) as Transaction[];

        acc.push(...normalized);
        offset += page.length;

        const last = normalized[normalized.length - 1];
        const parts = last?.vencimento?.includes('/') ? last.vencimento.split('/') : last?.vencimento?.split('-');
        const lastYear = last?.vencimento?.includes('/') ? parts?.[2] : parts?.[0];
        if (lastYear && Number(lastYear) < MIN_YEAR) break;
        if (page.length < limit) break;
      }

      const since = acc.filter((tx) => {
        const parts = tx.vencimento.includes('/') ? tx.vencimento.split('/') : tx.vencimento.split('-');
        const year = tx.vencimento.includes('/') ? parts[2] : parts[0];
        const y = Number(year);
        return !Number.isFinite(y) || y >= MIN_YEAR;
      });

      const sorted = since.sort((a, b) => dateSortKey(b.vencimento) - dateSortKey(a.vencimento));
      receitasBaseCache = sorted;
      setReceitasBase(sorted);
    } catch (e) {
      console.error(e);
      setReceitasBase(
        transactions.slice().sort((a, b) => dateSortKey(b.vencimento) - dateSortKey(a.vencimento))
      );
    } finally {
      setIsLoadingReceitas(false);
    }
  }, [transactions]);

  React.useEffect(() => {
    loadReceitasBase(false);
  }, [loadReceitasBase]);

  const revenueTransactions = React.useMemo(
    () => receitasBase.filter(tx => isRevenueTransaction(tx)),
    [receitasBase]
  );

  const years = React.useMemo(() => {
    const y = revenueTransactions.map(tx => {
      const dateParts = tx.vencimento.includes('-') ? tx.vencimento.split('-') : tx.vencimento.split('/');
      return tx.vencimento.includes('-') ? dateParts[0] : dateParts[2];
    });
    return [...new Set(y)].filter(Boolean).sort().reverse();
  }, [revenueTransactions]);

  const [selectedYear, setSelectedYear] = React.useState<string>('TODOS');

  const [selectedMonth, setSelectedMonth] = React.useState<string>('TODOS');
  const [selectedCompany, setSelectedCompany] = React.useState<string>('TODOS');

  const companies = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const tx of revenueTransactions) {
      const companyKey = normalizeCompanyKey(tx.empresa);
      if (!map.has(companyKey)) map.set(companyKey, companyKey);
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [revenueTransactions]);

  const filteredData = React.useMemo(() => {
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

  const monthlyData = React.useMemo(() => {
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

  const companyData = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of filteredData) {
      const companyKey = normalizeCompanyKey(tx.empresa);
      map.set(companyKey, (map.get(companyKey) || 0) + tx.valor);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const totalReceitas = React.useMemo(
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
        <button
          onClick={() => loadReceitasBase(true)}
          disabled={isLoadingReceitas}
          className="border border-white/10 hover:bg-white/5 text-on-surface px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap disabled:opacity-50"
          title="Recarregar dados do banco"
        >
          Recarregar
        </button>
        {isLoadingReceitas && (
          <div className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">
            Carregando histórico…
          </div>
        )}
        <div className="text-right">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase">Receitas no Período</p>
          <p className="text-xl font-bold text-success">
            {totalReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                formatter={(value: number) => [value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }), 'Receita']}
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
                formatter={(value: number) => [value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }), 'Receita']}
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

        <div className="overflow-x-auto custom-scrollbar pb-2">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-white/5">
                <th className="px-8 py-4 whitespace-nowrap">Fornecedor</th>
                <th className="px-8 py-4 whitespace-nowrap">Descrição</th>
                <th className="px-8 py-4 whitespace-nowrap">Empresa</th>
                <th className="px-8 py-4 whitespace-nowrap">Vencimento</th>
                <th className="px-8 py-4 whitespace-nowrap">Pagamento</th>
                <th className="px-8 py-4 whitespace-nowrap">Valor</th>
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
                      {tx.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

export default React.memo(ReceitasTab);
