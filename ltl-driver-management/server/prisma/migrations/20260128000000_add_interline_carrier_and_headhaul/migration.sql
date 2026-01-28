-- CreateTable
CREATE TABLE "interline_carriers" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scacCode" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interline_carriers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "interline_carriers_code_key" ON "interline_carriers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "interline_carriers_scacCode_key" ON "interline_carriers"("scacCode");

-- CreateIndex
CREATE INDEX "interline_carriers_active_idx" ON "interline_carriers"("active");

-- AlterTable
ALTER TABLE "linehaul_profiles" ADD COLUMN "headhaul" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "linehaul_profiles" ADD COLUMN "interlineTrailer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "linehaul_profiles" ADD COLUMN "interlineCarrierId" INTEGER;

-- CreateIndex
CREATE INDEX "linehaul_profiles_interlineCarrierId_idx" ON "linehaul_profiles"("interlineCarrierId");

-- AddForeignKey
ALTER TABLE "linehaul_profiles" ADD CONSTRAINT "linehaul_profiles_interlineCarrierId_fkey" FOREIGN KEY ("interlineCarrierId") REFERENCES "interline_carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable (Route model)
ALTER TABLE "routes" ADD COLUMN "headhaul" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "routes" ADD COLUMN "interlineTrailer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "routes" ADD COLUMN "interlineCarrierId" INTEGER;

-- CreateIndex
CREATE INDEX "routes_interlineCarrierId_idx" ON "routes"("interlineCarrierId");

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_interlineCarrierId_fkey" FOREIGN KEY ("interlineCarrierId") REFERENCES "interline_carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
