import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL);

export const parseDateToPg = (val) => {
  if (!val) return null;
  const s = String(val).trim();

  // 1. Prioridade: Se já vier no formato do banco YYYY-MM-DD (ISO)
  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts.length === 3 && parts[0].length === 4) return s.slice(0, 10);
  }

  // 2. Formato DD/MM/YYYY ou similar (extrai apenas dígitos)
  const digits = s.replace(/\D/g, ''); 
  if (digits.length === 8) {
    const day = digits.substring(0, 2);
    const month = digits.substring(2, 4);
    const year = digits.substring(4, 8);
    return `${year}-${month}-${day}`;
  }

  return null;
};

export const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};
