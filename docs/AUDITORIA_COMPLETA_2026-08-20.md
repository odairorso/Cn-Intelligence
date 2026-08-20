# Auditoria Completa — Fluxo de Caixa - Grupo CN

Data: 2026-08-20 (atualização)
Escopo: planilha Excel + código (src/api/scripts) + banco de dados (Supabase/PostgreSQL) + dependências.

## Metodologia

- Leitura estática do código (api/, src/, scripts/, sql/).
- Leitura programática da planilha (29 abas) com `read-excel-file/node`.
- Verificações executadas: `npm run lint`, `npm run test:node`, `npm run build`, `npm audit`.
- Consultas diretas ao PostgreSQL via `DATABASE_URL` (`.env.local`).

## Resultado executivo

O sistema é funcional: TypeScript sem erros, build de produção ok, 11 testes passando, JWT em cookie HttpOnly, queries parametrizadas e RLS ativo nas tabelas principais. Porém **o arquivo-fonte da planilha commitado no git está corrompido** e restam riscos de segurança relevantes.

---

## 1. Achados críticos / altos

### P0 — `pdfjs-dist` com execução arbitrária de JS em PDF malicioso
- `npm audit`: `pdfjs-dist >=5.6.83 <6.2.108` (GHSA-hq66-cqwq-w95j, "Arbitrary JavaScript execution upon opening a malicious PDF").
- O sistema extrai conteúdo de PDFs de boletos no frontend (`App.tsx` usa `pdfjs-dist`) e envia base64 ao backend. É superfície real de ataque.
- Correção: atualizar para `pdfjs-dist@6.2.108+` (breaking change — testar extração de boleto) e/ou processar PDFs com validação de MIME/tamanho e sandbox.

### P0 — Planilha-fonte commitada corrompida (integridade de dados)
- `Fluxo de caixa - Grupo CN 2024_2025.xlsx` (rastreada no git, 609.913 bytes) começa com `0x61 0x67` ("ag") antes de `PK\x03\x04`; o ZIP está truncado (~515 MB faltando) → `unzip`/`read-excel-file` falham. O mesmo vale para `fixed_fluxo.xlsx` e `fixed_fluxo.zip`.
- A única cópia legível encontrada está em `C:\Users\Odair\Desktop` (341 KB, 29 abas) — portanto o repositório NÃO contém um backup válido da planilha.
- Correção: substituir o arquivo no repo pela cópia íntegra (ou versioná-la fora do git via LFS/Drive), e corrigir o script de importação para não gravar versões truncadas.

### P1 — `fix-rounding` é GET mutável e sem gate de admin
- `api/fix-rounding.js` é `GET /api?route=fix-rounding` e executa `UPDATE transactions SET valor = ROUND(...)` em massa. Qualquer usuário autenticado (não só admin) consegue disparar. Violação de idempotência HTTP e de princípio de privilégio mínimo.
- Correção: mudar para `POST`, exigir `role === 'admin'`, e usar transação com confirmação.

### P1 — `auth-google-register` autocadastra sem validação da empresa
- `api/index.js` (rota `auth-google-register`) cria `portal_users` com `role='user'` apenas validando que o token Google corresponde ao e-mail informado. Qualquer Google account pode entrar como usuário comum.
- Correção: fechar o cadastro (só admin cria usuário) ou exigir convite de uso único/`companyPassword` validado no backend.

### P1 — `uid IS NULL` exposto a usuários comuns na API
- `api/_handlers/transactions.js` (linhas 42, 227, 245, 301, 320, 326, 518, 535, 558), `stats.js:16` e `fix-rounding.js` usam `(uid = ${uid} OR uid IS NULL)`; a política `sql/hardening.sql` reserva `uid IS NULL` a admin.
- Hoje há **0 linhas vivas com `uid IS NULL`**, então o risco é latente (não explorado), mas qualquer importação que gere linha global vazaria para outros usuários.
- Correção: condicionar `OR uid IS NULL` a `role === 'admin'`.

### P1 — `folha-push` público aceita `uid` arbitrário
- Rota pública (autenticada só por `FOLHA_INTEGRATION_TOKEN` Bearer) usa `req.query.uid`/`body.uid` como `req.authUid`. Um token de integração válido (ou vazado) escreve transações como qualquer usuário, incluindo `uid` em branco, e a checagem de duplicata é fraca (fornecedor+empresa+valor).
- Correção: derivar o `uid` do token (sign e `sub`), não do body/query; validar `empresa` contra allowlist.

### P1 — Upload de boleto sem limite de tamanho
- `api/_schemas.js` (`ExtractBoletoSchema`) aceita `text`, `fileName`, `pdfBase64` como strings sem `max()`. `pdfBase64` vai direto para a API do Gemini (custo/latência/memória em serverless).
- Correção: impor limite de MB no frontend e `z.string().max(...)` no backend; rejeitar com 413.

### P1 — `contas_contabeis` lidas sem filtro por usuário
- `api/_handlers/boleto.js` (`SELECT ... FROM contas_contabeis WHERE ativo = true` sem `uid`) expõe a lista de contas de todos os tenants ao contexto da IA/usuário. Compatível com o modelo single-tenant atual, mas deve ser isolado por `uid` se multi-tenancy for ativado (o índice `multi_tenancy_indexes.sql` sugere que é intenção).

## 2. Achados médios / baixos

### P2 — Rate limit falha aberto
- `api/_utils.js` (`checkRateLimit` e `ensureRateLimitTable`) retornam `true` quando o banco falha → anti-brute-force pode ser contornado em indisponibilidade parcial.
- Correção: fail-closed para rotas de auth ou limitador externo (ex. Upstash/Vercel).

### P2 — Token Google sem validação de `aud`
- `api/index.js` usa `tokeninfo` mas não confere `aud` contra `VITE_GOOGLE_CLIENT_ID`. Token emitido para outro client OAuth com o mesmo e-mail seria aceito.
- Correção: comparar `googleData.aud`.

### P2 — Fallback de login admin por env
- `api/index.js:84-90`: se `APP_PASSWORD`/`APP_EMAIL` existirem, login funciona por fora do banco. Útil, mas é credencial estática compartilhada; deve ser removido/aposentado após o primeiro admin real.

### P2 — `sql.unsafe` em `CREATE INDEX`/`rate_limits`
- Uso é restrito a nomes de tabela/colunas e valores parametrizados; baixo risco, mas manter a disciplina.

### P3 — Dependências `/` bundle
- `nanoid <3.3.18` (GHSA-2v37-7h3g-55p8, alta) via cadeia Vite/PostCSS. `npm audit fix` resolve; `pdfjs-dist` exige `--force`.
- `docs/AUDITORIA_DEPENDENCIAS.md` (11/05) lista `pdf-to-img`, `puppeteer`, `tesseract.js`, `pdf-parse` como mortos/utilitários — reavaliar removê-los/movê-los para devDependencies.

### P3 — Higiene do repo
- Vários artefatos soltos na raiz: imagens, `.cjs`, logs (`vite-dev.log`, 700 KB), `taxa` `10000`, `por.traineddata` (2.4 MB), `repo-backup-audit-20260701.tar` (28 MB). Recomenda-se mover para `/backups` ou ignorar.
- `APP_PASSWORD`/`JWT_SECRET` etc. existem em `.env.*` locais, mas **NÃO estão versionados** (`.gitignore` ok) — confirmado.

---

## 3. Auditoria da planilha (`Fluxo de caixa - Grupo CN 2024_2025`)

Estrutura (cópia Desktop): 29 abas = 24 meses (Set 2024 → Fev 2026) + `CASHFLOW` (consolidado previsto/realizado, 11 colunas bimestrais) + `Cheques Pré` + `Manutençao` + `ABRIL` (avulsa).

- Layout inconsistente entre abas: 10 abas têm coluna extra `SIT 2`; `ABRIL` não tem linha de cabeçalho; `MAIO` tem coluna `EMPRESA` ausente/reordenada em algumas.
- Precisão de ponto flutuante: totais exibem ruído binário (`477496.62300000014`, `482063.43000000005` no CASHFLOW) — cosmético, mas perigoso para auditoria/conciliar.
- Fornecedores inconsistentes: "SANESUL água e esgotos" vs typo "AGIA E ESGOTO"; "água" vs "agua" (acentuação).
- Datas `vencimento`/`pagamento` às vezes `null` em lançamentos `PENDENTE` (esperado) mas também há `PAGO` sem `DATA PAGAMENTO`.
- A aba `CASHFLOW` mistura previsto e realizado por bimestre sem coluna de rótulo por célula (só na linha 1) — ok para leitura humana, frágil para importação automatizada.

---

## 4. Auditoria do banco de dados (Supabase/PostgreSQL)

- 19 tabelas públicas; RLS `rowsecurity=true` em `transactions`, `suppliers`, `banks`, `portal_users`, `boleto_patterns` (force=false).
- Política ativa: `transactions_isolation` (role `authenticated`, ALL). Tabelas admin (`api_logs`, `audit_logs`, `security_audit`, `rate_limits`, `portal_users`) com RLS ativo mas sem políticas explícitas — sem exposição anônima detectada, mas revisar.
- Contagens: `transactions=15488`, `suppliers=623`, `banks=6`, `portal_users=3`.
- Distribuição de `uid` (transações vivas): `odair=15456`, `160cdab9-...=1`, `bac6a179-...=1` (os 2 últimos provavelmente de autocadastro Google).
- Nenhuma transação viva com `uid IS NULL`.

---

## 5. Verificações executadas (receipts)

```text
npm run lint                          -> OK (tsc --noEmit)
npm run test:node                     -> 11 testes, 0 falhas
npm run build                         -> OK (dist/ gerado)
npm audit --audit-level=high          -> 2 altas: nanoid, pdfjs-dist
node (pg direto via .env.local)       -> contagens + RLS (ver seção 4)
```

---

## 6. Ordem recomendada de correção

1. Restaurar/substituir a planilha corrompida no git por uma cópia íntegra (P0 dados).
2. Atualizar `pdfjs-dist` e revalidar extração de boleto (P0 segurança).
3. `fix-rounding`: POST + admin-only (P1).
4. Fechar/proteger `auth-google-register` (P1).
5. `uid IS NULL` somente admin em transactions/stats/fix-rounding (P1).
6. `folha-push`: derivar uid do token, validar empresa (P1).
7. Limite de tamanho em `ExtractBoletoSchema` (P1).
8. Validar `aud` do token Google (P2); rate limit fail-closed (P2); aposentar fallback de login por env (P2).
9. `npm audit fix` (+ `--force` para pdfjs-dist) e reexecutar lint/test/build.
10. Normalizar a planilha: corrigir typos de fornecedores, unificar colunas/`SIT 2`, arredondar totais a 2 casas.
