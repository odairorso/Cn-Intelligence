// v1.2.0 - Performance: lazy loading tabs + extracted components
import React, { useState, useRef, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import {
  LayoutDashboard, FileText, Building2, Settings, Bell, Wallet,
  HelpCircle, TrendingUp, TrendingDown, CheckCircle, Calendar,
  Upload, ChevronDown, Download, Plus, Trash2, Check, Search,
  BarChart3, PieChart as PieChartIcon, UserPlus, FileSpreadsheet,
  X, Edit, RefreshCw, CreditCard, FileUp, Loader2, Printer, Merge
} from 'lucide-react';
import readXlsxFile from 'read-excel-file/browser';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { motion, AnimatePresence } from 'motion/react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

import { Transaction, KPI, Supplier, TransactionStatus, Bank, ContaContabil } from './types';
import { api, apiAuth } from './api';
import { OFXImportTab } from './OFXImport';
import { useAppData } from './hooks/useAppData';
import {
  cn, toInputDate, toDisplayDate, dateSortKey,
  normalizeSupplierName, normalizeCompanyKey,
  isSupplierMatch, isRevenueTransaction, matchesAccountType, formatBRL, todayInputDate, parseMoneyToNumber,
} from './lib/utils';
import { DEFAULT_COMPANIES } from './lib/constants';
import { GlobalSearch } from './components/GlobalSearch';
import { AuthGuard } from './components/AuthGuard';
import {
  normalizeBoletoNumber,
  extractLocalBoletoNumber,
  parseLinhaDigitavel,
  shouldRejectSupplierName,
  resolveSupplierName,
  supplierFromFileName,
  extractBoletoData,
  type PdfImportDraft
} from './lib/boletoParser';

// Lazy-loaded tabs
const DashboardTab = lazy(() => import('./tabs/DashboardTab'));
const LancamentosTab = lazy(() => import('./tabs/LancamentosTab'));
const FornecedoresTab = lazy(() => import('./tabs/FornecedoresTab'));
const RelatoriosTab = lazy(() => import('./tabs/RelatoriosTab'));
const ReceitasTab = lazy(() => import('./tabs/ReceitasTab'));
const BancosTab = lazy(() => import('./tabs/BancosTab'));

// Lazy-loaded modals
const NewTxModal = lazy(() => import('./modals/NewTxModal'));
const EditTxModal = lazy(() => import('./modals/EditTxModal'));
const SelectBankModal = lazy(() => import('./modals/SelectBankModal'));
const NewBankModal = lazy(() => import('./modals/NewBankModal'));
const EditBankModal = lazy(() => import('./modals/EditBankModal'));
const TransferModal = lazy(() => import('./modals/TransferModal'));
const SupplierDetailModal = lazy(() => import('./modals/SupplierDetailModal'));
const NewSupplierModal = lazy(() => import('./modals/NewSupplierModal'));
const EditSupplierModal = lazy(() => import('./modals/EditSupplierModal'));

const TabFallback = () => (
  <div className="flex items-center justify-center py-32">
    <Loader2 size={32} className="text-primary animate-spin" />
  </div>
);

const ModalFallback = () => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
    <Loader2 size={32} className="text-primary animate-spin" />
  </div>
);

const defaultBrandLogo = new URL('../Logo Cn/WhatsApp Image 2021-02-10 at 10.34.53.jpeg', import.meta.url).href;

// --- Types ---
type Tab = 'dashboard' | 'lancamentos' | 'fornecedores' | 'relatorios' | 'receitas' | 'bancos' | 'extrato' | 'configuracoes';

// --- All tab & modal components extracted to tabs/ and modals/ ---
// --- Main App ---

export default function App() {
  const {
    transactions, globalStats, suppliers, banks, contasContabeis, companyOptions, notification, isLoading, isLoadingMore, hasMoreTransactions, boletoPatterns, isAuthorized,
    fetchTransactions, fetchSuppliers, fetchBanks, fetchContasContabeis, fetchBoletoPatterns, fetchStats,
    showNotification, login, logout, markAsPaid, markAsPaidBatch, updateTransaction, deleteTransaction,
    deleteSupplier, syncSuppliers, mergeSuppliers, mergeSuppliersAuto, updateSupplier,
    deleteBank,
    addCompanyOption, removeCompanyOption, updateCompanyOption,
    deleteBoletoPattern,
  } = useAppData();
  const safeCompanyOptions = Array.isArray(companyOptions) ? companyOptions : [];
  const safeContasContabeis = Array.isArray(contasContabeis) ? contasContabeis : [];
  const safeBoletoPatterns = Array.isArray(boletoPatterns) ? boletoPatterns : [];
  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
  const safeBanks = Array.isArray(banks) ? banks : [];
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [editingCompany, setEditingCompany] = useState<string | null>(null);
  const [editingCompanyName, setEditingCompanyName] = useState('');
  const [newContaContabil, setNewContaContabil] = useState({ codigo: '', nome: '', tipo: 'DESPESA' });
  const [searchContaContabil, setSearchContaContabil] = useState('');
  const [brandLogo, setBrandLogo] = useState<string>(() => {
    try { return localStorage.getItem('cn_brand_logo') || ''; } catch { return ''; }
  });

  const [showNewTxModal, setShowNewTxModal] = useState(false);
  const [newTxInitialTipo, setNewTxInitialTipo] = useState<'DESPESA' | 'RECEITA'>('DESPESA');
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [showNewBankModal, setShowNewBankModal] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [showPayModal, setShowPayModal] = useState<{ id: string; valor: number; vencimento?: string } | null>(null);
  const [showPayBatchModal, setShowPayBatchModal] = useState<Transaction[] | null>(null);
  const [showPdfImportModal, setShowPdfImportModal] = useState(false);
  const [pdfExtractedRows, setPdfExtractedRows] = useState<PdfImportDraft[]>([]);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const currentBrandLogo = brandLogo || defaultBrandLogo;

  useEffect(() => {
    if (!isAuthorized) return;
    if (!showNewTxModal) return;
    if (banks.length > 0) return;
    fetchBanks(true);
  }, [showNewTxModal, isAuthorized, banks.length, fetchBanks]);


  const addContaContabil = async () => {
    if (!newContaContabil.codigo || !newContaContabil.nome) {
      showNotification('Informe o código e o nome da conta.', 'error');
      return;
    }
    try {
      await api.createContaContabil({
        codigo: newContaContabil.codigo,
        nome: newContaContabil.nome,
        tipo: newContaContabil.tipo as 'RECEITA' | 'DESPESA',
      });
      showNotification('Conta contábil adicionada!', 'success');
      setNewContaContabil({ codigo: '', nome: '', tipo: 'DESPESA' });
      fetchContasContabeis();
    } catch {
      showNotification('Erro ao adicionar conta contábil.', 'error');
    }
  };

  const deleteContaContabil = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta conta?')) return;
    try {
      await api.updateContaContabil(id, { ativo: false });
      showNotification('Conta contábil excluída!', 'success');
      fetchContasContabeis();
    } catch {
      showNotification('Erro ao excluir conta contábil.', 'error');
    }
  };

  const startEditCompany = (name: string) => {
    setEditingCompany(name);
    setEditingCompanyName(name);
  };

  const saveEditCompany = (originalName: string) => {
    const ok = updateCompanyOption(originalName, editingCompanyName);
    if (ok) {
      setEditingCompany(null);
      setEditingCompanyName('');
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotification('Selecione um arquivo de imagem válido.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setBrandLogo(dataUrl);
      try { localStorage.setItem('cn_brand_logo', dataUrl); } catch { /* ignore */ }
      showNotification('Logo atualizada com sucesso!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setBrandLogo('');
    try {
      localStorage.removeItem('cn_brand_logo');
    } catch {
    }
    showNotification('Logo removida.', 'info');
  };

  const handleExportBackup = async () => {
    try {
      showNotification('Gerando backup... Aguarde.', 'info');
      const blob = await api.exportBackup();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      a.download = `backup-cn-intelligence-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showNotification('Backup exportado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao exportar backup:', error);
      showNotification('Erro ao exportar backup. Tente novamente.', 'error');
    }
  };

  const handleTransferSubmit = async (data: { originBank: string, destBank: string, originCompany: string, destCompany: string, value: number, date: string, description: string }) => {
    try {
      const isoDate = toInputDate(data.date);
      
      const batch = [
        {
          uid: apiAuth.getUid() || 'guest',
          fornecedor: `TRANSF: ${data.destBank} (${data.destCompany})`,
          descricao: data.description,
          empresa: data.originCompany,
          vencimento: isoDate,
          pagamento: isoDate,
          valor: data.value,
          status: 'PAGO' as TransactionStatus,
          banco: data.originBank,
          tipo: 'TRANSFERENCIA' as any
        },
        {
          uid: apiAuth.getUid() || 'guest',
          fornecedor: `TRANSF: ${data.originBank} (${data.originCompany})`,
          descricao: data.description,
          empresa: data.destCompany,
          vencimento: isoDate,
          pagamento: isoDate,
          valor: data.value,
          status: 'PAGO' as TransactionStatus,
          banco: data.destBank,
          tipo: 'TRANSFERENCIA' as any
        }
      ];

      (batch[1] as any).valor = -data.value; // Credit is negative so when subtracted it adds.

      await api.createTransactionsBatch(batch as any);
      setShowTransferModal(false);
      showNotification('Transferência realizada com sucesso!', 'success');
      fetchTransactions();
      fetchBanks();
      fetchStats();
    } catch (error) {
      console.error('Erro na transferência:', error);
      showNotification('Erro ao realizar transferência.', 'error');
    }
  };

  // --- Handlers ---



  const boletoDuplicateKey = (fornecedor: string, vencimento: string, valor: number, numeroBoleto?: string, descricao?: string, empresa?: string) => {
    const normalizedNumber = normalizeBoletoNumber(numeroBoleto);
    if (normalizedNumber) return `BOLETO:${normalizedNumber}`;
    const desc = normalizeSupplierName(descricao || '');
    const emp = normalizeSupplierName(empresa || '');
    return `BASE:${normalizeSupplierName(fornecedor)}|${vencimento}|${Number(valor || 0).toFixed(2)}|${desc}|${emp}`;
  };

  const getExistingBoletoKeys = () =>
    new Set(
      transactions
        .map((tx) => boletoDuplicateKey(tx.fornecedor, tx.vencimento, tx.valor, tx.numero_boleto, tx.descricao, tx.empresa))
        .filter((key): key is string => Boolean(key))
    );

  const applyDuplicateFlags = (rows: PdfImportDraft[]) => {
    const existingKeys = getExistingBoletoKeys();
    const batchKeys = new Set<string>();
    return rows.map((row) => {
      const numero_boleto = normalizeBoletoNumber(row.numero_boleto);
      const key = boletoDuplicateKey(row.fornecedor, row.vencimento, row.valor, numero_boleto, row.descricao, row.empresa);
      const duplicate = existingKeys.has(key) || batchKeys.has(key);
      batchKeys.add(key);
      return { ...row, numero_boleto, duplicate };
    });
  };

  const updatePdfRow = (index: number, patch: Partial<PdfImportDraft>) => {
    setPdfExtractedRows((prev) =>
      applyDuplicateFlags(prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
    );
  };

  const shouldRejectSupplierName = (name: string) => {
    const value = String(name || '').trim().toUpperCase();
    if (!value || value.length < 4) return true;
    if (value.includes('DATA DO DOCUMENTO') || value.includes('VENCIMENTO') || value.includes('NOSSO NUMERO')) return true;
    if (value.includes('AGENCIA') || value.includes('CÓDIGO') || value.includes('CODIGO') || value.includes('BENEFICI')) return true;
    if (value.includes('LOCAL DE PAGAMENTO') || value.includes('PAGAVEL') || value.includes('INSTRUCOES')) return true;
    if (value.includes('ESPECIE') || value.includes('CARTEIRA') || value.includes('USO DO BANCO')) return true;
    if (value.includes('AVENIDA') || value.includes(' AV ') || value.includes('AV.') || value.includes('RUA') || value.includes('CEP')) return true;
    const onlyNumericLike = value.replace(/[^0-9]/g, '').length >= Math.max(8, value.length - 2);
    if (onlyNumericLike) return true;
    if ((value.match(/[A-Z]/g) || []).length < 3) return true;
    return false;
  };

  const resolveSupplierName = (detectedName: string, sourceText: string, suppliers: Supplier[]) => {
    const cleanDetected = String(detectedName || '').trim();
    const validDetected = shouldRejectSupplierName(cleanDetected) ? '' : cleanDetected;
    const normalizedDetected = normalizeSupplierName(validDetected);
    const normalizedSource = normalizeSupplierName(sourceText);

    if (validDetected && normalizedDetected) {
      const exact = suppliers.find((s) => normalizeSupplierName(s.nome) === normalizedDetected);
      if (exact) return exact.nome;
    }

    if (normalizedDetected.includes('ENERGISA') || normalizedSource.includes('ENERGISA')) {
      const energisaMatch = suppliers
        .map((s) => ({ supplier: s, key: normalizeSupplierName(s.nome) }))
        .filter((x) => x.key.includes('ENERGISA'))
        .sort((a, b) => b.key.length - a.key.length)[0];
      if (energisaMatch) return energisaMatch.supplier.nome;
      return 'ENERGISA';
    }

    if (normalizedDetected.includes('SANESUL') || normalizedSource.includes('SANESUL')) {
      const sanesulMatch = suppliers
        .map((s) => ({ supplier: s, key: normalizeSupplierName(s.nome) }))
        .filter((x) => x.key.includes('SANESUL'))
        .sort((a, b) => b.key.length - a.key.length)[0];
      if (sanesulMatch) return sanesulMatch.supplier.nome;
      return 'SANESUL';
    }

    if (normalizedDetected.includes('INVIO') || normalizedSource.includes('INVIO')) {
      const invMatch = suppliers
        .map((s) => ({ supplier: s, key: normalizeSupplierName(s.nome) }))
        .filter((x) => x.key.includes('INVIO'))
        .sort((a, b) => b.key.length - a.key.length)[0];
      if (invMatch) return invMatch.supplier.nome;
      return validDetected || 'INVIOLAVEL';
    }

    if (validDetected) {
      const best = suppliers
        .map((s) => ({ supplier: s, key: normalizeSupplierName(s.nome) }))
        .filter((x) => x.key && (x.key.includes(normalizedDetected) || normalizedDetected.includes(x.key)))
        .sort((a, b) => b.key.length - a.key.length)[0];
      if (best && normalizedDetected.length >= 6) return best.supplier.nome;
    }

    if ((normalizedDetected === 'EDITORA' || !validDetected) && normalizedSource.includes('EDITORA')) {
      const editoraCandidates = suppliers
        .map((s) => ({ supplier: s, key: normalizeSupplierName(s.nome) }))
        .filter((x) => x.key.includes('EDITORA'))
        .sort((a, b) => b.key.length - a.key.length);
      if (editoraCandidates.length === 1) return editoraCandidates[0].supplier.nome;
    }

    if (!validDetected || validDetected === 'Fornecedor não identificado') {
      const byText = suppliers
        .map((s) => ({ supplier: s, key: normalizeSupplierName(s.nome) }))
        .filter((x) => x.key.length >= 5 && normalizedSource.includes(x.key))
        .sort((a, b) => b.key.length - a.key.length)[0];
      if (byText) return byText.supplier.nome;
    }

    return validDetected || 'Fornecedor não identificado';
  };

  const supplierFromFileName = (fileName: string): string => {
    let name = String(fileName || '').replace(/\.pdf$/i, '');
    name = name.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    name = name.replace(/^\d{10,}\s*/i, '').trim();
    name = name.replace(/^\d{6,}\s*/i, '').trim();
    name = name.replace(/^(?:BOLETO|BOL|MAT|MATRICULA|PAGAMENTO|PAGAR)\b[\s\-_:]*/i, '').trim();
    while (/^(BOL|BOLETO|MAT)\b/i.test(name)) {
      name = name.replace(/^(BOL|BOLETO|MAT)\b[\s\-_:]*/i, '').trim();
    }
    name = name.replace(/^\d{6,}\s*/i, '').trim();
    name = name.replace(/[\s\-_:]*(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)$/i, '').trim();
    return name;
  };


  const extractBoletoWithGemini = async (text: string, fileName: string, pdfBase64?: string): Promise<PdfImportDraft> => {
    const sanitizeBoletoValor = (v: any) => {
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) && n > 0 && n <= 500000 ? n : 0;
    };

    try {
      const local = extractBoletoData(text, fileName, safeSuppliers);

      // Sempre envia o PDF em base64 para o Gemini (visão computacional é muito mais precisa)
      const payload = { text, fileName, pdfBase64 };

      const data = await api.extractBoleto(payload.text, payload.fileName, (payload as any).pdfBase64);
      const dataAny = data as any;

      const beneficiario = String(dataAny.beneficiario || dataAny.cedente || '').trim().replace(/\s+/g, ' ');
      const fornecedorCandidate = (!shouldRejectSupplierName(beneficiario) && beneficiario)
        ? beneficiario
        : dataAny.fornecedor;

      const pagadorCandidate = String(dataAny.pagador || '').trim().replace(/\s+/g, ' ');
      const hasValidPagador = pagadorCandidate.length >= 5 && /[A-Z\u00C0-\u017E]/i.test(pagadorCandidate);

      const hasValidData =
        fornecedorCandidate &&
        fornecedorCandidate !== 'Fornecedor não identificado' &&
        (sanitizeBoletoValor(dataAny.valor) > 0 || Boolean(dataAny.vencimento));

      if (hasValidData) {
        const fallbackNumero = extractLocalBoletoNumber(text);
        const inferredFromDescricao = normalizeBoletoNumber(dataAny.descricao || '');
        const numero = normalizeBoletoNumber(dataAny.numero_boleto || '') || fallbackNumero || inferredFromDescricao;
        const fallbackDesc = supplierFromFileName(fileName) || fileName.replace(/\.pdf$/i, '').trim();
        const descricao = hasValidPagador ? pagadorCandidate : ((dataAny.descricao && dataAny.descricao !== '-') ? dataAny.descricao : fallbackDesc);
        const linhaInfo = parseLinhaDigitavel(text);
        const geminiValor = sanitizeBoletoValor(dataAny.valor);
        const valor = (linhaInfo?.valor && (!geminiValor || geminiValor > 20000))
          ? sanitizeBoletoValor(linhaInfo.valor)
          : geminiValor;
        return {
          fileName,
          fornecedor: (fornecedorCandidate && fornecedorCandidate !== 'Fornecedor não identificado') ? fornecedorCandidate : (local.fornecedor !== 'Fornecedor não identificado' ? local.fornecedor : 'Fornecedor não identificado'),
          vencimento: String(dataAny.vencimento || local.vencimento || ''),
          valor,
          descricao: (descricao && descricao !== 'Fornecedor não identificado') ? descricao : local.descricao,
          empresa: String(dataAny.empresa || ''),
          cnpj: String(dataAny.cnpj || ''),
          numero_boleto: numero,
          conta_contabil_id: dataAny.conta_contabil_id ? Number(dataAny.conta_contabil_id) : undefined,
          tipo: 'DESPESA',
          rawText: text.slice(0, 500),
          duplicate: false,
        };
      }

      console.log('[boleto] Gemini returned empty data, using local fallback');
      const fallback = extractBoletoData(text, fileName, safeSuppliers);
      // Se nem o fallback local extraiu dados, usa o nome do arquivo como fornecedor
      if (fallback.fornecedor === 'Fornecedor não identificado') {
        const nameFromFile = supplierFromFileName(fileName) || fileName.replace(/\.pdf$/i, '').trim();
        fallback.fornecedor = nameFromFile || 'Fornecedor não identificado';
      }
      return {
        ...fallback,
        valor: sanitizeBoletoValor((fallback as any).valor),
        empresa: String((dataAny as any)?.empresa || ''),
        cnpj: String((dataAny as any)?.cnpj || ''),
        numero_boleto: String((dataAny as any)?.numero_boleto || fallback.numero_boleto || ''),
        conta_contabil_id: dataAny.conta_contabil_id ? Number(dataAny.conta_contabil_id) : undefined,
        tipo: 'DESPESA'
      };
    } catch (err) {
      console.error('[boleto] API error, using local fallback:', err);
      const fallback = extractBoletoData(text, fileName, safeSuppliers);
      const errorMsg = String((err as any)?.message || err || 'Erro desconhecido na API');
      
      // Notifica o usuário sobre a falha da IA
      showNotification(`IA falhou: ${errorMsg}. Usando dados extraídos localmente.`, 'error');
      
      return { ...fallback, valor: sanitizeBoletoValor((fallback as any).valor), empresa: '', cnpj: '', numero_boleto: '', tipo: 'DESPESA', ai_error: errorMsg };
    }
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) return;
    const pdfFiles = files.filter((file) => file.type === 'application/pdf');
    if (!pdfFiles.length) {
      showNotification('Selecione pelo menos um arquivo PDF válido.', 'error');
      return;
    }

    setIsProcessingPdf(true);
    showNotification(`Processando ${pdfFiles.length} boleto(s)...`, 'info');

    try {
      const extractedRows: PdfImportDraft[] = await Promise.all(
        pdfFiles.map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();

          // Extrai texto com PDF.js primeiro
          let fullText = '';
          try {
            let pdf: any;
            try {
              pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            } catch {
              pdf = await pdfjsLib.getDocument({ data: arrayBuffer, disableWorker: true } as any).promise;
            }
            const maxPages = Math.min(5, pdf.numPages || 0);
            for (let i = 1; i <= maxPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
            }
          } catch (pdfErr) {
            console.log(`[boleto] PDF.js failed for ${file.name}:`, pdfErr);
          }

          const hasGoodText = fullText.trim().length > 100;

          const local = extractBoletoData(fullText, file.name, safeSuppliers);
          local.fornecedor = resolveSupplierName(local.fornecedor, fullText, safeSuppliers);

          // Para garantir 100% de acerto nas datas e valores, sempre usamos a IA (Gemini) como primeira opção.
          // O leitor local (regex) é muito propenso a falhas de leitura (como capturar descontos, multas ou juros no lugar do valor real, ex: R$ 7,95 de desconto).
          const hasLocalCore = false;

          // Se a extração local funcionou perfeitamente, usa ela (desabilitado em favor da precisão da IA)
          if (hasLocalCore) return local;

          // Converte PDF para base64 para o Gemini
          const pdfBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1] || '');
            };
            reader.readAsDataURL(file);
          });

          const ai = await extractBoletoWithGemini(fullText, file.name, pdfBase64);
          ai.fornecedor = resolveSupplierName(ai.fornecedor, fullText, safeSuppliers);

          const fornecedor = (!shouldRejectSupplierName(ai.fornecedor) && ai.fornecedor) ? ai.fornecedor : local.fornecedor;
          // Se a IA obteve vencimento/valor válidos, prioriza a IA. Caso contrário, cai no local.
          const vencimento = ai.vencimento || local.vencimento;
          const valor = ai.valor > 0 ? ai.valor : local.valor;
          const numero_boleto = normalizeBoletoNumber(ai.numero_boleto || '') || normalizeBoletoNumber(local.numero_boleto || '') || '';
          const descricao = ai.descricao || local.descricao;

          return {
            ...ai,
            fornecedor,
            vencimento,
            valor,
            numero_boleto,
            descricao,
          };
        })
      );

      if (!extractedRows.length) {
        showNotification('Nenhum dado foi extraído dos PDFs.', 'error');
        return;
      }

      setPdfExtractedRows(applyDuplicateFlags(extractedRows));
      setShowPdfImportModal(true);
      const firstAiError = extractedRows.find((r) => (r as any).ai_error)?.ai_error;
      if (firstAiError) {
        showNotification(`Falha ao ler boleto por IA (usando nome do arquivo). Motivo: ${String(firstAiError).slice(0, 120)}`, 'error');
      }
      showNotification('Boletos lidos. Revise e confirme.', 'success');
    } catch (error) {
      console.error('Error processing PDF:', error);
      showNotification('Erro ao processar PDF. Tente novamente.', 'error');
    } finally {
      setIsProcessingPdf(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleConfirmPdfImport = async () => {
    try {
      const validRows = pdfExtractedRows
        .filter((row) => row.fornecedor && row.vencimento && row.valor > 0)
        .map((row) => ({ ...row, numero_boleto: normalizeBoletoNumber(row.numero_boleto) }));

      if (validRows.length === 0) {
        showNotification('Preencha Fornecedor, Vencimento e Valor para confirmar a importação.', 'error');
        return;
      }

      const recheckedRows = applyDuplicateFlags(validRows as PdfImportDraft[]);
      const nonDuplicateRows = recheckedRows.filter((row) => !row.duplicate);
      const blockedCount = recheckedRows.length - nonDuplicateRows.length;

      if (!nonDuplicateRows.length) {
        showNotification('Todos os boletos já foram lançados e foram bloqueados.', 'info');
        return;
      }

      const canonicalRows = nonDuplicateRows.map((row) => ({
        ...row,
        fornecedor: resolveSupplierName(row.fornecedor, row.rawText, safeSuppliers),
        tipo: row.tipo || 'DESPESA',
      }));

      const txList = canonicalRows.map((row) => {
        const dateVal = toInputDate(row.vencimento);
        if (!dateVal) {
          throw new Error(`Data de vencimento inválida: "${row.vencimento}"`);
        }

        return {
          uid: apiAuth.getUid() || 'guest',
          fornecedor: row.fornecedor,
          descricao: row.descricao || `Importado de boleto PDF (${row.fileName})`,
          empresa: row.empresa || 'CN',
          vencimento: dateVal,
          pagamento: null as any,
          valor: row.valor,
          status: 'PENDENTE' as TransactionStatus,
          banco: null as any,
          numero_boleto: row.numero_boleto,
          conta_contabil_id: row.conta_contabil_id,
          tipo: row.tipo || 'DESPESA',
        };
      });

      if (txList.length === 1) {
        await api.createTransaction(txList[0]);
      } else {
        await api.createTransactionsBatch(txList as any);
      }

      const newSuppliers = canonicalRows
        .filter((row) => row.fornecedor !== 'Fornecedor não identificado')
        .filter((row) => !suppliers.some((s) => isSupplierMatch(row.fornecedor, s.nome)))
        .map((row) => ({
          uid: apiAuth.getUid() || 'guest',
          nome: row.fornecedor,
          email: '',
          telefone: '',
          cnpj: row.cnpj || '',
        }));

      if (newSuppliers.length) {
        await api.createSuppliersBatch(newSuppliers as any);
      }

      // Salva padrões aprendidos para cada boleto confirmado
      // Roda em background sem bloquear o fluxo
      canonicalRows.forEach(row => {
        if (row.fornecedor && row.fornecedor !== 'Fornecedor não identificado') {
          api.saveBoletoPattern({
            cnpj: row.cnpj,
            nome_beneficiario: row.fornecedor,
            fornecedor: row.fornecedor,
            descricao: row.descricao,
            empresa: row.empresa,
            tipo: row.tipo || 'DESPESA',
            conta_contabil_id: row.conta_contabil_id,
          });
        }
      });

      setShowPdfImportModal(false);
      setPdfExtractedRows([]);
      await fetchTransactions();
      await fetchSuppliers(true);
      showNotification(`${nonDuplicateRows.length} boleto(s) importado(s). ${blockedCount} bloqueado(s) por duplicidade.`, 'success');
    } catch (error: any) {
      console.error('Error creating transaction from PDF:', error);
      const isDuplicate = error.message && (
        error.message.includes('Boleto já lançado') ||
        error.message.includes('Lançamento duplicado')
      );
      const msg = isDuplicate 
        ? 'Este boleto já foi lançado no sistema.'
        : 'Erro ao salvar lançamentos de boleto.';
      showNotification(msg, isDuplicate ? 'info' : 'error');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        showNotification('Processando arquivo... Por favor, aguarde.', 'info');
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
          showNotification('Formato .xls antigo nao e suportado por seguranca. Salve como .xlsx ou .csv e tente novamente.', 'error');
          return;
        }

        let allDataMatrix: any[] = [];
        let sheetEntries: Array<{ sheetName: string; sheetMatrix: any[][] }> = [];

        const parseCsv = (text: string): any[][] => {
          const rows: string[][] = [];
          let row: string[] = [];
          let cell = '';
          let inQuotes = false;

          for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const next = text[i + 1];
            if (ch === '"' && inQuotes && next === '"') {
              cell += '"';
              i++;
            } else if (ch === '"') {
              inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
              row.push(cell);
              cell = '';
            } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
              if (ch === '\r' && next === '\n') i++;
              row.push(cell);
              if (row.some((v) => String(v || '').trim() !== '')) rows.push(row);
              row = [];
              cell = '';
            } else {
              cell += ch;
            }
          }

          row.push(cell);
          if (row.some((v) => String(v || '').trim() !== '')) rows.push(row);
          return rows;
        };

        if (fileName.endsWith('.csv')) {
          const text = new TextDecoder('utf-8').decode(arrayBuffer);
          sheetEntries = [{ sheetName: file.name.replace(/\.csv$/i, ''), sheetMatrix: parseCsv(text) }];
        } else {
          const sheets = await readXlsxFile(file);
          sheetEntries = sheets.map(({ sheet, data }) => ({
            sheetName: sheet,
            sheetMatrix: data.map((row) => row.map((value) => value ?? '')),
          }));
        }

        // Colunas consideradas "cabeçalho padrão"
        const KNOWN_COLS = ['FORNECEDOR', 'FORNECEDORES', 'NOME', 'FAVORECIDO', 'CLIENTE', 'VALOR', 'VENCIMENTO', 'DATA', 'PAGAMENTO', 'SITUAÇÃO', 'SITUACAO'];

        // Heurística de mapeamento posicional para abas/CSVs sem cabeçalho
        const isDateSerial = (v: any) => typeof v === 'number' && v > 40000 && v < 70000;
        const isYmdDate = (v: any) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim());
        const hasValue = (v: any) => v !== undefined && v !== null && String(v).trim() !== '';
        const buildPositionalRow = (row: any[], sheetName: string): any => {
          const r: any = { _aba_origem: sheetName };

          // MOVBANCO.csv (Odair) - sem cabeçalho:
          // CODCONTA,CODMOV,CODTIPMOV,DATA,VALOR,OBS,DOCUMENTO,CODFORNEC,...
          if (isYmdDate(row?.[3]) && hasValue(row?.[4])) {
            r['CODCONTA'] = row?.[0];
            r['CODMOV'] = row?.[1];
            r['CODTIPMOV'] = row?.[2];
            r['DATA'] = row?.[3];
            r['VALOR'] = row?.[4];
            r['OBS'] = row?.[5];
            r['DOCUMENTO'] = row?.[6];
            r['CODFORNEC'] = row?.[7];
            return r;
          }

          // MOVCAIXA.csv (Odair) - sem cabeçalho:
          // CODCAIXA,IDCODMOVCAIXA,DATA,OBS,OPERACAO,CREDITO,DEBITO,...
          if (isYmdDate(row?.[2]) && (hasValue(row?.[5]) || hasValue(row?.[6]))) {
            r['CODCAIXA'] = row?.[0];
            r['IDCODMOVCAIXA'] = row?.[1];
            r['DATA'] = row?.[2];
            r['OBS'] = row?.[3];
            r['OPERACAO'] = row?.[4];
            r['CREDITO'] = row?.[5];
            r['DEBITO'] = row?.[6];
            return r;
          }

          const strings = row.map((v, i) => ({ v, i })).filter(x => typeof x.v === 'string' && String(x.v).trim() !== '');
          const dates = row.map((v, i) => ({ v, i })).filter(x => isDateSerial(x.v));
          const nums = row.map((v, i) => ({ v, i })).filter(x => typeof x.v === 'number' && !isDateSerial(x.v) && x.v > 0);
          if (strings[0]) r['FORNECEDOR'] = strings[0].v;
          if (strings[1]) r['DESCRIÇÃO'] = strings[1].v;
          if (dates[0]) r['VENCIMENTO'] = dates[0].v;
          if (dates[1]) r['DATA PAGAMENTO'] = dates[1].v;
          if (nums[0]) r['VALOR'] = nums[0].v;
          if (strings[2]) r['EMPRESA'] = strings[2].v;
          const last = strings[strings.length - 1];
          if (last && last !== strings[0] && last !== strings[1] && last !== strings[2]) r['SITUAÇÃO'] = last.v;
          return r;
        };

        // Iterar sobre todas as abas do Excel
        for (const { sheetName, sheetMatrix } of sheetEntries) {
          // Ignora abas de sumário que não são lançamentos
          if (['CASHFLOW'].includes(sheetName.trim().toUpperCase())) continue;

          if (sheetMatrix.length < 1) continue; // Pula abas vazias

          // Verifica se a primeira linha contém colunas padrão
          const firstRowUpper = sheetMatrix[0].map(h => String(h || '').trim().toUpperCase());
          const hasMovementHeader =
            firstRowUpper.includes('CODCONTA') ||
            firstRowUpper.includes('CODCAIXA') ||
            firstRowUpper.includes('CODMOV') ||
            firstRowUpper.includes('IDCODMOVCAIXA') ||
            firstRowUpper.includes('CREDITO') ||
            firstRowUpper.includes('DEBITO');
          const hasStandardHeader = firstRowUpper.some(h => KNOWN_COLS.includes(h)) || hasMovementHeader;

          if (hasStandardHeader) {
            // Fluxo normal: primeira linha = cabeçalho
            const headers = firstRowUpper;
            for (let i = 1; i < sheetMatrix.length; i++) {
              const row = sheetMatrix[i];
              if (!row || row.length === 0) continue;
              const rowData: any = { _aba_origem: sheetName };
              headers.forEach((header, index) => {
                if (header && row[index] !== undefined && row[index] !== null && row[index] !== '') {
                  rowData[header] = row[index];
                }
              });
              allDataMatrix.push(rowData);
            }
          } else {
            // Aba sem cabeçalho padrão (ex: ABRIL, Manutençao): mapeia todas as linhas por posição
            for (let i = 0; i < sheetMatrix.length; i++) {
              const row = sheetMatrix[i];
              if (!row || row.length === 0) continue;
              const rowData = buildPositionalRow(row, sheetName);
              if (rowData['FORNECEDOR']) allDataMatrix.push(rowData);
            }
          }
        }

        console.log(`Planilha lida. Total de linhas: ${allDataMatrix.length}`);

        if (allDataMatrix.length === 0) {
          showNotification('A planilha parece estar vazia em todas as abas.', 'error');
          return;
        }

        const colsPresent = new Set<string>();
        for (const r of allDataMatrix.slice(0, 5)) {
          Object.keys(r || {}).forEach((k) => colsPresent.add(String(k || '').toUpperCase()));
        }

        const readJsonStorage = (key: string) => {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            return JSON.parse(raw);
          } catch {
            return null;
          }
        };

        const writeJsonStorage = (key: string, value: any) => {
          try {
            localStorage.setItem(key, JSON.stringify(value));
          } catch {
            return;
          }
        };

        const isOdairSupplierFile =
          colsPresent.has('CODFORNEC') &&
          colsPresent.has('NOME') &&
          !colsPresent.has('VENCIMENTO') &&
          !colsPresent.has('VALOR') &&
          !colsPresent.has('PAGAMENTO');

        const isOdairEmpresaFile =
          colsPresent.has('CODEMP') &&
          colsPresent.has('NOME') &&
          colsPresent.has('CGC') &&
          !colsPresent.has('VENCIMENTO') &&
          !colsPresent.has('VALOR');

        if (isOdairEmpresaFile) {
          const first = allDataMatrix.find((r) => String(r?.NOME || '').trim());
          const nomeEmpresa = String(first?.FANTASIA || first?.RAZAOSOCIAL || first?.NOME || '').trim();
          if (nomeEmpresa) writeJsonStorage('cn_odair_default_empresa', { empresa: nomeEmpresa });
          showNotification(nomeEmpresa ? `Empresa padrão salva: ${nomeEmpresa}` : 'Arquivo de empresa lido.', 'success');
          return;
        }

        if (isOdairSupplierFile) {
          const existingMap = (readJsonStorage('cn_odair_fornecedor_map') || {}) as Record<string, string>;
          const codeMap: Record<string, string> = { ...existingMap };

          let supBatch: Omit<Supplier, 'id'>[] = [];
          let imported = 0;

          for (const row of allDataMatrix) {
            const nome = String(row?.NOME || row?.RAZAOSOCIAL || '').trim();
            if (!nome) continue;
            const already = suppliers.some((s) => isSupplierMatch(nome, s.nome));
            const cod = String(row?.CODFORNEC ?? '').trim();
            if (cod) codeMap[cod] = nome;
            if (already) continue;

            supBatch.push({
              uid: apiAuth.getUid() || 'guest',
              nome,
              email: String(row?.EMAIL || '').trim(),
              telefone: String(row?.FONE || row?.CELULAR || '').trim(),
              cnpj: String(row?.CGC || row?.CNPJ_NFAVULSA || '').trim(),
            });
            imported++;

            if (supBatch.length >= 250) {
              try {
                await api.createSuppliersBatch(supBatch);
              } catch (err) {
                console.error('Erro no lote de fornecedores', err);
              } finally {
                supBatch = [];
              }
            }
          }

          if (supBatch.length) {
            try {
              await api.createSuppliersBatch(supBatch);
            } catch (err) {
              console.error('Erro no lote final de fornecedores', err);
            }
          }

          writeJsonStorage('cn_odair_fornecedor_map', codeMap);
          await fetchSuppliers(true);
          showNotification(`${imported} fornecedores importados.`, 'success');
          return;
        }

        const getRowValue = (row: any, keys: string[]) => {
          for (const key of keys) {
            const foundKey = Object.keys(row).find(rk => rk === key.toUpperCase());
            if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
              return row[foundKey];
            }
          }
          // Partial match apenas para descrição e observações
          if (keys.includes('DESCRIÇÃO') || keys.includes('OBSERVACAO')) {
            for (const key of keys) {
              const foundKey = Object.keys(row).find(rk => rk.toUpperCase().includes(key.toUpperCase()));
              if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
                return row[foundKey];
              }
            }
          }
          return undefined;
        };

        const parseValor = (val: any): number => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          const str = String(val).replace(/[R$\s]/g, '').trim();
          if (str === '' || str.toUpperCase() === 'TOTAL') return 0;

          // Trata formatos como 1.500,00 ou 1500,00 ou 1500.00
          if (str.includes(',') && str.includes('.')) {
            // Ex: 1.500,00 -> remove ponto, troca virgula por ponto
            return Number(str.replace(/\./g, '').replace(',', '.'));
          } else if (str.includes(',')) {
            // Ex: 1500,00
            return Number(str.replace(',', '.'));
          } else if ((str.match(/\./g) || []).length > 1) {
            // Ex: 1.500.000 -> remove todos os pontos
            return Number(str.replace(/\./g, ''));
          }

          const n = Number(str);
          return isNaN(n) ? 0 : n;
        };

        const localSuppliers = new Set(suppliers.map(s => s.nome));
        const fileIsMovimento =
          colsPresent.has('CODCONTA') ||
          colsPresent.has('CODCAIXA') ||
          colsPresent.has('CONC_OPERACAO') ||
          colsPresent.has('CREDITO') ||
          colsPresent.has('DEBITO');
        const txBatchSize = fileIsMovimento && allDataMatrix.length > 2000 ? 50 : 250;
        const supBatchSize = 250;

        let txBatch: Omit<Transaction, 'id'>[] = [];
        let supBatch: Omit<Supplier, 'id'>[] = [];
        let totalImported = 0;
        let totalFinanceiro = 0;

        for (const row of allDataMatrix) {
          const fornecedorFromCode = (() => {
            const cod = String(getRowValue(row, ['CODFORNEC', 'CODFOR']) ?? '').trim();
            if (!cod) return '';
            const map = (readJsonStorage('cn_odair_fornecedor_map') || {}) as Record<string, string>;
            return String(map[cod] || '').trim();
          })();

          const rawFornecedor = getRowValue(row, ['FORNECEDOR', 'FORNECEDORES', 'FORNECEDOR_NOME', 'NOME', 'FAVORECIDO', 'CLIENTE']);
          const fornecedorNome = String(rawFornecedor || '').trim();

          if (!fornecedorNome && !fornecedorFromCode && !fileIsMovimento) continue;
          if (fornecedorNome && fornecedorNome.toUpperCase().includes('TOTAL')) continue;
          if (fornecedorNome && (fornecedorNome.toUpperCase() === 'FORNECEDOR' || fornecedorNome.toUpperCase() === 'CLIENTE') && !fornecedorFromCode) continue;

          const rawValor = getRowValue(row, ['VALOR', 'VALOROPERACAO', 'VALOR TOTAL', 'TOTAL', 'VALOR_TOTAL', 'QUANTIA', 'PREÇO', 'PRECO', 'SAIDA', 'SAÍDA', 'PAGAMENTO']);
          const sanitizedValor = parseValor(rawValor);

          const creditoRaw = getRowValue(row, ['CREDITO']);
          const debitoRaw = getRowValue(row, ['DEBITO']);
          const creditoVal = typeof creditoRaw === 'number' ? creditoRaw : parseValor(creditoRaw);
          const debitoVal = typeof debitoRaw === 'number' ? debitoRaw : parseValor(debitoRaw);

          if (!fileIsMovimento && sanitizedValor === 0 && !rawValor) continue;
          if (fileIsMovimento && sanitizedValor === 0 && !rawValor && !(creditoVal > 0 || debitoVal > 0)) continue;

          const formatDate = (val: any) => {
            if (!val) return undefined;

            if (val instanceof Date) {
              const dt = new Date(val);
              let day = dt.getUTCDate();
              let month = dt.getUTCMonth() + 1;
              let year = dt.getUTCFullYear();
              if (!Number.isFinite(year) || year < 1990 || year > 2035) return undefined;
              return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
            }

            if (typeof val === 'number') {
              const excelEpoch = Date.UTC(1899, 11, 30);
              const dt = new Date(excelEpoch + val * 24 * 60 * 60 * 1000);
              const y = dt.getUTCFullYear();
              const m = dt.getUTCMonth() + 1;
              const d = dt.getUTCDate();
              if (!Number.isFinite(y) || y < 1990 || y > 2035) return undefined;
              return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
            }

            const str = String(val).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            const [y, m, d] = str.split('-');
            const year = Number(y);
            if (!Number.isFinite(year) || year < 1990 || year > 2035) return undefined;
            return `${String(Number(d)).padStart(2, '0')}/${String(Number(m)).padStart(2, '0')}/${y}`;
          }
            if (str.includes('/')) {
              const parts = str.split('/');
              if (parts.length === 3) {
                let p0 = Number(parts[0]);
                let p1 = Number(parts[1]);
                let p2 = parts[2];
                if (p2.length === 2) p2 = '20' + p2;
                const y = Number(p2);
                if (!Number.isFinite(y) || y < 1990 || y > 2035) return undefined;
                return `${String(p0).padStart(2, '0')}/${String(p1).padStart(2, '0')}/${p2}`;
              }
            }
            return undefined;
          };

          const rawVencimento =
            getRowValue(row, ['VENCIMENTO', 'DATA VENCIMENTO', 'VENC']) ??
            getRowValue(row, ['DATA', 'EMISSAO', 'DATAEMISSAO', 'DATANOTA', 'CONC_DATA']);
          const rawPagamento = getRowValue(row, ['DATA PAGAMENTO', 'PAGAMENTO', 'DATA PAGO', 'PAGO EM']);

          const vencimentoDate = formatDate(rawVencimento);
          const pagamentoDateRaw = rawPagamento ? formatDate(rawPagamento) : undefined;
          if (!vencimentoDate) continue;

          const pagamentoDate = pagamentoDateRaw || (fileIsMovimento ? vencimentoDate : undefined);

          let tipo: Transaction['tipo'] | undefined = undefined;
          const concOp = String(getRowValue(row, ['CONC_OPERACAO', 'OPERACAO', 'OPERAÇÃO', 'TIPO_LANC']) || '').trim();
          let finalValor = sanitizedValor;

          if ((!rawValor || finalValor === 0) && (creditoVal > 0 || debitoVal > 0)) {
            if (creditoVal > 0) {
              finalValor = creditoVal;
              tipo = 'RECEITA';
            } else {
              finalValor = debitoVal;
              tipo = 'DESPESA';
            }
          } else if (concOp === '+') {
            tipo = 'RECEITA';
          } else if (concOp === '-') {
            tipo = 'DESPESA';
          }

          const rawStatus = String(getRowValue(row, ['STATUS', 'SITUAÇÃO', 'SITUACAO', 'PAGO', 'SIT 2']) || '').toUpperCase();
          let status: TransactionStatus = 'PENDENTE';

          if (pagamentoDate || rawStatus.includes('PAGO')) {
            status = 'PAGO';
          } else if (rawStatus.includes('VENCIDO')) {
            status = 'VENCIDO';
          }

          const rawDescricao = getRowValue(row, ['DESCRIÇÃO', 'DESCRICAO', 'OBSERVACAO', 'OBSERVAÇÃO', 'OBS 1', 'OBS 2', 'OBS', 'DETALHE']);
          const rawEmpresa = getRowValue(row, ['EMPRESA', 'UNIDADE', 'LOJA', 'OBS 2', 'GRUPO']);

          const rawBanco = getRowValue(row, ['BANCO', 'CONTA', 'INSTITUIÇÃO', 'INSTITUICAO']);

          const fornecedorNomeFinal = String(
            String(rawFornecedor || '').trim() ||
            fornecedorFromCode ||
            'Diversos'
          ).trim();

          const defaultEmpresa = (() => {
            const stored = readJsonStorage('cn_odair_default_empresa') as any;
            return String(stored?.empresa || '').trim();
          })();

          const bancoFinal =
            (rawBanco ? String(rawBanco) : '') ||
            (colsPresent.has('CODCONTA') ? `Conta ${String(getRowValue(row, ['CODCONTA']) || '').trim()}` : '');

          txBatch.push({
            uid: apiAuth.getUid() || 'guest',
            fornecedor: fornecedorNomeFinal,
            descricao: String(rawDescricao || getRowValue(row, ['OBS']) || '-'),
            empresa: String(rawEmpresa || defaultEmpresa || 'Geral'),
            vencimento: vencimentoDate,
            pagamento: pagamentoDate || undefined,
            valor: finalValor,
            status: status,
            banco: bancoFinal ? String(bancoFinal) : undefined,
            tipo
          });

          totalImported++;
          totalFinanceiro += finalValor;

          // Handle supplier
          if (!localSuppliers.has(fornecedorNomeFinal) && fornecedorNomeFinal !== 'Desconhecido') {
            supBatch.push({
              uid: apiAuth.getUid() || 'guest',
              nome: fornecedorNomeFinal,


              email: '',
              telefone: '',
              cnpj: ''
            });
            localSuppliers.add(fornecedorNomeFinal);
          }

          // Lotes menores e usar await com try-catch individual por lote para evitar queda
          if (txBatch.length >= txBatchSize) {
            try {
              console.log(`Enviando lote de ${txBatch.length} transações...`);
              await api.createTransactionsBatch(txBatch);
              txBatch = [];
            } catch (err) {
              console.error('Erro no lote de transações', err);
              txBatch = [];
            }
          }
          if (supBatch.length >= supBatchSize) {
            try {
              await api.createSuppliersBatch(supBatch);
              supBatch = [];
            } catch (err) {
              console.error('Erro no lote de fornecedores', err);
              supBatch = [];
            }
          }
        }

        console.log(`Total mapeado para envio: ${totalImported} linhas. Financeiro: R$ ${totalFinanceiro}`);

        // Lotes finais
        if (txBatch.length > 0) {
          try {
            console.log(`Enviando lote final de ${txBatch.length} transações...`);
            await api.createTransactionsBatch(txBatch);
          } catch (err) { console.error(err); }
        }
        if (supBatch.length > 0) {
          try {
            await api.createSuppliersBatch(supBatch);
          } catch (err) { console.error(err); }
        }

        showNotification(`${totalImported} lançamentos processados na importação!`, 'success');
        fetchTransactions();
        fetchSuppliers(true);
      } catch (err) {
        console.error('Erro ao processar arquivo:', err);
        showNotification('Erro ao processar o arquivo. Verifique o formato.', 'error');
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMarkAsPaidClick = (tx: Transaction) => {
    if (banks.filter(b => b.ativo).length > 0) {
      setShowPayModal({ id: tx.id, valor: tx.valor, vencimento: tx.vencimento });
    } else {
      markAsPaid(String(tx.id), '');
    }
  };

  const handleMarkAsPaidBatchClick = (txs: Transaction[]) => {
    if (txs.length === 0) return;
    if (banks.filter(b => b.ativo).length > 0) {
      setShowPayBatchModal(txs);
    } else {
      markAsPaidBatch(txs.map(t => t.id), '');
    }
  };

  // --- Computed Stats ---
  const stats = useMemo(() => {
    let total = 0;
    let pagos = 0;
    let pendentes = 0;
    let vencidos = 0;
    const empresasSet = new Set<string>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const tx of transactions) {
      const baseValor = Number(tx.valor) || 0;
      const juros = Number((tx as any).juros) || 0;
      total += baseValor + juros;
      if (tx.status === 'PAGO') {
        pagos++;
      } else if (tx.status === 'VENCIDO') {
        vencidos++;
      } else {
        // Auto-detect: PENDENTE with past vencimento = VENCIDO
        const parts = tx.vencimento?.split('/');
        if (parts?.length === 3) {
          const vDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
          if (vDate < today) vencidos++;
          else pendentes++;
        } else {
          pendentes++;
        }
      }
      empresasSet.add(tx.empresa);
    }
    const kpis: KPI[] = [
      { label: 'VALOR TOTAL', value: total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }), color: '#3b82f6' },
      { label: 'REGISTROS', value: transactions.length.toString(), description: 'Volume operacional', color: '#3b82f6' },
      { label: 'EMPRESAS', value: empresasSet.size.toString(), description: 'Unidades ativas', color: '#3b82f6' },
      { label: 'PENDENTES', value: pendentes.toString(), description: 'Aguardando conciliação', color: '#f59e0b' },
      { label: 'PAGOS', value: pagos.toString(), description: 'Liquidados', color: '#3b82f6' },
      { label: 'VENCIDOS', value: vencidos.toString(), description: 'Ação imediata necessária', color: '#ef4444' },
    ];
    return { total, pagos, pendentes, vencidos, kpis };
  }, [transactions]);

  // Skeleton de carregamento inicial
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background">
        <div className="flex items-center gap-3">
          <img src={currentBrandLogo} alt="Logo" className="h-10 w-10 object-contain rounded-sm border border-surface-variant bg-surface-variant/40 p-1" />
          <h1 className="text-2xl font-black tracking-tighter premium-gradient-text font-headline">Fluxo Caixa CN</h1>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="w-48 hover:bg-surface-variant/60 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-[loading_1.2s_ease-in-out_infinite]" style={{ width: '60%', animation: 'pulse 1.2s ease-in-out infinite' }} />
          </div>
          <p className="text-xs text-on-surface-variant/50 uppercase tracking-widest font-bold">Carregando dados...</p>
        </div>
        {/* Skeleton cards */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-2xl px-8 mt-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="h-2 bg-white/10 rounded w-2/3 mb-3" />
              <div className="h-6 bg-white/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <AuthGuard isAuthorized={isAuthorized} onLogin={login}>
      <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-surface/80 backdrop-blur-md border-b border-surface-variant flex justify-between items-center w-full px-4 md:px-8 py-5 fixed top-0 z-50">
        <div className="flex items-center gap-4 md:gap-8">
          <div className="flex items-center gap-3">
            <img
              src={currentBrandLogo}
              alt="Logo Fluxo Caixa CN"
              className="h-9 w-9 md:h-10 md:w-10 object-contain rounded-sm border border-surface-variant bg-surface-variant/40 p-1"
            />
            <h1 className="text-xl md:text-2xl font-black tracking-tighter premium-gradient-text font-headline">Fluxo Caixa CN</h1>
          </div>

          <nav className="hidden lg:flex gap-6">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={cn("transition-all duration-200 font-medium text-sm", activeTab === 'dashboard' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-on-surface")}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('lancamentos')}
              className={cn("relative transition-all duration-200 font-medium text-sm", activeTab === 'lancamentos' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-on-surface")}
            >
              Lançamentos
              {stats.vencidos > 0 && (
                <span className="absolute -top-2 -right-3 bg-tertiary text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
                  {stats.vencidos}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('fornecedores')}
              className={cn("transition-all duration-200 font-medium text-sm", activeTab === 'fornecedores' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-on-surface")}
            >
              Fornecedores
            </button>
            <button
              onClick={() => setActiveTab('relatorios')}
              className={cn("transition-all duration-200 font-medium text-sm", activeTab === 'relatorios' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-on-surface")}
            >
              Relatórios
            </button>
            <button
              onClick={() => setActiveTab('receitas')}
              className={cn("transition-all duration-200 font-medium text-sm", activeTab === 'receitas' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-on-surface")}
            >
              Receitas
            </button>
            <button
              onClick={() => setActiveTab('bancos')}
              className={cn("transition-all duration-200 font-medium text-sm", activeTab === 'bancos' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-on-surface")}
            >
              Bancos
            </button>
            <button
              onClick={() => setActiveTab('extrato')}
              className={cn("transition-all duration-200 font-medium text-sm", activeTab === 'extrato' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-on-surface")}
            >
              Extrato OFX
            </button>
            <button
              onClick={() => setActiveTab('configuracoes')}
              className={cn("transition-all duration-200 font-medium text-sm", activeTab === 'configuracoes' ? "text-primary border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-on-surface")}
            >
              Configurações
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <GlobalSearch
            transactions={transactions}
            suppliers={suppliers}
            banks={banks}
            onNavigate={setActiveTab}
          />
          <button 
            onClick={logout}
            className="p-2 text-on-surface-variant hover:bg-tertiary/10 hover:text-tertiary rounded-full transition-colors hidden sm:block"
            title="Sair do Sistema"
          >
            <X size={20} />
          </button>
          <button className="p-2 text-on-surface-variant hover:bg-surface-variant/40 rounded-full transition-colors hidden sm:block">
            <Bell size={20} />
          </button>
        </div>
      </header>

      {/* Mobile Navigation (Bottom Bar) */}
      <nav className="lg:hidden fixed bottom-6 left-6 right-6 bg-surface/90 backdrop-blur-xl border border-surface-variant z-50 flex justify-around items-center py-4 px-4 rounded-sm shadow-2xl">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'dashboard' ? "text-primary scale-110" : "text-on-surface-variant opacity-60")}
        >
          <LayoutDashboard size={22} strokeWidth={activeTab === 'dashboard' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Dash</span>
        </button>
        <button
          onClick={() => setActiveTab('lancamentos')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'lancamentos' ? "text-primary scale-110" : "text-on-surface-variant opacity-60")}
        >
          <FileText size={22} strokeWidth={activeTab === 'lancamentos' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Lanç</span>
        </button>
        <button
          onClick={() => setActiveTab('fornecedores')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'fornecedores' ? "text-primary scale-110" : "text-on-surface-variant opacity-60")}
        >
          <Building2 size={22} strokeWidth={activeTab === 'fornecedores' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Forn</span>
        </button>
        <button
          onClick={() => setActiveTab('relatorios')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'relatorios' ? "text-primary scale-110" : "text-on-surface-variant opacity-60")}
        >
          <BarChart3 size={22} strokeWidth={activeTab === 'relatorios' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Relat</span>
        </button>
        <button
          onClick={() => setActiveTab('receitas')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'receitas' ? "text-primary scale-110" : "text-on-surface-variant opacity-60")}
        >
          <Wallet size={22} strokeWidth={activeTab === 'receitas' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Rec</span>
        </button>
        <button
          onClick={() => setActiveTab('bancos')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'bancos' ? "text-primary scale-110" : "text-on-surface-variant opacity-60")}
        >
          <CreditCard size={22} strokeWidth={activeTab === 'bancos' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Bancos</span>
        </button>
        <button
          onClick={() => setActiveTab('extrato')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'extrato' ? "text-primary scale-110" : "text-on-surface-variant opacity-60")}
        >
          <Download size={22} strokeWidth={activeTab === 'extrato' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">OFX</span>
        </button>
        <button
          onClick={() => setActiveTab('configuracoes')}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'configuracoes' ? "text-primary scale-110" : "text-on-surface-variant opacity-60")}
        >
          <Settings size={22} strokeWidth={activeTab === 'configuracoes' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Config</span>
        </button>
      </nav>


      <main className="flex-grow pt-24 pb-24 lg:pb-12 px-4 md:px-8 max-w-[1600px] mx-auto w-full">
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div>
            <h2 className="text-2xl md:text-4xl font-extrabold font-headline text-on-surface mb-3 tracking-tight">
              {activeTab === 'dashboard' && '💰 Dashboard Fluxo de Caixa'}
              {activeTab === 'lancamentos' && '📋 Gestão de Lançamentos'}
              {activeTab === 'fornecedores' && '🏢 Fornecedores'}
              {activeTab === 'relatorios' && '📈 Relatórios Financeiros'}
              {activeTab === 'receitas' && '💸 Receitas'}
              {activeTab === 'bancos' && '🏦 Bancos'}
              {activeTab === 'extrato' && '📄 Importar Extrato OFX'}
              {activeTab === 'configuracoes' && '⚙️ Configurações'}
            </h2>
            <div className="flex flex-wrap gap-3">
              <span className="bg-surface-variant/20 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary border border-primary/20 flex items-center gap-2">
                <LayoutDashboard size={14} /> Grupo CN
              </span>
              <span className="bg-surface-variant/20 px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant flex items-center gap-2">
                <CheckCircle size={14} /> {transactions.length} registros
              </span>
              <span className="bg-surface-variant/20 px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant flex items-center gap-2">
                <Calendar size={14} /> {[...new Set(transactions.map(t => t.vencimento.substring(0, 7)))].length} períodos
              </span>
              <span className="bg-surface-variant/20 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-on-surface-variant flex items-center gap-2">
                Build: {(__BUILD_SHA__ || __BUILD_TIME__).slice(0, 8)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {activeTab === 'lancamentos' && (
              <>
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  className="bg-primary/15 text-primary px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-primary/25 transition-all border border-primary/25"
                >
                  {isProcessingPdf ? <Loader2 size={18} className="animate-spin" /> : <FileUp size={18} />}
                  Importar Boletos PDF
                </button>
                <input
                  type="file"
                  ref={pdfInputRef}
                  onChange={handlePdfUpload}
                  accept="application/pdf"
                  multiple
                  className="hidden"
                />
              </>
            )}
            <button
              onClick={() => setShowTransferModal(true)}
              className="bg-secondary/15 text-secondary px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-secondary/25 transition-all border border-secondary/25"
            >
              <Merge size={18} /> Transferência
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-surface-variant/20 text-on-surface px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-surface-variant/40 transition-all border border-surface-variant"
            >
              <FileSpreadsheet size={18} className="text-primary" /> Importar CSV
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .csv"
              className="hidden"
            />
          </div>
        </div>

        {/* Tab Content */}
        <Suspense fallback={<TabFallback />}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && (
              <DashboardTab
                transactions={transactions}
                onMarkAsPaid={handleMarkAsPaidClick}
                globalStats={globalStats}
                fetchStats={fetchStats}
              />
            )}
            {activeTab === 'lancamentos' && (
              <LancamentosTab
                transactions={transactions}
                onMarkAsPaid={handleMarkAsPaidClick}
                onMarkAsPaidBatch={handleMarkAsPaidBatchClick}
                deleteTransaction={deleteTransaction}
                setShowNewTxModal={setShowNewTxModal}
                setEditingTx={setEditingTx}
                onLoadMore={(append, year, month, search, status) => fetchTransactions(append, year, month, search, undefined, { status })}
                isLoadingMore={isLoadingMore}
                hasMoreTransactions={hasMoreTransactions}
              />
            )}
            {activeTab === 'fornecedores' && (
              <FornecedoresTab
                suppliers={suppliers}
                transactions={transactions}
                deleteSupplier={deleteSupplier}
                setShowNewSupplierModal={setShowNewSupplierModal}
                syncSuppliers={syncSuppliers}
                mergeSuppliers={mergeSuppliers}
                mergeSuppliersAuto={mergeSuppliersAuto}
                onSelectSupplier={setDetailSupplier}
                onEditSupplier={setEditingSupplier}
              />
            )}

            {activeTab === 'relatorios' && (
              <RelatoriosTab
                globalStats={globalStats}
                fetchStats={fetchStats}
                contasContabeis={contasContabeis}
              />
            )}
            {activeTab === 'receitas' && <ReceitasTab transactions={transactions} onNewRevenue={() => { setNewTxInitialTipo('RECEITA'); setShowNewTxModal(true); }} />}
            {activeTab === 'bancos' && (
              <BancosTab
                banks={banks}
                transactions={transactions}
                setShowNewBankModal={setShowNewBankModal}
                setEditingBank={setEditingBank}
                deleteBank={deleteBank}
              />
            )}
            {activeTab === 'extrato' && (
              <OFXImportTab
                transactions={transactions}
                suppliers={suppliers}
                banks={banks}
                onSuccess={() => { fetchTransactions(false, 'TODOS'); }}
                showNotification={showNotification}
                fetchTransactions={fetchTransactions}
              />
            )}
            {activeTab === 'configuracoes' && (
              <div className="glass-card p-10 text-center space-y-6">
                <Settings size={48} className="mx-auto text-on-surface-variant opacity-20" />
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Configurações do Sistema</h3>
                  <p className="text-on-surface-variant max-w-md mx-auto">
                    Aqui você poderá gerenciar usuários, permissões e integrações bancárias em futuras atualizações.
                  </p>
                </div>

                <div className="pt-8 border-t border-surface-variant">
                  <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-widest">Identidade Visual</h4>
                  <div className="space-y-4 max-w-md mx-auto">
                    <div className="glass-card p-4">
                      <p className="text-[11px] text-on-surface-variant mb-3">Logo exibida no topo do sistema.</p>
                      <div className="flex items-center justify-center gap-3">
                        <label className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-primary/20 transition-all border border-primary/20 cursor-pointer">
                          <Upload size={14} /> Subir Logo
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleLogoUpload}
                          />
                        </label>
                        {brandLogo && (
                          <button
                            onClick={clearLogo}
                            className="bg-tertiary/10 text-tertiary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-tertiary/20 transition-all border border-tertiary/20"
                          >
                            <X size={14} /> Remover
                          </button>
                        )}
                      </div>
                      <div className="mt-4 flex justify-center">
                        <img
                          src={currentBrandLogo}
                          alt="Prévia da logo"
                          className="h-20 w-20 object-contain rounded-sm border border-surface-variant bg-surface-variant/40 p-2"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Backup do Sistema */}
                <div className="pt-8 border-t border-surface-variant">
                  <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-widest">💾 Backup dos Dados</h4>
                  <div className="space-y-4 max-w-xl mx-auto">
                    <div className="glass-card p-6">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <Download size={24} className="text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-on-surface mb-1">Exportar Backup Completo</p>
                          <p className="text-[11px] text-on-surface-variant">
                            Baixa um arquivo JSON com todos os dados (transações, fornecedores, bancos, contas contábeis).
                            Backup automático diário também é feito via GitHub Actions.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleExportBackup}
                        className="w-full bg-primary/20 text-primary px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/30 transition-all border border-primary/30"
                      >
                        <Download size={18} /> Exportar Backup Agora
                      </button>
                      <p className="text-[10px] text-on-surface-variant/60 mt-3 text-center">
                        💡 Dica: O backup automático é feito todo dia às 3h. Você pode baixar manualmente a qualquer momento.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-surface-variant">
                  <h4 className="text-sm font-bold text-secondary mb-4 uppercase tracking-widest">Empresas</h4>
                  <div className="space-y-4 max-w-xl mx-auto">
                    <div className="glass-card p-4">
                      <p className="text-[11px] text-on-surface-variant mb-3">Gerencie a lista de empresas usada nos lançamentos e na automação de boletos.</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newCompanyName}
                          onChange={(e) => setNewCompanyName(e.target.value)}
                          placeholder="Ex: POLO NOVO"
                          className="flex-1 bg-surface-variant/20 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                        <button
                          onClick={() => addCompanyOption(newCompanyName)}
                          className="bg-secondary/20 text-secondary px-4 py-2 rounded-lg text-xs font-bold border border-secondary/30 hover:bg-secondary/30 transition-all"
                        >
                          Adicionar
                        </button>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {safeCompanyOptions.map((company) => (
                          <span key={company} className="inline-flex items-center gap-2 bg-surface-variant/20 border border-surface-variant rounded-lg px-2 py-1.5 text-xs font-bold">
                            {editingCompany === company ? (
                              <>
                                <input
                                  value={editingCompanyName}
                                  onChange={(e) => setEditingCompanyName(e.target.value)}
                                  className="bg-transparent border border-surface-variant rounded px-2 py-1 text-xs outline-none focus:border-primary w-36"
                                />
                                <button
                                  onClick={() => saveEditCompany(company)}
                                  className="text-primary hover:text-primary/80"
                                >
                                  Salvar
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingCompany(null);
                                    setEditingCompanyName('');
                                  }}
                                  className="text-on-surface-variant hover:text-on-surface"
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <span>{company}</span>
                                <button
                                  onClick={() => startEditCompany(company)}
                                  className="text-secondary hover:text-secondary/80"
                                >
                                  <Edit size={12} />
                                </button>
                                <button
                                  onClick={() => removeCompanyOption(company)}
                                  className="text-tertiary hover:text-tertiary/80"
                                >
                                  <X size={12} />
                                </button>
                              </>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-surface-variant">
                  <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-widest">Plano de Contas</h4>
                  <div className="space-y-4 max-w-3xl mx-auto">
                    <div className="glass-card p-4">
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-3">
                          <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Código</p>
                          <input
                            value={newContaContabil.codigo}
                            onChange={(e) => setNewContaContabil(prev => ({ ...prev, codigo: e.target.value }))}
                            placeholder="Ex: 3.1"
                            className="w-full bg-surface-variant/20 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                        </div>
                        <div className="col-span-6">
                          <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Nome</p>
                          <input
                            value={newContaContabil.nome}
                            onChange={(e) => setNewContaContabil(prev => ({ ...prev, nome: e.target.value }))}
                            placeholder="Ex: Folha de Pagamento"
                            className="w-full bg-surface-variant/20 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                        </div>
                        <div className="col-span-3">
                          <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Tipo</p>
                          <select
                            value={newContaContabil.tipo}
                            onChange={(e) => setNewContaContabil(prev => ({ ...prev, tipo: e.target.value as 'DESPESA' | 'RECEITA' }))}
                            className="w-full bg-surface-variant/20 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                          >
                            <option value="DESPESA">DESPESA</option>
                            <option value="RECEITA">RECEITA</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end mt-3">
                        <button
                          onClick={async () => {
                            try {
                              if (!newContaContabil.codigo || !newContaContabil.nome) {
                                showNotification('Preencha código e nome.', 'error');
                                return;
                              }
                              await api.createContaContabil({
                                codigo: newContaContabil.codigo,
                                nome: newContaContabil.nome,
                                tipo: newContaContabil.tipo as any,
                              });
                              setNewContaContabil({ codigo: '', nome: '', tipo: 'DESPESA' });
                              await fetchContasContabeis();
                              showNotification('Conta contábil cadastrada!', 'success');
                            } catch (e) {
                              showNotification('Erro ao cadastrar conta.', 'error');
                            }
                          }}
                          className="bg-secondary/10 text-secondary px-4 py-2 rounded-lg text-xs font-bold border border-secondary/20 hover:bg-secondary/20 transition-all"
                        >
                          Cadastrar Conta
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await api.setupTables();
                              await fetchContasContabeis();
                              showNotification('Plano de contas padrão carregado.', 'success');
                            } catch {
                              showNotification('Erro ao carregar plano padrão.', 'error');
                            }
                          }}
                          className="ml-3 bg-primary/10 text-primary px-4 py-2 rounded-lg text-xs font-bold border border-primary/20 hover:bg-primary/20 transition-all"
                        >
                          Carregar Padrão
                        </button>
                      </div>
                    </div>
                    <div className="glass-card p-4">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-[11px] font-bold uppercase text-on-surface-variant mb-2">Despesas</p>
                          <div className="space-y-1 max-h-64 overflow-auto pr-1">
                            {safeContasContabeis.filter(c => matchesAccountType(c, 'DESPESA')).map((c) => (
                              <div key={c.id} className="flex items-center justify-between border border-surface-variant rounded-lg px-3 py-2">
                                <span className="text-xs">{c.nome}</span>
                                <label className="text-[10px] flex items-center gap-2">
                                  <span className="text-on-surface-variant">{c.ativo ? 'Ativa' : 'Inativa'}</span>
                                  <input
                                    type="checkbox"
                                    checked={c.ativo}
                                    onChange={async (e) => {
                                      try {
                                        await api.updateContaContabil(c.id, { ativo: e.target.checked });
                                        await fetchContasContabeis();
                                      } catch {
                                        showNotification('Erro ao atualizar conta.', 'error');
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase text-on-surface-variant mb-2">Receitas</p>
                          <div className="space-y-1 max-h-64 overflow-auto pr-1">
                            {safeContasContabeis.filter(c => matchesAccountType(c, 'RECEITA')).map((c) => (
                              <div key={c.id} className="flex items-center justify-between border border-surface-variant rounded-lg px-3 py-2">
                                <span className="text-xs">{c.nome}</span>
                                <label className="text-[10px] flex items-center gap-2">
                                  <span className="text-on-surface-variant">{c.ativo ? 'Ativa' : 'Inativa'}</span>
                                  <input
                                    type="checkbox"
                                    checked={c.ativo}
                                    onChange={async (e) => {
                                      try {
                                        await api.updateContaContabil(c.id, { ativo: e.target.checked });
                                        await fetchContasContabeis();
                                      } catch {
                                        showNotification('Erro ao atualizar conta.', 'error');
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-8 border-t border-surface-variant">
                  <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-widest">Contas Contábeis</h4>
                  <div className="space-y-4 max-w-xl mx-auto">
                    <div className="glass-card p-4">
                      <p className="text-[11px] text-on-surface-variant mb-3">Gerencie as contas contábeis usadas na classificação de lançamentos.</p>

                      {/* Botão Carregar Padrão */}
                      <button
                        onClick={async () => {
                          try {
                            await api.setupTables();
                            await fetchContasContabeis();
                            showNotification('Contas padrão carregadas!', 'success');
                          } catch (error) {
                            showNotification('Erro ao carregar contas padrão.', 'error');
                          }
                        }}
                        className="w-full mb-4 bg-primary/10 text-primary px-4 py-2 rounded-lg text-xs font-bold border border-primary/20 hover:bg-primary/20 transition-all"
                      >
                        Carregar Padrão (atualiza contas antigas)
                      </button>

                      <div className="flex gap-2 mb-4">
                        <input
                          type="text"
                          value={newContaContabil.codigo}
                          onChange={(e) => setNewContaContabil({ ...newContaContabil, codigo: e.target.value })}
                          placeholder="Código (ex: 3.10)"
                          className="w-24 bg-surface-variant/20 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                        <input
                          type="text"
                          value={newContaContabil.nome}
                          onChange={(e) => setNewContaContabil({ ...newContaContabil, nome: e.target.value })}
                          placeholder="Nome da conta"
                          className="flex-1 bg-surface-variant/20 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                        <select
                          value={newContaContabil.tipo}
                          onChange={(e) => setNewContaContabil({ ...newContaContabil, tipo: e.target.value })}
                          className="bg-surface-variant/20 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        >
                          <option value="DESPESA">Despesa</option>
                          <option value="RECEITA">Receita</option>
                        </select>
                        <button
                          onClick={addContaContabil}
                          className="bg-primary/20 text-primary px-4 py-2 rounded-lg text-xs font-bold border border-primary/30 hover:bg-primary/30 transition-all"
                        >
                          Adicionar
                        </button>
                      </div>

                      {/* Caixa de Busca */}
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={14} />
                        <input
                          type="text"
                          placeholder="Buscar conta..."
                          value={searchContaContabil || ''}
                          onChange={(e) => setSearchContaContabil(e.target.value)}
                          className="w-full bg-surface-variant/20 border border-surface-variant rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {safeContasContabeis
                          .filter(c => {
                            const q = (searchContaContabil || '').toLowerCase();
                            if (!q) return true;
                            return c.codigo.toLowerCase().includes(q) || c.nome.toLowerCase().includes(q);
                          })
                          .map((conta) => (
                            <div key={conta.id} className="flex items-center justify-between bg-surface-variant/10 border border-surface-variant rounded-lg px-3 py-2">
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-bold px-2 py-1 rounded ${conta.tipo === 'RECEITA' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {conta.codigo}
                                </span>
                                <span className="text-sm">{conta.nome}</span>
                              </div>
                              <button
                                onClick={() => deleteContaContabil(conta.id)}
                                className="text-tertiary hover:text-tertiary/80"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        {safeContasContabeis.length === 0 && (
                          <p className="text-center text-xs text-on-surface-variant py-4">Nenhuma conta contábil cadastrada.</p>
                        )}
                    </div>
                  </div>
                </div>
              </div>



                <div className="pt-8 border-t border-surface-variant">
                  <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-widest">Padrões de Boletos</h4>
                  <div className="space-y-4 max-w-2xl mx-auto">
                    <div className="glass-card p-4">
                      <p className="text-[11px] text-on-surface-variant mb-3">
                        Gerencie os padrões aprendidos automaticamente ao importar boletos. Se um fornecedor estiver errado, delete o padrão para que o sistema peça para configurar novamente na próxima importação.
                      </p>
                      <button
                        onClick={() => fetchBoletoPatterns()}
                        className="bg-primary/10 text-primary px-4 py-2 rounded-lg text-xs font-bold border border-primary/20 hover:bg-primary/20 transition-all mb-3"
                      >
                        Atualizar Lista
                      </button>
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {safeBoletoPatterns.length === 0 ? (
                          <p className="text-center text-xs text-on-surface-variant py-4">Nenhum padrão aprendido ainda.</p>
                        ) : (
                          safeBoletoPatterns.map((pattern) => (
                            <div key={pattern.id} className="flex items-center justify-between bg-surface-variant/10 border border-surface-variant rounded-lg px-3 py-2">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold">{pattern.fornecedor}</span>
                                <span className="text-[10px] text-on-surface-variant">
                                  {pattern.nome_normalizado} • {pattern.confirmacoes}x confirmado
                                  {pattern.empresa && ` • ${pattern.empresa}`}
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Excluir padrão "${pattern.fornecedor}"?`)) {
                                    deleteBoletoPattern(pattern.id);
                                  }
                                }}
                                className="text-tertiary hover:text-tertiary/80"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        </Suspense>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {detailSupplier && (
          <SupplierDetailModal
            supplier={detailSupplier}
            transactions={transactions}
            onClose={() => setDetailSupplier(null)}
            onEdit={(s) => setEditingSupplier(s)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingSupplier && (
          <EditSupplierModal
            supplier={editingSupplier}
            onClose={() => setEditingSupplier(null)}
            onSave={async (id, data) => {
              await updateSupplier(id, data);
              fetchSuppliers(true);
              fetchStats();
              setDetailSupplier((prev) => (prev && prev.id === id ? { ...prev, ...data } as Supplier : prev));
            }}
          />
        )}
      </AnimatePresence>

      {showPdfImportModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-surface-variant rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-variant flex items-center justify-between">
              <h3 className="text-lg md:text-xl font-bold font-headline flex items-center gap-2">
                <FileUp className="text-primary" size={20} /> Automação de Boletos
              </h3>
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                {pdfExtractedRows.length} arquivo(s)
              </span>
            </div>

            <div className="p-4 max-h-[60vh] overflow-auto">
              <div className="space-y-3">
                {pdfExtractedRows.map((row, index) => (
                  <div key={`${row.fileName}-${index}`} className={cn("border rounded-xl p-3", row.duplicate ? "border-tertiary/40 bg-tertiary/5" : "border-surface-variant bg-surface-variant/10")}>
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
                          onChange={(e) => updatePdfRow(index, { fornecedor: e.target.value })}
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
                          onChange={(e) => updatePdfRow(index, { vencimento: e.target.value })}
                          placeholder="DD/MM/AAAA"
                          className="w-full bg-surface-variant/30 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Valor</p>
                        <input
                          type="number"
                          step="0.01"
                          value={Number.isFinite(row.valor) ? row.valor.toFixed(2) : ''}
                          onChange={(e) => {
                            const raw = String(e.target.value || '').replace(',', '.');
                            const n = Number(raw);
                            updatePdfRow(index, { valor: Number.isFinite(n) ? n : 0 });
                          }}
                          className="w-full bg-surface-variant/30 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div className="md:col-span-2 flex md:justify-end items-end">
                        <span className={cn(
                          "text-[10px] font-bold uppercase px-2 py-1 rounded border",
                          !row.numero_boleto
                            ? "text-secondary border-secondary/40 bg-secondary/10"
                            : row.duplicate
                              ? "text-tertiary border-tertiary/40 bg-tertiary/10"
                              : "text-primary border-primary/40 bg-primary/10"
                        )}>
                          {!row.numero_boleto ? 'Sem número' : row.duplicate ? 'Duplicado' : 'Novo'}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-2">
                      <div className="md:col-span-5">
                        <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Descrição</p>
                        <input
                          value={row.descricao}
                          onChange={(e) => updatePdfRow(index, { descricao: e.target.value })}
                          placeholder="Descrição do boleto"
                          className="w-full bg-surface-variant/30 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div className="md:col-span-4">
                        <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Número do Boleto</p>
                        <input
                          value={row.numero_boleto || ''}
                          onChange={(e) => updatePdfRow(index, { numero_boleto: e.target.value })}
                          placeholder="Nosso número / Nro documento"
                          className="w-full bg-surface-variant/30 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Tipo</p>
                        <select
                          value={row.tipo || 'DESPESA'}
                          onChange={(e) => updatePdfRow(index, { tipo: e.target.value as 'RECEITA' | 'DESPESA', conta_contabil_id: undefined })}
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
                          onChange={(e) => updatePdfRow(index, { empresa: e.target.value })}
                          className="w-full bg-surface-variant/30 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary text-on-surface"
                          style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}
                        >
                          <option value="" style={{ backgroundColor: '#1e1e2e' }}>Selecione</option>
                          {safeCompanyOptions.map((company) => (
                            <option key={company} value={company} style={{ backgroundColor: '#1e1e2e' }}>{company}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Conta Contábil</p>
                        <select
                          value={row.conta_contabil_id || ''}
                          onChange={(e) => updatePdfRow(index, { conta_contabil_id: e.target.value ? Number(e.target.value) : undefined })}
                          className="w-full bg-surface-variant/30 border border-surface-variant rounded-lg px-3 py-2 text-sm outline-none focus:border-primary text-on-surface"
                          style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}
                        >
                          <option value="" style={{ backgroundColor: '#1e1e2e' }}>Selecione a conta</option>
                          {safeContasContabeis
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
                  {[...new Set([...safeSuppliers.map(s => s.nome), ...safeTransactions.map(t => t.fornecedor)])].sort().map((nome) => (
                    <option key={nome} value={nome} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-surface-variant flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPdfImportModal(false);
                  setPdfExtractedRows([]);
                }}
                className="px-4 py-2 rounded-lg text-sm font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPdfImport}
                className="bg-primary text-background px-5 py-2 rounded-lg text-sm font-black uppercase tracking-widest hover:bg-primary-dark transition-all"
              >
                Confirmar Importação
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewTxModal && (
        <NewTxModal
          suppliers={safeSuppliers}
          banks={safeBanks}
          contasContabeis={safeContasContabeis}
          companyOptions={safeCompanyOptions}
          setShowNewTxModal={setShowNewTxModal}
          onSuccess={() => {
            fetchTransactions();
            syncSuppliers();
            showNotification('Lançamento salvo com sucesso!', 'success');
          }}
          initialTipo={newTxInitialTipo}
        />
      )}

      {showNewSupplierModal && (
        <NewSupplierModal
          setShowNewSupplierModal={setShowNewSupplierModal}
          onSuccess={() => {
            fetchSuppliers(true);
            showNotification('Fornecedor cadastrado com sucesso!', 'success');
          }}
        />
      )}

      {showNewBankModal && (
        <NewBankModal
          setShowNewBankModal={setShowNewBankModal}
          onSuccess={() => {
            fetchBanks(true);
            showNotification('Banco cadastrado com sucesso!', 'success');
          }}
        />
      )}

      {editingBank && (
        <EditBankModal
          bank={editingBank}
          onClose={() => setEditingBank(null)}
          onSuccess={() => {
            fetchBanks(true);
            showNotification('Banco atualizado com sucesso!', 'success');
          }}
        />
      )}

      {showPayModal && (
        <SelectBankModal
          transactionId={showPayModal.id}
          valor={showPayModal.valor}
          banks={safeBanks}
          initialDate={toInputDate(showPayModal.vencimento)}
          onClose={() => setShowPayModal(null)}
          onConfirm={(banco, dataPagamento) => {
            markAsPaid(showPayModal.id, banco, dataPagamento);
            setShowPayModal(null);
          }}
        />
      )}

      {showPayBatchModal && (
        <SelectBankModal
          transactionId="batch"
          valor={showPayBatchModal.reduce((sum, tx) => sum + tx.valor, 0)}
          banks={safeBanks}
          initialDate={showPayBatchModal.length > 0 ? toInputDate(showPayBatchModal[0].vencimento) : undefined}
          onClose={() => setShowPayBatchModal(null)}
          onConfirm={(banco, dataPagamento) => {
            markAsPaidBatch(showPayBatchModal.map(t => t.id), banco, dataPagamento);
            setShowPayBatchModal(null);
          }}
        />
      )}

      {showTransferModal && (
        <TransferModal
          banks={safeBanks}
          companyOptions={safeCompanyOptions}
          onClose={() => setShowTransferModal(false)}
          onSubmit={handleTransferSubmit}
        />
      )}

      {editingTx && (
        <EditTxModal
          transaction={editingTx}
          suppliers={safeSuppliers}
          banks={safeBanks}
          contasContabeis={safeContasContabeis}
          companyOptions={safeCompanyOptions}
          onClose={() => setEditingTx(null)}
          onSave={updateTransaction}
        />
      )}

      {/* Footer */}
      <footer className="bg-surface border-t border-surface-variant hidden lg:flex flex-col md:flex-row justify-between items-center px-8 w-full py-6 mt-auto">
        <div className="mb-4 md:mb-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Dashboard Fluxo de Caixa - Grupo CN | Dados atualizados em tempo real | © 2025
          </p>
        </div>
        <div className="flex gap-6">
          <a href="#" className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant hover:text-primary transition-all">Privacy Policy</a>
          <a href="#" className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant hover:text-primary transition-all">Terms of Service</a>
          <a href="#" className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant hover:text-primary transition-all">System Status</a>
        </div>
      </footer>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "fixed bottom-24 lg:bottom-8 right-8 z-[100] px-6 py-3 rounded-xl shadow-2xl border flex items-center gap-3",
              notification.type === 'success' && "bg-primary/20 border-primary/40 text-primary",
              notification.type === 'error' && "bg-tertiary/20 border-tertiary/40 text-tertiary",
              notification.type === 'info' && "bg-secondary/20 border-secondary/40 text-secondary"
            )}
          >
            {notification.type === 'success' && <CheckCircle size={18} />}
            {notification.type === 'error' && <X size={18} />}
            {notification.type === 'info' && <HelpCircle size={18} />}
            <span className="text-sm font-bold">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </AuthGuard>
  );
}
