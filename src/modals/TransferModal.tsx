import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, RefreshCw } from 'lucide-react';
import { Bank } from '../types';
import { todayInputDate, parseMoneyToNumber } from '../lib/utils';

interface TransferModalProps {
  banks: Bank[];
  companyOptions: string[];
  onClose: () => void;
  onSubmit: (data: { originBank: string, destBank: string, originCompany: string, destCompany: string, value: number, date: string, description: string }) => void;
}

const TransferModal = ({ banks, companyOptions, onClose, onSubmit }: TransferModalProps) => {
  const [formData, setFormData] = useState({
    originBank: '',
    destBank: '',
    originCompany: 'CN',
    destCompany: 'CEI',
    value: '',
    date: todayInputDate(),
    description: 'Transferência entre contas'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.originBank || !formData.destBank || !formData.value) return;
    if (formData.originBank === formData.destBank && formData.originCompany === formData.destCompany) {
      alert('Selecione contas ou empresas diferentes para origem e destino.');
      return;
    }
    onSubmit({
      ...formData,
      value: parseMoneyToNumber(formData.value)
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-10 w-full max-w-lg border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold font-headline">Nova Transferência Inter-Empresa</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Origem */}
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Empresa Origem</label>
                <select
                  required
                  className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-tertiary transition-all text-on-surface appearance-none"
                  style={{ backgroundColor: '#161b2a' }}
                  value={formData.originCompany}
                  onChange={e => setFormData({ ...formData, originCompany: e.target.value })}
                >
                  {companyOptions.map(c => (
                    <option key={c} value={c} className="bg-[#161b2a]">{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Conta Origem (Débito)</label>
                <select
                  required
                  className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-tertiary transition-all text-on-surface appearance-none"
                  style={{ backgroundColor: '#161b2a' }}
                  value={formData.originBank}
                  onChange={e => setFormData({ ...formData, originBank: e.target.value })}
                >
                  <option value="">Selecione</option>
                  {banks.filter(b => b.ativo).map(b => (
                    <option key={b.id} value={b.nome} className="bg-[#161b2a]">{b.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Destino */}
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Empresa Destino</label>
                <select
                  required
                  className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                  style={{ backgroundColor: '#161b2a' }}
                  value={formData.destCompany}
                  onChange={e => setFormData({ ...formData, destCompany: e.target.value })}
                >
                  {companyOptions.map(c => (
                    <option key={c} value={c} className="bg-[#161b2a]">{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Conta Destino (Crédito)</label>
                <select
                  required
                  className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                  style={{ backgroundColor: '#161b2a' }}
                  value={formData.destBank}
                  onChange={e => setFormData({ ...formData, destBank: e.target.value })}
                >
                  <option value="">Selecione</option>
                  {banks.filter(b => b.ativo).map(b => (
                    <option key={b.id} value={b.nome} className="bg-[#161b2a]">{b.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-center py-1 opacity-30">
            <RefreshCw size={24} className="animate-spin-slow" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-primary"
                value={formData.value}
                onChange={e => setFormData({ ...formData, value: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Data</label>
              <input
                type="date"
                required
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-primary"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Descrição</label>
            <input
              type="text"
              className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-primary"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-sm border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all text-on-surface-variant"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 rounded-sm bg-primary text-background text-xs font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/10"
            >
              Confirmar Transferência
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

TransferModal.displayName = 'TransferModal';
export default React.memo(TransferModal);
