-- Add document upload token fields to bookings table
ALTER TABLE "bookings" 
ADD COLUMN IF NOT EXISTS "documentUploadToken" TEXT,
ADD COLUMN IF NOT EXISTS "documentUploadTokenCreatedAt" TIMESTAMP(3);

-- Create unique index on documentUploadToken
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_documentUploadToken_key" ON "bookings"("documentUploadToken");

-- Create booking_documents table
CREATE TABLE IF NOT EXISTS "booking_documents" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "documentType" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "booking_documents_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint
ALTER TABLE "booking_documents" ADD CONSTRAINT "booking_documents_bookingId_fkey" 
FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create index on bookingId for better query performance
CREATE INDEX IF NOT EXISTS "booking_documents_bookingId_idx" ON "booking_documents"("bookingId");