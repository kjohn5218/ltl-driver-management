-- CreateTable
CREATE TABLE "driver_morale_ratings" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "arrivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_morale_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "driver_morale_ratings_driverId_idx" ON "driver_morale_ratings"("driverId");

-- CreateIndex
CREATE INDEX "driver_morale_ratings_arrivedAt_idx" ON "driver_morale_ratings"("arrivedAt");

-- CreateIndex
CREATE INDEX "driver_morale_ratings_rating_idx" ON "driver_morale_ratings"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "driver_morale_ratings_tripId_key" ON "driver_morale_ratings"("tripId");

-- AddForeignKey
ALTER TABLE "driver_morale_ratings" ADD CONSTRAINT "driver_morale_ratings_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "linehaul_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_morale_ratings" ADD CONSTRAINT "driver_morale_ratings_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "carrier_drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
