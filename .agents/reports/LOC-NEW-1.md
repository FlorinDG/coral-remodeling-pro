# CORAL — CODER REPORT — LOC-NEW-1 · Admin and Purchase Localization — 2026-10-10

### 0 · Header
```
Item:            LOC-NEW-1
Queue:           .agents/workflows/CODER-QUEUE.md § 10
Branch:          coder/work
Date:            2026-10-10
```

### 1 · Outcome
DONE (Committed locally; pending user review before push to origin)

### 2 · Verification & Guard Tests
| Check | Status | Evidence |
|---|---|---|
| `tests/i18n.test.ts` (Parity across 4 locales) | ✅ | All 4 locales (`en`, `nl`, `fr`, `ro`) synchronized with identical key sets; 0 empty strings |
| `tests/i18n.test.ts` (Source references) | ✅ | Every `t('...')` reference resolves to existing keys in all locales |
| `tests/i18n.test.ts` (Throw proof guard) | ✅ | Tampered key parity and source reference throw proof tests verified for `Admin.*` |
| `tests/purchase-document.test.ts` | ✅ | 8/8 passed with translation keys; throw proof verified |
| `npm run test:compile` | ✅ | Exit code 0, 0 TS errors |
| `npm run test:lint` | ✅ | Exit code 0, 0 ESLint errors |

### 3 · Inventory of Localized Sites
1. **`src/messages/{en,nl,fr,ro}.json`**:
   - Added synchronized namespaces under `Admin`: `lineSearch`, `expenses` (`duplicateBanner`, `validation`, `import`, `tickets`), `purchaseDocument`, `lineVatRate`, `vatBreakdown`, `documentDiscount`, `clientDiscount`, `financialRow`, `sync`.
2. **`src/lib/records/purchase-document.ts`**:
   - `QUOTE_LABEL` and `TICKET_LABEL` return `Admin.purchaseDocument.*` translation keys.
3. **`tests/purchase-document.test.ts`**:
   - Assertions updated to expect translation keys; verified throw proof.
4. **`src/components/admin/expenses/PurchaseLineSearch.tsx`**:
   - Localized all UI text with `useTranslations('Admin.lineSearch')` and `useLocale()`.
5. **`src/components/admin/expenses/PurchaseInvoiceEngine.tsx`**:
   - Localized duplicate match banner, validation verdict, and editor field labels via `useTranslations('Admin')` and `trLabel`.
6. **`src/components/admin/expenses/TicketCaptureModal.tsx`**:
   - Localized duplicate match banner and receipt error via `useTranslations('Admin')`.
7. **`src/components/admin/expenses/AiDocumentImportModal.tsx`**:
   - Localized tab labels, job verdicts, and action buttons via `useTranslations('Admin')`.
8. **`src/components/admin/database/store.ts`**:
   - Localized stuck sync toast error (line 604) based on document language with dictionary fallback. Sync logic untouched.
9. **`src/components/admin/shared/LineVatRateSelect.tsx`**:
   - Localized `verlegd`, `(doc)`, and `aria-label` via `useTranslations('Admin.lineVatRate')`.
10. **`src/components/admin/shared/VatBreakdownRows.tsx`**:
    - Localized mixed VAT breakdown rows via `useTranslations('Admin.vatBreakdown')`.
11. **`src/components/admin/shared/DocumentDiscountRows.tsx`**:
    - Localized discount rows via `useTranslations('Admin.documentDiscount')`.
12. **`src/components/admin/shared/ClientDiscountInput.tsx`**:
    - Localized aria labels via `useTranslations('Admin.clientDiscount')`.
13. **`src/components/admin/invoices/FinancialRowRenderer.tsx`**:
    - Localized `BTW` and `Korting` column labels via `useTranslations('Admin.financialRow')`.
14. **`src/components/admin/quotations/FinancialRowRenderer.tsx`**:
    - Localized `BTW` and `Korting` column labels via `useTranslations('Admin.financialRow')`.
15. **`tests/i18n.test.ts`**:
    - Added explicit throw-proof guard for `Admin.*` keys under `LOC-NEW-1`.
