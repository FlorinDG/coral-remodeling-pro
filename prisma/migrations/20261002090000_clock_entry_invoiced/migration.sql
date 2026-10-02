-- TS-INV-1 · additive (pd.md 5e: DB first, code second)
-- hours that went onto an invoice: when, by whom, and which invoice (a page in the tenant's invoices database)
ALTER TABLE "ClockEntry" ADD COLUMN "invoicedAt" TIMESTAMP(3);
ALTER TABLE "ClockEntry" ADD COLUMN "invoicedBy" TEXT;
ALTER TABLE "ClockEntry" ADD COLUMN "invoiceRef" TEXT;
