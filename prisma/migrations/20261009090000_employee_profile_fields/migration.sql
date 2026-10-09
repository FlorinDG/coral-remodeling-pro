-- EMP-PROFILE-1 · additive (pd.md 5e: DB first, code second)
-- extended employee profile moved from browser localStorage to database
ALTER TABLE "Employee" ADD COLUMN "department" TEXT;
ALTER TABLE "Employee" ADD COLUMN "employmentType" TEXT;
ALTER TABLE "Employee" ADD COLUMN "address" TEXT;
ALTER TABLE "Employee" ADD COLUMN "birthDate" TEXT;
ALTER TABLE "Employee" ADD COLUMN "notes" TEXT;
