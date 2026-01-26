-- CreateEnum
CREATE TYPE "PayrollSourceType" AS ENUM ('TRIP_PAY', 'CUT_PAY');

-- CreateEnum
CREATE TYPE "PayrollLineItemStatus" AS ENUM ('PENDING', 'CALCULATED', 'REVIEWED', 'APPROVED', 'PAID', 'DISPUTED');

-- CreateTable
CREATE TABLE "payroll_line_items" (
    "id" SERIAL NOT NULL,
    "sourceType" "PayrollSourceType" NOT NULL,
    "tripPayId" INTEGER,
    "cutPayRequestId" INTEGER,
    "driverId" INTEGER NOT NULL,
    "tripId" INTEGER,
    "payPeriodId" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "driverName" TEXT,
    "driverNumber" TEXT,
    "workdayEmployeeId" TEXT,
    "tripNumber" TEXT,
    "origin" TEXT,
    "destination" TEXT,
    "totalMiles" DECIMAL(8,1),
    "basePay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "mileagePay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "dropAndHookPay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "chainUpPay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "waitTimePay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "otherAccessorialPay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bonusPay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalGrossPay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cutPayType" "CutPayType",
    "cutPayHours" DECIMAL(6,2),
    "cutPayMiles" DECIMAL(8,1),
    "trailerConfig" TEXT,
    "rateApplied" DECIMAL(10,4),
    "status" "PayrollLineItemStatus" NOT NULL DEFAULT 'PENDING',
    "calculatedAt" TIMESTAMP(3),
    "reviewedBy" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "approvedBy" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "externalPayrollId" TEXT,
    "exportedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_line_items_tripPayId_key" ON "payroll_line_items"("tripPayId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_line_items_cutPayRequestId_key" ON "payroll_line_items"("cutPayRequestId");

-- CreateIndex
CREATE INDEX "payroll_line_items_sourceType_idx" ON "payroll_line_items"("sourceType");

-- CreateIndex
CREATE INDEX "payroll_line_items_driverId_idx" ON "payroll_line_items"("driverId");

-- CreateIndex
CREATE INDEX "payroll_line_items_tripId_idx" ON "payroll_line_items"("tripId");

-- CreateIndex
CREATE INDEX "payroll_line_items_payPeriodId_idx" ON "payroll_line_items"("payPeriodId");

-- CreateIndex
CREATE INDEX "payroll_line_items_date_idx" ON "payroll_line_items"("date");

-- CreateIndex
CREATE INDEX "payroll_line_items_status_idx" ON "payroll_line_items"("status");

-- AddForeignKey
ALTER TABLE "payroll_line_items" ADD CONSTRAINT "payroll_line_items_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "carrier_drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_line_items" ADD CONSTRAINT "payroll_line_items_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "linehaul_trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_line_items" ADD CONSTRAINT "payroll_line_items_payPeriodId_fkey" FOREIGN KEY ("payPeriodId") REFERENCES "pay_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_line_items" ADD CONSTRAINT "payroll_line_items_tripPayId_fkey" FOREIGN KEY ("tripPayId") REFERENCES "trip_pay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_line_items" ADD CONSTRAINT "payroll_line_items_cutPayRequestId_fkey" FOREIGN KEY ("cutPayRequestId") REFERENCES "cut_pay_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_line_items" ADD CONSTRAINT "payroll_line_items_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_line_items" ADD CONSTRAINT "payroll_line_items_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
