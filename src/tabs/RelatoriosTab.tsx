import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionStatus, ContaContabil } from '../types';
import { cn, isRevenueTransaction, normalizeCompanyKey, dateSortKey, formatBRL } from '../lib/utils';
import { api } from '../api';
import { Printer, Search } from 'lucide-react';

interface RelatoriosTabProps {
  transactions: Transaction[];
  fetchTransactions: (
    append?: boolean,
    year?: string,
    month?: string,
    search?: string,
    tipo?: string,
    options?: { limit?: number; empresa?: string; status?: string; conta_contabil_id?: number; startDate?: string; endDate?: string }
  ) => void;
  globalStats: any;
  fetchStats: (
    year?: string,
    period?: string,
    empresa?: string,
    tipo?: string,
    status?: string,
    search?: string,
    startDate?: string,
    endDate?: string
  ) => Promise<void>;
  contasContabeis: ContaContabil[];
}

const RelatoriosTab = ({ globalStats, fetchStats, contasContabeis }: Omit<RelatoriosTabProps, 'transactions' | 'fetchTransactions'>) => {
  const [reportTransactions, setReportTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const years = useMemo(() => {
    const y = reportTransactions.map(tx => {
      const dateParts = tx.vencimento.includes('-') ? tx.vencimento.split('-') : tx.vencimento.split('/');
      return tx.vencimento.includes('-') ? dateParts[0] : dateParts[2];
    });
    const set = new Set<string>(y.filter(Boolean));
    const currentYear = new Date().getFullYear();
    for (let yr = currentYear; yr >= 2020; yr -= 1) set.add(String(yr));
    return Array.from(set).sort().reverse();
  }, [reportTransactions]);

  const [selectedYear, setSelectedYear] = useState<string>('TODOS');

  const [selectedMonth, setSelectedMonth] = useState<string>('TODOS');
  const [selectedCompany, setSelectedCompany] = useState<string>('TODOS');
  const [selectedTipo, setSelectedTipo] = useState<string>('TODOS');
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');
  const [selectedContaContabil, setSelectedContaContabil] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [filterType, setFilterType] = useState<'MES' | 'PERIODO'>('MES');
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });

  const todayKey = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return new Date(`${yyyy}-${mm}-${dd}`).getTime();
  }, []);

  const effectiveStatus = (tx: Transaction): TransactionStatus => {
    if (tx.pagamento) return 'PAGO';
    if (tx.status === 'VENCIDO') return 'VENCIDO';
    const dueKey = dateSortKey(tx.vencimento);
    if (dueKey && dueKey < todayKey) return 'VENCIDO';
    return 'PENDENTE';
  };

  useEffect(() => {
    const contaId = selectedContaContabil === 'TODOS' ? undefined : Number(selectedContaContabil);
    const apiStatus =
      selectedStatus === 'TODOS'
        ? undefined
        : selectedStatus === 'PENDENTE'
          ? 'NAO_PAGO'
          : selectedStatus;
          
    const queryYear = filterType === 'MES' ? selectedYear : undefined;
    const queryMonth = filterType === 'MES' ? selectedMonth : undefined;
    const queryStartDate = filterType === 'PERIODO' ? (startDate || undefined) : undefined;
    const queryEndDate = filterType === 'PERIODO' ? (endDate || undefined) : undefined;

    const loadData = async () => {
      setLoading(true);
      try {
        const data = await api.getTransactions(
          5000,
          0,
          queryYear,
          queryMonth,
          undefined,
          selectedTipo === 'TODOS' ? undefined : selectedTipo,
          selectedCompany === 'TODOS' ? undefined : selectedCompany,
          apiStatus,
          Number.isFinite(contaId as any) ? (contaId as number) : undefined,
          queryStartDate,
          queryEndDate
        );
        setReportTransactions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Erro ao carregar transações do relatório:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    fetchStats(
      queryYear,
      queryMonth,
      selectedCompany === 'TODOS' ? undefined : selectedCompany,
      selectedTipo === 'TODOS' ? undefined : selectedTipo,
      apiStatus,
      undefined,
      queryStartDate,
      queryEndDate
    );
  }, [
    filterType,
    startDate,
    endDate,
    selectedYear,
    selectedMonth,
    selectedCompany,
    selectedTipo,
    selectedStatus,
    selectedContaContabil,
    fetchStats
  ]);

  const companies = useMemo(() => {
    const map = new Map<string, string>();
    for (const tx of reportTransactions) {
      const raw = String(tx.empresa || '').trim();
      if (!raw) continue;
      const companyKey = normalizeCompanyKey(raw);
      if (!map.has(companyKey)) map.set(companyKey, raw);
    }
    return Array.from(map.entries())
      .map(([, raw]) => ({ value: raw, label: raw }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [reportTransactions]);

  const filteredData = useMemo(() => {
    const removeAccents = (str: string) => 
      str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const searchNormalized = removeAccents(searchTerm);
    const filtered = reportTransactions.filter(tx => {
      let matchesDateRange = true;
      if (filterType === 'PERIODO') {
        let txDateStr = '';
        if (tx.vencimento) {
          const parts = tx.vencimento.includes('/') ? tx.vencimento.split('/') : tx.vencimento.split('-');
          if (tx.vencimento.includes('/')) {
            // DD/MM/YYYY
            txDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          } else {
            // YYYY-MM-DD
            txDateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          }
        }
        if (startDate && txDateStr < startDate) matchesDateRange = false;
        if (endDate && txDateStr > endDate) matchesDateRange = false;
      } else {
        const parts = tx.vencimento.includes('/') ? tx.vencimento.split('/') : tx.vencimento.split('-');
        const year = tx.vencimento.includes('/') ? parts[2] : parts[0];
        const month = tx.vencimento.includes('/') ? parts[1] : parts[1];
        const matchesYear = selectedYear === 'TODOS' || year === selectedYear;
        const matchesMonth = selectedMonth === 'TODOS' || month === selectedMonth;
        matchesDateRange = matchesYear && matchesMonth;
      }

      const matchesCompany = selectedCompany === 'TODOS' || normalizeCompanyKey(tx.empresa) === normalizeCompanyKey(selectedCompany);
      const txTipo = tx.tipo || (isRevenueTransaction(tx) ? 'RECEITA' : 'DESPESA');
      const matchesTipo = selectedTipo === 'TODOS' || txTipo === selectedTipo;
      const currentStatus = effectiveStatus(tx);
      const matchesStatus = selectedStatus === 'TODOS' 
        || (selectedStatus === 'NAO_PAGO' ? (currentStatus === 'PENDENTE' || currentStatus === 'VENCIDO') : selectedStatus === 'PENDENTE' ? (currentStatus === 'PENDENTE' || currentStatus === 'VENCIDO') : currentStatus === selectedStatus);
      const contaId = selectedContaContabil === 'TODOS' ? null : Number(selectedContaContabil);
      const matchesConta = selectedContaContabil === 'TODOS' || (Number.isFinite(contaId as any) && Number(tx.conta_contabil_id) === contaId);
      
      const matchesSearch = !searchNormalized || 
        (tx.fornecedor && removeAccents(tx.fornecedor).includes(searchNormalized)) ||
        (tx.descricao && removeAccents(tx.descricao).includes(searchNormalized));

      return matchesDateRange && matchesCompany && matchesTipo && matchesStatus && matchesConta && matchesSearch;
    });

    return filtered.sort((a, b) => {
      const keyA = dateSortKey(a.vencimento);
      const keyB = dateSortKey(b.vencimento);
      if (keyA !== keyB) {
        return keyA - keyB;
      }
      const fornA = String(a.fornecedor || '').toLowerCase();
      const fornB = String(b.fornecedor || '').toLowerCase();
      return fornA.localeCompare(fornB, 'pt-BR');
    });
  }, [reportTransactions, filterType, startDate, endDate, selectedYear, selectedMonth, selectedCompany, selectedTipo, selectedStatus, selectedContaContabil, todayKey, searchTerm]);

  const periodTotals = useMemo(() => {
    let total = 0;
    let totalReceitas = 0;
    let totalDespesas = 0;
    let jurosTotal = 0;

    let realizadoTotal = 0;
    let realizadoReceitas = 0;
    let realizadoDespesas = 0;

    let naoPagoCount = 0;
    let naoPagoReceitas = 0;
    let naoPagoDespesas = 0;
    let naoPagoReceitasCount = 0;
    let naoPagoDespesasCount = 0;

    for (const tx of filteredData) {
      const isRev = tx.tipo === 'RECEITA' || (tx.tipo !== 'DESPESA' && isRevenueTransaction(tx));
      const valorTotal = Number(tx.valor) + Number(tx.juros || 0);
      const isPago = effectiveStatus(tx) === 'PAGO';
      
      if (isRev) {
        totalReceitas += valorTotal;
        total += valorTotal;
        if (isPago) {
          realizadoReceitas += valorTotal;
          realizadoTotal += valorTotal;
        } else {
          naoPagoCount += 1;
          naoPagoReceitasCount += 1;
          naoPagoReceitas += valorTotal;
        }
      } else {
        totalDespesas += valorTotal;
        total -= valorTotal;
        if (isPago) {
          realizadoDespesas += valorTotal;
          realizadoTotal -= valorTotal;
        } else {
          naoPagoCount += 1;
          naoPagoDespesasCount += 1;
          naoPagoDespesas += valorTotal;
        }
      }
      jurosTotal += Number(tx.juros || 0);
    }
    return { 
      total, totalReceitas, totalDespesas, jurosTotal, 
      realizadoTotal, realizadoReceitas, realizadoDespesas,
      naoPagoCount,
      naoPagoReceitas, naoPagoDespesas,
      naoPagoReceitasCount, naoPagoDespesasCount,
      naoPagoSaldo: naoPagoReceitas - naoPagoDespesas,
      count: filteredData.length 
    };
  }, [filteredData, globalStats, selectedYear, selectedMonth, selectedCompany, selectedTipo, selectedStatus, selectedContaContabil]);

  const monthLabel = useMemo(() => {
    const months: Record<string, string> = { '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril', '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto', '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro' };
    return selectedMonth === 'TODOS' ? 'Todos os Meses' : months[selectedMonth] || selectedMonth;
  }, [selectedMonth]);

  const handlePrint = () => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('O navegador bloqueou a abertura do relatório. Por favor, permita pop-ups para este site e tente novamente.');
        return;
      }

      const tipoLabel = selectedTipo === 'TODOS' ? 'Fluxo de Caixa' : selectedTipo === 'RECEITA' ? 'Relatório de Receitas' : 'Relatório de Despesas';
      const statusLabel = selectedStatus === 'TODOS'
        ? 'Todos'
        : selectedStatus === 'NAO_PAGO'
          ? 'Não Pagos'
          : selectedStatus === 'PENDENTE'
            ? 'Em Aberto'
          : selectedStatus;
      const now = new Date().toLocaleString('pt-BR', { 
        day: '2-digit', month: 'long', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      });

      const formatDateForDisplay = (dateStr: string) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return dateStr;
      };

      const periodDisplay = filterType === 'PERIODO' 
        ? `${formatDateForDisplay(startDate)} a ${formatDateForDisplay(endDate)}` 
        : `${monthLabel} de ${selectedYear}`;

      const pendentesCount = filteredData.filter(tx => effectiveStatus(tx) === 'PENDENTE').length;
      const vencidosCount = filteredData.filter(tx => effectiveStatus(tx) === 'VENCIDO').length;
      const pendentesValor = filteredData.filter(tx => {
        const s = effectiveStatus(tx);
        return s === 'PENDENTE' || s === 'VENCIDO';
      }).reduce((acc, tx) => acc + (Number(tx.valor) || 0) + (Number(tx.juros || 0)), 0);
      const hasNaoPagos = pendentesCount + vencidosCount > 0;

      const rows = filteredData.map((tx, i) => {
        const isRev = tx.tipo === 'RECEITA' || (tx.tipo !== 'DESPESA' && isRevenueTransaction(tx));
        const valorTotal = (Number(tx.valor) || 0) + (Number(tx.juros || 0));
        const status = effectiveStatus(tx);
        const isNaoPago = status !== 'PAGO';
        
        let statusColor = '#666';
        let rowBg = 'transparent';
        let statusWeight = 'normal';

        if (status === 'PAGO') {
          statusColor = '#10b981';
        } else if (status === 'VENCIDO') {
          statusColor = '#ef4444';
          rowBg = '#fff5f5';
          statusWeight = 'bold';
        } else if (status === 'PENDENTE') {
          statusColor = '#f59e0b';
          rowBg = '#fffbeb';
          statusWeight = 'bold';
        }

        const tipoColor = isRev ? '#10b981' : '#ef4444';
        const tipoText = isRev ? 'RECEITA' : 'DESPESA';
        const valorColor = isNaoPago ? '#f59e0b' : '#0f172a';
        const jurosColor = isNaoPago ? '#f59e0b' : '#ef4444';
        const totalColor = isNaoPago ? '#f59e0b' : tipoColor;

        return `<tr style="background-color: ${rowBg}">
          <td style="padding:8px;border:1px solid #ddd;text-align:center;font-size:9pt">${i + 1}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center;font-weight:bold;color:${tipoColor};font-size:9pt">${tipoText}</td>
          <td style="padding:8px;border:1px solid #ddd;font-size:10pt"><b>${tx.fornecedor || 'NÃO INFORMADO'}</b></td>
          <td style="padding:8px;border:1px solid #ddd;font-size:9pt">${tx.descricao || '-'}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center;font-size:9pt">${tx.empresa || '-'}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center;font-size:9pt">${tx.vencimento || '-'}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center;font-size:9pt">${tx.pagamento || '-'}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;font-size:10pt;color:${valorColor};font-weight:${isNaoPago ? 'bold' : 'normal'}">${(Number(tx.valor) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;font-size:9pt;color:${jurosColor};font-weight:${isNaoPago ? 'bold' : 'normal'}">${Number(tx.juros || 0) > 0 ? Number(tx.juros).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;font-weight:bold;color:${totalColor};font-size:10pt">${(isRev ? '' : '-')}${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center;font-weight:${statusWeight};color:${statusColor};font-size:9pt">${status}</td>
        </tr>`;
      }).join('');

  printWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${tipoLabel} - ${periodDisplay}</title>
  <style>
    @page { margin: 1.2cm; size: A4 landscape; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11pt; color: #333; line-height: 1.4; margin: 0; padding: 0; }
    .header { border-bottom: 3px solid #3b82f6; padding-bottom: 12px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
    .header-info h1 { margin: 0; font-size: 20pt; color: #1e293b; text-transform: uppercase; font-weight: 800; }
    .header-info p { margin: 5px 0 0; font-size: 10pt; color: #64748b; font-weight: 600; }
    .summary-boxes { display: flex; gap: 15px; margin-bottom: 25px; }
    .summary-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 15px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .summary-box .label { font-size: 8pt; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; }
    .summary-box .value { font-size: 15pt; font-weight: 800; color: #1e293b; }
    .summary-box.highlight { border-color: #f59e0b; background-color: #fffbeb; }
    .summary-box.critical { border-color: #ef4444; background-color: #fff5f5; }
    .summary-box.success { border-color: #10b981; background-color: #ecfdf5; }
    
    table { width: 100%; border-collapse: collapse; margin-top: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    th { background: #f8fafc; padding: 12px 8px; border: 1px solid #e2e8f0; text-align: left; font-weight: 800; text-transform: uppercase; font-size: 8pt; color: #475569; }
    .total-row td { font-weight: 800; background: #f1f5f9 !important; border-top: 2px solid #334155; }
    .footer { margin-top: 50px; font-size: 8pt; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-info">
      <h1>${tipoLabel}</h1>
          <p>${selectedCompany === 'TODOS' ? 'Grupo CN - Todas as Empresas' : 'Empresa: ' + selectedCompany} | Período: ${periodDisplay} | Status: ${statusLabel}</p>
    </div>
    <div style="text-align: right; font-size: 9pt; color: #64748b; font-weight: 600;">
      Gerado em: ${now}
    </div>
  </div>

  <div class="summary-boxes">
    <div class="summary-box">
      <div class="label">Total Movimentado</div>
      <div class="value">${periodTotals.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
    </div>
    <div class="summary-box success">
      <div class="label">Receitas</div>
      <div class="value">${periodTotals.totalReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
    </div>
    <div class="summary-box critical">
      <div class="label">Despesas</div>
      <div class="value">${periodTotals.totalDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
    </div>
    <div class="summary-box highlight">
      <div class="label">Em Aberto (Total)</div>
      <div class="value">${pendentesValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
      <div style="font-size: 8pt; color: #b45309; margin-top: 4px; font-weight: 800;">${vencidosCount + pendentesCount} ITENS EM ABERTO</div>
      <div style="height: 8px;"></div>
      <div class="label">A Pagar</div>
      <div class="value">${periodTotals.naoPagoDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
      <div style="font-size: 8pt; color: #b45309; margin-top: 4px; font-weight: 800;">${periodTotals.naoPagoDespesasCount} DESPESAS PENDENTES</div>
      <div style="height: 8px;"></div>
      <div class="label">A Receber</div>
      <div class="value">${periodTotals.naoPagoReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
      <div style="font-size: 8pt; color: #1d4ed8; margin-top: 4px; font-weight: 800;">${periodTotals.naoPagoReceitasCount} RECEITAS PENDENTES</div>
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th style="width:30px;text-align:center">#</th>
        <th style="width:70px;text-align:center">Tipo</th>
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
        <td colspan="7" style="padding:12px;text-align:right;text-transform:uppercase;letter-spacing:1px;font-size:9pt">Resumo de Saldos</td>
        <td style="padding:12px;text-align:right;color:#64748b;font-size:8pt">
          (+) ${periodTotals.totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}<br/>
          (-) ${periodTotals.totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </td>
        <td style="padding:12px;text-align:right;color:#ef4444">${periodTotals.jurosTotal > 0 ? periodTotals.jurosTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}</td>
        <td style="padding:12px;text-align:right;font-size:13pt;color:${periodTotals.total >= 0 ? '#10b981' : '#ef4444'}">
          ${periodTotals.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          <div style="font-size:8pt;color:#64748b;font-weight:700;">SALDO PREVISTO FINAL</div>
        </td>
        <td style="padding:12px;text-align:center;font-size:8pt;color:#64748b">${periodTotals.count} registros</td>
      </tr>
      ${periodTotals.naoPagoDespesas > 0 ? `
      <tr style="background-color: #fffbeb;">
        <td colspan="9" style="padding:12px;text-align:right;font-weight:800;color:#b45309;text-transform:uppercase;font-size:9pt">Total Pendente a Pagar (Em Aberto):</td>
        <td style="padding:12px;text-align:right;font-size:14pt;color:#f59e0b;font-weight:900;">
          - ${periodTotals.naoPagoDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </td>
        <td style="padding:12px;text-align:center;font-size:8pt;color:#b45309;font-weight:800;">${periodTotals.naoPagoDespesasCount} PENDÊNCIAS</td>
      </tr>` : ''}
    </tbody>
  </table>

  <div class="footer">
    <p>Documento gerado eletronicamente pelo sistema Cn-Intelligence em ${now}.</p>
  </div>
</body>
</html>`);
      printWindow.document.close();
      printWindow.focus();
      try { printWindow.print(); } catch {}
      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch {}
      }, 200);
    } catch (error) {
      console.error('Erro ao imprimir:', error);
      alert('Erro ao gerar o relatório. Verifique os dados e tente novamente.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="glass-card p-6 flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase">Filtro por</label>
          <select
            className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary text-on-surface"
            style={{ backgroundColor: '#1e1e2e' }}
            value={filterType}
            onChange={e => setFilterType(e.target.value as 'MES' | 'PERIODO')}
          >
            <option value="MES" className="bg-surface text-on-surface">Ano / Mês</option>
            <option value="PERIODO" className="bg-surface text-on-surface">Período Customizado</option>
          </select>
        </div>

        {filterType === 'MES' ? (
          <>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Ano</label>
              <select
                className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary text-on-surface"
                style={{ backgroundColor: '#1e1e2e' }}
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
                style={{ backgroundColor: '#1e1e2e' }}
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
          </>
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Data de Início</label>
              <input
                type="date"
                className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary text-on-surface"
                style={{ backgroundColor: '#1e1e2e' }}
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Data Final</label>
              <input
                type="date"
                className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary text-on-surface"
                style={{ backgroundColor: '#1e1e2e' }}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </>
        )}

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
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase">Status</label>
          <select
            className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary text-on-surface"
            style={{ backgroundColor: '#1e1e2e' }}
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
          >
            <option value="TODOS" className="bg-surface text-on-surface">Todos</option>
            <option value="PENDENTE" className="bg-surface text-on-surface">Em Aberto (Pendentes + Vencidos)</option>
            <option value="VENCIDO" className="bg-surface text-on-surface">Vencidos</option>
            <option value="PAGO" className="bg-surface text-on-surface">Pagos</option>
            <option value="NAO_PAGO" className="bg-surface text-on-surface">Não Pagos (Pendentes + Vencidos)</option>
          </select>
        </div>
        <div className="space-y-1 min-w-[240px]">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase">Conta Contábil</label>
          <select
            className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary text-on-surface"
            style={{ backgroundColor: '#1e1e2e' }}
            value={selectedContaContabil}
            onChange={e => setSelectedContaContabil(e.target.value)}
          >
            <option value="TODOS" className="bg-surface text-on-surface">Todas</option>
            {contasContabeis
              .filter((c) => c.ativo !== false)
              .sort((a, b) => String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR'))
              .map((c) => (
                <option key={c.id} value={String(c.id)} className="bg-surface text-on-surface">
                  {c.codigo} - {c.nome}
                </option>
              ))}
          </select>
        </div>
        <div className="flex-grow">
          <div className="bg-surface-variant/20 flex items-center px-4 py-2 rounded-lg border border-white/10 focus-within:border-primary transition-all">
            <Search size={16} className="text-on-surface-variant" />
            <input
              type="text"
              placeholder="Buscar fornecedor ou descrição..."
              className="bg-transparent border-none text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:ring-0 p-0 outline-none w-full ml-2"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={handlePrint}
          className="bg-primary text-background px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary-dark transition-all whitespace-nowrap"
        >
          <Printer size={16} /> Imprimir / PDF
        </button>
        <div className="flex gap-6 text-right">
          <div className="flex flex-col">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase">Saldo Realizado (Caixa)</p>
            <p className={cn("text-lg font-bold", periodTotals.realizadoTotal >= 0 ? "text-primary" : "text-tertiary")}>
              {periodTotals.realizadoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="flex flex-col">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase">Saldo Previsto (Final)</p>
            <p className={cn(
              "text-lg font-bold",
              periodTotals.naoPagoCount > 0 ? "text-secondary" : (periodTotals.total >= 0 ? "text-primary" : "text-tertiary")
            )}>
              {periodTotals.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[9px] text-on-surface-variant font-medium">{periodTotals.count} lançamentos</p>
          </div>
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
            filteredData.map((tx) => {
              const status = effectiveStatus(tx);
              const isNaoPago = status !== 'PAGO';
              return (
                <div key={tx.id} className="px-4 py-3 flex flex-col gap-1">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-semibold text-sm flex-1 leading-tight">{tx.fornecedor}</span>
                    <span className={cn(
                      "font-bold text-sm whitespace-nowrap",
                      isNaoPago && "text-secondary"
                    )}>
                      {(Number(tx.valor) + Number(tx.juros || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-on-surface-variant">
                    <span>{tx.descricao}</span>
                    <span>Empresa: {tx.empresa || '-'}</span>
                    <span>Venc: {tx.vencimento}</span>
                    <span className={cn(
                      "font-bold",
                      status === 'PAGO' && "text-primary",
                      status === 'PENDENTE' && "text-secondary",
                      status === 'VENCIDO' && "text-tertiary"
                    )}>{status}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop: table */}
        <div className="overflow-x-auto hidden md:block w-full custom-scrollbar pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full text-left border-collapse" style={{ minWidth: '1800px', tableLayout: 'fixed' }}>
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-white/5">
                <th className="px-3 py-4 whitespace-nowrap" style={{ width: '50px' }}>#</th>
                <th className="px-3 py-4 whitespace-nowrap" style={{ width: '90px' }}>Tipo</th>
                <th className="px-3 py-4" style={{ width: '250px' }}>Fornecedor</th>
                <th className="px-3 py-4" style={{ width: '350px' }}>Descrição</th>
                <th className="px-3 py-4" style={{ width: '130px' }}>Empresa</th>
                <th className="px-3 py-4" style={{ width: '120px' }}>Vencimento</th>
                <th className="px-3 py-4" style={{ width: '120px' }}>Pagamento</th>
                <th className="px-3 py-4 text-right whitespace-nowrap" style={{ width: '140px' }}>Valor</th>
                <th className="px-3 py-4 text-right whitespace-nowrap" style={{ width: '100px' }}>Juros</th>
                <th className="px-3 py-4 text-right whitespace-nowrap" style={{ width: '150px' }}>Total</th>
                <th className="px-3 py-4 whitespace-nowrap" style={{ width: '130px' }}>Status</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-white/5">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-on-surface-variant italic">
                    Nenhum lançamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredData.map((tx, i) => {
                  const isRev = tx.tipo === 'RECEITA' || (tx.tipo !== 'DESPESA' && isRevenueTransaction(tx));
                  const status = effectiveStatus(tx);
                  const isNaoPago = status !== 'PAGO';
                  return (
                    <tr key={tx.id} className={cn(
                      "hover:bg-white/5 transition-colors",
                      status === 'PENDENTE' && "bg-[#f59e0b]/5",
                      status === 'VENCIDO' && "bg-[#ef4444]/5"
                    )}>
                      <td className="px-3 py-4 text-on-surface-variant text-xs">{i + 1}</td>
                      <td className="px-3 py-4">
                        <span className={cn(
                          "text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest",
                          isRev ? "bg-success/20 text-success border-success/30" : "bg-primary/20 text-primary border-primary/30"
                        )}>
                          {isRev ? 'Receita' : 'Despesa'}
                        </span>
                      </td>
                      <td className={cn("px-3 py-4 font-semibold truncate max-w-[200px]", isNaoPago && "text-[#f59e0b]")} title={tx.fornecedor}>{tx.fornecedor}</td>
                      <td className="px-3 py-4 text-on-surface-variant truncate max-w-[250px]" title={tx.descricao}>{tx.descricao}</td>
                      <td className="px-3 py-4 whitespace-nowrap">{tx.empresa}</td>
                      <td className="px-3 py-4 whitespace-nowrap">{tx.vencimento}</td>
                      <td className="px-3 py-4 text-on-surface-variant whitespace-nowrap">{tx.pagamento || '-'}</td>
                      <td className={cn(
                        "px-3 py-4 text-right whitespace-nowrap",
                        isNaoPago ? "text-[#f59e0b] font-black" : "font-medium"
                      )}>
                        {Number(tx.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={cn(
                        "px-3 py-4 text-right text-xs whitespace-nowrap",
                        isNaoPago ? "text-[#f59e0b] font-black" : "text-tertiary"
                      )}>
                        {Number(tx.juros || 0) > 0 ? Number(tx.juros).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                    <td className={cn(
                      "px-3 py-4 text-right font-black text-sm whitespace-nowrap",
                      isNaoPago ? "text-[#f59e0b]" : (isRev ? "text-success" : "text-primary")
                    )}>
                        {(isRev ? '' : '-')}{(Number(tx.valor) + Number(tx.juros || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <span className={cn(
                          "text-[10px] font-black px-3 py-1 rounded-full border",
                          status === 'PAGO' && "bg-primary/20 text-primary border-primary/30",
                          status === 'PENDENTE' && "bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30",
                          status === 'VENCIDO' && "bg-tertiary/20 text-tertiary border-tertiary/30"
                        )}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Responsive Summary Card (No longer inside the scrolling table to prevent cut off!) */}
        {filteredData.length > 0 && (
          <div className="border-t border-white/5 bg-white/[0.01] p-4 md:p-6">
            <div className="flex flex-col lg:flex-row justify-between items-stretch gap-6">
              
              {/* Left Column: Title and Caixa/Pendente */}
              <div className="flex-grow flex flex-col justify-between gap-4">
                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-black">
                    Resumo Financeiro Detalhado
                  </span>
                </div>
                <div className="flex flex-wrap gap-6 md:gap-10">
                  <div>
                    <p className="text-[10px] uppercase text-on-surface-variant mb-1 font-bold">Saldo Atual em Caixa</p>
                    <p className={cn("text-xl md:text-2xl font-black", periodTotals.realizadoTotal >= 0 ? "text-primary" : "text-tertiary")}>
                      {periodTotals.realizadoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                  {periodTotals.naoPagoDespesas > 0 && (
                    <div className="border-l border-white/10 pl-6 md:pl-10">
                      <p className="text-[10px] uppercase text-on-surface-variant mb-1 font-bold">Total a Pagar (Pendências)</p>
                      <p className="text-xl md:text-2xl font-black text-[#f59e0b]">
                        - {periodTotals.naoPagoDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Middle Column: Details of Pendências */}
              {periodTotals.naoPagoCount > 0 && (
                <div className="w-full lg:w-80 bg-black/20 p-4 rounded-lg border border-white/5 flex flex-col justify-center gap-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-on-surface-variant font-bold uppercase">A Receber:</span>
                    <span className="text-primary font-black">{periodTotals.naoPagoReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-on-surface-variant font-bold uppercase">A Pagar:</span>
                    <span className="text-[#f59e0b] font-black">{periodTotals.naoPagoDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div className="h-px bg-white/10 my-1"></div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-on-surface-variant font-bold uppercase">Saldo de Pendências:</span>
                    <span className={cn("font-black", periodTotals.naoPagoSaldo >= 0 ? "text-primary" : "text-tertiary")}>
                      {periodTotals.naoPagoSaldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              )}

              {/* Right Column: Saldo Final Líquido (Previsto) and count */}
              <div className="flex items-center justify-between lg:justify-end gap-6 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-6 bg-white/[0.02] lg:bg-transparent p-4 lg:p-0 rounded-lg lg:rounded-none">
                <div className="text-left lg:text-right">
                  <p className="text-[10px] uppercase text-on-surface-variant mb-1 font-bold">Saldo Final Líquido (Previsto)</p>
                  <div className={cn(
                    "text-2xl md:text-3xl font-black tracking-tighter",
                    periodTotals.total >= 0 ? "text-primary" : "text-tertiary"
                  )}>
                    {periodTotals.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
                <div className="text-center border-l border-white/10 pl-6 text-xs text-on-surface-variant font-black leading-tight">
                  <span className="text-xl block">{periodTotals.count}</span>
                  REGISTROS
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(RelatoriosTab);
