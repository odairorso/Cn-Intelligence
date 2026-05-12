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

  // ── Rota pública: Login (não exige token)
  if (req.query.route === 'login') return handleLogin(req, res);
  if (req.query.route === 'health') return res.json({ ok: true, node: process.version });

  // ── Rate Limit
  if (!checkRateLimit(req, res)) return;

  // ── Verificar token JWT (todas as outras rotas)
  const decoded = verifyToken(req);
  if (!decoded) {
    // Fallback para token legado x-cn-security durante a transição
    const securityToken = req.headers['x-cn-security'];
    const EXPECTED_TOKEN = process.env.SECURITY_TOKEN || 'CN-INT-2024-SECURE-HARDENED-V1';
    if (securityToken !== EXPECTED_TOKEN) {
      res.status(401);
      await logSecurity(req, res, 'Token JWT ausente ou inválido');
      return res.json({ error: 'Não autorizado. Faça login novamente.' });
    }
    // Token legado aceito — injeta uid do query param por compatibilidade
    req.auth = { uid: req.query.uid || 'guest', legacy: true };
  } else {
    // JWT válido — uid vem do token, não do query param (mais seguro)
    req.auth = { uid: decoded.uid, legacy: false };
  }

  // Sanitização Global
  if (['POST', 'PUT'].includes(req.method) && req.body && req.query.route !== 'extract-boleto') {
    req.body = sanitizeObject(req.body);
  }

  const { route, id } = req.query;

  try {
    switch (route) {
      case 'health': return res.json({ ok: true, node: process.version });
      case 'db-check': return handleDbCheck(req, res);
      case 'stats': return handleStats(req, res);
      case 'fix-receitas-tipo': return handleFixReceitasTipo(req, res);
      
      // Transações
      case 'transactions': return id ? handleTransactionById(req, res) : handleTransactions(req, res);
      case 'transactions-batch': return handleTransactionsBatch(req, res);
      case 'transactions-batch-update': return handleTransactionsBatchUpdate(req, res);
      case 'transactions-dedupe-movimentos': return handleTransactionsDedupeMovimentos(req, res);
      
      // Fornecedores
      case 'suppliers': return id ? handleSupplierById(req, res) : handleSuppliers(req, res);
      case 'suppliers-batch': return handleSuppliersBatch(req, res);
      case 'suppliers-merge': return handleSuppliersMerge(req, res);
      case 'suppliers-merge-auto': return handleSuppliersMergeAuto(req, res);
      
      // Bancos e Contas
      case 'banks': return id ? handleBankById(req, res) : handleBanks(req, res);
      case 'contas-contabeis': return handleContasContabeis(req, res);
      
      // Boletos e IA
      case 'extract-boleto': return handleExtractBoleto(req, res);
      case 'save-boleto-pattern': return handleSaveBoletoPattern(req, res);
      case 'boleto-patterns': return id ? handleDeleteBoletoPattern(req, res) : handleBoletoPatterns(req, res);
      
      // Admin
      case 'setup-tables': return handleSetupTables(req, res);
      case 'export-backup': return handleExportBackup(req, res);
      
      default: return res.status(404).json({ error: 'Route not found' });
    }
  } catch (e) {
    console.error('[Router Error]', e);
    return res.status(500).json({ error: 'Erro interno no roteador', details: e.message });
  } finally {
    // Log final da requisição (opcional)
    if (route !== 'health') await logRequest(req, res, startTime);
  }
}
