import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { CreditCard, Calendar, CheckCircle2, DollarSign, X, AlertCircle } from 'lucide-react';
import { Bank, Transaction } from '../types';
import { cn, todayInputDate } from '../lib/utils';

interface BatchPayModalProps {
  transactions: Transaction[];
  banks: Bank[];
  initialDate?: string;
  onClose: () => void;
  onConfirm: (
    items: { id: string; juros: number }[],
    banco: string,
    dataPagamento: string
  ) => void;
}

const BatchPayModal: React.FC<BatchPayModalProps> = ({
  transactions,
  banks,
  initialDate,
  onClose,
  onConfirm,
}) => {
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(initialDate || todayInputDate());
  const [dateError, setDateError] = useState('');
  const paymentDateRef = useRef<HTMLInputElement | null>(null);

  // Mapa de juros individual por ID da transação
  const [jurosMap, setJurosMap] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    transactions.forEach((tx) => {
      initial[String(tx.id)] = Number(tx.juros || 0);
    });
    return initial;
  });

  useEffect(() => {
    setPaymentDate(initialDate || todayInputDate());
    setDateError('');
    setSelectedBank(null);
    const initial: Record<string, number> = {};
    transactions.forEach((tx) => {
      initial[String(tx.id)] = Number(tx.juros || 0);
    });
    setJurosMap(initial);
  }, [transactions, initialDate]);

  const handleJurosChange = (id: string, valStr: string) => {
    // Permite números e vírgula/ponto
    const normalized = valStr.replace(',', '.');
    const num = parseFloat(normalized);
    setJurosMap((prev) => ({
      ...prev,
      [id]: isNaN(num) || num < 0 ? 0 : Math.round(num * 100) / 100,
    }));
  };

  // Cálculos consolidados
  const { totalPrincipal, totalJuros, totalConsolidado } = useMemo(() => {
    let principal = 0;
    let jurosTotal = 0;

    transactions.forEach((tx) => {
      const idStr = String(tx.id);
      principal += Number(tx.valor) || 0;
      jurosTotal += Number(jurosMap[idStr] || 0);
    });

    return {
      totalPrincipal: principal,
      totalJuros: jurosTotal,
      totalConsolidado: principal + jurosTotal,
    };
  }, [transactions, jurosMap]);

  const handleConfirm = () => {
    if (selectedBank === null) return;
    const normalizedDate = paymentDateRef.current?.value || paymentDate;
    if (!normalizedDate) {
      setDateError('Informe uma data de pagamento válida.');
      return;
    }

    const items = transactions.map((tx) => ({
      id: String(tx.id),
      juros: Number(jurosMap[String(tx.id)] || 0),
    }));

    onConfirm(items, selectedBank, normalizedDate);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="glass-card p-6 md:p-8 w-full max-w-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.6)] my-8 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <CheckCircle2 size={20} />
              </span>
              <h3 className="text-xl font-bold font-headline text-on-surface">
                Quitação em Lote
              </h3>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              Baixa simultânea de <strong className="text-primary font-bold">{transactions.length}</strong> parcela(s) selecionada(s) com ajuste de juros individual.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg hover:bg-white/5 transition-all"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          {/* Tabela de Parcelas com Juros Individuais */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">
              Parcelas & Juros por Item
            </label>
            <div className="space-y-3">
              {transactions.map((tx, idx) => {
                const idStr = String(tx.id);
                const itemJuros = jurosMap[idStr] ?? Number(tx.juros || 0);
                const itemTotal = (Number(tx.valor) || 0) + itemJuros;

                return (
                  <div
                    key={tx.id || idx}
                    className="p-3.5 rounded-xl bg-surface/50 border border-white/5 hover:border-white/15 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-on-surface truncate">
                          {tx.fornecedor || tx.descricao || 'Lançamento sem descrição'}
                        </span>
                        {tx.empresa && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-white/5 border border-white/10 text-on-surface-variant">
                            {tx.empresa}
                          </span>
                        )}
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          tx.tipo === 'RECEITA' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                        )}>
                          {tx.tipo || 'DESPESA'}
                        </span>
                      </div>
                      {tx.descricao && tx.fornecedor && (
                        <p className="text-xs text-on-surface-variant truncate mt-0.5">
                          {tx.descricao}
                        </p>
                      )}
                      <div className="text-[11px] text-on-surface-variant mt-1 flex items-center gap-2">
                        <span>Valor Base: <strong>{(Number(tx.valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                        {tx.vencimento && <span>• Venc: {tx.vencimento}</span>}
                      </div>
                    </div>

                    {/* Juros Input + Total Linha */}
                    <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1 text-right">
                          + Juros (R$)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={itemJuros === 0 ? '' : itemJuros}
                            placeholder="0,00"
                            onChange={(e) => handleJurosChange(idStr, e.target.value)}
                            className="w-28 bg-surface-variant/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-right outline-none focus:border-primary text-on-surface font-mono"
                          />
                        </div>
                      </div>

                      <div className="text-right min-w-[90px]">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                          Total Item
                        </span>
                        <span className="text-sm font-bold text-primary font-mono block">
                          {itemTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resumo Consolidado */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-xs text-on-surface-variant">
              <div>
                <span>Principal:</span>{' '}
                <strong className="text-on-surface font-mono">
                  {totalPrincipal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
              </div>
              <div>
                <span>Juros Totais:</span>{' '}
                <strong className={cn("font-mono", totalJuros > 0 ? "text-amber-400 font-bold" : "text-on-surface")}>
                  {totalJuros.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
              </div>
            </div>
            <div className="text-right flex items-center gap-2">
              <span className="text-xs uppercase font-bold text-on-surface-variant tracking-wider">
                Total a Quitar:
              </span>
              <span className="text-lg font-black text-primary font-mono">
                {totalConsolidado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>

          {/* Data do Pagamento */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar size={14} className="text-primary" />
              Data do Pagamento
            </label>
            <input
              type="date"
              ref={paymentDateRef}
              value={paymentDate}
              onChange={(e) => {
                setPaymentDate(e.target.value);
                setDateError('');
              }}
              className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary text-on-surface"
            />
            {dateError && (
              <p className="mt-2 text-xs font-bold text-tertiary flex items-center gap-1">
                <AlertCircle size={13} /> {dateError}
              </p>
            )}
          </div>

          {/* Seleção de Banco */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CreditCard size={14} className="text-primary" />
              Conta Bancária de Quitação
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => setSelectedBank('')}
                className={cn(
                  "p-3 rounded-lg border text-left transition-all flex items-center gap-2.5",
                  selectedBank === ''
                    ? "border-primary bg-primary/10 shadow-sm shadow-primary/20"
                    : "border-white/10 hover:border-primary/40 bg-surface/30"
                )}
              >
                <CreditCard size={18} className={selectedBank === '' ? "text-primary" : "text-on-surface-variant"} />
                <span className={cn("text-xs truncate", selectedBank === '' ? "text-primary font-bold" : "text-on-surface")}>
                  Não informado (Dinheiro/Caixa)
                </span>
              </button>

              {banks
                .filter((b) => b.ativo)
                .map((bank) => (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => setSelectedBank(bank.nome)}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-all flex items-center gap-2.5",
                      selectedBank === bank.nome
                        ? "border-primary bg-primary/10 shadow-sm shadow-primary/20"
                        : "border-white/10 hover:border-primary/40 bg-surface/30"
                    )}
                  >
                    <CreditCard
                      size={18}
                      className={selectedBank === bank.nome ? "text-primary" : "text-on-surface-variant"}
                      style={{ color: selectedBank === bank.nome ? undefined : bank.cor }}
                    />
                    <span className={cn("text-xs font-bold truncate", selectedBank === bank.nome ? "text-primary" : "text-on-surface")}>
                      {bank.nome}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 pt-6 border-t border-white/10 mt-6 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-lg border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all text-on-surface-variant"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedBank === null}
            className="flex-1 px-4 py-3 rounded-lg bg-primary text-background text-xs font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={16} />
            Confirmar Baixa ({transactions.length})
          </button>
        </div>
      </motion.div>
    </div>
  );
};

BatchPayModal.displayName = 'BatchPayModal';
export default React.memo(BatchPayModal);
