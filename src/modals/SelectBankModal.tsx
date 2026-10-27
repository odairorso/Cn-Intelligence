import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { CreditCard, Calendar, Layers, Check, DollarSign } from 'lucide-react';
import { Bank, Transaction } from '../types';
import { cn, todayInputDate, formatBRL, toInputDate } from '../lib/utils';

export interface PartialPaymentData {
  valorPago: number;
  saldoRestante: number;
  novoVencimentoSaldo: string;
}

interface SelectBankModalProps {
  transactionId: string;
  valor: number;
  transaction?: Transaction;
  banks: Bank[];
  initialDate?: string;
  onClose: () => void;
  onConfirm: (
    banco: string, 
    dataPagamento: string, 
    partialData?: PartialPaymentData
  ) => Promise<void> | void;
}

const SelectBankModal: React.FC<SelectBankModalProps> = ({
  transactionId,
  valor,
  transaction,
  banks,
  initialDate,
  onClose,
  onConfirm,
}) => {
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(initialDate || todayInputDate());
  const [dateError, setDateError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const paymentDateRef = useRef<HTMLInputElement | null>(null);

  // Valor pago / recebido
  const [valorPagoInput, setValorPagoInput] = useState<string>(() => (valor ? valor.toFixed(2) : '0.00'));
  const [valorError, setValorError] = useState('');

  // Vencimento do saldo restante (se for parcial)
  const defaultSaldoDate = useMemo(() => {
    return transaction?.vencimento ? toInputDate(transaction.vencimento) : (initialDate || todayInputDate());
  }, [transaction?.vencimento, initialDate]);
  const [saldoVencimento, setSaldoVencimento] = useState(defaultSaldoDate);

  useEffect(() => {
    setPaymentDate(initialDate || todayInputDate());
    setDateError('');
    setValorError('');
    setSelectedBank(null);
    setValorPagoInput(valor ? valor.toFixed(2) : '0.00');
    setSaldoVencimento(defaultSaldoDate);
  }, [transactionId, initialDate, valor, defaultSaldoDate]);

  const numValorPago = useMemo(() => {
    if (!valorPagoInput) return 0;
    const clean = String(valorPagoInput).replace(',', '.').trim();
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
  }, [valorPagoInput]);

  const isPartial = numValorPago > 0 && numValorPago < (valor - 0.009);
  const saldoRestante = isPartial ? Math.round((valor - numValorPago) * 100) / 100 : 0;

  const isReceita = transaction?.tipo === 'RECEITA';
  const actionLabel = isReceita ? 'Recebimento' : 'Pagamento';
  const actionVerb = isReceita ? 'Receber' : 'Pagar';

  const handleConfirm = async () => {
    if (isSubmitting || selectedBank === null) return;
    const normalizedDate = paymentDateRef.current?.value || paymentDate;
    if (!normalizedDate) {
      setDateError('Informe uma data válida.');
      return;
    }

    if (numValorPago <= 0) {
      setValorError('Informe um valor válido maior que zero.');
      return;
    }

    if (numValorPago > valor + 0.01) {
      setValorError(`O valor informado não pode ser maior que o valor total de ${formatBRL(valor)}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isPartial) {
        await onConfirm(selectedBank, normalizedDate, {
          valorPago: numValorPago,
          saldoRestante: saldoRestante,
          novoVencimentoSaldo: saldoVencimento || normalizedDate,
        });
      } else {
        await onConfirm(selectedBank, normalizedDate);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="glass-card p-6 md:p-8 w-full max-w-lg border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] my-auto"
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold font-headline text-on-surface">
              Confirmar {actionLabel}
            </h3>
            {transaction && (
              <p className="text-xs text-on-surface-variant font-medium mt-1">
                {transaction.fornecedor} {transaction.empresa ? `• ${transaction.empresa}` : ''}
              </p>
            )}
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant/70 block">
              Valor Original
            </span>
            <span className="text-lg font-black text-primary">
              {formatBRL(valor)}
            </span>
          </div>
        </div>

        {/* Campo de Valor a Receber / Pagar */}
        <div className="mb-4 bg-surface-variant/10 p-3.5 rounded-lg border border-white/5">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase flex items-center gap-1.5">
              <DollarSign size={14} className="text-primary" />
              Valor a {actionVerb} Agora
            </label>
            {numValorPago !== valor && (
              <button
                type="button"
                onClick={() => {
                  setValorPagoInput(valor.toFixed(2));
                  setValorError('');
                }}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                Restaurar Total ({formatBRL(valor)})
              </button>
            )}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-on-surface-variant">
              R$
            </span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={valor}
              value={valorPagoInput}
              onChange={(e) => {
                setValorPagoInput(e.target.value);
                setValorError('');
              }}
              className="w-full bg-surface-variant/30 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-base font-bold outline-none focus:border-primary text-on-surface"
              placeholder="0,00"
            />
          </div>
          {valorError && (
            <p className="mt-1.5 text-xs font-bold text-tertiary">{valorError}</p>
          )}

          {/* Destaque quando for Parcial */}
          {isPartial && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2"
            >
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <Layers size={16} />
                <span>Recebimento Parcial Detectado</span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-amber-500/20 text-[13px]">
                <span className="text-on-surface-variant">Saldo restante em aberto:</span>
                <span className="font-black text-amber-300">{formatBRL(saldoRestante)}</span>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">
                  Vencimento do Saldo Restante
                </label>
                <input
                  type="date"
                  value={saldoVencimento}
                  onChange={(e) => setSaldoVencimento(e.target.value)}
                  className="w-full bg-background/60 border border-amber-500/30 rounded px-3 py-1.5 text-xs text-on-surface outline-none focus:border-amber-400"
                />
                <p className="text-[10px] text-on-surface-variant/80 mt-1">
                  💡 Um novo lançamento de <strong>{formatBRL(saldoRestante)}</strong> será criado automaticamente como <strong>PENDENTE</strong>.
                </p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Campo de Data do Pagamento / Recebimento */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5 flex items-center gap-1.5">
            <Calendar size={14} className="text-on-surface-variant" />
            Data do {actionLabel}
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
            <p className="mt-1 text-xs font-bold text-tertiary">{dateError}</p>
          )}
        </div>

        {/* Seleção do Banco */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-on-surface-variant uppercase mb-2">
            Conta Bancária de Destino / Origem
          </label>
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => setSelectedBank('')}
              className={cn(
                "w-full p-3 rounded-lg border text-left transition-all",
                selectedBank === ''
                  ? "border-primary bg-primary/10"
                  : "border-white/10 hover:border-primary/40"
              )}
            >
              <div className="flex items-center gap-3">
                <CreditCard size={18} className={selectedBank === '' ? "text-primary" : "text-on-surface-variant"} />
                <span className={selectedBank === '' ? "text-primary font-bold text-xs" : "text-on-surface text-xs"}>
                  Não informado (Dinheiro / Fora do Banco)
                </span>
              </div>
            </button>
            {banks.filter(b => b.ativo).map(bank => (
              <button
                type="button"
                key={bank.id}
                onClick={() => setSelectedBank(bank.nome)}
                className={cn(
                  "w-full p-3 rounded-lg border text-left transition-all",
                  selectedBank === bank.nome
                    ? "border-primary bg-primary/10"
                    : "border-white/10 hover:border-primary/40"
                )}
              >
                <div className="flex items-center gap-3">
                  <CreditCard size={18} className={selectedBank === bank.nome ? "text-primary" : "text-on-surface-variant"} />
                  <span className={selectedBank === bank.nome ? "text-primary font-bold text-xs" : "text-on-surface text-xs"}>
                    {bank.nome}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-sm border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all text-on-surface-variant"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedBank === null || numValorPago <= 0 || isSubmitting}
            className="flex-1 px-4 py-3 rounded-sm bg-primary text-background text-xs font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Check size={16} strokeWidth={3} />
            {isSubmitting 
              ? 'Processando...' 
              : (isPartial 
                ? `Baixar Parcial (${formatBRL(numValorPago)})` 
                : `Confirmar (${formatBRL(numValorPago || valor)})`
              )
            }
          </button>
        </div>
      </motion.div>
    </div>
  );
};

SelectBankModal.displayName = 'SelectBankModal';
export default React.memo(SelectBankModal);
