import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, FileText, Building2, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatBRL } from '../lib/utils';
import type { Transaction, Supplier, Bank } from '../types';

interface GlobalSearchProps {
  transactions: Transaction[];
  suppliers: Supplier[];
  banks: Bank[];
  onNavigate: (tab: string) => void;
}

export function GlobalSearch({ transactions, suppliers, banks, onNavigate }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K abre
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setQuery('');
  }, [open]);

  const q = query.toLowerCase().trim();

  const txResults = q.length >= 2
    ? transactions.filter(tx =>
        tx.fornecedor.toLowerCase().includes(q) ||
        (tx.descricao || '').toLowerCase().includes(q)
      ).slice(0, 5)
    : [];

  const supResults = q.length >= 2
    ? suppliers.filter(s => s.nome.toLowerCase().includes(q)).slice(0, 3)
    : [];

  const hasResults = txResults.length > 0 || supResults.length > 0;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-on-surface-variant hover:bg-white/10 hover:border-primary/30 transition-all"
        title="Busca global (Ctrl+K)"
      >
        <Search size={13} />
        <span>Buscar...</span>
        <kbd className="ml-2 text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
      </button>
    );
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-start justify-center pt-24 px-4" onClick={() => setOpen(false)}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-xl bg-surface border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
            <Search size={16} className="text-on-surface-variant flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar fornecedor, lançamento..."
              className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none"
            />
            <button onClick={() => setOpen(false)} className="text-on-surface-variant hover:text-on-surface">
              <X size={16} />
            </button>
          </div>

          {/* Resultados */}
          {q.length >= 2 && (
            <div className="max-h-80 overflow-y-auto">
              {!hasResults && (
                <p className="px-4 py-6 text-center text-sm text-on-surface-variant/50">Nenhum resultado encontrado</p>
              )}

              {txResults.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40">Lançamentos</p>
                  {txResults.map(tx => (
                    <button
                      key={tx.id}
                      onClick={() => { onNavigate('lancamentos'); setOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        tx.status === 'PAGO' ? "bg-primary/20" : tx.status === 'VENCIDO' ? "bg-tertiary/20" : "bg-secondary/20"
                      )}>
                        <FileText size={14} className={tx.status === 'PAGO' ? "text-primary" : tx.status === 'VENCIDO' ? "text-tertiary" : "text-secondary"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{tx.fornecedor}</p>
                        <p className="text-[11px] text-on-surface-variant/60">{tx.vencimento} · {tx.empresa}</p>
                      </div>
                      <span className={cn("text-sm font-bold flex-shrink-0", tx.status === 'VENCIDO' ? "text-tertiary" : "text-primary")}>
                        {formatBRL(tx.valor)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {supResults.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40">Fornecedores</p>
                  {supResults.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { onNavigate('fornecedores'); setOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 size={14} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{s.nome}</p>
                        <p className="text-[11px] text-on-surface-variant/60">{s.cnpj || 'CNPJ não informado'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {q.length < 2 && (
            <div className="px-4 py-4 flex gap-4 text-[11px] text-on-surface-variant/40">
              <span>↵ selecionar</span>
              <span>ESC fechar</span>
              <span>Ctrl+K alternar</span>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
