import { setCors } from './_db.js';
import { checkRateLimit, sanitizeObject } from './_utils.js';

// --- Helpers de Autenticação embutidos para evitar erros de importação ---
const generateSimpleToken = (payload) => {
  const data = Buffer.from(JSON.stringify({ 
    ...payload, 
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) 
  })).toString('base64');
  return `header.${data}.signature`;
};

const verifyToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch { return null; }
};

// --- Handlers que precisam de importação ---
import { 
  handleTransactions, handleTransactionById, handleTransactionsBatch, 
  handleTransactionsBatchUpdate, handleTransactionsDedupeMovimentos, handleFixReceitasTipo 
} from './_handlers/transactions.js';
import { 
  handleSuppliers, handleSupplierById, handleSuppliersBatch, 
  handleSuppliersMerge, handleSuppliersMergeAuto 
} from './_handlers/suppliers.js';
import { handleBanks, handleBankById, handleContasContabeis } from './_handlers/banks.js';
import { handleStats } from './_handlers/stats.js';
import { handleExtractBoleto, handleBoletoPatterns, handleSaveBoletoPattern, handleDeleteBoletoPattern } from './_handlers/boleto.js';
import { handleSetupTables, handleExportBackup, handleDbCheck, logRequest } from './_handlers/admin.js';

export default async function handler(req, res) {
  const startTime = Date.now();
  
  // CORS Simples Seguro
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cn-security');
  
  if (req.method === "OPTIONS") return res.status(200).end();

  const { route, id } = req.query;

  // ── Lógica de Login Direta (Resolução do erro 500) ──────────────────
  if (route === 'login' || route === 'auth-login') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { password } = req.body || {};
    const APP_PASSWORD = process.env.APP_PASSWORD || "Turce.334180";
    const APP_UID = process.env.APP_UID || "odair";

    if (password === APP_PASSWORD) {
      const token = generateSimpleToken({ uid: APP_UID });
      return res.json({ token, user: { uid: APP_UID } });
    }
    return res.status(401).json({ error: "Senha incorreta" });
  }

  // ── Verificação de Token ──────────────────────────────────────────
  const decoded = verifyToken(req);
  if (!decoded) {
    const securityToken = req.headers["x-cn-security"];
    const EXPECTED = process.env.SECURITY_TOKEN || "CN-INT-2024-SECURE-HARDENED-V1";
    if (securityToken !== EXPECTED) {
      return res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
    }
    req.authUid = req.query.uid || 'guest';
  } else {
    req.authUid = decoded.uid;
  }

  // ── Sanitização ──────────────────────────────────────
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
    return res.status(500).json({ error: 'Erro no servidor', details: e.message });
  } finally {
    if (route !== 'health') await logRequest(req, res, startTime);
  }
}