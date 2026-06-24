import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Edit, X, Loader2 } from 'lucide-react';
import { Supplier, Transaction } from '../types';
import { cn, isSupplierMatch } from '../lib/utils';
import { api } from '../api';

const SupplierDetailModal = ({ supplier, transactions: _transactions, onClose, onEdit }: { supplier: Supplier, transactions?: Transaction[], onClose: () => void, onEdit: (s: Supplier) => void }) => {
  const [supplierTransactions, setSupplierTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getTransactions(1000, 0, undefined, undefined, supplier.nome)
      .then((data) => {
        if (!active) return;
        const matched = data
          .filter(t => isSupplierMatch(t.fornecedor, supplier.nome))
          .sort((a, b) => txDateToNumber(b.vencimento) - txDateToNumber(a.vencimento));
        setSupplierTransactions(matched);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching supplier transactions:', err);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [supplier]);

  const kpis = useMemo(() => {
    const total = supplierTransactions.reduce((acc, t) => acc + (Number(t.valor) || 0), 0);
    const pago = supplierTransactions.filter(t => t.status === 'PAGO').reduce((acc, t) => acc + (Number(t.valor) || 0), 0);
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
          <div className="flex items-center gap-2">
            {supplier.id && !String(supplier.id).startsWith('virtual-') && (
              <button
                onClick={() => onEdit(supplier)}
                className="p-2 hover:bg-primary/10 rounded-sm transition-colors text-on-surface-variant hover:text-primary"
                title="Editar"
              >
                <Edit size={20} />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-sm transition-colors text-on-surface-variant" title="Fechar">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* KPIs Internos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5">
          <div className="p-6 bg-surface/40">
            <p className="text-[10px] font-black uppercase text-on-surface-variant/40 tracking-widest mb-1">Total Movimentado</p>
            <p className="text-xl font-black font-headline">{(kpis.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="p-6 bg-surface/40">
            <p className="text-[10px] font-black uppercase text-primary/60 tracking-widest mb-1">Total Liquidado</p>
            <p className="text-xl font-black font-headline text-primary">{(kpis.pago || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="p-6 bg-surface/40">
            <p className="text-[10px] font-black uppercase text-secondary/60 tracking-widest mb-1">Saldo em Aberto</p>
            <p className="text-xl font-black font-headline text-secondary">{(kpis.aberto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* Lista de Histórico */}
        <div className="flex-grow overflow-y-auto p-8">
          <h4 className="text-xs font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-6">Histórico Financeiro</h4>
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-primary" size={24} />
              </div>
            ) : (
              <>
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
                      <span className={cn("text-sm font-black font-headline", (tx.valor || 0) < 0 ? "text-tertiary" : "text-primary")}>{(tx.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

SupplierDetailModal.displayName = 'SupplierDetailModal';
export default React.memo(SupplierDetailModal);
