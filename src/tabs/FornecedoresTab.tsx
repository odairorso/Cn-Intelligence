import React, { useState, useMemo } from 'react';
import { Search, FileText, HelpCircle, Edit, Trash2, UserPlus, RefreshCw, Merge } from 'lucide-react';
import { motion } from 'motion/react';
import { Supplier, Transaction } from '../types';
import { cn, normalizeSupplierName } from '../lib/utils';
import { apiAuth } from '../api';

interface FornecedoresTabProps {
  suppliers: Supplier[];
  transactions: Transaction[];
  deleteSupplier: (id: string) => void;
  setShowNewSupplierModal: (show: boolean) => void;
  syncSuppliers: () => void;
  mergeSuppliers: (target: string, aliases: string[]) => Promise<{ updated: number; removed: number }>;
  mergeSuppliersAuto: () => Promise<{ updated: number; removed: number }>;
  onSelectSupplier: (s: Supplier) => void;
  onEditSupplier: (s: Supplier) => void;
}

const FornecedoresTab = ({ suppliers, transactions, deleteSupplier, setShowNewSupplierModal, syncSuppliers, mergeSuppliers, mergeSuppliersAuto, onSelectSupplier, onEditSupplier }: FornecedoresTabProps) => {
  const [searchSupplier, setSearchSupplier] = useState('');
  const [mergeTarget, setMergeTarget] = useState<string>('');
  const [mergeAliases, setMergeAliases] = useState<string[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [manualMergeTarget, setManualMergeTarget] = useState('');
  const [manualMergeAlias, setManualMergeAlias] = useState('');
  const [manualMergeTargetSearch, setManualMergeTargetSearch] = useState('');
  const [manualMergeAliasSearch, setManualMergeAliasSearch] = useState('');
  const [merging, setMerging] = useState(false);
  const [autoMerging, setAutoMerging] = useState(false);

  // Pre-calculate transaction count per supplier (optimized O(n) instead of O(n*m))
  const supplierTransactionCount = useMemo(() => {
    const countMap = new Map<string, number>();
    transactions.forEach(tx => {
      const key = normalizeSupplierName(tx.fornecedor);
      if (key) {
        countMap.set(key, (countMap.get(key) || 0) + 1);
      }
    });
    return countMap;
  }, [transactions]);

  // Fast lookup for transaction count
  const getTransactionCount = (s: Supplier): number => {
    if (typeof s.transaction_count === 'number') {
      return s.transaction_count;
    }
    const key = normalizeSupplierName(s.nome);
    return supplierTransactionCount.get(key) || 0;
  };

  const mergedSuppliers = useMemo(() => {
    const byKey = new Map<string, Supplier>();

    // Add real suppliers first
    suppliers.forEach((s) => {
      const key = normalizeSupplierName(s.nome);
      if (!key) return;
      byKey.set(key, s);
    });

    // Only add virtual suppliers from transactions if not already in suppliers
    // Limit to first 500 unique to avoid performance issues with large datasets
    let virtualCount = 0;
    const seenVirtual = new Set<string>();

    for (const tx of transactions) {
      if (virtualCount >= 500) break; // Limit virtual suppliers

      const key = normalizeSupplierName(tx.fornecedor);
      if (!key || byKey.has(key) || seenVirtual.has(key)) continue;

      seenVirtual.add(key);
      byKey.set(key, {
        id: `virtual-${key}`,
        uid: apiAuth.getUid() || 'guest',
        nome: tx.fornecedor,
        cnpj: '',
        email: '',
        telefone: ''
      });
      virtualCount++;
    }

    return Array.from(byKey.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [suppliers, transactions]);

  const filteredSuppliers = useMemo(() => {
    const q = normalizeSupplierName(searchSupplier);
    if (!q) return mergedSuppliers;
    return mergedSuppliers.filter((s) => normalizeSupplierName(s.nome).includes(q));
  }, [mergedSuppliers, searchSupplier]);

  const duplicateGroups = useMemo(() => {
    const map = new Map<string, Set<string>>();

    // Only process suppliers, not virtual ones
    suppliers.forEach((s) => {
      if (s.id?.startsWith('virtual-')) return; // Skip virtual suppliers

      const key = normalizeSupplierName(s.nome);
      if (!key) return;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(s.nome);
    });

    const out: Array<{ key: string; names: string[] }> = [];
    map.forEach((set, key) => {
      if (set.size <= 1) return; // Skip singles
      const arr = Array.from(set.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      out.push({ key, names: arr });
    });

    return out.sort((a, b) => a.names[0].localeCompare(b.names[0], 'pt-BR'));
  }, [suppliers]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-bold font-headline">Gestão de Fornecedores</h3>
          <button
            onClick={syncSuppliers}
            className="bg-white/5 text-on-surface-variant px-4 py-2 rounded-sm text-xs font-bold flex items-center gap-2 hover:bg-white/10 transition-colors"
            title="Sincronizar fornecedores dos lançamentos"
          >
            <RefreshCw size={14} /> Sincronizar
          </button>
          <button
            onClick={async () => {
              if (autoMerging) return;
              try {
                setAutoMerging(true);
                await mergeSuppliersAuto();
                await syncSuppliers();
              } catch (e) {
                console.error('Auto merge error', e);
              } finally {
                setAutoMerging(false);
              }
            }}
            className="bg-primary/10 text-primary px-4 py-2 rounded-sm text-xs font-bold flex items-center gap-2 hover:bg-primary/20 transition-colors"
            title="Unificar variações automaticamente"
          >
            <Merge size={14} /> {autoMerging ? 'Unificando...' : 'Unificar Auto'}
          </button>
          <button
            onClick={() => { setManualMergeTarget(''); setManualMergeAlias(''); setManualMergeTargetSearch(''); setManualMergeAliasSearch(''); setShowMergeModal(true); }}
            className="bg-secondary/10 text-secondary px-4 py-2 rounded-sm text-xs font-bold flex items-center gap-2 hover:bg-secondary/20 transition-colors"
            title="Unificar dois fornecedores manualmente"
          >
            <Merge size={14} /> Unificar Manual
          </button>
        </div>
        <button
          onClick={() => setShowNewSupplierModal(true)}
          className="bg-primary text-background px-6 py-2.5 rounded-sm text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-primary-dark transition-all"
        >
          <UserPlus size={18} /> Novo Fornecedor
        </button>
      </div>

      <div className="glass-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={16} />
          <input
            value={searchSupplier}
            onChange={(e) => setSearchSupplier(e.target.value)}
            placeholder="Buscar fornecedor..."
            className="w-full bg-surface-variant/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {duplicateGroups.length > 0 && (
        <div className="glass-card p-4">
          <h4 className="text-sm font-bold text-on-surface mb-3">Unificar Fornecedores Duplicados</h4>
          <div className="space-y-3">
            {duplicateGroups.map((g, idx) => (
              <div key={g.key} className="flex flex-wrap items-center gap-2 border border-white/10 rounded-lg p-3">
                <select
                  value={mergeTarget && g.names.includes(mergeTarget) ? mergeTarget : g.names[0]}
                  onChange={(e) => setMergeTarget(e.target.value)}
                  className="bg-surface-variant/20 border border-white/10 rounded px-2 py-1 text-xs"
                >
                  {g.names.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase">← manter</span>
                <div className="flex flex-wrap gap-2">
                  {g.names.map((n) => (
                    <label key={n} className="inline-flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={mergeAliases.includes(n)}
                        onChange={(e) => {
                          setMergeAliases((prev) => e.target.checked ? Array.from(new Set([...prev, n])) : prev.filter((x) => x !== n));
                        }}
                      />
                      <span className="px-2 py-1 rounded bg-surface-variant/20 border border-white/10">{n}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={async () => {
                    const target = mergeTarget && g.names.includes(mergeTarget) ? mergeTarget : g.names[0];
                    const toMerge = mergeAliases.filter((n) => n !== target && g.names.includes(n));
                    try {
                      await mergeSuppliers(target, toMerge);
                      setMergeAliases([]);
                      setMergeTarget('');
                      await syncSuppliers();
                    } catch {
                    }
                  }}
                  className="ml-auto bg-primary/10 text-primary px-3 py-1.5 rounded text-xs font-bold border border-primary/20 hover:bg-primary/20"
                >
                  Unificar Selecionados
                </button>
              </div>
            ))}
            {duplicateGroups.length === 0 && (
              <p className="text-xs text-on-surface-variant">Sem duplicados detectados.</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSuppliers.map(s => (
          <div key={s.id || normalizeSupplierName(s.nome)} className="glass-card p-6 flex flex-col gap-4 relative group cursor-pointer hover:border-primary/40" onClick={() => onSelectSupplier(s)}>
            {s.id && !String(s.id).startsWith('virtual-') && (
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); onEditSupplier(s); }}
                  className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-sm"
                  title="Editar"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSupplier(s.id); }}
                  className="p-2 text-tertiary hover:bg-tertiary/10 rounded-sm"
                  title="Excluir"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-sm bg-primary/20 flex items-center justify-center text-primary font-bold text-xl border border-primary/10">
                {s.nome.charAt(0)}
              </div>
              <div>
                <h4 className="font-bold text-on-surface">{s.nome}</h4>
                <p className="text-[10px] font-black text-on-surface-variant/60 tracking-wider mt-0.5">{s.cnpj || 'CNPJ NÃO INFORMADO'}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm mt-2">
              <p className="flex items-center gap-2 text-on-surface-variant/80 text-xs font-medium">
                <FileText size={14} className="opacity-40" /> {s.email || 'E-mail não informado'}
              </p>
              <p className="flex items-center gap-2 text-on-surface-variant/80 text-xs font-medium">
                <HelpCircle size={14} className="opacity-40" /> {s.telefone || 'Telefone não informado'}
              </p>
            </div>
            <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                {getTransactionCount(s)} Lançamentos
              </p>
              <button className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest hover:text-primary transition-colors">
                Detalhes →
              </button>
            </div>
          </div>
        ))}
        {filteredSuppliers.length === 0 && (
          <div className="col-span-full text-center text-on-surface-variant py-12 italic">
            Nenhum fornecedor encontrado para a busca.
          </div>
        )}
      </div>

      {/* Modal de Unificação Manual */}
      {showMergeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-card p-8 w-full max-w-md border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          >
            <h3 className="text-xl font-bold font-headline mb-2">Unificar Fornecedores</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              Todos os lançamentos do fornecedor <span className="text-tertiary font-bold">a remover</span> serão migrados para o <span className="text-primary font-bold">nome final</span>.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Nome final (manter)</label>
                <input
                  value={manualMergeTargetSearch}
                  onChange={e => setManualMergeTargetSearch(e.target.value)}
                  placeholder="Buscar fornecedor..."
                  className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary mb-2"
                />
                <select
                  value={manualMergeTarget}
                  onChange={e => setManualMergeTarget(e.target.value)}
                  className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="">Selecione o fornecedor...</option>
                  {[...new Set([...suppliers.map(s => s.nome), ...transactions.map(t => t.fornecedor)])]
                    .filter(Boolean)
                    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
                    .filter(n => {
                      const q = normalizeSupplierName(manualMergeTargetSearch);
                      if (!q) return true;
                      return normalizeSupplierName(n).includes(q);
                    })
                    .map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Fornecedor a remover (alias)</label>
                <input
                  value={manualMergeAliasSearch}
                  onChange={e => setManualMergeAliasSearch(e.target.value)}
                  placeholder="Buscar fornecedor..."
                  className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary mb-2"
                />
                <select
                  value={manualMergeAlias}
                  onChange={e => setManualMergeAlias(e.target.value)}
                  className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="">Selecione o fornecedor...</option>
                  {[...new Set([...suppliers.map(s => s.nome), ...transactions.map(t => t.fornecedor)])]
                    .filter(Boolean)
                    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
                    .filter(n => n !== manualMergeTarget)
                    .filter(n => {
                      const q = normalizeSupplierName(manualMergeAliasSearch);
                      if (!q) return true;
                      return normalizeSupplierName(n).includes(q);
                    })
                    .map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                </select>
              </div>
            </div>

            {manualMergeTarget && manualMergeAlias && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-6 text-xs text-on-surface-variant">
                Todos os lançamentos de <span className="font-bold text-tertiary">"{manualMergeAlias}"</span> passarão a se chamar <span className="font-bold text-primary">"{manualMergeTarget}"</span>.
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowMergeModal(false)}
                className="flex-1 px-4 py-3 rounded-sm border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all text-on-surface-variant"
              >
                Cancelar
              </button>
              <button
                disabled={!manualMergeTarget || !manualMergeAlias || merging}
                onClick={async () => {
                  if (!manualMergeTarget || !manualMergeAlias) return;
                  setMerging(true);
                  try {
                    await mergeSuppliers(manualMergeTarget, [manualMergeAlias]);
                    setShowMergeModal(false);
                    setManualMergeTargetSearch('');
                    setManualMergeAliasSearch('');
                    await syncSuppliers();
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setMerging(false);
                  }
                }}
                className="flex-1 px-4 py-3 rounded-sm bg-primary text-background text-xs font-black uppercase tracking-widest hover:bg-primary-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {merging ? 'Unificando...' : 'Confirmar'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const FornecedoresTabMemo = React.memo(FornecedoresTab);
FornecedoresTabMemo.displayName = 'FornecedoresTab';

export default FornecedoresTabMemo;
