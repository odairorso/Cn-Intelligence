import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL);

export const parseDateToPg = (val) => {
  if (!val) return null;
  const str = String(val).replace(/\D/g, ''); // Remove qualquer coisa que não seja número
  
  // Formato DD/MM/YYYY ou similar (já tratado pelo replace acima se vier com separadores)
  if (str.length === 8) {
    const day = str.substring(0, 2);
    const month = str.substring(2, 4);
    const year = str.substring(4, 8);
    return `${year}-${month}-${day}`;
  }

  // Se já vier no formato do banco YYYY-MM-DD
  if (String(val).includes('-')) {
    const parts = String(val).split('-');
    if (parts.length === 3 && parts[0].length === 4) return String(val);
  }

  return null;
};

export const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};
