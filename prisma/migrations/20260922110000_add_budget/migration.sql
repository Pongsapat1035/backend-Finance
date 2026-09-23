-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "categoryId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RecurringTransaction" ALTER COLUMN "categoryId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Budget" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "categoryId" INTEGER,
    "period" TEXT NOT NULL,
    "plannedAmount" INTEGER,
    "spentAmount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Budget_period_format_check" CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

-- CreateIndex
CREATE INDEX "Budget_userId_period_idx" ON "Budget"("userId", "period");

-- CreateIndex
CREATE INDEX "Budget_userId_categoryId_period_idx" ON "Budget"("userId", "categoryId", "period");

-- CreateIndex
CREATE INDEX "Transaction_userId_type_date_idx" ON "Transaction"("userId", "type", "date");

-- Nullable category IDs need separate partial indexes because a standard PostgreSQL
-- unique index allows multiple NULL values.
CREATE UNIQUE INDEX "Budget_userId_categoryId_period_key"
ON "Budget"("userId", "categoryId", "period")
WHERE "categoryId" IS NOT NULL;

CREATE UNIQUE INDEX "Budget_userId_period_uncategorized_key"
ON "Budget"("userId", "period")
WHERE "categoryId" IS NULL;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill the rebuildable usage projection from expense transactions. Existing
-- timestamps are interpreted as UTC instants, then grouped by the product's
-- Asia/Bangkok calendar month.
INSERT INTO "Budget" ("userId", "categoryId", "period", "plannedAmount", "spentAmount", "updatedAt")
SELECT
    "userId",
    "categoryId",
    to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM'),
    NULL,
    SUM("amount"),
    CURRENT_TIMESTAMP
FROM "Transaction"
WHERE "type" = 'expend' AND "categoryId" IS NOT NULL
GROUP BY "userId", "categoryId", to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM')
ON CONFLICT ("userId", "categoryId", "period") WHERE "categoryId" IS NOT NULL
DO UPDATE SET "spentAmount" = EXCLUDED."spentAmount", "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Budget" ("userId", "categoryId", "period", "plannedAmount", "spentAmount", "updatedAt")
SELECT
    "userId",
    NULL,
    to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM'),
    NULL,
    SUM("amount"),
    CURRENT_TIMESTAMP
FROM "Transaction"
WHERE "type" = 'expend' AND "categoryId" IS NULL
GROUP BY "userId", to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM')
ON CONFLICT ("userId", "period") WHERE "categoryId" IS NULL
DO UPDATE SET "spentAmount" = EXCLUDED."spentAmount", "updatedAt" = CURRENT_TIMESTAMP;
