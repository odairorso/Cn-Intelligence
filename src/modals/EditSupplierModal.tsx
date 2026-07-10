import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Supplier } from '../types';
import { formatCnpjCpf } from '../lib/utils';

interface EditSupplierModalProps {
  supplier: Supplier;
  onClose: () => void;
  onSave: (id: string, data: Partial<Supplier>) => Promise<void>;
}

const EditSupplierModal = ({ supplier, onClose, onSave }: EditSupplierModalProps) => {
  const [formData, setFormData] = useState({
    nome: supplier.nome || '',
    cnpj: formatCnpjCpf(supplier.cnpj || ''),
    email: supplier.email || '',
    telefone: supplier.telefone || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier.id) return;
    await onSave(supplier.id, {
      nome: formData.nome,
      cnpj: formData.cnpj,
      email: formData.email,
      telefone: formData.telefone,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 w-full max-w-2xl border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <h3 className="text-xl font-bold font-headline mb-6">Editar Fornecedor</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Nome do Fornecedor</label>
              <input
                type="text"
                required
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all"
                value={formData.nome}
                onChange={e => setFormData({ ...formData, nome: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">CNPJ</label>
              <input
                type="text"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.cnpj}
                onChange={e => setFormData({ ...formData, cnpj: formatCnpjCpf(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">E-mail</label>
              <input
                type="email"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Telefone</label>
              <input
                type="text"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.telefone}
                onChange={e => setFormData({ ...formData, telefone: e.target.value })}
              />
            </div>
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
              className="flex-1 px-4 py-3 rounded-sm bg-primary text-background text-xs font-black uppercase tracking-widest hover:opacity-90 shadow-lg shadow-primary/10 transition-all"
            >
              Salvar Fornecedor
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

EditSupplierModal.displayName = 'EditSupplierModal';
export default React.memo(EditSupplierModal);
