# Backend Static Analysis Audit - CN Intelligence

## 1. Observation

A static analysis of the Vercel Functions Node.js backend files in the `api/` directory and corresponding database schemas was performed. The following observations were recorded:

### Administrative & Route Entry Point (`api/index.js`)
- **Unused Fallback Token Logic**: Lines 81-88 inspect a legacy token legacy header `x-cn-security` matching `process.env.SECURITY_TOKEN` to authenticate and authorize requests on all routes, despite the comment indicating it should only apply to public routes:
  ```javascript
  // Sem JWT válido — verificar fallback de security token (APENAS para rotas públicas)
  const publicRoutes = new Set(['health']);
  if (!publicRoutes.has(route)) {
    const securityToken = req.headers['x-cn-security'];
    const EXPECTED = process.env.SECURITY_TOKEN;
    if (!EXPECTED || securityToken !== EXPECTED) {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }
  }
  ```
- **Fake Multi-Tenancy**: Lines 60-65 check the password against a global environment variable `APP_PASSWORD` and generate a token with a hardcoded `APP_UID` ('odair' by default), which implies all users share the same backend database workspace:
  ```javascript
  if (password === APP_PASSWORD) {
    const token = generateToken({ uid: APP_UID, email: email || APP_EMAIL || null });
  ```

### Database Helpers (`api/_db.js`)
- **CORS Default Fallback**: Lines 103-107 set the CORS origin header. If the request origin is not in the allowed list, it defaults to the first allowed origin:
  ```javascript
  const safeOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  ```

### Middlewares (`api/_middlewares/auth.js`)
- **Dead Code**: The folder `api/_middlewares/` is completely unused. No references or imports of `authMiddleware` or `requireAuth` exist in the backend router `api/index.js`.

### Security Logs & Sanitization (`api/_utils.js`)
- **Destructive/Mutating Sanitization**: Lines 4-7 strip out characters like `'`, `"`, `;`, `&`, `<` and `>` from all request body properties:
  ```javascript
  export const sanitizeInput = (value) => {
    if (typeof value !== 'string') return value;
    return value.replace(/[<>'";&]/g, '').slice(0, 10000);
  };
  ```
- **Dynamic Table Creation Overhead**: Line 146 runs a `CREATE TABLE IF NOT EXISTS security_logs` query before every insert into security logs:
  ```javascript
  await sql`
    CREATE TABLE IF NOT EXISTS security_logs (
      id SERIAL PRIMARY KEY, ...
  ```

### Database Hardening Schema Mismatches (`sql/hardening.sql`)
- **RLS Policy Block**: Lines 201-228 enforce Row Level Security (RLS) policies requiring `uid = current_setting('app.current_uid', true)`. However, the Node.js backend client NEVER executes `SET app.current_uid` or calls the setting function.
- **`api_logs` Schema Mismatch**: Line 47 defines the response size column as `response_size` in PostgreSQL:
  ```sql
  response_size   INTEGER DEFAULT 0,
  ```
  But `api/_handlers/admin.js` line 137 writes to `response_size_bytes`:
  ```javascript
  VALUES (${req.query.route || "unknown"}, ${req.method}, ${res.statusCode}, ${duration}, ${responseSize})
  ```
- **`security_logs` Schema Mismatch**: Lines 59-67 define the table with columns `event_type`, `description`, `ip_address`, `user_agent`, `uid`, `route`. But `api/_utils.js` lines 157-159 insert into `ip`, `user_agent`, `route`, `method`, `event`.

### Transactions Handler (`api/_handlers/transactions.js`)
- **Pagination NaN Crash**: Lines 37-38 parse query limits and offsets into numbers. If the query parameters are invalid strings, they parse as `NaN`. Line 109 executes this directly into the query, causing syntax errors in PostgreSQL:
  ```javascript
  const rows = await sql`${query} ORDER BY vencimento DESC LIMIT ${parsedLimit} OFFSET ${parsedOffset}`;
  ```
- **Date Validation Bypass to NULL values**: Lines 236-242 pick and validate the date. If the date is invalid (e.g. `'invalid-date'`), `parseDateToPg` returns `null` (falsy), skipping the safety validation block:
  ```javascript
  if (body.vencimento) {
    const vPg = parseDateToPg(body.vencimento);
    if (vPg) {
      const vResult = TransactionSchema.pick({ vencimento: true }).safeParse({ vencimento: vPg });
      if (!vResult.success) return res.status(400).json({ error: 'Data de vencimento inválida' });
    }
  }
  ```
  Line 252 then writes `null` directly into the database:
  ```javascript
  if (body.vencimento !== undefined) fields.push(sql`vencimento = ${parseDateToPg(body.vencimento)}`);
  ```
- **Missing validation on PUT updates**: Lines 233-247 only parse and validate `vencimento` and `valor`. All other updated fields (like `status`, `tipo`, `banco`, `conta_contabil_id`) bypass the schema validation.
- **Batch Update Date validation failure**: Line 323 runs `TransactionBatchSchema.safeParse` directly on client data before running `parseDateToPg`, which causes validation to fail if the date is in `DD/MM/YYYY` format.
- **Soft-delete updates bypass**: Lines 390 (`transactions-batch-update`) and 433 (`fix-receitas-tipo`) update transaction fields without filtering out deleted records (`deleted_at IS NULL`).

### Bank and Supplier Handlers (`api/_handlers/banks.js` and `api/_handlers/suppliers.js`)
- **COALESCE Bug**: PUT endpoints for bank accounts (line 60) and suppliers (line 219) update fields using `COALESCE(${value}, value)`. Passing `null` in the request body to clear an optional field evaluates to `COALESCE(NULL, value)`, making it impossible to clear data:
  ```javascript
  agencia = COALESCE(${agencia}, agencia),
  ```
- **Missing `boleto_patterns` Table**: Administrative table verification `setup-tables` does not create the table `boleto_patterns`, although it is written to by the `extract-boleto` module.

### Payroll Handler (`api/_handlers/folha.js`)
- **Hardcoded integration fallback**: Line 10 uses a default fallback token when `process.env.FOLHA_INTEGRATION_TOKEN` is not defined:
  ```javascript
  const INTEGRATION_TOKEN = process.env.FOLHA_INTEGRATION_TOKEN || 'DEFAULT_FOLHA_INTEGRATION_TOKEN_123';
  ```
- **Invisible Payroll Transactions**: Line 32 sets the transaction owner to `'system_folha'`. However, transactions are only queried with owner `req.authUid` (e.g. `'odair'`) or `NULL`. As a result, payroll transactions are hidden from both the transaction list and dashboard metrics.

### Stats Handler (`api/_handlers/stats.js`)
- **Type conversion omissions**: Aggregate sums are returned directly from the SQL engine as strings. The JSON response returns metrics (like `receitas` and `despesas`) as string values instead of formatting them into JS numbers, causing inconsistencies.

---

## 2. Logic Chain

The static observations directly support the following findings:

1. **Vulnerability to Schema Errors and Logging Failures**:
   - Because `hardening.sql` defines columns `response_size` and `event_type`, and the JS code uses `response_size_bytes` and `event`, the database queries for API logging and security auditing will crash with `column ... does not exist` errors as soon as the database is hardened.
2. **Access Denial (RLS Lockout)**:
   - Because Row Level Security is active and filters records on `current_setting('app.current_uid')`, and because the backend connection pool does not execute session settings (`SET app.current_uid`), the database restricts all reads and updates to non-existent null-owned records.
3. **Data Corruption through Bypass Validation**:
   - Because `vPg` is null for invalid dates, the validation block in PUT updates is bypassed, allowing the query to successfully set non-nullable database columns like `vencimento` to `NULL`.
4. **Data Mutability and UX Issues (Sanitization)**:
   - Stripping out characters like `&` and `'` globally modifies inputs (e.g. `M&M` becomes `MM`, `D'água` becomes `Dágua`) at the API border, which alters text values instead of escaping them contextually during client rendering.
5. **Multi-Tenancy Vulnerabilities**:
   - Authenticated sessions are not isolated because there is no database-backed login and validation (authentication is limited to a single shared password).
   - Integration-level payroll transactions use a hardcoded fallback token and are linked to a system ID that renders them inaccessible to actual users.

---

## 3. Caveats

- **No Live Runtime Checks**: This report is compiled via static analysis and DDL reviews. Active connection tests were not performed on the live database.
- **Vercel Functions Sandbox**: In-memory rate limiting map risks and memory leaks are mitigated by Vercel's execution lifecycle (which limits serverless runtime durations), though it remains a design flaw for standard server environments.

---

## 4. Conclusion

The backend Node.js application of CN Intelligence contains critical security weaknesses, architectural inconsistencies, and logical bugs:
1. **Critical Mismatches**: Applying the database hardening script (`hardening.sql`) will immediately break logging and block all user data requests due to Row Level Security session config omissions and table schema variations.
2. **Vulnerabilities**: Shared credentials, lack of password hashing, and fallback integration tokens represent substantial authentication gaps.
3. **Validation Faults**: Global body sanitization mutates text, pagination parameters crash the database on non-numeric limits, and PUT updates bypass enum and nullability constraints.

---

## 5. Verification Method

To verify these findings, developers should inspect the following:

### Manual Database Verification
1. **Schema Check for logs**:
   Run `\d api_logs` and `\d security_logs` in the PostgreSQL database terminal to verify whether the column names match `response_size` or `response_size_bytes`, and if the columns in `security_logs` correspond to the parameters injected by `logSecurity` in `api/_utils.js`.
2. **RLS Policy Validation**:
   Ensure RLS is active on `transactions` using:
   ```sql
   SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'transactions';
   ```
   Run a select query as a non-superuser connection without executing `SET app.current_uid` to check if it returns 0 rows.

### Automated Test Cases (Scratch Scripts)
Execute the scratch scripts directly from the console to verify API endpoints behavior:
- Run `node scratch/test_api_handler.js` to observe whether invalid input formats or missing fields generate 500 errors.
- Test endpoint parameters using tools like `Postman` or `curl`:
  ```bash
  # Test limit/offset NaN handling (should trigger a 500 syntax error crash)
  curl -H "Authorization: Bearer <valid_jwt>" "http://localhost:3000/api?route=transactions&limit=invalid"
  ```
