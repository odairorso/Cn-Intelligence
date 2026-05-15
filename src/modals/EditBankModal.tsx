import React, { useState } from 'react';
import { motion } from 'motion/react';
import { api } from '../api';
import { Bank } from '../types';

interface EditBankModalProps {
  bank: Bank;
  onClose: () => void;
  onSuccess: () => void;
}

const EditBankModal = ({ bank, onClose, onSuccess }: EditBankModalProps) => {
  const [formData, setFormData] = useState({
    nome: bank.nome || '',
    agencia: bank.agencia || '',
    conta: bank.conta || '',
    saldo: String(bank.saldo ?? 0),
    ativo: bank.ativo ?? true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bank.id) return;
    try {
      await api.updateBank(bank.id, {
        nome: formData.nome,
        agencia: formData.agencia || undefined,
        conta: formData.conta || undefined,
        saldo: Number(formData.saldo) || 0,
        ativo: formData.ativo
      });
      onClose();
      onSuccess();
    } catch (error) {
      console.error('Failed to update bank:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-10 w-full max-w-md border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
      >
        <h3 className="text-xl font-bold font-headline mb-6">Editar Conta Bancária</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Nome do Banco</label>
            <input
              type="text"
              className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
              value={formData.nome}
              onChange={e => setFormData({ ...formData, nome: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Agência</label>
              <input
                type="text"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.agencia}
                onChange={e => setFormData({ ...formData, agencia: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Conta</label>
              <input
                type="text"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.conta}
                onChange={e => setFormData({ ...formData, conta: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Saldo Inicial (R$)</label>
            <input
              type="number" step="0.01"
              className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
              value={formData.saldo}
              onChange={e => setFormData({ ...formData, saldo: e.target.value })}
            />
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-white/20 bg-surface-variant/20 text-primary focus:ring-primary"
                checked={formData.ativo}
                onChange={e => setFormData({ ...formData, ativo: e.target.checked })}
              />
              <span className="text-sm text-on-surface">Conta ativa</span>
            </label>
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
              Salvar Alterações
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

EditBankModal.displayName = 'EditBankModal';
export default React.memo(EditBankModal);
