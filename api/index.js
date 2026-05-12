import { setCors } from './_db.js';
import { checkRateLimit, sanitizeObject, logSecurity } from './_utils.js';
import { requireAuth, resolveAuthUid } from './_middlewares/auth.js';
import {
  handleTransactions,
  handleTransactionById,
  handleTransactionsBatch,
  handleTransactionsBatchUpdate,
  handleTransactionsDedupeMovimentos,
  handleFixReceitasTipo
} from './_handlers/transactions.js';
import {
  handleSuppliers,
  handleSupplierById,
  handleSuppliersBatch,
  handleSuppliersMerge,
  handleSuppliersMergeAuto
} from './_handlers/suppliers.js';
import { handleBanks, handleBankById, handleContasContabeis } from './_handlers/banks.js';
import { handleStats } from './_handlers/stats.js';
import {
  handleExtractBoleto,
  handleBoletoPatterns,
  handleSaveBoletoPattern,
  handleDeleteBoletoPattern
} from './_handlers/boleto.js';
import { handleLogin } from './_handlers/auth.js';
import { handleSetupTables, handleExportBackup, handleDbCheck, logRequest } from './_handlers/admin.js';

// Rotas públicas (não requerem autenticação)
const PUBLIC_ROUTES = ['health', 'auth-login'];

export default async function handler(req, res) {
  const startTime = Date.now();
  setCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();

  // Segurança: Rate limiting
  if (!checkRateLimit(req, res)) return;

  const { route, id } = req.query;

  // Autenticação — todas as rotas exceto públicas
  if (!PUBLIC_ROUTES.includes(route)) {
    const uid = requireAuth(req, res);
    if (!uid) return; // requireAuth já enviou resposta 401
  }

  // Sanitização Global
  if (['POST', 'PUT'].includes(req.method) && req.body && !['extract-boleto', 'auth-login'].includes(route)) {
    req.body = sanitizeObject(req.body);
  }

  try {
    switch (route) {
      // ── Públicas ──────────────────────────────────────────
      case 'health':
        return res.json({ ok: true, node: process.version, authenticated: !!resolveAuthUid(req) });
      case 'auth-login':
        return handleLogin(req, res);

      // ── Admin ─────────────────────────────────────────────
      case 'db-check':
        return handleDbCheck(req, res);
      case 'setup-tables':
        return handleSetupTables(req, res);
      case 'export-backup':
        return handleExportBackup(req, res);

      // ── Estatísticas ───────────────────────────────────────
      case 'stats':
        return handleStats(req, res);
      case 'fix-receitas-tipo':
        return handleFixReceitasTipo(req, res);

      // ── Transações ─────────────────────────────────────────
      case 'transactions':
        return id ? handleTransactionById(req, res) : handleTransactions(req, res);
      case 'transactions-batch':
        return handleTransactionsBatch(req, res);
      case 'transactions-batch-update':
        return handleTransactionsBatchUpdate(req, res);
      case 'transactions-dedupe-movimentos':
        return handleTransactionsDedupeMovimentos(req, res);

      // ── Fornecedores ───────────────────────────────────────
      case 'suppliers':
        return id ? handleSupplierById(req, res) : handleSuppliers(req, res);
      case 'suppliers-batch':
        return handleSuppliersBatch(req, res);
      case 'suppliers-merge':
        return handleSuppliersMerge(req, res);
      case 'suppliers-merge-auto':
        return handleSuppliersMergeAuto(req, res);

      // ── Bancos e Contas ────────────────────────────────────
      case 'banks':
        return id ? handleBankById(req, res) : handleBanks(req, res);
      case 'contas-contabeis':
        return handleContasContabeis(req, res);

      // ── Boletos e IA ───────────────────────────────────────
      case 'extract-boleto':
        return handleExtractBoleto(req, res);
      case 'save-boleto-pattern':
        return handleSaveBoletoPattern(req, res);
      case 'boleto-patterns':
        return id ? handleDeleteBoletoPattern(req, res) : handleBoletoPatterns(req, res);

      default:
        return res.status(404).json({ error: 'Route not found' });
    }
  } catch (e) {
    console.error('[Router Error]', e);
    return res.status(500).json({ error: 'Erro interno no roteador', details: e.message });
  } finally {
    if (route !== 'health') await logRequest(req, res, startTime);
  }
}