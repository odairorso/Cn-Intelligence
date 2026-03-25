import { Client } from 'pg';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import 'dotenv/config';

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

const filePath = './Fluxo de caixa - Grupo CN 2024_2025.xlsx';

async function importData() {
  console.log('Lendo arquivo Excel...');
  if (!fs.existsSync(filePath)) {
    console.error('Arquivo não encontrado:', filePath);
    return;
  }

  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  console.log(`Planilha carregada. Encontradas ${workbook.SheetNames.length} abas.`);

  let allDataMatrix: any[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    console.log(`Lendo aba: ${sheetName}`);
    const worksheet = workbook.Sheets[sheetName];
    
    // raw: true para ler valores numéricos como numbers (não strings formatadas)
    const sheetMatrix = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as any[][];
    
    if (sheetMatrix.length < 2) continue; // Pula abas vazias
    
    const headers = sheetMatrix[0].map(h => String(h || '').trim().toUpperCase());
    
    for (let i = 1; i < sheetMatrix.length; i++) {
      const row = sheetMatrix[i];
      if (!row || row.length === 0) continue; // Pula linha vazia
      
      const rowData: any = { _aba_origem: sheetName };
      
      // Mapeia os valores usando o índice real do cabeçalho da aba
      headers.forEach((header, index) => {
        if (header) {
          // Mantém o cabeçalho original em maiúsculo como chave
          rowData[header] = row[index];
        }
      });
      
      allDataMatrix.push(rowData);
    }
  }

  console.log(`Total de linhas combinadas (Matriz Exata): ${allDataMatrix.length}`);

  const getRowValue = (row: any, keys: string[]) => {
    // Agora que as chaves são garantidas do cabeçalho da aba, match exato é suficiente
    for (const key of keys) {
      const foundKey = Object.keys(row).find(rk => rk === key.toUpperCase());
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
        return row[foundKey];
      }
    }
    return undefined;
  };

  const parseValor = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val).replace(/[R$\s]/g, '').trim();
    if (str === '' || str.toUpperCase() === 'TOTAL') return 0;
    if (str.includes(',') && str.includes('.')) {
       return Number(str.replace(/\./g, '').replace(',', '.'));
    } else if (str.includes(',')) {
       return Number(str.replace(',', '.'));
    } else if ((str.match(/\./g) || []).length > 1) {
       return Number(str.replace(/\./g, ''));
    }
    const n = Number(str);
    return isNaN(n) ? 0 : n;
  };

  await client.connect();
  console.log('Conectado ao banco de dados Neon.');

  let totalImported = 0;
  let totalFinanceiro = 0;
  const localSuppliers = new Set<string>();
  const batchTransactions: any[] = [];
  const BATCH_SIZE = 500;

  console.log('Iniciando envio para o PostgreSQL...');

  const flushBatch = async (client: any) => {
    if (batchTransactions.length === 0) return;
    
    const values: any[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    for (const tx of batchTransactions) {
      values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      params.push(tx.uid, tx.fornecedor, tx.descricao, tx.empresa, tx.vencimento, tx.pagamento, tx.valor, tx.status);
    }
    
    await client.query(
      `INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status) VALUES ${values.join(', ')}`,
      params
    );
    
    batchTransactions.length = 0;
  };

  // Helper para conversão de datas pro formato aceito pelo PG (YYYY-MM-DD)
  const parseDateToPg = (val: any, sheetName?: string): string | null => {
    if (!val) return null;
    
    // Se a data já vier como string direto do Excel (ex: "20/03/2026")
    if (typeof val === 'string' && val.includes('/')) {
      const parts = val.split('/');
      if (parts.length === 3) {
        let p0 = Number(parts[0]);
        let p1 = Number(parts[1]);
        let p2 = parts[2];
        
        // Ajuste de ano 2 dígitos
        if (p2.length === 2) p2 = '20' + p2;
        
        let day = p0;
        let month = p1;
        
        // O Excel americano lê MM/DD/YYYY, o Brasil lê DD/MM/YYYY
        // Vamos tentar inferir. Se p0 for > 12, ele É dia.
        if (p0 > 12) {
          day = p0;
          month = p1;
        } else if (p1 > 12) {
          day = p1;
          month = p0;
        } else {
          // Os dois são menores que 12. Como saber?
          // Se estamos na aba MARÇO, o mês deve ser 3!
          if (sheetName && sheetName.toUpperCase().includes('MAR')) {
             if (p0 === 3) { month = p0; day = p1; }
             else if (p1 === 3) { month = p1; day = p0; }
             else { day = p0; month = p1; } // Fallback DD/MM
          } else {
             // Fallback padrão: assumir que é DD/MM se vier string brasileira "20/03/2026"
             day = p0;
             month = p1;
          }
        }
        
        // Validação final de sanidade para não quebrar o banco (2025-18-18 não existe)
        if (month > 12) {
          let temp = month;
          month = day;
          day = temp;
        }
        
        if (month > 12) month = 12;
        if (day > 31) day = 28;
        
        return `${p2}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    
    if (typeof val === 'number') {
      const excelEpoch = Date.UTC(1899, 11, 30);
      const dt = new Date(excelEpoch + val * 24 * 60 * 60 * 1000);
      const y = dt.getUTCFullYear();
      const m = dt.getUTCMonth() + 1;
      const d = dt.getUTCDate();
      // Se year inválido (ex: 1938, 2002, 2028) — aceita todos os anos válidos do Excel
      if (!Number.isFinite(y)) return null;
      // Validação de sanidade: ano entre 1990 e 2035 é plausível para dados financeiros
      if (y < 1990 || y > 2035) return null;
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    // Se o XLSX converteu para Date (ele as vezes inverte mês e dia na leitura se o Windows tiver confuso)
    if (val instanceof Date) {
      const dt = new Date(val);
      let day = dt.getUTCDate();
      let month = dt.getUTCMonth() + 1;
      let year = dt.getUTCFullYear();
      
      // Validação de sanidade do Date object
      if (month > 12) {
        let temp = month;
        month = day;
        day = temp;
      }
      
      // Validação final anti-quebra de banco (se mesmo invertendo der ruim, ex: dia 35)
      if (month > 12) month = 12;
      if (day > 31) day = 28;
      
      if (!Number.isFinite(year) || year < 1990 || year > 2035) return null;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    
    // Fallback pra string não padronizada que chegou aqui (ex: "18-18-2025" ou lixo)
    return null;
  };

  try {
    await client.query('BEGIN');
    
    const shouldReset = process.env.RESET_BEFORE_IMPORT === 'true';
    if (shouldReset) {
      console.log('Limpando dados antigos...');
      await client.query('TRUNCATE TABLE transactions RESTART IDENTITY CASCADE');
      await client.query('TRUNCATE TABLE suppliers RESTART IDENTITY CASCADE');
      console.log('Banco zerado. Iniciando importação nova...');
    } else {
      console.log('Importação sem limpeza prévia (dados manuais preservados).');
    }

    for (const row of allDataMatrix) {
      const rawFornecedor = getRowValue(row, ['FORNECEDOR', 'FORNECEDORES', 'FORNECEDOR_NOME', 'NOME', 'FAVORECIDO', 'CLIENTE']);
      if (!rawFornecedor || String(rawFornecedor).toUpperCase().includes('TOTAL')) continue;

      const rawValor = getRowValue(row, ['VALOR', 'VALOR TOTAL', 'TOTAL', 'VALOR_TOTAL', 'QUANTIA', 'PREÇO', 'PRECO', 'SAIDA', 'SAÍDA', 'PAGAMENTO']);
      const sanitizedValor = parseValor(rawValor);
      
      if (sanitizedValor === 0 && !rawValor) continue;
      if (String(rawFornecedor).toUpperCase() === 'FORNECEDOR' || String(rawFornecedor).toUpperCase() === 'CLIENTE') continue;

      const fornecedorNome = String(rawFornecedor).trim();
      
      const rawVencimento = getRowValue(row, ['VENCIMENTO', 'DATA VENCIMENTO', 'VENC']);
      const rawPagamento = getRowValue(row, ['DATA PAGAMENTO', 'PAGAMENTO', 'DATA PAGO', 'PAGO EM']);
      
      const rawDescricao = getRowValue(row, ['DESCRIÇÃO', 'DESCRICAO', 'OBSERVACAO', 'OBSERVAÇÃO', 'OBS 1', 'OBS 2', 'OBS', 'DETALHE']);
      const rawEmpresa = getRowValue(row, ['EMPRESA', 'UNIDADE', 'LOJA']);

      const vencimentoDate = parseDateToPg(rawVencimento, row._aba_origem);
      const pagamentoDatePg = rawPagamento ? parseDateToPg(rawPagamento, row._aba_origem) : null;
      if (!vencimentoDate) continue;
      
      const rawStatus = String(getRowValue(row, ['STATUS', 'SITUAÇÃO', 'SITUACAO', 'PAGO', 'SIT 2']) || '').toUpperCase();
      let status = 'PENDENTE';
      
      if (pagamentoDatePg || rawStatus.includes('PAGO')) {
        status = 'PAGO';
      } else if (rawStatus.includes('VENCIDO')) {
        status = 'VENCIDO';
      }

      batchTransactions.push({
        uid: 'guest',
        fornecedor: fornecedorNome,
        descricao: String(rawDescricao || '-'),
        empresa: String(rawEmpresa || 'Geral'),
        vencimento: vencimentoDate,
        pagamento: pagamentoDatePg,
        valor: sanitizedValor,
        status: status
      });
      
      totalFinanceiro += sanitizedValor;
      totalImported++;

      if (!localSuppliers.has(fornecedorNome) && fornecedorNome !== 'Desconhecido') {
        await client.query(
          `INSERT INTO suppliers (uid, nome) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          ['guest', fornecedorNome]
        );
        localSuppliers.add(fornecedorNome);
      }
      
      if (batchTransactions.length >= BATCH_SIZE) {
        await flushBatch(client);
        console.log(`Inseridos ${totalImported} registros... (Volume: R$ ${totalFinanceiro.toLocaleString('pt-BR')})`);
      }
    }

    await flushBatch(client);
    await client.query('COMMIT');
    console.log(`FINALIZADO! Total de ${totalImported} lançamentos importados com sucesso.`);
    console.log(`VOLUME FINANCEIRO TOTAL: R$ ${totalFinanceiro.toLocaleString('pt-BR')}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro durante a importação. Rollback executado.', err);
  } finally {
    await client.end();
  }
}

importData().catch(console.error);
