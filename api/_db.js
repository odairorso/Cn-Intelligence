import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL);

export const parseDateToPg = (val) => {
  if (!val) return null;
  const str = String(val);
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  if (str.includes('-')) return str;
  return null;
};

export const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};
