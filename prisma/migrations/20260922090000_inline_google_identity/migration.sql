-- AlterTable
ALTER TABLE "User" ADD COLUMN "googleSubject" TEXT;

-- Backfill existing Google identities before removing the relation table.
UPDATE "User" AS "user"
SET "googleSubject" = "identity"."subject"
FROM "GoogleIdentity" AS "identity"
WHERE "identity"."userId" = "user"."id";

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");

-- DropTable
DROP TABLE "GoogleIdentity";
