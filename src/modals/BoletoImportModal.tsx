import React, { useMemo } from 'react';
import { FileUp } from 'lucide-react';
import type { ContaContabil, Supplier, Transaction } from '../types';
import type { PdfImportDraft } from '../lib/boletoParser';
import { cn, matchesAccountType } from '../lib/utils';

interface BoletoImportModalProps {
  rows: PdfImportDraft[];
  companyOptions: string[];
  contasContabeis: ContaContabil[];
  suppliers: Supplier[];
  transactions: Transaction[];
  isSaving: boolean;
  onUpdateRow: (index: number, patch: Partial<PdfImportDraft>) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Modal for reviewing and confirming batch PDF boleto imports before saving. */
const BoletoImportModal = ({
  rows,
  companyOptions,
  contasContabeis,
  suppliers,
  transactions,
  isSaving,
  onUpdateRow,
  onCancel,
  onConfirm,
}: BoletoImportModalProps) => {
  const supplierSuggestions = useMemo(
    () => [...new Set([...suppliers.map(s => s.nome), ...transactions.map(t => t.fornecedor)])].sort(),
    [suppliers, transactions]
  );

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-surface-variant rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-variant flex items-center justify-between">
          <h3 className="text-lg md:text-xl font-bold font-headline flex items-center gap-2">
            <FileUp className="text-primary" size={20} /> Automação de Boletos
          </h3>
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            {rows.length} arquivo(s)
          </span>
        </div>

        <div className="p-4 max-h-[60vh] overflow-auto">
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div
                key={`${row.fileName}-${index}`}
                className={cn(
                  'border rounded-xl p-3',
                  row.duplicate ? 'border-tertiary/40 bg-tertiary/5' : 'border-surface-variant bg-surface-variant/10'
                )}
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-3">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Arquivo</p>
                    <p className="text-xs text-on-surface-variant truncate">
                      {row.fileName.length > 55 ? `boleto_${index + 1}.pdf` : row.fileName}
                    </p>
                  </div>
                  <div className="md:col-span-3 relative">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Fornecedor</p>
                    <input
                      list="supplier-suggestions"
                      value={row.fornecedor}
                      onChange={(e) => onUpdateRow(index, { fornecedor: e.target.value })}
                      placeholder="Digite o fornecedor..."
                      className="w-full bg-surface-variant/30 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary cursor-text"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Vencimento</p>
                    <input
                      value={row.vencimento}
                      onChange={(e) => onUpdateRow(index, { vencimento: e.target.value })}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v.match(/^\d{8}$/)) {
                          onUpdateRow(index, { vencimento: `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4, 8)}` });
                        } else if (v.match(/^\d{6}$/)) {
                          onUpdateRow(index, { vencimento: `${v.slice(0, 2)}/${v.slice(2, 4)}/20${v.slice(4, 6)}` });
                        }
                      }}
                      placeholder="DD/MM/AAAA"
                      className="w-full bg-surface-variant/30 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Valor</p>
                    <input
                      type="number"
                      step="0.01"
                      value={row.valorInput !== undefined ? row.valorInput : (Number.isFinite(row.valor) && row.valor !== 0 ? row.valor.toString() : '')}
                      onChange={(e) => {
                        const valStr = e.target.value;
                        const raw = String(valStr || '').replace(',', '.');
                        const n = Number(raw);
                        onUpdateRow(index, {
                          valorInput: valStr,
                          valor: Number.isFinite(n) ? n : 0,
                        });
                      }}
                      className="w-full bg-surface-variant/30 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <div className="md:col-span-2 flex md:justify-end items-end">
                    <span
                      className={cn(
                        'text-[10px] font-bold uppercase px-2 py-1 rounded border',
                        !row.numero_boleto
                          ? 'text-secondary border-secondary/40 bg-secondary/10'
                          : row.duplicate
                            ? 'text-tertiary border-tertiary/40 bg-tertiary/10'
                            : 'text-primary border-primary/40 bg-primary/10'
                      )}
                    >
                      {!row.numero_boleto ? 'Sem número' : row.duplicate ? 'Duplicado' : 'Novo'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-2">
                  <div className="md:col-span-5">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Descrição</p>
                    <input
                      value={row.descricao}
                      onChange={(e) => onUpdateRow(index, { descricao: e.target.value })}
                      placeholder="Descrição do boleto"
                      className="w-full bg-surface-variant/30 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Número do Boleto</p>
                    <input
                      value={row.numero_boleto || ''}
                      onChange={(e) => onUpdateRow(index, { numero_boleto: e.target.value })}
                      placeholder="Nosso número / Nro documento"
                      className="w-full bg-surface-variant/30 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Tipo</p>
                    <select
                      value={row.tipo || 'DESPESA'}
                      onChange={(e) => onUpdateRow(index, { tipo: e.target.value as 'RECEITA' | 'DESPESA', conta_contabil_id: undefined })}
                      className="w-full bg-surface-variant/30 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary text-on-surface"
                      style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}
                    >
                      <option value="DESPESA" style={{ backgroundColor: '#1e1e2e' }}>Despesa</option>
                      <option value="RECEITA" style={{ backgroundColor: '#1e1e2e' }}>Receita</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Empresa</p>
                    <select
                      value={row.empresa}
                      onChange={(e) => onUpdateRow(index, { empresa: e.target.value })}
                      className="w-full bg-surface-variant/30 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary text-on-surface"
                      style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}
                    >
                      <option value="" style={{ backgroundColor: '#1e1e2e' }}>Selecione</option>
                      {companyOptions.map((company) => (
                        <option key={company} value={company} style={{ backgroundColor: '#1e1e2e' }}>{company}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Conta Contábil</p>
                    <select
                      value={row.conta_contabil_id || ''}
                      onChange={(e) => onUpdateRow(index, { conta_contabil_id: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full bg-surface-variant/30 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary text-on-surface"
                      style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}
                    >
                      <option value="" style={{ backgroundColor: '#1e1e2e' }}>Selecione a conta</option>
                      {contasContabeis
                        .filter((conta) => matchesAccountType(conta, (row.tipo || 'DESPESA') as 'RECEITA' | 'DESPESA'))
                        .map((conta) => (
                          <option key={conta.id} value={conta.id} style={{ backgroundColor: '#1e1e2e' }}>
                            {conta.nome}
                          </option>
                        ))}
                    </select>
                  </div>
                  {row.cnpj && (
                    <div className="md:col-span-5 flex items-end">
                      <p className="text-xs text-on-surface-variant">CNPJ: {row.cnpj}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <datalist id="supplier-suggestions">
              {supplierSuggestions.map((nome) => (
                <option key={nome} value={nome} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-surface-variant flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isSaving}
            className="bg-primary text-background px-5 py-2 rounded-lg text-sm font-black uppercase tracking-widest hover:bg-primary-dark transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Salvando...' : 'Confirmar Importação'}
          </button>
        </div>
      </div>
    </div>
  );
};

BoletoImportModal.displayName = 'BoletoImportModal';
export default React.memo(BoletoImportModal);
