import { sql, parseDateToPg } from '../_db.js';
import { handleError } from '../_utils.js';
import { TransactionSchema } from '../_schemas.js';

// POST /api?route=folha-push
export async function handleFolhaPush(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Autenticação via token fixo para integração servidor-a-servidor
  const authHeader = req.headers.authorization;
  const INTEGRATION_TOKEN = process.env.FOLHA_INTEGRATION_TOKEN || 'DEFAULT_FOLHA_INTEGRATION_TOKEN_123';
  if (!authHeader || authHeader !== `Bearer ${INTEGRATION_TOKEN}`) {
    return res.status(401).json({ error: 'Token de integração inválido' });
  }

  try {
    const { competencia, empresa, totalPagar, vencimento, fornecedor } = req.body;

    if (!competencia || !totalPagar) {
      return res.status(400).json({ error: 'Dados insuficientes. Exige competencia e totalPagar.' });
    }

    const vDate = parseDateToPg(vencimento) || new Date().toISOString().split('T')[0];
    const valorNumber = Number(totalPagar);

    // Conta 3.1 - Folha de Pagamento (assume ID fixo ou busca)
    let contaContabilId = null;
    const contaRows = await sql`SELECT id FROM contas_contabeis WHERE codigo = '3.1' AND ativo = true LIMIT 1`;
    if (contaRows.length > 0) {
      contaContabilId = contaRows[0].id;
    }

    const uid = 'system_folha'; // UID especial ou fixo

    // Dedup: se já enviou a mesma folha na mesma competência/empresa
    const duplicateRows = await sql`
      SELECT id FROM transactions
      WHERE fornecedor = ${fornecedor || `Folha de Pagamento - ${competencia}`}
        AND empresa = ${empresa || 'Geral'}
        AND deleted_at IS NULL
        AND abs(valor - ${valorNumber}) < 0.0001
      LIMIT 1
    `;

    if (duplicateRows.length) {
      return res.status(409).json({ error: 'Folha já integrada para esta competência/empresa e valor.' });
    }

    const rows = await sql`
      INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, pagamento, valor, status, banco, tipo, conta_contabil_id, created_by)
      VALUES (
        ${uid},
        ${fornecedor || `Folha de Pagamento - ${competencia}`},
        ${`Lançamento automático via integração da Folha - ${competencia}`},
        ${empresa || 'Geral'},
        ${vDate},
        NULL,
        ${valorNumber},
        'PENDENTE',
        NULL,
        'DESPESA',
        ${contaContabilId},
        ${uid}
      )
      RETURNING *`;

    // Audit Log simplificado para integração
    await sql`
      INSERT INTO audit_logs (user_uid, action, tabela, record_id, dados_novos)
      VALUES (${uid}, 'CREATE', 'transactions', ${rows[0].id}, ${JSON.stringify(rows[0])})
    `;

    return res.status(201).json(rows[0]);
  } catch (e) {
    return handleError(res, e, 'folha.js handleFolhaPush');
  }
}
