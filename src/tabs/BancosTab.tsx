import React from 'react';
import { CreditCard, Edit, Trash2, Plus } from 'lucide-react';
import type { Bank, Transaction } from '../types';

interface BancosTabProps {
  banks: Bank[];
  transactions: Transaction[];
  setShowNewBankModal: (show: boolean) => void;
  setEditingBank: (bank: Bank) => void;
  deleteBank: (id: string) => void;
}

const BancosTab = React.memo(({ banks, setShowNewBankModal, setEditingBank, deleteBank }: BancosTabProps) => {
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
            <div key={bank.id} className="glass-card p-6 relative group">
              <button
                onClick={() => setEditingBank(bank)}
                className="absolute top-4 right-14 p-2 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 rounded-sm"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => deleteBank(bank.id)}
                className="absolute top-4 right-4 p-2 text-tertiary opacity-0 group-hover:opacity-100 transition-opacity hover:bg-tertiary/10 rounded-sm"
              >
                <Trash2 size={16} />
              </button>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-sm bg-primary/20 flex items-center justify-center text-primary">
                  <CreditCard size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-on-surface">{bank.nome}</h4>
                  <p className="text-[10px] text-on-surface-variant/60">
                    {bank.ativo ? 'Ativo' : 'Inativo'}
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
    </div>
  );
});

export default BancosTab;
