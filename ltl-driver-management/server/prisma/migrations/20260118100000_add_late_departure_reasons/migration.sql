-- CreateEnum
CREATE TYPE "LateReasonType" AS ENUM ('PRE_LOAD', 'DOCK_ISSUE', 'STAFFING', 'DRIVER_ISSUE', 'WEATHER', 'LATE_INBOUND', 'DISPATCH_ISSUE');

-- CreateTable
CREATE TABLE "late_departure_reasons" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "reason" "LateReasonType" NOT NULL,
    "willCauseServiceFailure" BOOLEAN NOT NULL,
    "accountableTerminalId" INTEGER,
    "accountableTerminalCode" TEXT,
    "notes" TEXT,
    "scheduledDepartTime" TEXT,
    "actualDepartTime" TEXT,
    "minutesLate" INTEGER,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "late_departure_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "late_departure_reasons_tripId_key" ON "late_departure_reasons"("tripId");

-- CreateIndex
CREATE INDEX "late_departure_reasons_tripId_idx" ON "late_departure_reasons"("tripId");

-- CreateIndex
CREATE INDEX "late_departure_reasons_reason_idx" ON "late_departure_reasons"("reason");

-- CreateIndex
CREATE INDEX "late_departure_reasons_accountableTerminalId_idx" ON "late_departure_reasons"("accountableTerminalId");

-- CreateIndex
CREATE INDEX "late_departure_reasons_createdAt_idx" ON "late_departure_reasons"("createdAt");

-- AddForeignKey
ALTER TABLE "late_departure_reasons" ADD CONSTRAINT "late_departure_reasons_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "linehaul_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "late_departure_reasons" ADD CONSTRAINT "late_departure_reasons_accountableTerminalId_fkey" FOREIGN KEY ("accountableTerminalId") REFERENCES "terminals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "late_departure_reasons" ADD CONSTRAINT "late_departure_reasons_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
