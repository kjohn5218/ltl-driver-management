-- CreateTable
CREATE TABLE "carrier_drivers" (
    "id" SERIAL NOT NULL,
    "carrierId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "email" TEXT,
    "licenseNumber" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carrier_drivers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "carrier_drivers" ADD CONSTRAINT "carrier_drivers_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;