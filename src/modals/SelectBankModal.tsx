import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { CreditCard } from 'lucide-react';
import { Bank } from '../types';
import { cn, todayInputDate } from '../lib/utils';

interface SelectBankModalProps {
  transactionId: string;
  valor: number;
  banks: Bank[];
  initialDate?: string;
  onClose: () => void;
  onConfirm: (banco: string, dataPagamento: string) => void;
}

const SelectBankModal = ({ transactionId, valor, banks, initialDate, onClose, onConfirm }: SelectBankModalProps) => {
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(initialDate || todayInputDate());
  const [dateError, setDateError] = useState('');
  const paymentDateRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPaymentDate(initialDate || todayInputDate());
    setDateError('');
    setSelectedBank(null);
  }, [transactionId, initialDate]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-10 w-full max-w-md border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
      >
        <h3 className="text-xl font-bold font-headline mb-2">Confirmar Pagamento</h3>
        <p className="text-sm text-on-surface-variant mb-4">
          Selecione o banco para registrar o pagamento de <span className="font-bold text-primary">{valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </p>

        <div className="mb-6">
          <label className="block text-xs font-bold text-on-surface-variant uppercase mb-2">Data do Pagamento</label>
          <input
            type="date"
            ref={paymentDateRef}
            value={paymentDate}
            onChange={(e) => {
              setPaymentDate(e.target.value);
              setDateError('');
            }}
            className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-primary text-on-surface"
          />
          {dateError && (
            <p className="mt-2 text-xs font-bold text-tertiary">{dateError}</p>
          )}
        </div>

        <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-1">
          <button
            onClick={() => setSelectedBank('')}
            className={cn(
              "w-full p-4 rounded-lg border text-left transition-all",
              selectedBank === ''
                ? "border-primary bg-primary/10"
                : "border-white/10 hover:border-primary/40"
            )}
          >
            <div className="flex items-center gap-3">
              <CreditCard size={20} className={selectedBank === '' ? "text-primary" : "text-on-surface-variant"} />
              <span className={selectedBank === '' ? "text-primary font-bold" : "text-on-surface"}>
                Não informado (Dinheiro / Fora do Banco)
              </span>
            </div>
          </button>
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
            onClick={() => {
              if (selectedBank === null) return;
              const normalized = paymentDateRef.current?.value || paymentDate;
              if (!normalized) {
                setDateError('Informe uma data válida.');
                return;
              }
              onConfirm(selectedBank, normalized);
            }}
            disabled={selectedBank === null}
            className="flex-1 px-4 py-3 rounded-sm bg-primary text-background text-xs font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmar
          </button>
        </div>
      </motion.div>
    </div>
  );
};

SelectBankModal.displayName = 'SelectBankModal';
export default React.memo(SelectBankModal);
