# Relatório de Auditoria Técnica — CN Intelligence

Este relatório consolida todas as inconsistências, bugs, vulnerabilidades de segurança, falhas de integridade de dados e problemas de UX identificados através da análise estática do código-fonte do frontend (React/Vite) e backend (Node.js/Vercel Functions).

---

## 🔝 Top 5 Itens Críticos para Correção Imediata

### 1. Cálculo Incorreto do Saldo por Banco
- **Arquivos afetados**: `src/tabs/BancosTab.tsx` (linhas 14-25, 89-91)
- **Severidade**: 🚨 **Crítica**
- **Causa Raiz**: O componente calcula `bankTotals` somando todos os lançamentos com status `PAGO` sem filtrar pelo tipo (`RECEITA` ou `DESPESA`). No cálculo final, o saldo é exibido como `bank.saldo - bankTotals[bank.nome]`. Isso significa que tanto receitas quanto despesas reduzem o saldo na interface.
- **Sugestão de Correção**: Alterar a soma de totais para considerar o tipo de transação:
  ```typescript
  transactions.filter(tx => tx.status === 'PAGO' && tx.banco).forEach(tx => {
    if (tx.banco && totals[tx.banco] !== undefined) {
      if (tx.tipo === 'RECEITA') {
        totals[tx.banco] += tx.valor;
      } else if (tx.tipo === 'DESPESA') {
        totals[tx.banco] -= tx.valor;
      }
    }
  });
  ```
  Exibir o saldo como `bank.saldo + bankTotals[bank.nome]`.

### 2. Bloqueio Completo por RLS (Row Level Security)
- **Arquivos afetados**: `sql/hardening.sql` (linhas 201-228), `api/_db.js`
- **Severidade**: 🚨 **Crítica**
- **Causa Raiz**: As políticas de RLS no script de hardening exigem que `uid = current_setting('app.current_uid', true)`. No entanto, o cliente Node.js do backend não executa `SET app.current_uid` nas conexões. Ao aplicar o hardening, todas as buscas de dados retornarão vazio (0 linhas) para usuários logados.
- **Sugestão de Correção**: Na inicialização do cliente SQL ou antes de executar as consultas autenticadas, definir o valor da sessão:
  ```javascript
  await sql`SET LOCAL app.current_uid = ${req.userId}`;
  ```
  Alternativamente, ajustar a política para usar o payload do JWT caso a extensão do JWT esteja integrada no banco.

### 3. Falha Silenciosa de Decodificação do JWT (Deslogamento Inesperado)
- **Arquivos afetados**: `src/api.ts` (linhas 29-41)
- **Severidade**: 🔥 **Alta**
- **Causa Raiz**: O método `getUid` utiliza a função `atob` para decodificar a seção do payload do JWT. A decodificação padrão base64url omite o padding (`=`). A função `atob` lança uma exceção `DOMException` se o comprimento do payload mod 4 for 2 ou 3. A exceção é capturada pelo bloco `catch`, retornando `null` e fazendo com que o frontend force um logout em sessões válidas.
- **Sugestão de Correção**: Adicionar padding ao base64 antes de invocar `atob`:
  ```typescript
  let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const payload = JSON.parse(atob(base64));
  ```

### 4. Mismatch de Schemas nos Logs de Segurança e Logs de API
- **Arquivos afetados**: `sql/hardening.sql` (linhas 47, 59-67), `api/_handlers/admin.js` (linha 137), `api/_utils.js` (linhas 157-159)
- **Severidade**: 🔥 **Alta**
- **Causa Raiz**: 
  - A tabela `api_logs` no banco de dados possui a coluna `response_size`, mas o backend tenta inserir em `response_size_bytes`, causando falha de inserção na consulta.
  - A tabela `security_logs` define as colunas `event_type`, `description`, `ip_address`, `user_agent`, `uid`, `route`, mas a inserção em `api/_utils.js` usa as colunas `ip`, `user_agent`, `route`, `method`, `event`, o que gerará erros de "coluna inexistente" ao tentar salvar os logs.
- **Sugestão de Correção**: Homologar a definição de tabelas e as queries correspondentes para usar os mesmos nomes de colunas em ambos os lados.

### 5. Crash por Parâmetros de Paginação Inválidos (NaN)
- **Arquivos afetados**: `api/_handlers/transactions.js` (linhas 37-38, 109)
- **Severidade**: 🔥 **Alta**
- **Causa Raiz**: Parâmetros de busca `limit` e `offset` são passados na URL e convertidos para números. Se o valor for inválido, eles resultam em `NaN`. O backend injeta diretamente esses valores na query SQL do PostgreSQL, resultando em erro de sintaxe e crash da rota.
- **Sugestão de Correção**: Adicionar fallback numérico caso a conversão resulte em `NaN`:
  ```javascript
  const parsedLimit = isNaN(Number(limit)) ? 100 : Number(limit);
  const parsedOffset = isNaN(Number(offset)) ? 0 : Number(offset);
  ```

---

## 🔍 Detalhamento das Descobertas por Requisito (R1 a R5)

### R1. Bugs e Erros Funcionais

#### Causa Raiz do Filtro de Anos (`availableYears`)
- **Arquivos afetados**: `src/tabs/LancamentosTab.tsx` (linhas 55-66) e `src/tabs/RelatoriosTab.tsx` (linhas 32-41)
- **Severidade**: ⚠️ **Média**
- **Causa**: O filtro de anos varre apenas as transações carregadas em memória local (as quais são paginadas e limitadas a cerca de 100 itens) e adiciona dinamicamente anos de `currentYear` até 2020. Anos anteriores a 2020 ou anos de transações não carregadas na memória inicial não aparecem no dropdown.
- **Correção**: Consultar no banco (ou estender dinamicamente) a lista de anos com transações disponíveis, ou estender a faixa fixa de anos (ex: até 2010 ou dinâmico a partir do primeiro registro histórico).

#### Validação no EditTxModal Bypassada
- **Arquivos afetados**: `src/modals/EditTxModal.tsx` (linhas 121-133)
- **Severidade**: ⚠️ **Média**
- **Causa**: Ao contrário do modal de inserção (`NewTxModal.tsx`), o modal de edição não exige o preenchimento do campo `banco` quando o status é modificado para `PAGO`, gerando lançamentos pagos sem vínculo bancário.
- **Correção**: Implementar validação obrigatória no submit do modal:
  ```typescript
  if (formData.status === 'PAGO' && !formData.banco) {
    setError('Banco é obrigatório para lançamentos pagos');
    return;
  }
  ```

#### Interface não Atualizada após Importação de OFX
- **Arquivos afetados**: `src/hooks/useAppData.tsx` (linhas 608-640)
- **Severidade**: ⚠️ **Média**
- **Causa**: O método `importOFX` faz as chamadas de criação da(s) transação(ões) na API com sucesso, exibe uma notificação, mas não limpa o cache nem recarrega a lista de lançamentos em memória global.
- **Correção**: Adicionar `await fetchTransactions()` após o processamento das importações de OFX no bloco `try`.

#### Bypass de Validação de Datas no PUT do Backend
- **Arquivos afetados**: `api/_handlers/transactions.js` (linhas 236-242, 252)
- **Severidade**: ⚠️ **Média**
- **Causa**: Se o payload de atualização de uma transação contiver uma data de vencimento inválida (ex: `'invalid-date'`), a função `parseDateToPg` retornará `null`, o que ignora a validação do Zod, mas insere `null` no banco de dados em uma coluna que deveria ser não-nula.
- **Correção**: Garantir que se o vencimento for fornecido, a data deve ser válida:
  ```javascript
  const vPg = parseDateToPg(body.vencimento);
  if (!vPg) return res.status(400).json({ error: 'Data de vencimento inválida' });
  ```

#### Falta de Validação de Outros Campos no PUT
- **Arquivos afetados**: `api/_handlers/transactions.js` (linhas 233-247)
- **Severidade**: ⚠️ **Média**
- **Causa**: O endpoint de edição de transações valida apenas `vencimento` e `valor`. Outros campos como `status`, `tipo`, `banco` e `conta_contabil_id` são escritos diretamente sem passar pelo schema do Zod.
- **Correção**: Utilizar `TransactionSchema.partial().safeParse(body)` antes de processar as atualizações.

#### Falha na Validação de Datas em Batch Update
- **Arquivos afetados**: `api/_handlers/transactions.js` (linha 323)
- **Severidade**: ⚠️ **Média**
- **Causa**: O endpoint `transactions-batch-update` executa a validação Zod diretamente sobre a data recebida no formato `DD/MM/YYYY` antes de convertê-la para o formato PostgreSQL, gerando falsos negativos e falha na validação.
- **Correção**: Converter as datas com `parseDateToPg` nos itens do batch antes de realizar a validação do Schema.

---

### R2. Análise de Segurança

#### Falta de Autenticação/Autorização Individual (Monotenant disfarçado)
- **Arquivos afetados**: `api/index.js` (linhas 22-25, 60-65)
- **Severidade**: 🔥 **Alta**
- **Causa**: O sistema valida credenciais contra uma variável de ambiente global `APP_PASSWORD`. Não há gerenciamento de senhas hasheadas e o token JWT é gerado com um UID fixo `'odair'`, fazendo com que todos os usuários acessem a mesma base de dados.
- **Correção**: Implementar tabela de usuários e utilizar bcrypt para senhas.

#### Token Fallback Exposto (Bypass de JWT)
- **Arquivos afetados**: `api/index.js` (linhas 81-88)
- **Severidade**: ⚠️ **Média**
- **Causa**: Rotas teoricamente protegidas verificam um header `x-cn-security` que permite bypassar o JWT se corresponder ao token fixo `process.env.SECURITY_TOKEN`.
- **Correção**: Remover fallback ou restringi-lo estritamente a webhooks externos identificados.

#### Middleware Não Utilizado (Dead Code)
- **Arquivos afetados**: `api/_middlewares/auth.js`
- **Severidade**: 📁 **Baixa**
- **Causa**: O middleware de autenticação existe na pasta, mas não é importado em `api/index.js`, que faz a checagem manual de token em cada rota, aumentando o risco de rotas desprotegidas no futuro.
- **Correção**: Importar e aplicar o middleware globalmente no roteador principal.

---

### R3. Análise de Integridade de Dados

#### Timezone Date Shift (Deslocamento de Datas por Fuso Horário)
- **Arquivos afetados**: `api/_handlers/transactions.js` (linha 113)
- **Severidade**: 🔥 **Alta**
- **Causa**: O driver `node-postgres` lê colunas `DATE` sem hora e cria objetos Date locais à meia-noite do fuso do servidor. Se o servidor estiver em um timezone com offset positivo, a conversão com `toLocaleDateString` pode deslocar a data em -1 dia.
- **Correção**: Tratar datas como strings brutas sem converter para objeto Date local ou configurar o node-postgres para ler campos do tipo DATE como strings diretamente.

#### Cálculos Incompletos no Dashboard (Fallback Stats Mismatch)
- **Arquivos afetados**: `src/tabs/DashboardTab.tsx` (linhas 53-83)
- **Severidade**: ⚠️ **Média**
- **Causa**: Se o endpoint de estatísticas do backend demorar ou falhar, o dashboard realiza cálculos locais sobre o array `filteredTx` (que contém apenas as 100 transações mais recentes da página inicial), exibindo KPIs gravemente incorretos.
- **Correção**: Mostrar indicador de erro/loading ou usar estatísticas em cache, em vez de realizar cálculo local parcial e incorreto.

#### Atualizações Ignorando Soft-Delete
- **Arquivos afetados**: `api/_handlers/transactions.js` (linhas 390 e 433)
- **Severidade**: ⚠️ **Média**
- **Causa**: Rotas de atualizações em lote (`transactions-batch-update`) e correções automáticas (`fix-receitas-tipo`) alteram registros no banco sem filtrar `deleted_at IS NULL`, permitindo ressuscitar ou alterar transações excluídas.
- **Correção**: Adicionar cláusula `AND deleted_at IS NULL` nestas queries.

#### Impossibilidade de Limpar Campos Opcionais (Bug do COALESCE)
- **Arquivos afetados**: `api/_handlers/banks.js` (linha 60) e `api/_handlers/suppliers.js` (linha 219)
- **Severidade**: ⚠️ **Média**
- **Causa**: Consultas do tipo `PUT` atualizam campos como `agencia` utilizando `COALESCE(${value}, agencia)`. Enviar `null` no JSON resulta em `COALESCE(null, agencia)`, mantendo o valor anterior e impedindo que o campo seja limpo.
- **Correção**: Gerar queries dinamicamente ou tratar individualmente os campos nulos.

---

### R4. Análise de UX e Fluxo de Integração

#### Mutação Colateral do Estado Global de Lançamentos
- **Arquivos afetados**: `src/tabs/RelatoriosTab.tsx` (linhas 93-107)
- **Severidade**: ⚠️ **Média**
- **Causa**: Ao aplicar filtros e gerar relatórios na aba `RelatoriosTab`, a rota dispara um fetch que sobrescreve o array de transações globais (`transactions`). Ao retornar para a aba `LancamentosTab`, a interface exibe a lista gerada no relatório, causando descompasso visual e dessincronização dos filtros da própria tela de Lançamentos.
- **Correção**: Manter o estado das transações de relatórios em um estado isolado na aba `RelatoriosTab` ou em um slice separado.

#### Sanitização Destrutiva no Backend
- **Arquivos afetados**: `api/_utils.js` (linhas 4-7)
- **Severidade**: ⚠️ **Média**
- **Causa**: A função `sanitizeInput` remove caracteres como `'`, `"`, `;`, `&`, `<` e `>` dos campos textuais no backend. Nomes comerciais válidos (ex: `M&M` ou `D'água`) são alterados silenciosamente para `MM` e `Dágua`.
- **Correção**: Evitar remoção de caracteres. Em vez disso, fazer o escape dos dados de forma contextual ao renderizar e utilizar queries parametrizadas (que já previnem injeção de SQL).

---

### R5. Qualidade de Código e Manutenibilidade

#### Criação de Tabelas em Tempo de Execução (Overhead do Log)
- **Arquivos afetados**: `api/_utils.js` (linha 146)
- **Severidade**: 📁 **Baixa**
- **Causa**: A rotina de logs de segurança tenta rodar `CREATE TABLE IF NOT EXISTS security_logs` em toda e qualquer inserção de logs, gerando acessos desnecessários ao banco.
- **Correção**: Remover este comando da função de log e adicioná-lo estritamente no script de setup inicial da base de dados.

#### Falta de Tabela `boleto_patterns` no Setup Inicial
- **Arquivos afetados**: Rotina de inicialização de tabelas no backend.
- **Severidade**: ⚠️ **Média**
- **Causa**: O módulo de leitura e extração de boleto lê e escreve na tabela `boleto_patterns`, mas essa tabela não é criada no script/endpoint `setup-tables`.
- **Correção**: Adicionar a query de criação de `boleto_patterns` no handler de criação das tabelas.
