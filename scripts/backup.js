/**
 * Script de Backup Automático - Exporta todos os dados do Neon para JSON
 * Usado por: GitHub Actions (diário) ou manualmente
 */

require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

const sql = neon(process.env.DATABASE_URL);

async function backup() {
  console.log('🔄 Iniciando backup do banco de dados...\n');

  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup-${timestamp}.json`);

  try {
    // Exportar todas as tabelas
    const [transactions, suppliers, banks, contasContabeis, boletoPatterns] = await Promise.all([
      sql`SELECT * FROM transactions ORDER BY created_at DESC`,
      sql`SELECT * FROM suppliers ORDER BY nome`,
      sql`SELECT * FROM banks ORDER BY nome`,
      sql`SELECT * FROM contas_contabeis ORDER BY codigo`,
      sql`SELECT * FROM boleto_patterns ORDER BY created_at DESC`
    ]);

    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'Neon PostgreSQL',
        tables: ['transactions', 'suppliers', 'banks', 'contas_contabeis', 'boleto_patterns']
      },
      data: {
        transactions: transactions || [],
        suppliers: suppliers || [],
        banks: banks || [],
        contas_contabeis: contasContabeis || [],
        boleto_patterns: boletoPatterns || []
      },
      stats: {
        total_transactions: transactions?.length || 0,
        total_suppliers: suppliers?.length || 0,
        total_banks: banks?.length || 0,
        total_contas_contabeis: contasContabeis?.length || 0,
        total_boleto_patterns: boletoPatterns?.length || 0
      }
    };

    // Salvar backup
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf-8');

    console.log('✅ Backup concluído com sucesso!\n');
    console.log('📁 Arquivo:', backupFile);
    console.log('📊 Estatísticas:');
    console.log('   - Transações:', backup.stats.total_transactions);
    console.log('   - Fornecedores:', backup.stats.total_suppliers);
    console.log('   - Bancos:', backup.stats.total_banks);
    console.log('   - Contas Contábeis:', backup.stats.total_contas_contabeis);
    console.log('   - Padrões de Boleto:', backup.stats.total_boleto_patterns);
    console.log('\n💾 Tamanho do arquivo:', (fs.statSync(backupFile).size / 1024).toFixed(2), 'KB');

    return backupFile;
  } catch (error) {
    console.error('❌ Erro ao fazer backup:', error.message);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  backup().catch(console.error);
}

module.exports = { backup };
