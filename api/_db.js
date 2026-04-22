import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL);

export const parseDateToPg = (val) => {
  if (!val) return null;
  const s = String(val).trim();
  console.log(`[parser] Input: "${s}"`);
  
  // 1. ISO: YYYY-MM-DD
  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const res = s.slice(0, 10);
      console.log(`[parser] ISO Match: ${res}`);
      return res;
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
      const res = `${y}-${m}-${d}`;
      console.log(`[parser] Separated Match (${sep}): ${res}`);
      return res;
    }
  }

  // 3. Apenas dígitos
  const digits = s.replace(/\D/g, '');
  if (digits.length === 6) { // DDMMYY
    const d = digits.substring(0, 2);
    const m = digits.substring(2, 4);
    const y = '20' + digits.substring(4, 6);
    const res = `${y}-${m}-${d}`;
    console.log(`[parser] Digits6 Match: ${res}`);
    return res;
  }
  if (digits.length === 8) {
    // Tenta DDMMYYYY primeiro (BR)
    const d = digits.substring(0, 2);
    const m = digits.substring(2, 4);
    const y = digits.substring(4, 8);
    if (parseInt(m) <= 12 && parseInt(d) <= 31) {
      const res = `${y}-${m}-${d}`;
      console.log(`[parser] Digits8 BR Match: ${res}`);
      return res;
    }
    
    // Fallback: YYYYMMDD
    const res = `${digits.substring(0, 4)}-${digits.substring(4, 6)}-${digits.substring(6, 8)}`;
    console.log(`[parser] Digits8 ISO Match: ${res}`);
    return res;
  }

  console.log(`[parser] No match found for "${s}"`);
  return null;
};

export const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};
