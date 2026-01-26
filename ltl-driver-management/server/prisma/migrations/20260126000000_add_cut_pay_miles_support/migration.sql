-- CreateEnum
CREATE TYPE "CutPayType" AS ENUM ('HOURS', 'MILES');

-- AlterTable: Add cutPayType and milesRequested columns
ALTER TABLE "cut_pay_requests" ADD COLUMN "cutPayType" "CutPayType" NOT NULL DEFAULT 'HOURS';
ALTER TABLE "cut_pay_requests" ADD COLUMN "milesRequested" DECIMAL(6,1);

-- AlterTable: Make hoursRequested nullable (since we now have milesRequested as alternative)
ALTER TABLE "cut_pay_requests" ALTER COLUMN "hoursRequested" DROP NOT NULL;
