# Auditoria do Sistema - Fluxo de Caixa Grupo CN

Data: 2026-08-20

## Escopo

Auditoria tecnica do codigo local, configuracoes, autenticacao, rotas de API, validacao de entradas, dependencias e verificacoes automatizadas disponiveis.

## Resultado Executivo

O sistema tem boas bases: TypeScript sem erros, build de producao funcionando, JWT em cookie HttpOnly, CORS por allowlist, uso amplo de queries parametrizadas e isolamento por `uid` em muitas rotas.

Os principais riscos encontrados estao em quatro areas:

1. Segredo de IA potencialmente exposto no bundle frontend.
2. Cadastro via Google sem validacao real de senha/codigo da empresa.
3. Entrada de PDF/base64 sem limite explicito e dependencia `pdfjs-dist` com vulnerabilidade alta.
4. Operacoes financeiras permitindo registros `uid IS NULL` para usuarios comuns, contrariando a politica SQL de hardening.

## Achados Prioritarios

### P0 - `GEMINI_API_KEY` pode ser injetada no bundle frontend

Evidencia:

- `vite.config.ts:11` define `process.env.GEMINI_API_KEY` para o bundle.
- `api/_handlers/boleto.js:46-53` usa `GEMINI_API_KEY` apenas no servidor, que e o local correto.

Impacto:

Mesmo que hoje o frontend nao use diretamente essa constante, a configuracao permite que uma chave sensivel entre no JavaScript final caso algum codigo referencie `process.env.GEMINI_API_KEY`. Isso pode expor custo, quota e dados enviados a IA.

Recomendacao:

Remover a linha de `define` para `process.env.GEMINI_API_KEY` no Vite. Manter a chave somente nas variaveis de ambiente do backend/serverless.

### P1 - Cadastro via Google ignora `companyPassword`

Evidencia:

- `src/api.ts:182-186` envia `companyPassword` no cadastro Google.
- `api/index.js:230-256` recebe apenas `email`, `name`, `credential` e cria usuario `role = 'user'` sem validar senha/codigo da empresa.
- `src/components/AuthGuard.tsx:154` indica que `companyPassword` nao e mais necessaria.

Impacto:

Qualquer conta Google valida pode se autocadastrar se souber/usar o fluxo. Isso amplia acesso ao portal sem aprovacao administrativa, ainda que como usuario comum.

Recomendacao:

Escolher um modelo claro:

- cadastro fechado: remover `auth-google-register` publico e exigir criacao por admin;
- cadastro com convite: validar token de convite de uso unico;
- cadastro com senha da empresa: validar `companyPassword` no backend antes do insert.

### P1 - Upload/extracao de PDF sem limite explicito

Evidencia:

- `api/_schemas.js:54-58` aceita `text`, `fileName` e `pdfBase64` como strings opcionais sem tamanho maximo.
- `src/App.tsx:591-600` transforma PDF em base64 e envia ao backend.
- `api/_handlers/boleto.js:122-127` repassa o `pdfBase64` para Gemini.

Impacto:

Um PDF/base64 grande pode gerar custo alto, latencia, estouro de memoria em serverless ou indisponibilidade por abuso.

Recomendacao:

Adicionar limites no frontend e backend. Exemplo: tamanho maximo do PDF em MB, limite de caracteres para OCR/texto e rejeicao com `413 Payload Too Large`.

### P1 - `pdfjs-dist` com vulnerabilidade alta

Evidencia:

- `npm audit --audit-level=moderate` reportou `pdfjs-dist` com severidade alta: "Arbitrary JavaScript execution upon opening a malicious PDF".
- O sistema processa boletos PDF no fluxo de importacao.

Impacto:

Arquivos PDF maliciosos sao parte natural da superficie de ataque deste sistema. Mesmo quando a vulnerabilidade nao afeta todos os modos de uso, deve ser tratada como risco relevante.

Recomendacao:

Atualizar/substituir `pdfjs-dist` quando houver versao corrigida, restringir PDFs aceitos, validar MIME/tamanho, considerar sandbox de processamento e evitar execucao de JavaScript embutido em PDF.

### P1 - Usuarios comuns acessam registros globais `uid IS NULL`

Evidencia:

- `api/_handlers/transactions.js:42`, `227`, `245`, `301`, `320`, `326`, `518`, `535`, `558` usam `(uid = ${uid} OR uid IS NULL)`.
- `api/_handlers/stats.js:16` tambem inclui `uid IS NULL`.
- `sql/hardening.sql:215` permite `uid IS NULL` apenas para admin na politica RLS.

Impacto:

No backend da API, qualquer usuario autenticado pode listar/alterar/baixar como pago/excluir registros globais `uid IS NULL`, se existirem. Isso diverge da politica de hardening e pode vazar ou corromper dados compartilhados.

Recomendacao:

Aplicar a mesma regra do SQL: somente `admin` deve enxergar `uid IS NULL`. Usuarios comuns devem filtrar apenas `uid = authUid`.

### P2 - Rate limit e `auth-register` dependem do banco e falham aberto

Evidencia:

- `api/_utils.js:95-98` permite requisicao quando o rate limit falha no banco.
- `api/index.js:132-153` permite primeiro cadastro admin se a tabela estiver vazia.

Impacto:

Em indisponibilidade parcial do banco ou corrida de primeiro acesso, controles anti-abuso ficam fracos. O cadastro inicial e sensivel e deveria ter protecao adicional.

Recomendacao:

Para rotas de autenticacao, preferir fail-closed ou limitador externo. Para primeiro acesso, exigir segredo de bootstrap temporario ou desativar a rota apos setup.

### P2 - Dependencias com vulnerabilidades altas na cadeia Vite/PostCSS

Evidencia:

- `npm audit --audit-level=moderate` reportou `nanoid`, `postcss`, `vite`, `vitest` e pacotes relacionados, totalizando 9 vulnerabilidades altas.

Impacto:

Principalmente risco de supply chain/dev tooling. Menos critico em runtime que PDF, mas deve ser atualizado.

Recomendacao:

Atualizar Vite, Vitest, plugins e PostCSS quando disponivel. Reexecutar `npm audit` apos update.

### P2 - Google token nao valida audiencia/client_id no backend

Evidencia:

- `api/index.js:172-185` consulta `tokeninfo`, mas nao compara `aud` com o client id esperado.

Impacto:

Um token Google valido para outro client OAuth pode ser aceito se o email existir/corresponder no fluxo.

Recomendacao:

Validar `googleData.aud` contra `GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID` configurado no servidor.

## Pontos Positivos

- `npm run lint` passou (`tsc --noEmit`).
- `npm run build` passou e gerou `dist/`.
- JWT em cookie `HttpOnly`, `SameSite=Strict` e `Secure` fora de desenvolvimento.
- Queries principais usam parametros via tagged template `sql`.
- Bloqueio de tentativa de injecao de `uid` por query em `api/index.js`.
- `export-backup` exige `role = admin`.
- `git ls-files` nao mostrou `.env.local`, `.env.prod`, `.env.preview`, `.env.development.local`, `.env.production.local` nem `supabase_config.txt` versionados.

## Verificacoes Executadas

```text
npm run lint
Resultado: passou.

npm test
Resultado: testes Node passaram; Vitest falhou ao inicializar por bloqueio de acesso do sandbox ao resolver vite.config.ts.

npm run build
Resultado: passou.

npm audit --audit-level=moderate
Resultado: falhou com vulnerabilidades altas em nanoid/postcss/vite/vitest e pdfjs-dist.

Teste Supabase REST com chave publica salva localmente
Resultado: projeto respondeu. A raiz /rest/v1/ exige chave secreta para schema. Consultas anonimas minimas em transactions, suppliers, banks, portal_users e boleto_patterns retornaram 200 com lista vazia, sem vazamento de dados anonimos nessas tabelas.

Teste PostgreSQL via DATABASE_URL local
Resultado atualizado: conexao funcionando via Supabase Transaction Pooler (`aws-1-sa-east-1`, porta 6543). O app consegue consultar usando `api/_db.js`.

Auditoria de metadados do banco
Resultado: 19 tabelas publicas encontradas, todas com RLS ativado. Foram encontradas 18 policies. Tabelas administrativas com RLS ativado mas sem policies explicitas: `api_logs`, `audit_logs`, `portal_users`, `rate_limits`, `security_audit`. Contagens gerais, sem exibir dados: `transactions` 15480, `suppliers` 623, `banks` 6, `portal_users` 3, `boleto_patterns` 40, `api_logs` 11934, `security_logs` 41, `audit_logs` 1599, `professores` 14, `segmentos` 8, `lancamentos` 0, `fechamentos` 0.
```

## Melhorias Aplicadas

- Removida exposicao da `GEMINI_API_KEY` no bundle Vite; a IA de boletos continua usando a chave somente no backend.
- Ajustado `api/_db.js` para respeitar `PG_SSL_REJECT_UNAUTHORIZED=false` em ambiente local com Supabase Transaction Pooler.
- Otimizado rate limit: limpeza de registros expirados agora roda no maximo uma vez por janela por instancia, e a contagem usa `INSERT ... ON CONFLICT DO UPDATE`, reduzindo round-trips ao banco.
- Otimizado log de requisicoes: `api_logs` deixa de executar `CREATE TABLE IF NOT EXISTS` em toda chamada; a verificacao fica cacheada por instancia.
- Reduzida a geracao de `api_logs`: por padrao, agora sao registrados erros e requisicoes lentas; chamadas normais rapidas deixam de gravar no banco. Para registrar tudo novamente, usar `LOG_SUCCESS_REQUESTS=true`.
- Criados indices seguros para logs: `idx_api_logs_route_timestamp`, `idx_api_logs_timestamp`, `idx_security_logs_created`, `idx_audit_logs_created`.
- Executado `ANALYZE` nas tabelas principais e de logs para atualizar estatisticas do planejador.
- Limpeza conservadora de logs tecnicos: removidos 8794 registros antigos de `api_logs`, mantendo 3140 registros dos ultimos 30 dias. `security_logs` e `audit_logs` foram preservados.

Validacao apos melhorias:

```text
npm run lint
Resultado: passou.

npm run test:node
Resultado: passou, 11 testes.

npm run build
Resultado: passou.
```

## Ordem Recomendada de Correcao

1. Remover `GEMINI_API_KEY` do bundle Vite.
2. Fechar ou proteger `auth-google-register`.
3. Adicionar limite e validacao forte para PDF/base64/texto de boleto.
4. Ajustar filtros `uid IS NULL` para somente admin.
5. Validar audiencia do token Google.
6. Atualizar dependencias vulneraveis e repetir audit/test/build.
7. Adicionar testes para: cadastro Google sem convite, acesso a `uid IS NULL`, tamanho maximo de PDF e token Google com audiencia invalida.
