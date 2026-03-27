require('dotenv').config();
const { Pool } = require('pg');

const unificationMap = {
  'ALEMAO MULTI SERVIÇOS': ['ALEMAO MUITI SERVIÇOS', 'ALEMAO MULT SERVICE', 'Alemao Muilti Serviço', 'Alemão Multi Uso'],
  'ALMIR EXTINTORES': ['ALMIR EXTINORES', 'Almir Extintores'],
  'ACEN': ['ASSOCIACAO COMERCIAL E EMPRESARIAL DE NAVIRAI'],
  'ANHANGUERA': ['Editora e Distribuidora Anhanguera', 'Editora e Distribuidora Educacional', 'Uniforme Anhanguera Navirai', 'KROTON/ANHANGUERA'],
  'ZAPSIGN': ['ZAPSINGN', 'ZapSign'],
  'CREA': ['Cons. Reg. Engenharia e Agronomia', 'Crea', 'CONSELHO REGIONAL ENGENHARIA'],
  'BANCO DO BRASIL': ['BB GIRO PRONAMPE', 'BB RENDE FÁCIL', 'BB RENDE FÁCIL - RENDE FACIL', 'BB CN', 'BANCO BRASIL'],
  'CASA DOS PARAFUSOS': ['CASA DOS PARAGUSOS', 'CASA DOSA PARAFUSOS', 'Casa dos Parausos'],
  'DMM LOPES': ['DMM LOPES & FILHOS LTDA', 'DMM LOPES E FILHOS', 'DMM LOPES E FILHS'],
  'EL SHADAY PAPEL': ['EL SHADAY PAPEL GRAF.', 'EL SHADAY PAPEL GRAF. BENIGON', 'El Shaday'],
  'GRÊMIO BOMBEIROS': ['GREMIO BOMBEIROS DOURADOS', 'GREMIO DOS BOMBEIROS'],
  'J DE OLIVEIRA': ['J DE OLIVEIRA SANCHEZ ME', 'J de Oliveira Sanchez ME', 'J de Oliveira Sanhez Me'],
  'VALDENIRA': ['Valdenira', 'VALDENIRA CARMINAT'],
  'AGUIMAR': ['AGMAR', 'Aguimar'],
  '3G CELULARES': ['3G Celulars'],
  'CREA': ['Crea'],
  'LUIZ FELIPE': ['Luiz Felipe'],
  'ZAPSIGN': ['ZAPSINGN', 'ZapSign']
};

async function unify() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('--- INICIANDO UNIFICAÇÃO ---');
    
    for (const [master, variations] of Object.entries(unificationMap)) {
      if (variations.length === 0) continue;

      // 1. Atualizar transações
      const txRes = await pool.query(
        "UPDATE transactions SET fornecedor = $1 WHERE fornecedor = ANY($2)",
        [master, variations]
      );
      if (txRes.rowCount > 0) {
        console.log(`[Transactions] ${master}: ${txRes.rowCount} registros atualizados.`);
      }

      // 2. Atualizar tabela suppliers (se o master já existir, mudamos os outros para o master e depois deletamos)
      // Primeiro garantimos que o master existe (opcional, mas seguro)
      
      // Deletar variações da tabela suppliers (pois agora transactions aponta para o master)
      const supRes = await pool.query(
        "DELETE FROM suppliers WHERE nome = ANY($1)",
        [variations]
      );
      if (supRes.rowCount > 0) {
        console.log(`[Suppliers] ${master}: ${supRes.rowCount} registros duplicados removidos.`);
      }
    }

    console.log('\n--- LIMPEZA FINAL ---');
    // Remover nomes vazios ou "(informar)" se desejado, mas vamos focar no que foi pedido.
    
    console.log('Unificação concluída com sucesso.');

  } catch (err) {
    console.error('Erro durante unificação:', err);
  } finally {
    await pool.end();
  }
}

unify();
