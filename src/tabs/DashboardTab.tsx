import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import {
  TrendingUp, TrendingDown, CheckCircle, Calendar, PieChart as PieChartIcon,
  Building2,
} from 'lucide-react';
import type { Transaction } from '../types';
import { useAppData } from '../hooks/useAppData';
import {
  cn, formatBRL, isRevenueTransaction,
} from '../lib/utils';
import { AnimatedNumber } from '../components/AnimatedNumber';

interface DashboardTabProps {
  transactions: Transaction[];
  onMarkAsPaid: (tx: Transaction) => void;
  globalStats: any;
  fetchStats: (year?: string, period?: string) => Promise<void>;
}

const DashboardTab = React.memo(({ transactions, onMarkAsPaid, globalStats, fetchStats }: DashboardTabProps) => {
  const { isAuthorized } = useAppData();
  const [periodoFilter, setPeriodoFilter] = useState('TODOS');
  const [isFetching, setIsFetching] = useState(false);

  const realKpis = globalStats?.kpis;
  const realMonthlyFlux = globalStats?.monthlyFlux;
  const realTopSuppliers = globalStats?.topSuppliers;
  const statsYears = Array.isArray(globalStats?.years) ? globalStats.years : null;

  useEffect(() => {
    const updateStats = async () => {
      setIsFetching(true);
      if (periodoFilter === 'TODOS') {
        await fetchStats();
      } else {
        await fetchStats(periodoFilter, 'year');
      }
      setIsFetching(false);
    };
    updateStats();
  }, [periodoFilter, fetchStats]);

  const anos = useMemo(() => {
    if (statsYears && statsYears.length) {
      return statsYears
        .map((y: any) => Number(y))
        .filter((y: any) => Number.isFinite(y) && y >= 1990 && y <= 2100)
        .sort((a: number, b: number) => a - b);
    }
    const set = new Set<number>();
    transactions.forEach((tx) => {
      const parts = String(tx.vencimento || '').split('/');
      if (parts.length === 3) {
        const y = Number(parts[2]);
        if (Number.isFinite(y) && y >= 1990 && y <= 2100) set.add(y);
      }
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [transactions, statsYears]);

  const periodos = useMemo(() => {
    const list = ['TODOS'];
    if (anos.includes(2024) && anos.includes(2025)) list.push('2024-2025');
    if (anos.includes(2024) && anos.includes(2025) && anos.includes(2026)) list.push('2024-2026');
    anos.forEach((y) => list.push(String(y)));
    return list;
  }, [anos]);

  const filteredTx = useMemo(() => {
    return transactions.filter((tx) => {
      if (periodoFilter === 'TODOS') return true;
      const parts = String(tx.vencimento || '').split('/');
      if (parts.length !== 3) return false;
      const y = Number(parts[2]);
      if (!Number.isFinite(y)) return false;
      if (periodoFilter === '2024-2025') return y === 2024 || y === 2025;
      if (periodoFilter === '2024-2026') return y === 2024 || y === 2025 || y === 2026;
      return String(y) === periodoFilter;
    });
  }, [transactions, periodoFilter]);

  const statusChartData = [
    { name: 'Pagos', value: realKpis?.count_pagos || 0, color: '#10b981' },
    { name: 'Pendentes', value: realKpis?.count_pendentes || 0, color: '#f59e0b' },
    { name: 'Vencidos', value: realKpis?.count_vencidos || 0, color: '#ef4444' },
  ];

  const monthlyFlux = useMemo(() => {
    if (realMonthlyFlux) {
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return months.map((month, idx) => {
        const stat = realMonthlyFlux.find(s => Number(s.month_num) === idx + 1);
        return {
          name: month,
          receitas: stat ? Number(stat.receitas) : 0,
          despesas: stat ? Number(stat.despesas) : 0,
          saldo: (stat ? Number(stat.receitas) : 0) - (stat ? Number(stat.despesas) : 0)
        };
      });
    }

    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentYear = new Date().getFullYear();
    const targetYear = periodoFilter === 'TODOS' ? String(currentYear) : periodoFilter;

    const monthlyAggregation = filteredTx.reduce((acc, tx) => {
      const parts = tx.vencimento.split('/');
      if (parts.length === 3 && parts[2] === targetYear) {
        const monthIdx = parseInt(parts[1]) - 1;
        if (monthIdx >= 0 && monthIdx < 12) {
          const valor = Number(tx.valor) || 0;
          if (tx.tipo === 'RECEITA') {
            acc[monthIdx].receitas += valor;
          } else if (tx.tipo === 'DESPESA') {
            acc[monthIdx].despesas += valor;
          }
        }
      }
      return acc;
    }, months.map((name) => ({ name, receitas: 0, despesas: 0, saldo: 0 })));

    monthlyAggregation.forEach(m => {
      m.saldo = m.receitas - m.despesas;
    });

    return monthlyAggregation;
  }, [filteredTx, realMonthlyFlux, periodoFilter]);

  const topSuppliers = useMemo(() => {
    if (realTopSuppliers) {
      return realTopSuppliers.slice(0, 5);
    }

    const supplierMap = new Map<string, number>();
    filteredTx.forEach(tx => {
      const current = supplierMap.get(tx.fornecedor) || 0;
      supplierMap.set(tx.fornecedor, current + (Number(tx.valor) || 0));
    });
    return Array.from(supplierMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  }, [filteredTx, realTopSuppliers]);

  const filteredStats = useMemo(() => {
    if (realKpis) {
      const receitas = Number(realKpis.total_receitas) || 0;
      const despesas = Number(realKpis.total_despesas) || 0;
      const geral = Number(realKpis.total_geral);
      const totalCalc = Number.isFinite(geral) && geral > 0 ? geral : receitas + despesas;
      return {
        total: Number.isFinite(totalCalc) ? totalCalc : 0,
        total_financeiro: receitas - despesas,
        receitas: Number(realKpis.total_receitas) || 0,
        despesas: Number(realKpis.total_despesas) || 0,
        pagos: Number(realKpis.count_pagos) || 0,
        pendentes: Number(realKpis.count_pendentes) || 0,
        vencidos: Number(realKpis.count_vencidos) || 0
      };
    }

    let total = 0, pagos = 0, pendentes = 0, vencidos = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (const tx of filteredTx) {
      if (tx.tipo === 'TRANSFERENCIA') continue;
      const baseValor = Number(tx.valor) || 0;
      const juros = Number((tx as any).juros) || 0;
      total += baseValor + juros;
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
    return { total, pagos, pendentes, vencidos, total_financeiro: total };
  }, [filteredTx, realKpis]);

  const registrosTotal = realKpis?.total_count ? Number(realKpis.total_count) : filteredTx.length;
  const totalTx = (periodoFilter === 'TODOS' && realKpis?.total_count) ? Number(realKpis.total_count) : (filteredTx.length || 1);
  const pagosPercent = Math.round((filteredStats.pagos / totalTx) * 100);
  const pendentesPercent = Math.round((filteredStats.pendentes / totalTx) * 100);
  const vencidosPercent = Math.round((filteredStats.vencidos / totalTx) * 100);

  const healthScore = pagosPercent;
  const healthColor = healthScore >= 80 ? '#10b981' : healthScore >= 60 ? '#f59e0b' : '#ef4444';
  const healthLabel = healthScore >= 80 ? 'Saudável' : healthScore >= 60 ? 'Atenção' : 'Crítico';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header and Period Filter */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Visão Geral</h1>
          <p className="text-zinc-500 text-sm">Acompanhe a saúde financeira do Grupo CN.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {periodos.map((p) => (
            <button
              key={p}
              onClick={() => setPeriodoFilter(p)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                periodoFilter === p
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-zinc-600 border-zinc-200 hover:border-blue-400 hover:text-zinc-900"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'VALOR TOTAL', value: filteredStats.total, format: 'currency' as const, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'REGISTROS', value: registrosTotal, format: 'number' as const, color: 'text-zinc-700', bg: 'bg-zinc-100', border: 'border-zinc-200' },
          { label: 'PENDENTES', value: filteredStats.pendentes, format: 'number' as const, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          { label: 'PAGOS', value: filteredStats.pagos, format: 'number' as const, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'VENCIDOS', value: filteredStats.vencidos, format: 'number' as const, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
          { label: 'SAÚDE', value: healthScore, format: 'number' as const, color: healthColor === '#10b981' ? 'text-emerald-600' : healthColor === '#f59e0b' ? 'text-amber-600' : 'text-rose-600', bg: 'bg-zinc-50', border: 'border-zinc-200', suffix: '%' },
        ].map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className={`bg-white border ${kpi.border} p-5 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden`}
          >
            <p className="text-[10px] font-bold uppercase text-zinc-500 mb-2">{kpi.label}</p>
            <h3 className={`text-xl lg:text-2xl font-bold ${kpi.color} tracking-tight leading-none`}>
              <AnimatedNumber value={kpi.value} format={kpi.format} duration={900} />
              {kpi.suffix}
            </h3>
          </motion.div>
        ))}
      </div>

      {/* CHARTS AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-base font-semibold text-zinc-900">Receitas vs Despesas</h4>
              <p className="text-xs text-zinc-500 mt-1">Fluxo mensal {new Date().getFullYear()}</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Receitas</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> Despesas</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyFlux} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
              <XAxis dataKey="name" stroke="#71717a" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={10} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ color: '#18181b', fontSize: '12px', fontWeight: 500 }}
                formatter={(v: number) => [v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }), '']}
              />
              <Bar dataKey="receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} opacity={0.9} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex flex-col">
          <div className="mb-2">
            <h4 className="text-base font-semibold text-zinc-900">Status dos Lançamentos</h4>
            <p className="text-xs text-zinc-500 mt-1">Distribuição atual no período</p>
          </div>
          <div className="flex-1 flex items-center justify-center relative min-h-[260px]">
            {filteredTx.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-zinc-400">
                <PieChartIcon size={48} strokeWidth={1} /><p className="text-xs mt-4">Sem dados</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={70} outerRadius={95} paddingAngle={4} dataKey="value" cornerRadius={6}>
                      {statusChartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#18181b', fontWeight: 500 }}
                      formatter={(v: number) => [`${v} lançamentos`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-4xl font-bold tracking-tight" style={{ color: healthColor === '#10b981' ? '#10b981' : healthColor === '#f59e0b' ? '#f59e0b' : '#ef4444' }}>{pagosPercent}%</span>
                  <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{healthLabel}</span>
                </div>
              </>
            )}
          </div>
          <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-zinc-100">
            {statusChartData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs font-medium text-zinc-600">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* TOP FORNECEDORES E LISTAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }} className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h4 className="text-base font-semibold text-zinc-900">Top Fornecedores</h4>
              <p className="text-xs text-zinc-500 mt-1">Por volume financeiro</p>
            </div>
            <Building2 size={18} className="text-zinc-400" />
          </div>
          {topSuppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-zinc-400">
              <Building2 size={32} className="mb-3 opacity-50" /><p className="text-xs">Nenhum fornecedor</p>
            </div>
          ) : (
            <div className="space-y-5">
              {topSuppliers.map((supplier, idx) => {
                const maxValue = topSuppliers[0]?.value || 1;
                const percent = Math.round((supplier.value / maxValue) * 100);
                return (
                  <div key={idx} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-600">{idx + 1}</span>
                        <span className="text-sm font-medium text-zinc-900 truncate max-w-[140px]">{supplier.name}</span>
                      </div>
                      <span className="text-xs font-bold text-zinc-900">{formatBRL(supplier.value)}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ delay: 0.8 + idx * 0.1, duration: 0.6 }}
                        className="h-full bg-blue-500 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-zinc-200 flex justify-between items-center bg-white">
            <h3 className="font-semibold text-zinc-900">Últimos Lançamentos</h3>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-200">
                <tr>
                  <th className="px-5 py-3 font-medium">Fornecedor / Descrição</th>
                  <th className="px-5 py-3 font-medium">Vencimento</th>
                  <th className="px-5 py-3 font-medium text-right">Valor</th>
                  <th className="px-5 py-3 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredTx.slice(0, 6).map((tx) => {
                  let badgeStyle = 'bg-zinc-100 text-zinc-700 border-zinc-200';
                  if (tx.status === 'PAGO') badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  else if (tx.status === 'PENDENTE') badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
                  else if (tx.status === 'VENCIDO') badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200';

                  return (
                    <tr key={tx.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-zinc-900 truncate max-w-[200px]">{tx.fornecedor}</p>
                        <p className="text-xs text-zinc-500 truncate max-w-[200px]">{tx.descricao}</p>
                      </td>
                      <td className="px-5 py-3 text-zinc-600 whitespace-nowrap">{tx.vencimento}</td>
                      <td className={`px-5 py-3 text-right font-medium whitespace-nowrap ${tx.tipo === 'RECEITA' ? 'text-emerald-600' : 'text-zinc-900'}`}>
                        {formatBRL(tx.valor)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeStyle}`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredTx.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-zinc-500">
                      Nenhum lançamento encontrado neste período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
});

DashboardTab.displayName = 'DashboardTab';
export default DashboardTab;
