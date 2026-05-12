import { setCors } from './_db.js';
import { checkRateLimit, sanitizeObject, logSecurity } from './_utils.js';
import { handleLogin, verifyToken } from './_handlers/auth.js';
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
import { handleSetupTables, handleExportBackup, handleDbCheck, logRequest } from './_handlers/admin.js';

export default async function handler(req, res) {
  const startTime = Date.now();
  setCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();

  const { route, id } = req.query;

  // 1. Rotas Públicas
  if (route === 'health') return res.json({ ok: true, node: process.version });
  if (route === 'login' || route === 'auth-login') return handleLogin(req, res);

  // 2. Proteção JWT
  const decoded = verifyToken(req);
  if (!decoded) {
    // Fallback legado para não travar o sistema
    const securityToken = req.headers["x-cn-security"];
    const EXPECTED = process.env.SECURITY_TOKEN || "CN-INT-2024-SECURE-HARDENED-V1";
    if (securityToken !== EXPECTED) {
      res.status(401);
      return res.json({ error: "Sessão expirada. Faça login novamente." });
    }
    req.authUid = req.query.uid || 'guest';
  } else {
    req.authUid = decoded.uid;
  }

  // 3. Rate Limit e Sanitização
  if (!checkRateLimit(req, res)) return;
  if (['POST', 'PUT'].includes(req.method) && req.body && route !== 'extract-boleto') {
    req.body = sanitizeObject(req.body);
  }

  try {
    switch (route) {
      case 'db-check': return handleDbCheck(req, res);
      case 'stats': return handleStats(req, res);
      case 'transactions': return id ? handleTransactionById(req, res) : handleTransactions(req, res);
      case 'transactions-batch': return handleTransactionsBatch(req, res);
      case 'transactions-batch-update': return handleTransactionsBatchUpdate(req, res);
      case 'transactions-dedupe-movimentos': return handleTransactionsDedupeMovimentos(req, res);
      case 'suppliers': return id ? handleSupplierById(req, res) : handleSuppliers(req, res);
      case 'suppliers-batch': return handleSuppliersBatch(req, res);
      case 'suppliers-merge': return handleSuppliersMerge(req, res);
      case 'suppliers-merge-auto': return handleSuppliersMergeAuto(req, res);
      case 'banks': return id ? handleBankById(req, res) : handleBanks(req, res);
      case 'contas-contabeis': return handleContasContabeis(req, res);
      case 'extract-boleto': return handleExtractBoleto(req, res);
      case 'save-boleto-pattern': return handleSaveBoletoPattern(req, res);
      case 'boleto-patterns': return id ? handleDeleteBoletoPattern(req, res) : handleBoletoPatterns(req, res);
      case 'setup-tables': return handleSetupTables(req, res);
      case 'export-backup': return handleExportBackup(req, res);
      case 'fix-receitas-tipo': return handleFixReceitasTipo(req, res);
      default: return res.status(404).json({ error: 'Route not found' });
    }
  } catch (e) {
    console.error('[Router Error]', e);
    return res.status(500).json({ error: 'Erro no servidor', details: e.message });
  } finally {
    if (route !== 'health') await logRequest(req, res, startTime);
  }
}