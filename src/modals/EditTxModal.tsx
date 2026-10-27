import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Search, ChevronDown, Layers } from 'lucide-react';
import { Transaction, Supplier, Bank, TransactionStatus, ContaContabil } from '../types';
import { cn, normalizeSupplierName, normalizeCompanyKey, todayInputDate, toInputDate, parseMoneyToNumber, matchesAccountType, stripAccents, formatBRL } from '../lib/utils';
import { api } from '../api';

const parseNumeroBoleto = (num?: string) => {
  if (!num) return { numero: '', ocorrencia: '' };
  const parts = num.split('-');
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (last.length <= 4 && /^[0-9a-zA-Z]+$/.test(last)) {
      return {
        numero: parts.slice(0, parts.length - 1).join('-'),
        ocorrencia: last
      };
    }
  }
  const slashParts = num.split('/');
  if (slashParts.length > 1) {
    const last = slashParts[slashParts.length - 1];
    if (last.length <= 4 && /^[0-9a-zA-Z]+$/.test(last)) {
      return {
        numero: slashParts.slice(0, slashParts.length - 1).join('/'),
        ocorrencia: last
      };
    }
  }
  return { numero: num, ocorrencia: '' };
};

interface EditTxModalProps {
  transaction: Transaction;
  suppliers: Supplier[];
  banks: Bank[];
  contasContabeis: ContaContabil[];
  companyOptions: string[];
  onClose: () => void;
  onSave: (
    id: string, 
    data: Partial<Transaction>,
    partialInfo?: {
      saldoRestante: number;
      novoVencimentoSaldo: string;
      originalTx: Transaction;
    }
  ) => Promise<void> | void;
}

const EditTxModal = ({ transaction, suppliers, banks, contasContabeis, companyOptions, onClose, onSave }: EditTxModalProps) => {
  const initialNumInfo = parseNumeroBoleto(transaction.numero_boleto);

  const [formData, setFormData] = useState({
    ...transaction,
    vencimento: toInputDate(transaction.vencimento),
    pagamento: toInputDate(transaction.pagamento),
    valor: String(transaction.valor ?? 0),
    banco: transaction.banco || '',
    tipo: transaction.tipo || 'DESPESA',
    juros: transaction.juros || 0,
    valorPago: transaction.status === 'PAGO' ? String(Number(transaction.valor || 0) + Number(transaction.juros || 0)) : '',
    numero_boleto_base: initialNumInfo.numero,
    ocorrencia: initialNumInfo.ocorrencia,
  });
  const [tipoDiferenca, setTipoDiferenca] = useState<'parcial' | 'desconto'>('parcial');
  const [saldoVencimento, setSaldoVencimento] = useState(toInputDate(transaction.vencimento) || todayInputDate());
  const [searchConta, setSearchConta] = useState('');
  const [showContaDropdown, setShowContaDropdown] = useState(false);
  const [searchSupplier, setSearchSupplier] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const getDefaultContaKey = (empresa: string, tipo: string) =>
    `cn_default_conta_contabil:${normalizeCompanyKey(empresa)}:${String(tipo || '').toUpperCase()}`;

  useEffect(() => {
    const tipo = String(formData.tipo || 'DESPESA') as 'RECEITA' | 'DESPESA';
    const allowed = contasContabeis.filter((c) => c.ativo !== false).filter((c) => matchesAccountType(c, tipo));
    const hasSelected = typeof formData.conta_contabil_id === 'number' && allowed.some((c) => c.id === formData.conta_contabil_id);

    const key = getDefaultContaKey(formData.empresa, tipo);
    const stored = (() => {
      try { return localStorage.getItem(key); } catch { return null; }
    })();
    const storedId = stored ? Number(stored) : NaN;
    const storedValid = Number.isFinite(storedId) && allowed.some((c) => c.id === storedId);

    if (hasSelected) return;
    if (storedValid) {
      setFormData((prev) => ({ ...prev, conta_contabil_id: storedId }));
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

  useEffect(() => {
    const numInfo = parseNumeroBoleto(transaction.numero_boleto);
    setFormData({
      ...transaction,
      vencimento: toInputDate(transaction.vencimento),
      pagamento: toInputDate(transaction.pagamento),
      valor: String(transaction.valor ?? 0),
      banco: transaction.banco || '',
      tipo: transaction.tipo || 'DESPESA',
      juros: transaction.juros || 0,
      valorPago: transaction.status === 'PAGO' ? String(Number(transaction.valor || 0) + Number(transaction.juros || 0)) : '',
      numero_boleto_base: numInfo.numero,
      ocorrencia: numInfo.ocorrencia,
    });
    setSaldoVencimento(toInputDate(transaction.vencimento) || todayInputDate());
    setTipoDiferenca('parcial');
  }, [transaction]);

  // Cálculos de valor original, valor pago e parcial
  const valOriginalNum = useMemo(() => {
    return Number(parseMoneyToNumber(String(formData.valor || 0)).toFixed(2));
  }, [formData.valor]);

  const valPagoNum = useMemo(() => {
    if (!formData.valorPago) return valOriginalNum;
    return Number(parseMoneyToNumber(String(formData.valorPago)).toFixed(2));
  }, [formData.valorPago, valOriginalNum]);

  const isPartial = formData.status === 'PAGO' && valPagoNum > 0 && valPagoNum < (valOriginalNum - 0.009);
  const saldoRestante = isPartial ? Math.round((valOriginalNum - valPagoNum) * 100) / 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    const rawNumero = String(formData.numero_boleto_base || '').trim();
    const occSuffix = formData.ocorrencia ? `-${formData.ocorrencia.trim()}` : '';
    const numeroBoletoFinal = rawNumero ? `${rawNumero}${occSuffix}` : null;

    let finalValor = valOriginalNum;
    let finalJuros = Number(formData.juros || 0);
    let partialInfoToSend: { saldoRestante: number; novoVencimentoSaldo: string; originalTx: Transaction } | undefined = undefined;

    if (isPartial && tipoDiferenca === 'parcial') {
      finalValor = valPagoNum;
      finalJuros = 0;
      partialInfoToSend = {
        saldoRestante,
        novoVencimentoSaldo: saldoVencimento || formData.vencimento,
        originalTx: transaction,
      };
    } else if (isPartial && tipoDiferenca === 'desconto') {
      finalValor = valOriginalNum;
      finalJuros = -saldoRestante;
    } else if (formData.status === 'PAGO' && valPagoNum > valOriginalNum) {
      finalValor = valOriginalNum;
      finalJuros = Math.round((valPagoNum - valOriginalNum) * 100) / 100;
    }

    const { id, ...rest } = {
      ...transaction,
      ...formData,
      vencimento: toInputDate(formData.vencimento),
      pagamento: formData.status === 'PAGO' && formData.pagamento ? toInputDate(formData.pagamento) : null,
      valor: finalValor,
      juros: finalJuros,
      numero_boleto: numeroBoletoFinal
    };
    
    delete (rest as any).numero_boleto_base;
    delete (rest as any).ocorrencia;
    delete (rest as any).valorPago;

    try {
      setIsSaving(true);
      setSaveError('');
      await onSave(String(id), rest, partialInfoToSend);
      onClose();
    } catch (err: any) {
      setSaveError(err?.message || 'Não foi possível salvar as alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-6 md:p-10 w-full max-w-lg border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] my-auto max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-xl font-bold font-headline mb-6">Editar Lançamento</h3>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="new-transaction">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Fornecedor</label>
              <select
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.fornecedor}
                onChange={e => setFormData({ ...formData, fornecedor: e.target.value })}
              >
                <option value={transaction.fornecedor} className="bg-[#161b2a] text-on-surface">{transaction.fornecedor}</option>
                {suppliers.filter(s => s.nome !== transaction.fornecedor).map(s => (
                  <option key={s.id} value={s.nome} className="bg-[#161b2a] text-on-surface">{s.nome}</option>
                ))}
              </select>
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
                {banks.map(b => (
                  <option key={b.id} value={b.nome} className="bg-[#161b2a] text-on-surface">{b.nome}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Descrição</label>
            <input
              type="text" required
              autoComplete="new-transaction"
              className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all"
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
                autoComplete="new-transaction"
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.numero_boleto_base || ''}
                onChange={e => setFormData({ ...formData, numero_boleto_base: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Ocorrência</label>
              <input
                type="text"
                placeholder="Ex: 01"
                autoComplete="new-transaction"
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.ocorrencia || ''}
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
                {companyOptions.map(c => (
                  <option key={c} value={c} className="bg-[#161b2a] text-on-surface">{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Tipo</label>
              <select
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.tipo}
                onChange={e => setFormData({ ...formData, tipo: e.target.value as any })}
              >
                <option value="DESPESA" className="bg-[#161b2a] text-on-surface">Despesa</option>
                <option value="RECEITA" className="bg-[#161b2a] text-on-surface">Receita</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Conta Contábil</label>
              <div className="relative">
                <div
                  className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all cursor-pointer flex justify-between items-center"
                  style={{ backgroundColor: '#161b2a' }}
                  onClick={() => setShowContaDropdown(!showContaDropdown)}
                >
                  <span className={formData.conta_contabil_id ? 'text-on-surface' : 'text-on-surface-variant'}>
                    {formData.conta_contabil_id
                      ? (() => {
                          const conta = contasContabeis.find((c) => c.id === formData.conta_contabil_id);
                          return conta ? `${conta.codigo} - ${conta.nome}` : 'Selecione a conta';
                        })()
                      : 'Selecione a conta'}
                  </span>
                  <ChevronDown className="text-on-surface-variant" size={16} />
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
                          const q = stripAccents(searchConta).toLowerCase();
                          if (!q) return true;
                          return stripAccents(c.codigo).toLowerCase().includes(q) || stripAccents(c.nome).toLowerCase().includes(q);
                        })
                        .map(c => (
                          <div
                            key={c.id}
                            className="px-3 py-2 text-sm hover:bg-white/5 cursor-pointer flex items-center gap-2"
                            style={{ backgroundColor: formData.conta_contabil_id === c.id ? 'rgba(59, 130, 246, 0.2)' : 'transparent' }}
                            onClick={() => {
                              setFormData({ ...formData, conta_contabil_id: c.id });
                              try {
                                localStorage.setItem(getDefaultContaKey(formData.empresa, formData.tipo), String(c.id));
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
              {contasContabeis.filter(c => matchesAccountType(c, formData.tipo)).length === 0 && (
                <p className="text-[10px] text-on-surface-variant mt-1">Nenhuma conta encontrada para {formData.tipo}. Cadastre em Configurações.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Status</label>
              <select
                className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
                style={{ backgroundColor: '#161b2a' }}
                value={formData.status}
                onChange={e => {
                  const newStatus = e.target.value as TransactionStatus;
                  if (newStatus !== 'PAGO') {
                    setFormData({ ...formData, status: newStatus, juros: 0, valorPago: '', pagamento: '' });
                  } else {
                    setFormData({
                      ...formData,
                      status: newStatus,
                      pagamento: formData.pagamento || todayInputDate(),
                      valorPago: formData.valorPago || formData.valor,
                    });
                  }
                }}
              >
                <option value="PENDENTE" className="bg-[#161b2a] text-on-surface">PENDENTE</option>
                <option value="PAGO" className="bg-[#161b2a] text-on-surface">PAGO</option>
                <option value="VENCIDO" className="bg-[#161b2a] text-on-surface">VENCIDO</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Vencimento</label>
              <input
                type="date" required
                autoComplete="new-transaction"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.vencimento}
                onChange={e => setFormData({ ...formData, vencimento: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Valor Total do Título (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                required
                placeholder="0,00"
                autoComplete="new-transaction"
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.valor}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9.,]/g, '');
                  setFormData({ ...formData, valor: raw });
                }}
              />
            </div>
            {formData.status === 'PAGO' && (
              <div className="col-span-2">
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Valor Efetivamente Pago / Recebido (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={formData.valor}
                  autoComplete="new-transaction"
                  className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                  value={formData.valorPago || ''}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9.,]/g, '');
                    const valorPago = raw === '' ? 0 : parseMoneyToNumber(raw);
                    const valorOriginal = parseMoneyToNumber(formData.valor);
                    const jurosCalculado = raw === '' ? 0 : Math.round((valorPago - valorOriginal) * 100) / 100;
                    setFormData({ ...formData, valorPago: raw, juros: jurosCalculado });
                  }}
                />
                {formData.juros > 0 && (
                  <p className="text-[10px] text-tertiary mt-1 font-bold">
                    Juros/Multa: R$ {Number(formData.juros).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                )}
                {formData.juros < 0 && tipoDiferenca === 'desconto' && (
                  <p className="text-[10px] text-success mt-1 font-bold">
                    Desconto: R$ {Number(Math.abs(formData.juros)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Card de Recebimento Parcial Detectado */}
          {isPartial && (
            <div className="p-4 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs space-y-3">
              <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                <Layers size={18} />
                <span>Recebimento / Pagamento Parcial Detectado</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-t border-amber-500/20 text-xs">
                <span className="text-on-surface-variant">Valor pago agora:</span>
                <span className="font-bold text-on-surface">{formatBRL(valPagoNum)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-t border-amber-500/20 text-xs">
                <span className="text-on-surface-variant font-medium">Saldo restante a pagar/receber:</span>
                <span className="font-black text-amber-300 text-base">{formatBRL(saldoRestante)}</span>
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-200">
                  <input
                    type="radio"
                    name="editTipoDiferenca"
                    checked={tipoDiferenca === 'parcial'}
                    onChange={() => setTipoDiferenca('parcial')}
                    className="text-primary focus:ring-primary"
                  />
                  <span>Gerar novo lançamento com o saldo restante ({formatBRL(saldoRestante)})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-on-surface-variant">
                  <input
                    type="radio"
                    name="editTipoDiferenca"
                    checked={tipoDiferenca === 'desconto'}
                    onChange={() => setTipoDiferenca('desconto')}
                  />
                  <span>Dar desconto integral (sem gerar saldo)</span>
                </label>
              </div>
              {tipoDiferenca === 'parcial' && (
                <div className="pt-1.5">
                  <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">
                    Vencimento do Saldo Restante
                  </label>
                  <input
                    type="date"
                    value={saldoVencimento}
                    onChange={(e) => setSaldoVencimento(e.target.value)}
                    className="w-full bg-[#161b2a] border border-amber-500/40 rounded px-3 py-2 text-xs text-on-surface outline-none focus:border-amber-400"
                  />
                  <p className="text-[11px] text-amber-300/90 mt-1">
                    💡 Ao salvar: este lançamento atual fica com valor <strong>{formatBRL(valPagoNum)}</strong> (PAGO) e um novo lançamento de <strong>{formatBRL(saldoRestante)}</strong> será criado automaticamente como <strong>PENDENTE</strong>.
                  </p>
                </div>
              )}
            </div>
          )}

          {formData.status === 'PAGO' && (
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Data de Pagamento</label>
              <input
                type="date" required
                className="w-full bg-surface-variant/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary"
                value={formData.pagamento}
                onChange={e => setFormData({ ...formData, pagamento: e.target.value })}
              />
            </div>
          )}

          {saveError && (
            <p className="text-xs font-bold text-tertiary bg-tertiary/10 border border-tertiary/30 rounded-lg px-4 py-2">
              {saveError}
            </p>
          )}
          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-3 rounded-sm border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all text-on-surface-variant disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-3 rounded-sm bg-primary text-background text-xs font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/10 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

EditTxModal.displayName = 'EditTxModal';
export default React.memo(EditTxModal);
