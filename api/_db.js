import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || process.env.URL_DO_BANCO_DE_DADOS,
  ssl: { rejectUnauthorized: false }
});

class SqlQuery {
  constructor(strings, values) {
    this.strings = strings;
    this.values = values;
    this._isSqlQuery = true;
  }

  // Permite que o objeto seja awaitado
  async then(resolve, reject) {
    try {
      const { query, params } = this.build();
      const res = await pool.query(query, params);
      resolve(res.rows);
    } catch (err) {
      const { query, params } = this.build();
      console.error('[DB Error] Query:', query);
      console.error('[DB Error] Values:', params);
      reject(err);
    }
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
    // Caso de chamada legada ou direta: sql('query', [params])
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
  const digits = s.replace(/\D/g, '');
  if (digits.length === 6) {
    return `20${digits.substring(4, 6)}-${digits.substring(2, 4)}-${digits.substring(0, 2)}`;
  }
  if (digits.length === 8) {
    const d = digits.substring(0, 2);
    const m = digits.substring(2, 4);
    const y = digits.substring(4, 8);
    if (parseInt(m) <= 12 && parseInt(d) <= 31) return `${y}-${m}-${d}`;
    return `${digits.substring(0, 4)}-${digits.substring(4, 6)}-${digits.substring(6, 8)}`;
  }
  return null;
};

export const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};
