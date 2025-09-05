-- First, update existing records to map old values to new values
UPDATE "bookings" SET "status" = 'UNBOOKED' WHERE "status" = 'PENDING';
UPDATE "bookings" SET "status" = 'BOOKED' WHERE "status" = 'CONFIRMED';

-- Create new enum type
CREATE TYPE "BookingStatus_new" AS ENUM ('UNBOOKED', 'BOOKED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- Update column to use new enum
ALTER TABLE "bookings" 
  ALTER COLUMN "status" TYPE "BookingStatus_new" 
  USING ("status"::text::"BookingStatus_new");

-- Drop old enum type
DROP TYPE "BookingStatus";

-- Rename new enum to match original name
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";

-- Also make carrierId nullable to allow unbooked bookings
ALTER TABLE "bookings" ALTER COLUMN "carrierId" DROP NOT NULL;