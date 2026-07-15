import React, { useState, useEffect } from 'react';
import { CreditCard, Edit, Trash2, Plus, X, Loader2 } from 'lucide-react';
import type { Bank, Transaction } from '../types';
import { api } from '../api';

interface BancosTabProps {
  banks: Bank[];
  transactions: Transaction[]; // Mantido para compatibilidade de tipos
  setShowNewBankModal: (show: boolean) => void;
  setEditingBank: (bank: Bank) => void;
  deleteBank: (id: string) => void;
  onEditTransaction?: (tx: Transaction) => void;
}

const BancosTab = React.memo(({ banks, transactions, setShowNewBankModal, setEditingBank, deleteBank, onEditTransaction }: BancosTabProps) => {
  const [selectedBankForExtract, setSelectedBankForExtract] = useState<Bank | null>(null);
  const [extractFilter, setExtractFilter] = useState<'PAGO' | 'TODOS'>('PAGO');
  const [extractMonth, setExtractMonth] = useState<string>(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [extractYear, setExtractYear] = useState<string>(() => String(new Date().getFullYear()));

  const [extractTransactions, setExtractTransactions] = useState<Transaction[]>([]);
  const [loadingExtract, setLoadingExtract] = useState(false);

  const normalizeName = (name: string) => String(name || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  // Busca lançamentos na API dinamicamente de acordo com filtros e banco
  useEffect(() => {
    if (!selectedBankForExtract) return;

    const loadExtract = async () => {
      setLoadingExtract(true);
      try {
        // NÃO passamos queryYear e queryMonth para a API!
        // Carregamos todos os registros para permitir filtragem por pagamento ou vencimento no frontend.
        const data = await api.getTransactions(
          5000,
          0
        );
        
        setExtractTransactions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Erro ao buscar extrato do banco:', err);
      } finally {
        setLoadingExtract(false);
      }
    };

    loadExtract();
  }, [selectedBankForExtract, transactions]); // Recarrega se o banco ou as transações mudarem

  const formatCreatedAt = (dateTimeStr?: string) => {
    if (!dateTimeStr) return '-';
    try {
      const date = new Date(dateTimeStr);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('pt-BR');
    } catch {
      return '-';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold font-headline">Contas Bancárias</h3>
          <p className="text-sm text-on-surface-variant mt-1">Gerencie suas contas bancárias e acompanhe os saldos reais calculados</p>
        </div>
        <button
          onClick={() => setShowNewBankModal(true)}
          className="bg-primary text-background px-6 py-2.5 rounded-sm text-sm font-black uppercase tracking-widest flex items-center gap-2 hover:bg-primary-dark transition-all shadow-lg shadow-primary/10"
        >
          <Plus size={18} strokeWidth={3} /> Nova Conta
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {banks.map(bank => {
          const totalPagoVal = bank.total_pago || 0;
          const saldoAtualVal = Number(bank.saldo) + totalPagoVal;

          return (
            <div
              key={bank.id}
              className="glass-card p-6 relative group cursor-pointer hover:border-primary/30 transition-all hover:shadow-lg"
              onClick={() => setSelectedBankForExtract(bank)}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingBank(bank);
                }}
                className="absolute top-4 right-14 p-2 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 rounded-sm z-10"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteBank(bank.id);
                }}
                className="absolute top-4 right-4 p-2 text-tertiary opacity-0 group-hover:opacity-100 transition-opacity hover:bg-tertiary/10 rounded-sm z-10"
              >
                <Trash2 size={16} />
              </button>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-sm bg-primary/20 flex items-center justify-center text-primary">
                  <CreditCard size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-on-surface">{bank.nome}</h4>
                  <p className="text-[10px] text-on-surface-variant/60 flex items-center gap-1.5 mt-0.5">
                    <span>{bank.ativo ? 'Ativo' : 'Inativo'}</span>
                    {saldoAtualVal < 0 && (
                      <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 px-1 py-0.2 rounded-xs font-black uppercase tracking-wider">
                        Usando Limite
                      </span>
                    )}
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
                    {Number(bank.saldo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant">Movimentação</span>
                  <span className="text-sm font-bold" style={{ color: totalPagoVal < 0 ? '#ef4444' : '#22c55e' }}>
                    {totalPagoVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="pt-2 border-t border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-primary">Saldo Atual</span>
                    <span className="text-lg font-black" style={{ color: saldoAtualVal < 0 ? '#ef4444' : '#3b82f6' }}>
                      {saldoAtualVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-primary/70 mt-2 opacity-0 group-hover:opacity-100 transition-opacity text-right font-bold">
                  Clique para ver lançamentos →
                </p>
              </div>
            </div>
          );
        })}
        {banks.length === 0 && (
          <div className="col-span-full glass-card p-12 text-center">
            <CreditCard size={48} className="mx-auto text-on-surface-variant opacity-20 mb-4" />
            <p className="text-on-surface-variant">Nenhuma conta bancária cadastrada</p>
            <p className="text-xs text-on-surface-variant/60 mt-1">Clique em "Nova Conta" para adicionar</p>
          </div>
        )}
      </div>

      {selectedBankForExtract && (() => {
        const bankNameNormalized = normalizeName(selectedBankForExtract.nome);
        const bankTransactions = extractTransactions
          .filter(tx => tx.banco && normalizeName(tx.banco) === bankNameNormalized)
          .filter(tx => {
            if (extractFilter === 'PAGO') {
              return tx.status === 'PAGO';
            }
            return true;
          })
          .filter(tx => {
            // Regra crucial: se o lançamento está pago, a data de movimentação real é a data de PAGAMENTO.
            // Se está pendente/vencido, a data de movimentação estimada é a data de VENCIMENTO.
            const dateStr = tx.status === 'PAGO' && tx.pagamento ? tx.pagamento : tx.vencimento;
            if (!dateStr) return true;
            
            const parts = dateStr.includes('-') ? dateStr.split('-') : dateStr.split('/');
            const year = dateStr.includes('-') ? parts[0] : parts[2];
            const month = dateStr.includes('-') ? parts[1] : parts[1];
            
            const matchesYear = extractYear === 'TODOS' || year === extractYear;
            const matchesMonth = extractMonth === 'TODOS' || month === extractMonth;
            
            return matchesYear && matchesMonth;
          })
          .sort((a, b) => {
            const dateA = a.pagamento || a.vencimento;
            const dateB = b.pagamento || b.vencimento;
            return dateB.localeCompare(dateA);
          });

        // Totais do período filtrado
        const totalReceitas = bankTransactions
          .filter(tx => tx.status === 'PAGO' && (tx.tipo === 'RECEITA' || (tx.tipo === 'TRANSFERENCIA' && Number(tx.valor || 0) > 0)))
          .reduce((sum, tx) => sum + Math.abs(Number(tx.valor || 0)) + Number(tx.juros || 0), 0);

        const totalDespesas = bankTransactions
          .filter(tx => tx.status === 'PAGO' && (tx.tipo === 'DESPESA' || (tx.tipo === 'TRANSFERENCIA' && Number(tx.valor || 0) < 0)))
          .reduce((sum, tx) => sum + Math.abs(Number(tx.valor || 0)) + Number(tx.juros || 0), 0);

        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="glass-card p-6 w-full max-w-5xl border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold font-headline flex items-center gap-2 text-on-surface">
                    <CreditCard className="text-primary" size={22} />
                    Extrato de Lançamentos - {selectedBankForExtract.nome}
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-1">
                    {selectedBankForExtract.agencia && `Agência: ${selectedBankForExtract.agencia}`}
                    {selectedBankForExtract.agencia && selectedBankForExtract.conta && ' • '}
                    {selectedBankForExtract.conta && `Conta: ${selectedBankForExtract.conta}`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedBankForExtract(null);
                    setExtractFilter('PAGO');
                    setExtractMonth(String(new Date().getMonth() + 1).padStart(2, '0'));
                    setExtractYear(String(new Date().getFullYear()));
                    setExtractTransactions([]);
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-full text-on-surface-variant transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Filtros rápidos e data */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div className="flex gap-2 bg-surface-variant/20 p-1 rounded-lg w-fit">
                  <button
                    disabled={loadingExtract}
                    onClick={() => setExtractFilter('PAGO')}
                    className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${
                      extractFilter === 'PAGO'
                        ? 'bg-primary text-background'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Apenas Pagos (Afetam o Saldo)
                  </button>
                  <button
                    disabled={loadingExtract}
                    onClick={() => setExtractFilter('TODOS')}
                    className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${
                      extractFilter === 'TODOS'
                        ? 'bg-primary text-background'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Todos os Lançamentos
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-on-surface-variant uppercase font-black tracking-wider">Mês:</span>
                    <select
                      disabled={loadingExtract}
                      value={extractMonth}
                      onChange={(e) => setExtractMonth(e.target.value)}
                      className="bg-surface border border-white/10 rounded px-2.5 py-1.5 text-xs outline-none focus:border-primary text-on-surface"
                      style={{ backgroundColor: '#1e1e2e' }}
                    >
                      <option value="TODOS">Todos</option>
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
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-on-surface-variant uppercase font-black tracking-wider">Ano:</span>
                    <select
                      disabled={loadingExtract}
                      value={extractYear}
                      onChange={(e) => setExtractYear(e.target.value)}
                      className="bg-surface border border-white/10 rounded px-2.5 py-1.5 text-xs outline-none focus:border-primary text-on-surface"
                      style={{ backgroundColor: '#1e1e2e' }}
                    >
                      <option value="TODOS">Todos</option>
                      {Array.from({ length: 7 }, (_, i) => String(2020 + i))
                        .reverse()
                        .map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Tabela de Lançamentos */}
              <div className="flex-grow overflow-y-auto mb-6 border border-white/5 rounded-lg relative min-h-[250px]">
                {loadingExtract ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-xs">
                    <Loader2 className="animate-spin text-primary mb-2" size={32} />
                    <p className="text-xs text-on-surface-variant">Carregando dados diretamente do servidor...</p>
                  </div>
                ) : bankTransactions.length === 0 ? (
                  <div className="p-12 text-center text-on-surface-variant">
                    Nenhum lançamento encontrado para os filtros selecionados neste banco.
                  </div>
                ) : (
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-surface-variant/40 border-b border-white/10 text-on-surface-variant font-bold text-xs uppercase">
                        <th className="p-3">Data Mov.</th>
                        <th className="p-3">Cadastrado em</th>
                        <th className="p-3">Fornecedor</th>
                        <th className="p-3">Descrição</th>
                        <th className="p-3 text-center">Tipo</th>
                        <th className="p-3 text-right">Valor</th>
                        <th className="p-3 text-center">Status</th>
                        {onEditTransaction && <th className="p-3 text-center w-16">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {bankTransactions.map(tx => {
                        const isRevenue = tx.tipo === 'RECEITA' || (tx.tipo === 'TRANSFERENCIA' && Number(tx.valor || 0) > 0);
                        const displayDate = tx.status === 'PAGO' && tx.pagamento ? tx.pagamento : tx.vencimento;
                        
                        const formattedDate = displayDate.includes('-')
                          ? displayDate.split('-').reverse().join('/')
                          : displayDate;

                        return (
                          <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-3 text-xs text-on-surface font-semibold">{formattedDate}</td>
                            <td className="p-3 text-xs text-on-surface-variant">{formatCreatedAt(tx.created_at)}</td>
                            <td className="p-3 font-medium text-on-surface">{tx.fornecedor || '-'}</td>
                            <td className="p-3 text-xs text-on-surface-variant">{tx.descricao || '-'}</td>
                            <td className="p-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isRevenue ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                              }`}>
                                {isRevenue ? 'Receita' : 'Despesa'}
                              </span>
                            </td>
                            <td className={`p-3 text-right font-bold ${isRevenue ? 'text-green-400' : 'text-red-400'}`}>
                              <div>
                                {isRevenue ? '+' : '-'}{Math.abs(Number(tx.valor || 0) + Number(tx.juros || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </div>
                              {Number(tx.juros || 0) !== 0 && (
                                <div className="text-[10px] text-on-surface-variant/70 font-normal">
                                  {Number(tx.juros || 0) > 0 ? 'Juros: ' : 'Desconto: '}
                                  {Math.abs(Number(tx.juros)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                tx.status === 'PAGO'
                                  ? 'bg-green-500/10 text-green-400'
                                  : tx.status === 'VENCIDO'
                                  ? 'bg-red-500/10 text-red-400'
                                  : 'bg-yellow-500/10 text-yellow-400'
                              }`}>
                                {tx.status}
                              </span>
                            </td>
                            {onEditTransaction && (
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => onEditTransaction(tx)}
                                  className="p-1 text-primary hover:bg-primary/10 rounded transition-all inline-flex items-center justify-center"
                                  title="Editar Lançamento"
                                >
                                  <Edit size={14} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Resumo de Conciliação */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-surface-variant/10 rounded-lg border border-white/5">
                <div>
                  <p className="text-[10px] text-on-surface-variant uppercase font-bold">Saldo Inicial</p>
                  <p className="text-sm font-bold text-on-surface mt-0.5">
                    {Number(selectedBankForExtract.saldo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-green-400 uppercase font-bold">Total Receitas Pagas (Período)</p>
                  <p className="text-sm font-bold text-green-400 mt-0.5">
                    +{totalReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-red-400 uppercase font-bold">Total Despesas Pagas (Período)</p>
                  <p className="text-sm font-bold text-red-400 mt-0.5">
                    -{totalDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <div className="border-l border-white/10 pl-4">
                  <p className="text-[10px] text-primary uppercase font-bold">Saldo Atual da Conta</p>
                  <p className="text-base font-black text-primary mt-0.5">
                    {((Number(selectedBankForExtract.saldo) + (selectedBankForExtract.total_pago || 0))).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
});

BancosTab.displayName = 'BancosTab';
export default BancosTab;
