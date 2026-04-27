import pg from 'pg';

// Configuração do Pool para o Supabase (compatível com IPv4 via Session Pooler)
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || process.env.URL_DO_BANCO_DE_DADOS,
  ssl: { rejectUnauthorized: false }
});

// Wrapper para manter a compatibilidade com a sintaxe de Template Literals do Neon
export const sql = async (strings, ...values) => {
  // Se for chamado como função normal em vez de template literal
  if (!Array.isArray(strings)) {
    const res = await pool.query(strings, values);
    return res.rows;
  }

  // Reconstrói a query com placeholders $1, $2...
  const query = strings.reduce((acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''), '');
  
  try {
    const res = await pool.query(query, values);
    return res.rows;
  } catch (err) {
    console.error('[DB Error] Query:', query);
    console.error('[DB Error] Values:', values);
    throw err;
  }
};

export const parseDateToPg = (val) => {
  if (!val) return null;
  const s = String(val).trim();
  
  // 1. ISO: YYYY-MM-DD
  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return s.slice(0, 10);
    }
  }

  // 2. Separadores comuns: / ou .
  const sep = s.includes('/') ? '/' : s.includes('.') ? '.' : null;
  if (sep) {
    const parts = s.split(sep);
    if (parts.length === 3) {
      let [d, m, y] = parts;
      d = d.padStart(2, '0');
      m = m.padStart(2, '0');
      if (y.length === 2) y = '20' + y;
      return `${y}-${m}-${d}`;
    }
  }

  // 3. Apenas dígitos
  const digits = s.replace(/\D/g, '');
  if (digits.length === 6) { // DDMMYY
    const d = digits.substring(0, 2);
    const m = digits.substring(2, 4);
    const y = '20' + digits.substring(4, 6);
    return `${y}-${m}-${d}`;
  }
  if (digits.length === 8) {
    const d = digits.substring(0, 2);
    const m = digits.substring(2, 4);
    const y = digits.substring(4, 8);
    if (parseInt(m) <= 12 && parseInt(d) <= 31) {
      return `${y}-${m}-${d}`;
    }
    return `${digits.substring(0, 4)}-${digits.substring(4, 6)}-${digits.substring(6, 8)}`;
  }
  return null;
};

export const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};
