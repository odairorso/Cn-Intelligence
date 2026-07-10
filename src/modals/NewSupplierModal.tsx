import React, { useState } from 'react';
import { motion } from 'motion/react';
import { api } from '../api';
import { Supplier } from '../types';
import { formatCnpjCpf } from '../lib/utils';

interface NewSupplierModalProps {
  setShowNewSupplierModal: (show: boolean) => void;
  onSuccess: () => void;
}

const NewSupplierModal = ({ setShowNewSupplierModal, onSuccess }: NewSupplierModalProps) => {



  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cnpj: '',
    endereco: '',
    cidade: '',
    estado: '',
    categoria: '',
    observacoes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const newSupplier = {
        ...formData,
        uid: 'guest'
      };
      await api.createSupplier(newSupplier);
      setShowNewSupplierModal(false);
      onSuccess();

    } catch (error) {
      console.error('Failed to create supplier:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 w-full max-w-2xl border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <h3 className="text-xl font-bold font-headline mb-6">Novo Fornecedor</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Nome do Fornecedor</label>
              <input
                type="text" required
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

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Endereço</label>
            <input
              type="text"
              className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
              value={formData.endereco}
              onChange={e => setFormData({ ...formData, endereco: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Cidade</label>
              <input
                type="text"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.cidade}
                onChange={e => setFormData({ ...formData, cidade: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Estado</label>
              <input
                type="text"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.estado}
                onChange={e => setFormData({ ...formData, estado: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Categoria</label>
              <input
                type="text"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.categoria}
                onChange={e => setFormData({ ...formData, categoria: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Observações</label>
            <textarea
              className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary h-24 resize-none"
              value={formData.observacoes}
              onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowNewSupplierModal(false)}
              className="flex-1 px-4 py-3 rounded-sm border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all text-on-surface-variant"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 rounded-sm bg-primary text-background text-xs font-black uppercase tracking-widest hover:opacity-90 shadow-lg shadow-primary/10 transition-all"
            >
              Cadastrar Fornecedor
            </button>
          </div>

        </form>
      </motion.div>
    </div>
  );
};

NewSupplierModal.displayName = 'NewSupplierModal';
export default React.memo(NewSupplierModal);
