-- AlterTable
ALTER TABLE "locations" ADD COLUMN "isPhysicalTerminal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "locations" ADD COLUMN "isVirtualTerminal" BOOLEAN NOT NULL DEFAULT false;
