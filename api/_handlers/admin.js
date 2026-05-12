import { sql } from '../_db.js';
import { logSecurity } from '../_utils.js';

// POST /api?route=setup-tables
export async function handleSetupTables(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    await sql`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      uid VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255),
      display_name VARCHAR(255),
      photo_url TEXT,
      password_hash TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;
    return res.json({ message: 'Tables verified/created successfully' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// GET /api?route=db-check
export async function handleDbCheck(req, res) {
  try {
    const rows = await sql`SELECT 1 AS ok, version(), current_database() as db`;
    return res.json({ ok: true, info: rows[0] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}

// GET /api?route=export-backup
export async function handleExportBackup(req, res) {
  const backupToken = req.headers['x-cn-backup-token'];
  const BACKUP_TOKEN = process.env.BACKUP_TOKEN;

  if (!BACKUP_TOKEN) {
    await logSecurity(req, res, "BACKUP_TOKEN não configurado no servidor");
    return res.status(500).json({ error: 'Backup não disponível. BACKUP_TOKEN não configurado.' });
  }

  if (backupToken !== BACKUP_TOKEN) {
    res.status(403);
    await logSecurity(req, res, "Tentativa de backup sem token válido");
    return res.json({ error: "Acesso negado" });
  }

  try {
    const [txs, sups, banks] = await Promise.all([
      sql`SELECT * FROM transactions`,
      sql`SELECT * FROM suppliers`,
      sql`SELECT * FROM banks`
    ]);
    return res.json({ timestamp: new Date(), data: { transactions: txs, suppliers: sups, banks } });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// Logging Helpers
export async function logRequest(req, res, startTime, responseSize = 0) {
  const duration = Date.now() - startTime;
  try {
    await sql`
      INSERT INTO api_logs (route, method, status_code, duration_ms, response_size_bytes)
      VALUES (${req.query.route || "unknown"}, ${req.method}, ${res.statusCode}, ${duration}, ${responseSize})
    `;
  } catch (e) {
    console.error("[logRequest] Error:", e.message);
  }
}