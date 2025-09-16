-- AlterTable
ALTER TABLE "bookings" 
  ALTER COLUMN "routeId" DROP NOT NULL,
  ADD COLUMN "origin" TEXT,
  ADD COLUMN "destination" TEXT,
  ADD COLUMN "estimatedMiles" DECIMAL(6,1),
  ADD COLUMN "manifestNumber" TEXT;