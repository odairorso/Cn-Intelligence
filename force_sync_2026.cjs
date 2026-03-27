const xlsx = require('xlsx');
const pg = require('pg');
require('dotenv').config();

const { Pool } = pg;
const filePath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';

const getRowValue = (row, keys) => {
    for (const key of keys) {
      const foundKey = Object.keys(row).find(rk => rk === key.toUpperCase());
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
        return row[foundKey];
      }
    }
    return undefined;
};

// Conversão robusta de datas do Excel
const parseDataValue = (val) => {
    if (val === undefined || val === null) return undefined;
    
    // Se for data serial do Excel (ex: 46030)
    if (typeof val === 'number') {
      const excelEpoch = Date.UTC(1899, 11, 30);
      const dt = new Date(excelEpoch + val * 24 * 60 * 60 * 1000);
      const y = dt.getUTCFullYear();
      const m = dt.getUTCMonth() + 1;
      const d = dt.getUTCDate();
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    
    // String DD/MM/YY ou DD/MM/YYYY
    const str = String(val).trim();
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
            let y = parts[2];
            if (y.length === 2) y = '20' + y;
            return `${y}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
        }
    }
    
    if (str.includes('-')) {
        return str.substring(0, 10);
    }
    
    // Date object
    if (val instanceof Date) {
        return `${val.getUTCFullYear()}-${String(val.getUTCMonth()+1).padStart(2, '0')}-${String(val.getUTCDate()).padStart(2, '0')}`;
    }

    return undefined;
};

async function forceSync2026() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const buffer = require('fs').readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  
  let inserted = 0;
  let errors = 0;
  
  const client = await pool.connect();
  
  try {
      console.log('Iniciando sincronização forçada de abas 2026...');
      
      const targetSheets = ['Janeiro 26', 'Fev 26', 'Março26'];
      
      for (const s of targetSheets) {
          console.log(`\nProcessando aba: ${s}`);
          const ws = workbook.Sheets[s];
          if (!ws) continue;
          
          const sheetMatrix = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });
          if (sheetMatrix.length < 1) continue;
          
          const headers = sheetMatrix[0].map(h => String(h || '').trim().toUpperCase());
          const txs = [];
          
          for (let i = 1; i < sheetMatrix.length; i++) {
              const row = sheetMatrix[i];
              if (!row || row.length === 0) continue;
              const rowData = {};
              headers.forEach((header, index) => {
                if (header && row[index] !== undefined) rowData[header] = row[index];
              });
              
              const fornecedor = getRowValue(rowData, ['FORNECEDOR', 'FORNECEDORES', 'NOME']);
              let vencimento = getRowValue(rowData, ['VENCIMENTO', 'DATA']);
              const valorRaw = getRowValue(rowData, ['VALOR']);
              
              if (!fornecedor || String(fornecedor).toUpperCase().includes('TOTAL')) continue;
              
              vencimento = parseDataValue(vencimento);
              if (!vencimento) continue;
              // Ignorar se não for 2026
              if (!vencimento.startsWith('2026')) continue;
              
              let valorNum = parseFloat(String(valorRaw).replace(/[^\d,-]/g, '').replace(',', '.'));
              if (isNaN(valorNum)) valorNum = 0;
              
              const statusRaw = String(getRowValue(rowData, ['SITUAÇÃO', 'SITUACAO']) || '').toUpperCase();
              let isPaid = statusRaw.includes('PAGO') || statusRaw === 'PG' || statusRaw === 'PAGA';
              if (!isPaid && rowData['DATA PAGAMENTO']) isPaid = true;
              
              const pagamento = isPaid ? (parseDataValue(getRowValue(rowData, ['DATA PAGAMENTO'])) || vencimento) : null;
              const status = isPaid ? 'PAGO' : 'PENDENTE';
              
              let empresa = String(getRowValue(rowData, ['EMPRESA']) || 'CN').toUpperCase().trim();
              if (empresa.includes('CN')) empresa = 'CN';
              else if (empresa.includes('FACEMS')) empresa = 'FACEMS';
              else if (empresa.includes('LAB')) empresa = 'LAB';
              else if (empresa.includes('CEI')) empresa = 'CEI';
              else if (empresa.includes('UNOPAR')) empresa = 'UNOPAR';
              else empresa = 'CN';
              
              txs.push({
                  uid: 'guest',
                  fornecedor: String(fornecedor).trim(),
                  descricao: String(getRowValue(rowData, ['DESCRIÇÃO', 'DESCRICAO', 'OBS 1', 'OBSERVAÇÃO']) || '-').substring(0, 255),
                  empresa,
                  vencimento,
                  pagamento,
                  valor: valorNum,
                  status,
                  banco: null
              });
          }
          
          console.log(`Encontrados ${txs.length} registros válidos de 2026 na aba ${s}`);
          
          await client.query('BEGIN');
          for (const tx of txs) {
              try {
                  // Prevenir duplicatas exatas usando SELECT EXISTS? (Opcional, mas seguro)
                  const check = await client.query(
                      `SELECT id FROM transactions 
                       WHERE fornecedor = $1 AND vencimento = $2 AND valor = $3 AND empresa = $4
                       LIMIT 1`,
                      [tx.fornecedor, tx.vencimento, tx.valor, tx.empresa]
                  );
                  
                  if (check.rows.length === 0) {
                      await client.query(
                          `INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco)
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                          [tx.uid, tx.fornecedor, tx.descricao, tx.empresa, tx.vencimento, tx.pagamento, tx.valor, tx.status, tx.banco]
                      );
                      inserted++;
                  }
              } catch (err) {
                  errors++;
                  console.error(`Falha ao inserir: ${tx.fornecedor} (${tx.vencimento}). Error: ${err.message}`);
              }
          }
          await client.query('COMMIT');
      }
      
      console.log(`\nSincronização concluída!`);
      console.log(`Inseridos novos: ${inserted}`);
      console.log(`Erros logados: ${errors}`);
      
  } catch (e) {
      await client.query('ROLLBACK');
      console.error('Falha geral no script:', e);
  } finally {
      client.release();
      pool.end();
  }
}

forceSync2026();
