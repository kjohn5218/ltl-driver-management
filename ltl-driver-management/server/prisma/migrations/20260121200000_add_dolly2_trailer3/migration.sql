-- AlterTable
ALTER TABLE "linehaul_trips" ADD COLUMN "dolly2Id" INTEGER;
ALTER TABLE "linehaul_trips" ADD COLUMN "trailer3Id" INTEGER;

-- AddForeignKey
ALTER TABLE "linehaul_trips" ADD CONSTRAINT "linehaul_trips_dolly2Id_fkey" FOREIGN KEY ("dolly2Id") REFERENCES "equipment_dollies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linehaul_trips" ADD CONSTRAINT "linehaul_trips_trailer3Id_fkey" FOREIGN KEY ("trailer3Id") REFERENCES "equipment_trailers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
