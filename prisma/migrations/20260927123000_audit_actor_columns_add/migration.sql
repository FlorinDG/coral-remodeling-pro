-- CreateEnum
CREATE TYPE "ActorKind" AS ENUM ('USER', 'SYSTEM', 'PORTAL', 'OPERATOR');

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "actorUserId" DROP NOT NULL;
ALTER TABLE "AuditLog" ADD COLUMN "actorKind" "ActorKind";
ALTER TABLE "AuditLog" ADD COLUMN "actorRef" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "actorLabel" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "onBehalfOfId" TEXT;

-- Backfill: every existing row is USER, actorLabel from User.name or actorUserId
UPDATE "AuditLog" a
SET "actorKind" = 'USER'::"ActorKind",
    "actorLabel" = COALESCE(u.name, a."actorUserId")
FROM "AuditLog" a2
LEFT JOIN "User" u ON u.id = a2."actorUserId"
WHERE a.id = a2.id AND a."actorKind" IS NULL;
