-- Add UNLOADING status to TripStatus enum
ALTER TYPE "TripStatus" ADD VALUE 'UNLOADING' AFTER 'ARRIVED';
