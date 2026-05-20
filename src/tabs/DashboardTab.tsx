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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {periodos.map((p) => (
          <button
            key={p}
            onClick={() => setPeriodoFilter(p)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
              periodoFilter === p
                ? "bg-primary text-background border-primary"
                : "bg-surface-variant/40 text-on-surface-variant border-surface-variant hover:border-primary/40 hover:text-on-surface"
            )}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'VALOR TOTAL', value: filteredStats.total, format: 'currency' as const, color: '#3b82f6' },
          { label: 'REGISTROS', value: registrosTotal, format: 'number' as const, color: '#3b82f6', desc: 'Volume operacional' },
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Pagos', value: filteredStats.pagos, percent: pagosPercent, color: 'success', icon: <CheckCircle size={20} className="text-success" />, delay: 0.2 },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #ffffff15', borderRadius: '12px' }}
                itemStyle={{ color: '#dee2f7', fontSize: '12px' }}
                formatter={(v: number) => [v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }), '']}
              />
              <Bar dataKey="receitas" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="despesas" fill="#ef4444" radius={[3, 3, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }} className="glass-card p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h4 className="text-lg font-bold font-headline">Top Fornecedores</h4>
              <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest mt-1">Por volume financeiro</p>
            </div>
            <Building2 size={20} className="text-primary/40" />
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

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-lg font-bold font-headline text-success">Últimas Receitas</h4>
              <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest mt-1">Entradas recentes</p>
            </div>
            <TrendingUp size={20} className="text-success/40" />
          </div>
          <div className="space-y-3">
            {filteredTx.filter(tx => isRevenueTransaction(tx)).slice(0, 5).map((tx, idx) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + idx * 0.05 }}
                className="flex flex-col p-3 bg-success/5 rounded-xl border border-success/10 hover:bg-success/10 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface truncate pr-2">{tx.fornecedor}</span>
                  <span className="text-xs font-black text-success whitespace-nowrap">{formatBRL(tx.valor)}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/50">{tx.vencimento}</span>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <span className="text-[9px] font-bold text-success/60 uppercase">{tx.empresa}</span>
                  </div>
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-success/20 text-success uppercase tracking-tighter">{tx.status}</span>
                </div>
              </motion.div>
            ))}
            {filteredTx.filter(tx => isRevenueTransaction(tx)).length === 0 && (
              <div className="py-10 text-center opacity-30">
                <p className="text-xs font-medium text-on-surface-variant">Nenhuma receita recente</p>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-lg font-bold font-headline text-primary">Últimas Despesas</h4>
              <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest mt-1">Saídas recentes</p>
            </div>
            <TrendingDown size={20} className="text-primary/40" />
          </div>
          <div className="space-y-3">
            {filteredTx.filter(tx => !isRevenueTransaction(tx)).slice(0, 5).map((tx, idx) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0 + idx * 0.05 }}
                className="flex flex-col p-3 bg-primary/5 rounded-xl border border-primary/10 hover:bg-primary/10 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface truncate pr-2">{tx.fornecedor}</span>
                  <span className="text-xs font-black text-primary whitespace-nowrap">{formatBRL(tx.valor)}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/50">{tx.vencimento}</span>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <span className="text-[9px] font-bold text-primary/60 uppercase">{tx.empresa}</span>
                  </div>
                  <span className={cn("text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter",
                    tx.status === 'PAGO' && "bg-primary/20 text-primary",
                    tx.status === 'PENDENTE' && "bg-secondary/20 text-secondary",
                    tx.status === 'VENCIDO' && "bg-tertiary/20 text-tertiary"
                  )}>{tx.status}</span>
                </div>
              </motion.div>
            ))}
            {filteredTx.filter(tx => !isRevenueTransaction(tx)).length === 0 && (
              <div className="py-10 text-center opacity-30">
                <p className="text-xs font-medium text-on-surface-variant">Nenhuma despesa recente</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
});

DashboardTab.displayName = 'DashboardTab';
export default DashboardTab;
