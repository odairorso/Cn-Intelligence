/**
 * OFXImport.tsx
 * Componente de importação de extrato OFX (Open Financial Exchange)
 * 
 * Como usar:
 * 1. Copie este arquivo para src/OFXImport.tsx
 * 2. Siga as instruções de integração no App.tsx abaixo
 */

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  FileText,
  Check,
  X,
  AlertCircle,
  ArrowRight,
  Loader2,
  Download,
  RefreshCw,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { api } from './api';
import type { Transaction, Supplier, Bank, TransactionStatus } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OFXTransaction {
  fitid: string;         // ID único do OFX
  dtposted: string;      // Data da transação (YYYYMMDD ou YYYYMMDDHHMMSS)
  trnamt: number;        // Valor (positivo = crédito, negativo = débito)
  trntype: string;       // DEBIT | CREDIT | INT | DIV | FEE | etc
  memo: string;          // Descrição original do banco
  // Campos preenchidos pelo usuário na revisão:
  fornecedor: string;
  descricao: string;
  empresa: string;
  status: TransactionStatus;
  banco: string;
  tipo: 'DESPESA' | 'RECEITA';
  vencimento: string;    // formato DD/MM/AAAA para a API
  duplicate: boolean;
  selected: boolean;
}

// ---------------------------------------------------------------------------
// OFX Parser (sem dependências externas)
// ---------------------------------------------------------------------------

function parseOFXDate(raw: string): string {
  // Formatos: YYYYMMDDHHMMSS, YYYYMMDD, YYYYMMDD[+-]HH:MM
  const clean = raw.trim().replace(/\[.*\]/, '');
  const year  = clean.slice(0, 4);
  const month = clean.slice(4, 6);
  const day   = clean.slice(6, 8);
  return `${day}/${month}/${year}`;
}

function getTagValue(content: string, tag: string): string {
  // Suporta tanto SGML (<TAG>value) quanto XML (<TAG>value</TAG>)
  const upper = content.toUpperCase();
  const openTag = `<${tag.toUpperCase()}>`;
  const idx = upper.indexOf(openTag);
  if (idx === -1) return '';
  const start = idx + openTag.length;
  // Procura fechamento explícito ou quebra de linha / próxima tag
  const closeTag = `</${tag.toUpperCase()}>`;
  const closeIdx = upper.indexOf(closeTag, start);
  const nextTagIdx = upper.indexOf('<', start);
  const end = closeIdx !== -1
    ? closeIdx
    : nextTagIdx !== -1 ? nextTagIdx : content.length;
  return content.slice(start, end).trim();
}

function parseOFX(raw: string): OFXTransaction[] {
  // Normaliza quebras de linha
  const content = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Extrai bloco de transações (BANKTRANLIST ou INVTRANLIST)
  const blockStart = content.toUpperCase().indexOf('<BANKTRANLIST>');
  const blockEnd   = content.toUpperCase().indexOf('</BANKTRANLIST>');
  const block = blockStart !== -1 && blockEnd !== -1
    ? content.slice(blockStart, blockEnd)
    : content;

  // Divide por <STMTTRN>
  const rawTxs = block.split(/<\/?STMTTRN>/i).filter((_, i) => i % 2 === 1);

  return rawTxs.map((txRaw) => {
    const fitid   = getTagValue(txRaw, 'FITID')   || `ofx_${Math.random().toString(36).slice(2)}`;
    const dtraw   = getTagValue(txRaw, 'DTPOSTED') || getTagValue(txRaw, 'DTTRADE') || '';
    const amtRaw  = getTagValue(txRaw, 'TRNAMT')  || '0';
    const trntype = getTagValue(txRaw, 'TRNTYPE') || 'OTHER';
    const memo    = getTagValue(txRaw, 'MEMO')    || getTagValue(txRaw, 'NAME') || 'Sem descrição';

    const trnamt   = parseFloat(amtRaw.replace(',', '.')) || 0;
    const dtposted = dtraw ? parseOFXDate(dtraw) : '';

    const isCredit = trnamt > 0 || trntype === 'CREDIT' || trntype === 'INT' || trntype === 'DIV';

    return {
      fitid,
      dtposted,
      trnamt,
      trntype,
      memo,
      fornecedor: memo.slice(0, 60),
      descricao: memo,
      empresa: 'CN',
      status: 'PENDENTE' as TransactionStatus,
      banco: '',
      tipo: isCredit ? 'RECEITA' : 'DESPESA',
      vencimento: dtposted,
      duplicate: false,
      selected: true,
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (v: number) =>
  Math.abs(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const EMPRESAS = ['CN', 'FACEMS', 'LAB', 'CEI', 'UNOPAR'];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface OFXImportProps {
  transactions: Transaction[];   // existentes, para detectar duplicatas
  suppliers: Supplier[];
  banks: Bank[];
  onSuccess: () => void;
  showNotification: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const OFXImportTab: React.FC<OFXImportProps> = ({
  transactions,
  suppliers,
  banks,
  onSuccess,
  showNotification,
}) => {
  const [ofxRows, setOfxRows]     = useState<OFXTransaction[]>([]);
  const [loading, setLoading]     = useState(false);
  const [fileName, setFileName]   = useState('');
  const [step, setStep]           = useState<'upload' | 'review' | 'done'>('upload');
  const [importCount, setImportCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeSearchIdx, setActiveSearchIdx] = useState(-1);
  const [searchTerm, setSearchTerm] = useState('');

  const normalizeSupplierName = (v: string) =>
    String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // ── Detect duplicates ──────────────────────────────────────────────────
  const isDuplicate = useCallback(
    (row: OFXTransaction) => {
      return transactions.some(
        (tx) =>
          tx.descricao?.includes(row.fitid) ||
          (tx.valor === Math.abs(row.trnamt) &&
            tx.vencimento === row.dtposted &&
            tx.fornecedor.toUpperCase() === row.fornecedor.toUpperCase())
      );
    },
    [transactions]
  );

  // ── File handler ───────────────────────────────────────────────────────
  const handleFile = useCallback(
    async (file: File) => {
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.ofx') &&
          !file.name.toLowerCase().endsWith('.qfx') &&
          !file.name.toLowerCase().endsWith('.ofc')) {
        showNotification('Selecione um arquivo OFX, QFX ou OFC válido.', 'error');
        return;
      }

      setLoading(true);
      setFileName(file.name);

      try {
        const text = await file.text();
        const parsed = parseOFX(text);

        if (!parsed.length) {
          showNotification('Nenhuma transação encontrada no arquivo OFX.', 'error');
          setLoading(false);
          return;
        }

        const withDuplicates = parsed.map((row) => ({
          ...row,
          duplicate: isDuplicate(row),
          selected: !isDuplicate(row),   // Pré-seleciona apenas os não-duplicados
        }));

        setOfxRows(withDuplicates);
        setStep('review');
        showNotification(
          `${parsed.length} transação(ões) lida(s). Revise antes de importar.`,
          'success'
        );
      } catch (err) {
        console.error(err);
        showNotification('Erro ao processar o arquivo OFX.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [isDuplicate, showNotification]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  // ── Drag & Drop ────────────────────────────────────────────────────────
  const [dragging, setDragging] = useState(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  // ── Row edit helpers ───────────────────────────────────────────────────
  const updateRow = (idx: number, patch: Partial<OFXTransaction>) =>
    setOfxRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const toggleSelect = (idx: number) =>
    updateRow(idx, { selected: !ofxRows[idx].selected });

  const toggleAll = () => {
    const allSelected = ofxRows.filter((r) => !r.duplicate).every((r) => r.selected);
    setOfxRows((prev) =>
      prev.map((r) => (r.duplicate ? r : { ...r, selected: !allSelected }))
    );
  };

  // ── Confirm import ─────────────────────────────────────────────────────
  const handleConfirm = async () => {
    const toImport = ofxRows.filter((r) => r.selected && !r.duplicate);
    if (!toImport.length) {
      showNotification('Nenhuma transação selecionada para importar.', 'info');
      return;
    }

    setLoading(true);
    try {
      const txList = toImport.map((row) => ({
        uid: 'guest',
        fornecedor: row.fornecedor,
        descricao: `${row.descricao} [OFX:${row.fitid}]`,
        empresa: row.empresa,
        vencimento: row.vencimento,
        pagamento: row.status === 'PAGO' ? row.vencimento : (null as any),
        valor: Math.abs(row.trnamt),
        status: row.status,
        banco: row.banco || (null as any),
        tipo: row.tipo,
      }));

      if (txList.length === 1) {
        await api.createTransaction(txList[0]);
      } else {
        await api.createTransactionsBatch(txList as any);
      }

      setImportCount(txList.length);
      setStep('done');
      onSuccess();
      showNotification(`${txList.length} lançamento(s) importado(s) com sucesso!`, 'success');
    } catch (err) {
      console.error(err);
      showNotification('Erro ao importar lançamentos. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setOfxRows([]);
    setFileName('');
    setStep('upload');
    setImportCount(0);
  };

  // ── Counters ───────────────────────────────────────────────────────────
  const totalRows    = ofxRows.length;
  const dupRows      = ofxRows.filter((r) => r.duplicate).length;
  const selectedRows = ofxRows.filter((r) => r.selected && !r.duplicate).length;
  const creditSum    = ofxRows.filter((r) => r.selected && r.trnamt > 0).reduce((s, r) => s + r.trnamt, 0);
  const debitSum     = ofxRows.filter((r) => r.selected && r.trnamt < 0).reduce((s, r) => s + Math.abs(r.trnamt), 0);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-12">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-black font-headline premium-gradient-text tracking-tighter">
          Importar Extrato OFX
        </h2>
        <p className="text-xs text-on-surface-variant/60 uppercase tracking-widest mt-1">
          Importe extratos bancários no formato OFX / QFX e lance direto no sistema
        </p>
      </div>

      <AnimatePresence mode="wait">

        {/* ─── Step: Upload ─────────────────────────────────────────────── */}
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'glass-card border-2 border-dashed rounded-xl p-16 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200',
                dragging
                  ? 'border-primary bg-primary/5 scale-[1.01]'
                  : 'border-white/10 hover:border-primary/50 hover:bg-primary/5'
              )}
            >
              {loading ? (
                <Loader2 size={48} className="text-primary animate-spin" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Upload size={36} className="text-primary" />
                </div>
              )}
              <div className="text-center">
                <p className="text-lg font-bold text-on-surface">
                  {loading ? 'Processando extrato...' : 'Arraste o arquivo OFX aqui'}
                </p>
                <p className="text-sm text-on-surface-variant/60 mt-1">
                  ou clique para selecionar — Aceita .ofx, .qfx, .ofc
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".ofx,.qfx,.ofc"
                className="hidden"
                onChange={onFileChange}
              />
            </div>

            {/* Info boxes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  icon: <FileText size={20} className="text-primary" />,
                  title: 'O que é OFX?',
                  desc: 'Formato padrão de extrato bancário eletrônico. A maioria dos bancos disponibiliza no internet banking.',
                },
                {
                  icon: <Check size={20} className="text-primary" />,
                  title: 'Revisão antes de importar',
                  desc: 'Você pode revisar, editar empresa, status e fornecedor de cada transação antes de confirmar.',
                },
                {
                  icon: <AlertCircle size={20} className="text-secondary" />,
                  title: 'Detecção de duplicatas',
                  desc: 'Transações já existentes no sistema são identificadas automaticamente e ficam desabilitadas.',
                },
              ].map((item, i) => (
                <div key={i} className="glass-card p-5 flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">{item.title}</p>
                    <p className="text-xs text-on-surface-variant/60 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── Step: Review ─────────────────────────────────────────────── */}
        {step === 'review' && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Summary bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total no arquivo', value: totalRows, color: 'text-on-surface' },
                { label: 'Duplicatas', value: dupRows, color: 'text-secondary' },
                { label: 'Selecionados', value: selectedRows, color: 'text-primary' },
                { label: 'Créditos', value: fmt(creditSum), color: 'text-primary', sub: `Débitos: ${fmt(debitSum)}` },
              ].map((s, i) => (
                <div key={i} className="glass-card p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50 mb-1">{s.label}</p>
                  <p className={cn('text-xl font-black font-headline', s.color)}>{s.value}</p>
                  {s.sub && <p className="text-[10px] text-tertiary mt-0.5">{s.sub}</p>}
                </div>
              ))}
            </div>

            {/* File info + action buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FileText size={16} className="text-primary" />
                </div>
                <span className="text-sm font-bold text-on-surface-variant">{fileName}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-on-surface-variant hover:bg-white/5 border border-white/10 transition-all"
                >
                  <RefreshCw size={14} /> Trocar arquivo
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading || selectedRows === 0}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-black uppercase tracking-widest transition-all',
                    selectedRows > 0 && !loading
                      ? 'bg-primary text-background hover:bg-primary/80'
                      : 'bg-white/10 text-on-surface-variant cursor-not-allowed'
                  )}
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ArrowRight size={14} />
                  )}
                  {loading ? 'Importando...' : `Importar ${selectedRows} lançamento(s)`}
                </button>
              </div>
            </div>

            {/* Table header */}
            <div className="glass-card overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                <button
                  onClick={toggleAll}
                  className="w-5 h-5 rounded border border-white/20 flex items-center justify-center hover:border-primary transition-all flex-shrink-0"
                >
                  {ofxRows.filter((r) => !r.duplicate).every((r) => r.selected) && (
                    <Check size={12} className="text-primary" />
                  )}
                </button>
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40">
                  Selecionar todos
                </span>
              </div>

              <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto">
                {ofxRows.map((row, idx) => (
                  <div
                    key={row.fitid}
                    className={cn(
                      'p-4 transition-all',
                      row.duplicate
                        ? 'opacity-40'
                        : row.selected
                        ? 'bg-primary/5 hover:bg-primary/8'
                        : 'hover:bg-white/5'
                    )}
                  >
                    {/* Row top */}
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        disabled={row.duplicate}
                        onClick={() => toggleSelect(idx)}
                        className={cn(
                          'mt-1 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all',
                          row.duplicate
                            ? 'border-white/10 cursor-not-allowed'
                            : row.selected
                            ? 'border-primary bg-primary/20'
                            : 'border-white/20 hover:border-primary'
                        )}
                      >
                        {row.selected && !row.duplicate && <Check size={12} className="text-primary" />}
                      </button>

                      {/* Icon */}
                      <div
                        className={cn(
                          'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                          row.trnamt > 0 ? 'bg-primary/10' : 'bg-tertiary/10'
                        )}
                      >
                        {row.trnamt > 0 ? (
                          <TrendingUp size={16} className="text-primary" />
                        ) : (
                          <TrendingDown size={16} className="text-tertiary" />
                        )}
                      </div>

                      {/* Editable fields */}
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2 min-w-0">
                        {/* Date (read-only) */}
                        <div className="md:col-span-2">
                          <p className="text-[9px] font-bold uppercase text-on-surface-variant/50 mb-1">Data</p>
                          <p className="text-xs font-bold text-on-surface">{row.dtposted}</p>
                        </div>

                        {/* Fornecedor */}
                        <div className="md:col-span-3">
                          <p className="text-[9px] font-bold uppercase text-on-surface-variant/50 mb-1">Fornecedor / Sacado</p>
                          <div className="relative">
                            <input
                              value={row.fornecedor}
                              onChange={(e) => {
                                updateRow(idx, { fornecedor: e.target.value });
                                setActiveSearchIdx(idx);
                                setSearchTerm(e.target.value);
                              }}
                              onFocus={() => { setActiveSearchIdx(idx); setSearchTerm(row.fornecedor); }}
                              placeholder="Digite para buscar fornecedor..."
                              className="w-full bg-surface-variant/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary"
                              disabled={row.duplicate}
                            />
                            {activeSearchIdx === idx && searchTerm && (
                              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1e1e2e] border border-white/10 rounded-lg shadow-2xl max-h-40 overflow-y-auto">
                                {suppliers
                                  .filter(s => normalizeSupplierName(s.nome).includes(normalizeSupplierName(searchTerm)))
                                  .slice(0, 8)
                                  .map(s => (
                                    <button
                                      key={s.id || s.nome}
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-primary/20 hover:text-primary transition-colors truncate"
                                      onClick={() => {
                                        updateRow(idx, { fornecedor: s.nome });
                                        setActiveSearchIdx(-1);
                                        setSearchTerm('');
                                      }}
                                    >
                                      {s.nome}
                                    </button>
                                  ))}
                                {suppliers.filter(s => normalizeSupplierName(s.nome).includes(normalizeSupplierName(searchTerm))).length === 0 && (
                                  <p className="px-3 py-2 text-xs text-on-surface-variant italic">Nenhum fornecedor encontrado</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Descrição */}
                        <div className="md:col-span-3">
                          <p className="text-[9px] font-bold uppercase text-on-surface-variant/50 mb-1">Descrição</p>
                          <input
                            value={row.descricao}
                            onChange={(e) => updateRow(idx, { descricao: e.target.value })}
                            className="w-full bg-surface-variant/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary"
                            disabled={row.duplicate}
                          />
                        </div>

                        {/* Empresa */}
                        <div className="md:col-span-2">
                          <p className="text-[9px] font-bold uppercase text-on-surface-variant/50 mb-1">Empresa</p>
                          <select
                            value={row.empresa}
                            onChange={(e) => updateRow(idx, { empresa: e.target.value })}
                            className="w-full bg-surface-variant/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary text-on-surface"
                            style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}
                            disabled={row.duplicate}
                          >
                            {EMPRESAS.map((emp) => (
                              <option key={emp} value={emp} style={{ backgroundColor: '#1e1e2e' }}>
                                {emp}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Status */}
                        <div className="md:col-span-2">
                          <p className="text-[9px] font-bold uppercase text-on-surface-variant/50 mb-1">Status</p>
                          <select
                            value={row.status}
                            onChange={(e) => updateRow(idx, { status: e.target.value as TransactionStatus })}
                            className="w-full bg-surface-variant/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary text-on-surface"
                            style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}
                            disabled={row.duplicate}
                          >
                            <option value="PENDENTE" style={{ backgroundColor: '#1e1e2e' }}>PENDENTE</option>
                            <option value="PAGO"     style={{ backgroundColor: '#1e1e2e' }}>PAGO</option>
                            <option value="VENCIDO"  style={{ backgroundColor: '#1e1e2e' }}>VENCIDO</option>
                          </select>
                        </div>
                      </div>

                      {/* Value + badges */}
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0 min-w-[100px]">
                        <span
                          className={cn(
                            'text-sm font-black font-headline',
                            row.trnamt > 0 ? 'text-primary' : 'text-tertiary'
                          )}
                        >
                          {row.trnamt > 0 ? '+' : '-'}{fmt(row.trnamt)}
                        </span>
                        {row.duplicate && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-secondary/10 text-secondary border border-secondary/30">
                            Duplicado
                          </span>
                        )}
                        {/* Banco */}
                        <select
                          value={row.banco}
                          onChange={(e) => updateRow(idx, { banco: e.target.value })}
                          className="w-full bg-surface-variant/20 border border-white/5 rounded px-1.5 py-1 text-[10px] outline-none focus:border-primary text-on-surface-variant"
                          style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}
                          disabled={row.duplicate}
                        >
                          <option value="" style={{ backgroundColor: '#1e1e2e' }}>Banco...</option>
                          {banks.map((b) => (
                            <option key={b.id} value={b.nome} style={{ backgroundColor: '#1e1e2e' }}>
                              {b.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <datalist id="ofx-supplier-suggestions">
              {suppliers.map((s) => (
                <option key={s.id || s.nome} value={s.nome} />
              ))}
            </datalist>
          </motion.div>
        )}

        {/* ─── Step: Done ───────────────────────────────────────────────── */}
        {step === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-6"
          >
            <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
              <Check size={48} className="text-primary" />
            </div>
            <div className="text-center">
              <h3 className="text-3xl font-black font-headline premium-gradient-text">
                Importação concluída!
              </h3>
              <p className="text-on-surface-variant/60 mt-2 text-sm">
                {importCount} lançamento(s) adicionado(s) ao sistema com sucesso.
              </p>
            </div>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-background font-black uppercase tracking-widest text-sm hover:bg-primary/80 transition-all"
            >
              <Upload size={16} /> Importar outro extrato
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

export default OFXImportTab;

/**
 * ════════════════════════════════════════════════════════════
 * INSTRUÇÕES DE INTEGRAÇÃO NO App.tsx
 * ════════════════════════════════════════════════════════════
 *
 * 1. IMPORT (no topo do App.tsx, junto com os outros imports):
 *
 *    import { OFXImportTab } from './OFXImport';
 *
 * 2. TIPO Tab (linha ~173):
 *    Adicione 'extrato' ao union type:
 *
 *    type Tab = 'dashboard' | 'lancamentos' | 'fornecedores' | 'relatorios'
 *             | 'receitas' | 'bancos' | 'extrato' | 'configuracoes';
 *
 * 3. BOTÃO NO MENU DESKTOP (dentro do <nav className="hidden lg:flex...">):
 *    Cole após o botão de "Bancos":
 *
 *    <button
 *      onClick={() => setActiveTab('extrato')}
 *      className={cn("transition-all duration-200 font-medium text-sm",
 *        activeTab === 'extrato' ? "text-primary border-b-2 border-primary pb-1"
 *                                : "text-on-surface-variant hover:text-white")}
 *    >
 *      Extrato OFX
 *    </button>
 *
 * 4. BOTÃO NO MENU MOBILE (dentro do <nav className="lg:hidden fixed...">):
 *    Cole após o ícone de Bancos:
 *
 *    <button
 *      onClick={() => setActiveTab('extrato')}
 *      className={cn("flex flex-col items-center gap-1 transition-all",
 *        activeTab === 'extrato' ? "text-primary scale-110" : "text-on-surface-variant opacity-60")}
 *    >
 *      <Download size={22} strokeWidth={activeTab === 'extrato' ? 3 : 2} />
 *      <span className="text-[9px] font-black uppercase tracking-tighter">OFX</span>
 *    </button>
 *
 *    (Adicione Download ao import do lucide-react se ainda não tiver)
 *
 * 5. RENDERIZAÇÃO DA ABA (dentro do bloco de switch/ternários de abas):
 *    Procure onde está o bloco que renderiza cada aba (ex: activeTab === 'bancos' && ...)
 *    e adicione:
 *
 *    {activeTab === 'extrato' && (
 *      <OFXImportTab
 *        transactions={transactions}
 *        suppliers={suppliers}
 *        banks={banks}
 *        onSuccess={() => { fetchTransactions(); }}
 *        showNotification={showNotification}
 *      />
 *    )}
 *
 * ════════════════════════════════════════════════════════════
 */
