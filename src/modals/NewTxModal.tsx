import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { Search, ChevronDown } from 'lucide-react';
import { Transaction, Supplier, Bank, TransactionStatus, ContaContabil } from '../types';
import { cn, normalizeSupplierName, normalizeCompanyKey, todayInputDate, toInputDate, parseMoneyToNumber, matchesAccountType } from '../lib/utils';
import { api, apiAuth } from '../api';

interface NewTxModalProps {
  suppliers: Supplier[];
  banks: Bank[];
  contasContabeis: ContaContabil[];
  companyOptions: string[];
  setShowNewTxModal: (show: boolean) => void;
  onSuccess: () => void;
  initialTipo?: 'DESPESA' | 'RECEITA';
}

function incrementDocumentNumber(base: string, offset: number): string {
  if (!base) return '';
  if (offset === 0) return base;
  const match = base.match(/(\d+)(?!.*\d)/);
  if (!match) return base;
  const numStr = match[1];
  const numVal = parseInt(numStr, 10) + offset;
  const paddedNumStr = String(numVal).padStart(numStr.length, '0');
  const index = match.index ?? 0;
  return base.slice(0, index) + paddedNumStr + base.slice(index + numStr.length);
}

const NewTxModal = ({ suppliers, banks, contasContabeis, companyOptions, setShowNewTxModal, onSuccess, initialTipo = 'DESPESA' }: NewTxModalProps) => {
  const [formData, setFormData] = useState({
    fornecedor: '',
    descricao: '',
    empresa: companyOptions[0] || 'CN',
    vencimento: todayInputDate(),
    pagamento: '',
    valor: '',
    parcelas: '1',
    valorTipo: 'parcela' as 'parcela' | 'total',
    status: 'PENDENTE' as TransactionStatus,
    banco: '',
    tipo: initialTipo as 'RECEITA' | 'DESPESA',
    conta_contabil_id: undefined as number | undefined,
    numero_boleto: '',
    ocorrencia: '',
  });
  const [searchConta, setSearchConta] = useState('');
  const [showContaDropdown, setShowContaDropdown] = useState(false);
  const [searchSupplier, setSearchSupplier] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const GLOBAL_CONTA_KEY = 'cn_last_selected_conta_contabil';

  useEffect(() => {
    const allowed = contasContabeis.filter((c) => c.ativo !== false).filter((c) => matchesAccountType(c, formData.tipo));
    const hasSelected = typeof formData.conta_contabil_id === 'number' && allowed.some((c) => c.id === formData.conta_contabil_id);

    // 1. Tentar carregar a última selecionada globalmente
    const storedGlobal = (() => {
      try { return localStorage.getItem(GLOBAL_CONTA_KEY); } catch { return null; }
    })();
    const globalId = storedGlobal ? Number(storedGlobal) : NaN;
    const globalValid = Number.isFinite(globalId) && allowed.some((c) => c.id === globalId);

    // 2. Se não houver global, tenta por empresa (legado)
    const companyKey = `cn_default_conta_contabil:${normalizeCompanyKey(formData.empresa)}:${String(formData.tipo || '').toUpperCase()}`;
    const storedCompany = (() => {
      try { return localStorage.getItem(companyKey); } catch { return null; }
    })();
    const companyId = storedCompany ? Number(storedCompany) : NaN;
    const companyValid = Number.isFinite(companyId) && allowed.some((c) => c.id === companyId);

    if (hasSelected) return;

    if (globalValid) {
      setFormData((prev) => ({ ...prev, conta_contabil_id: globalId }));
      return;
    }

    if (companyValid) {
      setFormData((prev) => ({ ...prev, conta_contabil_id: companyId }));
      return;
    }

    if (typeof formData.conta_contabil_id === 'number' && !hasSelected) {
      setFormData((prev) => ({ ...prev, conta_contabil_id: undefined }));
    }
  }, [formData.empresa, formData.tipo, contasContabeis]);

  const filteredSuppliers = useMemo(() => {
    const q = normalizeSupplierName(searchSupplier);
    const byKey = new Map<string, Supplier>();
    for (const s of suppliers) {
      const key = normalizeSupplierName(s.nome);
      if (!key) continue;
      if (q && !key.includes(q)) continue;
      if (!byKey.has(key)) byKey.set(key, s);
    }
    return Array.from(byKey.values())
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
      .slice(0, 100);
  }, [suppliers, searchSupplier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const fornecedorRaw = String(formData.fornecedor || '').trim();
      const fornecedorKey = normalizeSupplierName(fornecedorRaw);
      let fornecedorFinal = fornecedorRaw;
      if (fornecedorKey && fornecedorKey.length >= 3) {
        const exact = suppliers.find((s) => normalizeSupplierName(s.nome) === fornecedorKey);
        if (exact?.nome) {
          fornecedorFinal = exact.nome;
        } else {
          const candidates = suppliers.filter((s) => normalizeSupplierName(s.nome).includes(fornecedorKey));
          if (candidates.length === 1 && candidates[0]?.nome) {
            fornecedorFinal = candidates[0].nome;
          }
        }
      }

      const parcelas = Math.max(1, Number(formData.parcelas) || 1);
      const addMonthsToInputDate = (baseDate: string, monthsToAdd: number) => {
        const [year, month, day] = baseDate.split('-').map(Number);
        const dt = new Date(Date.UTC(year, (month || 1) - 1 + monthsToAdd, day || 1));
        const yyyy = dt.getUTCFullYear();
        const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(dt.getUTCDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };
      const newTxList = Array.from({ length: parcelas }, (_, i) => {
        const vencimentoParcela = addMonthsToInputDate(formData.vencimento, i);
        const pagamentoParcela = formData.status === 'PAGO'
          ? (formData.pagamento ? addMonthsToInputDate(formData.pagamento, i) : todayInputDate())
          : '';

        const rawNumero = String(formData.numero_boleto || '').trim();
        const baseNumber = formData.ocorrencia ? `${rawNumero}-${formData.ocorrencia.trim()}` : rawNumero;

        return {
          uid: apiAuth.getUid() || 'guest',
          fornecedor: fornecedorFinal,
          descricao: formData.descricao,
          empresa: formData.empresa,
          vencimento: toInputDate(vencimentoParcela),
          pagamento: formData.status === 'PAGO' ? toInputDate(pagamentoParcela) : null,
          valor: formData.valorTipo === 'total' ? Number((parseMoneyToNumber(formData.valor) / parcelas).toFixed(2)) : parseMoneyToNumber(formData.valor),
          status: formData.status,
          banco: formData.status === 'PAGO' ? formData.banco : null,
          tipo: formData.tipo,
          conta_contabil_id: formData.conta_contabil_id,
          numero_boleto: baseNumber ? incrementDocumentNumber(baseNumber, i) : null
        };
      });

      if (newTxList.length === 1) {
        await api.createTransaction(newTxList[0]);
      } else {
        await api.createTransactionsBatch(newTxList);
      }
      setShowNewTxModal(false);
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create transaction:', error);
      alert(error.message || 'Erro ao criar o lançamento. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-10 w-full max-w-lg border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-y-auto max-h-[90vh]"

      >
        <h3 className="text-xl font-bold font-headline mb-6">Novo Lançamento</h3>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Fornecedor</label>
              <div className="relative">
                <input
                  type="text" required
                  placeholder="Buscar fornecedor..."
                  autoComplete="chrome-off"
                  className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface"
                  style={{ backgroundColor: '#161b2a' }}
                  value={formData.fornecedor}
                  onChange={e => {
                    setFormData({ ...formData, fornecedor: e.target.value });
                    setSearchSupplier(e.target.value);
                  }}
                  onFocus={() => setSearchSupplier(formData.fornecedor)}
                />
                {searchSupplier && (
                  <div className="absolute z-[110] w-full mt-1 bg-[#161b2a] border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {filteredSuppliers.length > 0 ? (
                      filteredSuppliers.map(s => (
                        <div
                          key={s.id}
                          className="px-4 py-2 text-sm hover:bg-white/5 cursor-pointer text-on-surface"
                          onClick={() => {
                            setFormData({ ...formData, fornecedor: s.nome });
                            setSearchSupplier('');
                          }}
                        >
                          {s.nome}
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-sm text-on-surface-variant italic">
                        Nenhum fornecedor encontrado (será criado um novo)
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Banco / Conta</label>
              <select
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.banco}
                onChange={e => setFormData({ ...formData, banco: e.target.value })}
              >
                <option value="" className="bg-[#161b2a] text-on-surface">Não informado</option>
                {banks.filter(b => b.ativo).map(b => (
                  <option key={b.id} value={b.nome} className="bg-[#161b2a] text-on-surface">{b.nome}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Descrição</label>
            <input
              type="text" required
              autoComplete="chrome-off"
              className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
              value={formData.descricao}
              onChange={e => setFormData({ ...formData, descricao: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Número / Título</label>
              <input
                type="text"
                placeholder="Ex: 123456"
                autoComplete="chrome-off"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary text-on-surface"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.numero_boleto}
                onChange={e => setFormData({ ...formData, numero_boleto: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                Ocorrência {Number(formData.parcelas) > 1 && <span className="text-[10px] text-primary">(Auto)</span>}
              </label>
              <input
                type="text"
                placeholder="Ex: 01"
                disabled={Number(formData.parcelas) > 1}
                autoComplete="chrome-off"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary text-on-surface disabled:opacity-50"
                style={{ backgroundColor: '#161b2a' }}
                value={Number(formData.parcelas) > 1 ? 'Auto' : formData.ocorrencia}
                onChange={e => setFormData({ ...formData, ocorrencia: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Empresa</label>
              <select
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.empresa}
                onChange={e => setFormData({ ...formData, empresa: e.target.value })}
              >
                {companyOptions.map((company) => (
                  <option key={company} value={company} className="bg-[#161b2a]">{company}</option>
                ))}
              </select>

            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Tipo</label>
              <select
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.tipo}
                onChange={e => setFormData({ ...formData, tipo: e.target.value as 'RECEITA' | 'DESPESA' })}
              >
                <option value="DESPESA" className="bg-[#161b2a] text-on-surface">Despesa</option>
                <option value="RECEITA" className="bg-[#161b2a] text-on-surface">Receita</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Conta Contábil</label>
            <div className="relative">
              <div
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm cursor-pointer flex justify-between items-center"
                style={{ backgroundColor: '#161b2a' }}
                onClick={() => setShowContaDropdown(!showContaDropdown)}
              >
                <span className={formData.conta_contabil_id ? 'text-on-surface' : 'text-on-surface-variant'}>
                  {formData.conta_contabil_id
                    ? contasContabeis.find(c => c.id === formData.conta_contabil_id)?.nome
                    : 'Selecione a conta'}
                </span>
                <ChevronDown size={14} className="text-on-surface-variant" />
              </div>
              {showContaDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-[#161b2a] border border-white/10 rounded-lg shadow-xl max-h-60 overflow-hidden">
                  <div className="p-2 border-b border-white/10">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={14} />
                      <input
                        type="text"
                        placeholder="Buscar conta..."
                        value={searchConta}
                        onChange={(e) => setSearchConta(e.target.value)}
                        className="w-full bg-surface-variant/20 border border-white/10 rounded pl-8 pr-3 py-1.5 text-sm outline-none focus:border-primary"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-44 overflow-y-auto">
                    <div
                      className="px-3 py-2 text-sm text-on-surface-variant hover:bg-white/5 cursor-pointer"
                      onClick={() => {
                        setFormData({ ...formData, conta_contabil_id: undefined });
                        setShowContaDropdown(false);
                        setSearchConta('');
                      }}
                    >
                      Selecione a conta
                    </div>
                    {contasContabeis
                      .filter(c => c.ativo !== false)
                      .filter(c => matchesAccountType(c, formData.tipo))
                      .filter(c => {
                        const q = searchConta.toLowerCase();
                        if (!q) return true;
                        return c.codigo.toLowerCase().includes(q) || c.nome.toLowerCase().includes(q);
                      })
                      .map(c => (
                        <div
                          key={c.id}
                          className="px-3 py-2 text-sm hover:bg-white/5 cursor-pointer flex items-center gap-2"
                          style={{ backgroundColor: formData.conta_contabil_id === c.id ? 'rgba(59, 130, 246, 0.2)' : 'transparent' }}
                          onClick={() => {
                            setFormData({ ...formData, conta_contabil_id: c.id });
                            try {
                              localStorage.setItem(GLOBAL_CONTA_KEY, String(c.id));
                              localStorage.setItem(
                                `cn_default_conta_contabil:${normalizeCompanyKey(formData.empresa)}:${String(formData.tipo || '').toUpperCase()}`,
                                String(c.id)
                              );
                            } catch {}
                            setShowContaDropdown(false);
                            setSearchConta('');
                          }}
                        >
                          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{c.codigo}</span>
                          <span>{c.nome}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Status</label>
              <select
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value as TransactionStatus })}
              >
                <option value="PENDENTE" className="bg-[#161b2a] text-on-surface">PENDENTE</option>
                <option value="PAGO" className="bg-[#161b2a] text-on-surface">PAGO</option>
              </select>

            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Vencimento</label>
              <input
                type="date" required
                autoComplete="chrome-off"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.vencimento}
                onChange={e => setFormData({ ...formData, vencimento: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Valor (R$)</label>
              <input
                type="number" step="0.01" required
                autoComplete="chrome-off"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.valor}
                onChange={e => setFormData({ ...formData, valor: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Parcelas</label>
              <input
                type="number"
                min={1}
                step={1}
                autoComplete="chrome-off"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.parcelas}
                onChange={e => setFormData({ ...formData, parcelas: e.target.value })}
              />
            </div>
          </div>
          {Number(formData.parcelas) > 1 && (
            <div className="flex items-center gap-3 p-3 bg-surface-variant/10 rounded-lg border border-white/5">
              <span className="text-xs font-bold text-on-surface-variant uppercase">Tipo do valor:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="valorTipo"
                  value="parcela"
                  checked={formData.valorTipo === 'parcela'}
                  onChange={() => setFormData({ ...formData, valorTipo: 'parcela' })}
                  className="accent-primary"
                />
                <span className="text-xs text-on-surface">Por parcela</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="valorTipo"
                  value="total"
                  checked={formData.valorTipo === 'total'}
                  onChange={() => setFormData({ ...formData, valorTipo: 'total' })}
                  className="accent-primary"
                />
                <span className="text-xs text-on-surface">Valor total (divide)</span>
              </label>
              {formData.valorTipo === 'total' && formData.valor && (
                <span className="text-[10px] text-primary ml-auto">
                  = R$ {(Number(formData.valor) / Number(formData.parcelas)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/parcela
                </span>
              )}
            </div>
          )}
          {formData.status === 'PAGO' && (
            <>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Data de Pagamento</label>
                <input
                  type="date" required
                  autoComplete="chrome-off"
                  className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                  value={formData.pagamento}
                  onChange={e => setFormData({ ...formData, pagamento: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Banco</label>
                <select
                  className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                  style={{ backgroundColor: '#161b2a' }}
                  value={formData.banco}
                  onChange={e => setFormData({ ...formData, banco: e.target.value })}
                  required
                >
                  <option value="" className="bg-[#161b2a] text-on-surface">Selecione...</option>
                  {banks.filter(b => b.ativo).map(b => (
                    <option key={b.id} value={b.nome} className="bg-[#161b2a] text-on-surface">{b.nome}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowNewTxModal(false)}
              className="flex-1 px-4 py-3 rounded-sm border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all text-on-surface-variant"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 rounded-sm bg-primary text-background text-xs font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Lançamento'}
            </button>
          </div>

        </form>
      </motion.div>
    </div>
  );
};

NewTxModal.displayName = 'NewTxModal';
export default React.memo(NewTxModal);
