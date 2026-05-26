# Fluxo de Caixa - Grupo CN

Sistema web para controle de lancamentos, fornecedores, bancos, receitas, relatorios, importacao de planilhas/OFX e extracao de boletos.

## Requisitos

- Node.js
- Banco PostgreSQL compativel com a string `DATABASE_URL`

## Rodar localmente

1. Instale as dependencias:
   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env` e preencha os valores reais.

3. Inicie a API local:
   ```bash
   node server.js
   ```

4. Em outro terminal, inicie o frontend:
   ```bash
   npm run dev
   ```

5. Acesse `http://localhost:5173`.

## Verificacoes

```bash
npm run lint
npm run build
npm audit --audit-level=high
```

## Variaveis importantes

- `APP_PASSWORD`: senha de login do sistema.
- `JWT_SECRET`: segredo usado para assinar tokens JWT. Use um valor longo e aleatorio.
- `SECURITY_TOKEN` e `VITE_CN_SECURITY_TOKEN`: devem ser iguais.
- `BACKUP_TOKEN` e `VITE_CN_BACKUP_TOKEN`: devem ser iguais para exportacao de backup.
- `ALLOWED_ORIGINS`: dominios autorizados pelo CORS, separados por virgula.

Ao trocar `JWT_SECRET`, usuarios ja logados precisam entrar novamente.
