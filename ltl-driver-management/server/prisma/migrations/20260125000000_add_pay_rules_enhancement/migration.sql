-- Add new AccessorialType enum values
-- Note: PostgreSQL doesn't support altering enums easily, so we need to add the new values
ALTER TYPE "AccessorialType" ADD VALUE IF NOT EXISTS 'WAIT_TIME';
ALTER TYPE "AccessorialType" ADD VALUE IF NOT EXISTS 'SINGLE_TRAILER';
ALTER TYPE "AccessorialType" ADD VALUE IF NOT EXISTS 'DOUBLE_TRAILER';
ALTER TYPE "AccessorialType" ADD VALUE IF NOT EXISTS 'TRIPLE_TRAILER';
ALTER TYPE "AccessorialType" ADD VALUE IF NOT EXISTS 'CUT_PAY';

-- Create CutPayStatus enum
DO $$ BEGIN
    CREATE TYPE "CutPayStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add Workday fields to carrier_drivers
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "workdayEmployeeId" TEXT;
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "workdayLastSync" TIMESTAMP(3);
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "workdayRateInfo" TEXT;

-- Create index on workdayEmployeeId
CREATE INDEX IF NOT EXISTS "carrier_drivers_workdayEmployeeId_idx" ON "carrier_drivers"("workdayEmployeeId");

-- Create cut_pay_requests table
CREATE TABLE IF NOT EXISTS "cut_pay_requests" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tripId" INTEGER,
    "status" "CutPayStatus" NOT NULL DEFAULT 'PENDING',
    "trailerConfig" TEXT,
    "hoursRequested" DECIMAL(4,2) NOT NULL,
    "reason" TEXT,
    "approvedBy" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "rateApplied" DECIMAL(8,2),
    "totalPay" DECIMAL(8,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cut_pay_requests_pkey" PRIMARY KEY ("id")
);

-- Create indexes on cut_pay_requests
CREATE INDEX IF NOT EXISTS "cut_pay_requests_driverId_idx" ON "cut_pay_requests"("driverId");
CREATE INDEX IF NOT EXISTS "cut_pay_requests_status_idx" ON "cut_pay_requests"("status");
CREATE INDEX IF NOT EXISTS "cut_pay_requests_requestDate_idx" ON "cut_pay_requests"("requestDate");

-- Add foreign keys for cut_pay_requests
DO $$ BEGIN
    ALTER TABLE "cut_pay_requests" ADD CONSTRAINT "cut_pay_requests_driverId_fkey"
        FOREIGN KEY ("driverId") REFERENCES "carrier_drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "cut_pay_requests" ADD CONSTRAINT "cut_pay_requests_tripId_fkey"
        FOREIGN KEY ("tripId") REFERENCES "linehaul_trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "cut_pay_requests" ADD CONSTRAINT "cut_pay_requests_approvedBy_fkey"
        FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create workday_paycodes table
CREATE TABLE IF NOT EXISTS "workday_paycodes" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "workdayId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "payType" TEXT NOT NULL,
    "trailerConfig" TEXT,
    "isCutPay" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workday_paycodes_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on code
CREATE UNIQUE INDEX IF NOT EXISTS "workday_paycodes_code_key" ON "workday_paycodes"("code");

-- Create indexes on workday_paycodes
CREATE INDEX IF NOT EXISTS "workday_paycodes_payType_idx" ON "workday_paycodes"("payType");
CREATE INDEX IF NOT EXISTS "workday_paycodes_trailerConfig_idx" ON "workday_paycodes"("trailerConfig");

-- Seed workday_paycodes with the Workday paycodes
INSERT INTO "workday_paycodes" ("code", "workdayId", "description", "payType", "trailerConfig", "isCutPay", "active", "createdAt", "updatedAt")
VALUES
    ('LH_TRIP_PAY', 'c769e32b0baa10017147afe740cd0000', 'LH Trip Pay', 'TRIP_PAY', NULL, false, true, NOW(), NOW()),
    ('LH_SINGLE_MILES', '252c7e64604d1000ad393115c9fd0000', 'LH Single Miles', 'MILES', 'SINGLE', false, true, NOW(), NOW()),
    ('LH_DOUBLE_MILES', '252c7e64604d1000ad3940beb5580000', 'LH Double Miles', 'MILES', 'DOUBLE', false, true, NOW(), NOW()),
    ('LH_TRIPLE_MILES', '5873f4e85b951001714670aecd480000', 'LH Triple Miles', 'MILES', 'TRIPLE', false, true, NOW(), NOW()),
    ('LH_TRIP_CUT_PAY', '5cf3b1c5059c100164135cafdff80000', 'LH Trip Cut Pay', 'CUT_PAY', NULL, true, true, NOW(), NOW()),
    ('LH_SINGLE_CUT_MILES', 'c769e32b0baa10017147be5b24840000', 'LH Single Cut Miles', 'CUT_MILES', 'SINGLE', true, true, NOW(), NOW()),
    ('LH_DOUBLE_CUT_MILES', 'c769e32b0baa10017147b72185330000', 'LH Double Cut Miles', 'CUT_MILES', 'DOUBLE', true, true, NOW(), NOW()),
    ('LH_TRIPLE_CUT_MILES', '252c7e64604d1000ad3938ebf70b0000', 'LH Triple Cut Miles', 'CUT_MILES', 'TRIPLE', true, true, NOW(), NOW()),
    ('LH_SINGLE_DROP_HOOKS', 'c769e32b0baa100171479d362d1a0000', 'LH Single Drop Hooks', 'DROP_HOOK', 'SINGLE', false, true, NOW(), NOW()),
    ('LH_DOUBLE_DROP_HOOKS', 'c769e32b0baa10017147b2ea7c7d0000', 'LH Double Drop Hooks', 'DROP_HOOK', 'DOUBLE', false, true, NOW(), NOW()),
    ('LH_TRIPLE_DROP_HOOKS', '5873f4e85b95100171469a42262f0000', 'LH Triple Drop Hooks', 'DROP_HOOK', 'TRIPLE', false, true, NOW(), NOW()),
    ('LH_CHAIN_UPS', 'c769e32b0baa10017147908d1b4e0000', 'LH Chain Ups', 'CHAIN_UP', NULL, false, true, NOW(), NOW()),
    ('LH_STOP_HOURS', '1f3d82e327491000ad60ed34d7050000', 'LH Stop Hours', 'STOP_HOURS', NULL, false, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;
