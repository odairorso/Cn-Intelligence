/**
 * Servidor local de desenvolvimento
 * Mínimo possível: CORS + rate limiting + delega tudo para api/index.js
 * Em produção (Vercel), api/index.js é usado diretamente como Serverless Function
 */
import express from 'express';
import { createServer } from 'http';

// --------------------------------------------------------------
// CORS — headers permitidos (devem bater com fetchWithSecurity no frontend)
// --------------------------------------------------------------
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

const corsMiddleware = (req, res, next) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-cn-security, x-cn-backup-token'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
};

// --------------------------------------------------------------
// Rate Limiting in-memory
// --------------------------------------------------------------
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 100;

const rateLimitMiddleware = (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + RATE_LIMIT_WINDOW;
  } else {
    record.count++;
  }
  if (record.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  rateLimitMap.set(ip, record);
  next();
};

// --------------------------------------------------------------
// Proxy para api/index.js (Vercel-style Serverless Functions)
// --------------------------------------------------------------
// Importa o handler modular que é o MESMO usado em produção
const apiHandler = (await import('./api/index.js')).default;

const app = express();
app.use(corsMiddleware);
app.use(rateLimitMiddleware);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// TODAS as rotas /api delegam para api/index.js
app.all('/api/*', async (req, res) => {
  try {
    await apiHandler(req, res);
  } catch (e) {
    console.error('[api] error:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.all('/api', async (req, res) => {
  try {
    await apiHandler(req, res);
  } catch (e) {
    console.error('[api] error:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --------------------------------------------------------------
// Health check
// --------------------------------------------------------------
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// --------------------------------------------------------------
// Servir frontend em produção (Vercel cuida disso, mas útil local)
// --------------------------------------------------------------
if (process.env.NODE_ENV !== 'production') {
  // Em dev, Vite serve o frontend; aqui só garantimos que / vai responder
  app.get('*', (_req, res) => {
    res.status(404).json({ error: 'Not found (API-only in dev mode)' });
  });
}

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  console.log(`[AUTH] APP_PASSWORD must be set in .env`);
});

// Graceful shutdown
process.on('SIGTERM', () => server.close());