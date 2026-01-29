-- Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" SERIAL NOT NULL,
    "fuelSurchargeRate" DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- Add foreign key for updatedBy if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_updatedBy_fkey'
    ) THEN
        ALTER TABLE "system_settings"
        ADD CONSTRAINT "system_settings_updatedBy_fkey"
        FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AlterTable: Add fuel surcharge source tracking fields
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "fuelSurchargeSource" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "fuelSurchargeExternalId" TEXT;
