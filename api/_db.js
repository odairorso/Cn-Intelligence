import pg from 'pg';

let connectionString = process.env.DATABASE_URL || process.env.URL_DO_BANCO_DE_DADOS || process.env.DATABASE_URLL;
// Remove any sslmode that might conflict with our manual ssl config
if (connectionString) {
  connectionString = connectionString.replace(/sslmode=[^&?]+/g, 'sslmode=no-verify');
}

const pool = new pg.Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

class SqlQuery {
  constructor(strings, values) {
    this.strings = strings;
    this.values = values;
    this._isSqlQuery = true;
  }

  // Thenable implementation
  then(resolve, reject) {
    const { query, params } = this.build();
    pool.query(query, params)
      .then(res => resolve(res.rows))
      .catch(err => {
        console.error('[DB Error] Query:', query);
        console.error('[DB Error] Object:', err);
        reject(err);
      });
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
    return pool.query(strings, values).then(res => res.rows);
  }
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

export const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};
