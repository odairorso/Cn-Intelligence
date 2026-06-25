import pg from 'pg';
import { AsyncLocalStorage } from 'async_hooks';

export const dbStorage = new AsyncLocalStorage();

let connectionString = process.env.DATABASE_URL || process.env.URL_DO_BANCO_DE_DADOS || process.env.DATABASE_URLL;
// Remove any sslmode that might conflict with our manual ssl config
if (connectionString) {
  connectionString = connectionString.replace(/sslmode=[^&?]+/g, 'sslmode=require');
}

const poolMax = (() => {
  const raw = process.env.PG_POOL_MAX || process.env.DB_POOL_MAX || '2';
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 4) : 2;
})();

// SSL: por padrão exige certificado válido. Em ambiente local com certificado self-signed,
// defina PG_SSL_REJECT_UNAUTHORIZED=false (nunca faça isso em produção).
const sslRejectUnauthorized = String(process.env.PG_SSL_REJECT_UNAUTHORIZED ?? 'true').toLowerCase() !== 'false';

const pool = new pg.Pool({
  connectionString,
  max: poolMax,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  allowExitOnIdle: true,
  ssl: connectionString
    ? {
        rejectUnauthorized: sslRejectUnauthorized,
      }
    : false,
});

export class SqlQuery {
  constructor(strings, values) {
    this.strings = strings;
    this.values = values;
    this._isSqlQuery = true;
  }

  // Thenable implementation
  then(resolve, reject) {
    const { query, params } = this.build();
    const uid = dbStorage.getStore();
    pool.connect()
      .then(async client => {
        try {
          const currentUid = uid || '';
          await client.query('SELECT set_config($1, $2, $3)', ['app.current_uid', currentUid, false]);
          const res = await client.query(query, params);
          resolve(res.rows);
        } catch (err) {
          console.error('[DB Error] Query:', query);
          console.error('[DB Error] Object:', err);
          reject(err);
        } finally {
          client.release();
        }
      })
      .catch(reject);
  }

  build() {
    const finalStrings = [];
    const finalValues = [];
    let pIdx = 1;

    const _build = (strs, vals) => {
      strs.forEach((str, i) => {
        finalStrings.push(str);
        if (i < vals.length) {
          const v = vals[i];
          if (v && v._isSqlQuery) {
            _build(v.strings, v.values);
          } else {
            finalStrings.push(`$${pIdx++}`);
            finalValues.push(v);
          }
        }
      });
    };

    _build(this.strings, this.values);
    return { query: finalStrings.join(''), params: finalValues };
  }
}

export const sql = (strings, ...values) => {
  if (!Array.isArray(strings)) {
    const uid = dbStorage.getStore();
    return pool.connect().then(async client => {
      try {
        const currentUid = uid || '';
        await client.query('SELECT set_config($1, $2, $3)', ['app.current_uid', currentUid, false]);
        const res = await client.query(strings, values);
        return res.rows;
      } finally {
        client.release();
      }
    });
  }
  return new SqlQuery(strings, values);
};

sql.join = (queries, separator = '') => {
  if (!Array.isArray(queries) || queries.length === 0) {
    return new SqlQuery([''], []);
  }

  const values = [];
  const strings = [''];
  const sep = (separator && separator._isSqlQuery) 
    ? separator 
    : new SqlQuery([String(separator)], []);

  queries.forEach((q, idx) => {
    if (idx > 0) {
      values.push(sep);
      strings.push('');
    }
    values.push(q);
    strings.push('');
  });

  return new SqlQuery(strings, values);
};

export const parseDateToPg = (val) => {
  if (!val) return null;
  const s = String(val).trim();
  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts.length === 3 && parts[0].length === 4) return s.slice(0, 10);
  }
  const sep = s.includes('/') ? '/' : s.includes('.') ? '.' : null;
  if (sep) {
    const parts = s.split(sep);
    if (parts.length === 3) {
      let [d, m, y] = parts;
      d = d.padStart(2, '0'); m = m.padStart(2, '0');
      if (y.length === 2) y = '20' + y;
      return `${y}-${m}-${d}`;
    }
  }
  return null;
};

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const setCors = (req, res) => {
  const origin = req?.headers?.origin || '';
  const safeOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  if (safeOrigin) {
    res.setHeader('Access-Control-Allow-Origin', safeOrigin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cn-security, x-cn-backup-token');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
};
