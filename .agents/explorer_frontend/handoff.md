# Handoff Report — Static Analysis Audit of Frontend React Application

This report details the findings from a comprehensive static analysis audit of the frontend React application of **CN Intelligence**.

---

## 1. Observations

### 1.1 availableYears Filter Issue (R1)
In `src/tabs/LancamentosTab.tsx` (lines 55-66) and `src/tabs/RelatoriosTab.tsx` (lines 32-41), the dropdown options for filtering by year are calculated as:
```typescript
  const availableYears = useMemo(() => {
    const years = transactions.map(tx => {
      const dateParts = tx.vencimento.includes('-') ? tx.vencimento.split('-') : tx.vencimento.split('/');
      return tx.vencimento.includes('-') ? dateParts[0] : dateParts[2];
    }).filter(Boolean);
    const set = new Set<string>(years);
    const currentYear = new Date().getFullYear();
    for (let yr = currentYear; yr >= 2020; yr -= 1) {
      set.add(String(yr));
    }
    return Array.from(set).sort().reverse();
  }, [transactions]);
```

### 1.2 BancosTab.tsx Balance Calculation Bug (R3)
In `src/tabs/BancosTab.tsx` (lines 14-25), the total paid amount per bank is calculated as:
```typescript
  const bankTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    banks.forEach(bank => {
      totals[bank.nome] = 0;
    });
    transactions.filter(tx => tx.status === 'PAGO' && tx.banco).forEach(tx => {
      if (tx.banco && totals[tx.banco] !== undefined) {
        totals[tx.banco] += tx.valor;
      }
    });
    return totals;
  }, [banks, transactions]);
```
And the current balance is rendered as (lines 89-91):
```typescript
  <span className="text-lg font-black" style={{ color: (Number(bank.saldo) - (bankTotals[bank.nome] || 0)) < 0 ? '#ef4444' : '#3b82f6' }}>
    {(Number(bank.saldo) - (bankTotals[bank.nome] || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  </span>
```

### 1.3 JWT base64URL decode silent failure (R1)
In `src/api.ts` (lines 29-41), the user ID is decoded from the JWT token:
```typescript
const getUid = (): string | null => {
  try {
    const token = getToken();
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.uid || null;
  } catch {
    return null;
  }
};
```

### 1.4 EditTxModal Validation Bypass (R1)
In `src/modals/EditTxModal.tsx` (lines 121-133), the bank selection field is declared as:
```typescript
  <select
    className="w-full bg-surface-variant/40 border border-white/10 rounded-sm px-4 py-3 text-sm outline-none focus:border-primary transition-all text-on-surface appearance-none"
    style={{ backgroundColor: '#161b2a' }}
    value={formData.banco}
    onChange={e => setFormData({ ...formData, banco: e.target.value })}
  >
    <option value="" className="bg-[#161b2a] text-on-surface">Não informado</option>
    {banks.map(b => (
      <option key={b.id} value={b.nome} className="bg-[#161b2a] text-on-surface">{b.nome}</option>
    ))}
  </select>
```
No validation checks are performed on submission (lines 82-93) to ensure `formData.banco` is populated when `formData.status === 'PAGO'`.

### 1.5 Stale UI after OFX Import (R1)
In `src/hooks/useAppData.tsx` (lines 608-640), the `importOFX` callback is defined as:
```typescript
  const importOFX = useCallback(async (ofxData: any[]) => {
    ...
    try {
      const txList = ofxData.map((row) => ({ ... }));

      if (txList.length === 1) {
        await api.createTransaction(txList[0]);
      } else {
        await api.createTransactionsBatch(txList as any);
      }

      showNotification(`${txList.length} lançamento(s) importado(s) com sucesso!`, 'success');
    } catch (err: any) { ... }
  }, [showNotification]);
```

### 1.6 DashboardTab Fallback Stats Mismatch (R3)
In `src/tabs/DashboardTab.tsx` (lines 53-83), if `globalStats` is missing or null, it falls back to local memory calculation:
```typescript
  const filteredStats = useMemo(() => {
    if (globalStats) return globalStats;
    ...
    // local fallback calculations based on filteredTx ...
  }, [globalStats, filteredTx]);
```

### 1.7 Shared State Mutation Side-Effect between Tabs (R4)
In `src/tabs/RelatoriosTab.tsx` (lines 93-107), `RelatoriosTab` executes queries on change:
```typescript
    fetchTransactions(
      false,
      queryYear,
      queryMonth,
      undefined,
      selectedTipo === 'TODOS' ? undefined : selectedTipo,
      {
        limit: 5000,
        ...
      }
    );
```

### 1.8 Node-postgres Timezone Date Shift (R2)
In `api/_handlers/transactions.js` (line 113):
```javascript
vencimento: tx.vencimento ? new Date(tx.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '',
```

---

## 2. Logic Chain

### 2.1 availableYears Filter Issue
- **Step 1**: The years dropdown only lists years extracted from `transactions` loaded in memory, plus a hardcoded list starting from `currentYear` down to `2020`.
- **Step 2**: The client-side loaded `transactions` array is paginated (typically limited to 100 items on initialization) and only contains recent transactions.
- **Step 3**: Any years prior to `2020` (e.g. 2019, 2018) are omitted from the hardcoded fallback loop. Because older transactions are not loaded in memory initially, their years are never mapped.
- **Conclusion**: The dropdown will never list years prior to 2020, even if they exist in the database.

### 2.2 BancosTab.tsx Balance Calculation Bug
- **Step 1**: All transactions have a positive `valor` field.
- **Step 2**: `bankTotals` aggregates `tx.valor` for all transactions with `status === 'PAGO'` and `banco`, regardless of whether `tipo` is `RECEITA` or `DESPESA`.
- **Step 3**: The balance formula is `bank.saldo - bankTotals[bank.nome]`.
- **Conclusion**: Revenues are added to `bankTotals` and then subtracted from the initial bank balance, meaning both revenues and expenses decrease the bank balance in the UI.

### 2.3 JWT base64URL decode silent failure
- **Step 1**: JWT payload sections are base64url-encoded and omit padding characters (`=`).
- **Step 2**: The standard `atob` JS function throws a `DOMException` error if input lengths are not multiples of 4.
- **Step 3**: The `getUid` function decodes payload using `atob` directly after replacing characters, but without reconstructing padding.
- **Conclusion**: If the base64url payload length mod 4 is 2 or 3, `atob` throws an error. The `try-catch` block catches this and returns `null`, silently treating valid authenticated sessions as unauthenticated and logging out the user.

### 2.4 EditTxModal Validation Bypass
- **Step 1**: In `NewTxModal.tsx`, when `status === 'PAGO'`, the select input for `banco` is dynamically marked `required`.
- **Step 2**: In `EditTxModal.tsx`, the `banco` input has no `required` attribute and defaults to `"Não informado"`.
- **Conclusion**: Users editing transactions can change their status to `PAGO` and clear or bypass the bank value, creating a data state where a paid transaction has no bank associated.

### 2.5 Stale UI after OFX Import
- **Step 1**: `importOFX` maps and creates transactions using the API (`api.createTransaction` or `api.createTransactionsBatch`).
- **Step 2**: Once successful, it only triggers a notification but does not fetch new transactions or update the global React state.
- **Conclusion**: The UI remains completely stale until a manual page refresh or a filter change occurs.

### 2.6 DashboardTab Fallback Stats Mismatch
- **Step 1**: `filteredTx` is a sliced and paginated list of transactions stored in local memory (typically capped at 100 items).
- **Step 2**: If the backend stats endpoint is slow or fails, the dashboard falls back to calculating sums over `filteredTx`.
- **Conclusion**: Fallback KPIs display severely incomplete values, misleading users.

### 2.7 Shared State Mutation Side-Effect
- **Step 1**: The global `transactions` state is shared between all tabs.
- **Step 2**: When `RelatoriosTab` queries transactions with a limit of 5000 and custom report filters, it modifies the global `transactions` list.
- **Conclusion**: Switching back to `LancamentosTab` displays the dirty list of up to 5000 transactions matching the report's filters, while the dropdown filters of `LancamentosTab` still say "Todos", causing a visual state desync.

### 2.8 Node-postgres Timezone Date Shift
- **Step 1**: Node-postgres driver parses `DATE` columns as local midnight in the server's timezone.
- **Step 2**: If the server timezone has a positive offset (GMT+X), converting the local Date object back to UTC string shifts the date backward by 1 day.
- **Conclusion**: Transaction dates will be shifted backward by one day when run on servers east of Greenwich.

---

## 3. Caveats
- The analysis is purely static; actual runtime verification depends on database state.
- Assumptions were made that the server running the Vercel handler might be configured with timezones other than UTC (which is common in cloud hosting environments).

---

## 4. Conclusion
The application suffers from critical mathematical bugs in bank balance calculations, security failures in JWT parsing (which can cause silent logouts), data integrity issues (bypass of bank validation during edits), and major UI state synchronization issues.

---

## 5. Verification Method

### 5.1 Verification files to inspect:
- **availableYears filter issue**: View `src/tabs/LancamentosTab.tsx` at line 55 and `src/tabs/RelatoriosTab.tsx` at line 32.
- **BancosTab balance bug**: View `src/tabs/BancosTab.tsx` at lines 19-23 and 89-91.
- **JWT Decoding**: View `src/api.ts` at line 36.
- **EditTxModal required bypass**: View `src/modals/EditTxModal.tsx` at line 121.
- **OFX Import stale state**: View `src/hooks/useAppData.tsx` at line 608.
- **Timezone shift**: View `api/_handlers/transactions.js` at line 113.

### 5.2 Invalidation conditions:
- If `BancosTab.tsx` checks `tx.tipo === 'RECEITA'` and computes the sum accordingly, this bug is resolved.
- If `api.ts` pads the base64 string before calling `atob`, the JWT decoding issue is resolved.
