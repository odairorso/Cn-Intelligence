import { sql } from '../_db.js';

// GET /api?route=stats — retorna agregados globais para o dashboard
export async function handleStats(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const uid = req.authUid;
  if (!uid) return res.status(401).json({ error: 'Autenticação necessária' });

  try {
    const { year, period, empresa, tipo, status, search } = req.query;

    const uidFilterSql = sql`AND (uid = ${uid} OR uid IS NULL)`;

    // Filtros
    const empresaFilterSql = empresa && empresa !== 'TODOS' ? sql`AND upper(empresa) = upper(${empresa})` : sql``;
    const tipoFilterSql = tipo && tipo !== 'TODOS' ? sql`AND tipo = ${tipo}` : sql``;
    const statusFilterSql = status && status !== 'TODOS'
      ? (status === 'NAO_PAGO' ? sql`AND (status = 'PENDENTE' OR status = 'VENCIDO')` : sql`AND status = ${status}`)
      : sql``;

    let searchFilterSql = sql``;
    if (search) {
      const sRaw = `%${search}%`;
      searchFilterSql = sql`AND (fornecedor ILIKE ${sRaw} OR descricao ILIKE ${sRaw} OR empresa ILIKE ${sRaw})`;
    }

    // Filtro de data dinâmico
    let dateFilterSql;
    const isRange = (val) => /^\d{4}-\d{4}$/.test(val);

    if (year && year !== 'TODOS' && !isRange(year)) {
      const y = parseInt(year);
      dateFilterSql = sql`AND vencimento >= ${y + '-01-01'} AND vencimento <= ${y + '-12-31'}`;
    } else if (isRange(year) || isRange(period)) {
      const range = isRange(year) ? year : period;
      const [start, end] = range.split('-');
      dateFilterSql = sql`AND vencimento >= ${start + '-01-01'} AND vencimento <= ${end + '-12-31'}`;
    } else {
      dateFilterSql = sql``;
    }

    // 1. KPIs Agrupados
    const kpiRows = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN UPPER(tipo) = 'RECEITA' THEN valor ELSE 0 END), 0) as total_receitas,
        COALESCE(SUM(CASE WHEN UPPER(tipo) = 'DESPESA' THEN valor + COALESCE(juros, 0) ELSE 0 END), 0) as total_despesas,
        COALESCE(SUM(CASE WHEN UPPER(tipo) = 'TRANSFERENCIA' THEN valor + COALESCE(juros, 0) ELSE 0 END), 0) as total_transferencias,
        COALESCE(SUM(ABS(valor) + COALESCE(juros, 0)), 0) as total_geral,
        COUNT(CASE WHEN status = 'PAGO' AND tipo != 'TRANSFERENCIA' THEN 1 END) as count_pagos,
        COUNT(CASE WHEN (status = 'PENDENTE' OR status = 'VENCIDO') AND (vencimento >= CURRENT_DATE OR vencimento IS NULL) AND tipo != 'TRANSFERENCIA' THEN 1 END) as count_pendentes,
        COUNT(CASE WHEN (status = 'VENCIDO' OR (status = 'PENDENTE' AND vencimento < CURRENT_DATE)) AND tipo != 'TRANSFERENCIA' THEN 1 END) as count_vencidos,
        COUNT(CASE WHEN tipo != 'TRANSFERENCIA' THEN 1 END) as total_count
      FROM transactions
      WHERE 1=1 ${uidFilterSql} ${dateFilterSql} ${empresaFilterSql} ${tipoFilterSql} ${statusFilterSql} ${searchFilterSql}`;

    // 2. Fluxo Mensal
    let fluxRows;
    const activeRange = isRange(year) ? year : (isRange(period) ? period : null);

    if (year && year !== 'TODOS' && !activeRange) {
      const y = parseInt(year);
      fluxRows = await sql`
        SELECT
          EXTRACT(MONTH FROM vencimento) as month_num,
          COALESCE(SUM(CASE WHEN tipo = 'RECEITA' THEN valor ELSE 0 END), 0) as receitas,
          COALESCE(SUM(CASE WHEN tipo = 'DESPESA' THEN valor + COALESCE(juros, 0) ELSE 0 END), 0) as despesas
        FROM transactions
        WHERE 1=1 ${uidFilterSql} ${dateFilterSql} ${empresaFilterSql} ${tipoFilterSql} ${statusFilterSql} ${searchFilterSql}
          AND vencimento >= ${y + '-01-01'}
          AND vencimento <= ${y + '-12-31'}
        GROUP BY EXTRACT(MONTH FROM vencimento)
        ORDER BY month_num`;
    } else if (activeRange) {
      const [start, end] = activeRange.split('-');
      fluxRows = await sql`
        SELECT
          EXTRACT(MONTH FROM vencimento) as month_num,
          COALESCE(SUM(CASE WHEN tipo = 'RECEITA' THEN valor ELSE 0 END), 0) as receitas,
          COALESCE(SUM(CASE WHEN tipo = 'DESPESA' THEN valor + COALESCE(juros, 0) ELSE 0 END), 0) as despesas
        FROM transactions
        WHERE 1=1 ${uidFilterSql} ${dateFilterSql} ${empresaFilterSql} ${tipoFilterSql} ${statusFilterSql} ${searchFilterSql}
          AND vencimento >= ${start + '-01-01'}
          AND vencimento <= ${end + '-12-31'}
        GROUP BY EXTRACT(MONTH FROM vencimento)
        ORDER BY month_num`;
    } else {
      fluxRows = await sql`
        SELECT
          EXTRACT(MONTH FROM vencimento) as month_num,
          COALESCE(SUM(CASE WHEN tipo = 'RECEITA' THEN valor ELSE 0 END), 0) as receitas,
          COALESCE(SUM(CASE WHEN tipo = 'DESPESA' THEN valor + COALESCE(juros, 0) ELSE 0 END), 0) as despesas
        FROM transactions
        WHERE 1=1 ${uidFilterSql} ${dateFilterSql} ${empresaFilterSql} ${tipoFilterSql} ${statusFilterSql} ${searchFilterSql}
          AND vencimento >= DATE_TRUNC('year', CURRENT_DATE)
          AND vencimento < DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year'
        GROUP BY EXTRACT(MONTH FROM vencimento)
        ORDER BY month_num`;
    }

    // 3. Top Fornecedores
    const supplierRows = await sql`
      SELECT
        fornecedor as name,
        COALESCE(SUM(valor + COALESCE(juros, 0)), 0) as value
      FROM transactions
      WHERE 1=1 AND tipo != 'TRANSFERENCIA' ${uidFilterSql} ${dateFilterSql} ${empresaFilterSql} ${tipoFilterSql} ${statusFilterSql} ${searchFilterSql}
      GROUP BY fornecedor
      ORDER BY value DESC
      LIMIT 10`;

    return res.json({
      kpis: kpiRows[0],
      monthlyFlux: fluxRows,
      topSuppliers: supplierRows
    });
  } catch (e) {
    console.error('[stats] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
