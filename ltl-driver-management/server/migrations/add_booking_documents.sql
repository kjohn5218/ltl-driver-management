-- Add document tracking fields to bookings table
ALTER TABLE "bookings" 
ADD COLUMN "hasUploadedDocuments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "documentUploadToken" TEXT,
ADD COLUMN "documentUploadTokenCreatedAt" TIMESTAMP(3);

-- Add unique constraint for documentUploadToken
ALTER TABLE "bookings" 
ADD CONSTRAINT "bookings_documentUploadToken_key" UNIQUE ("documentUploadToken");

-- Create booking_documents table
CREATE TABLE "booking_documents" (
  "id" SERIAL NOT NULL,
  "bookingId" INTEGER NOT NULL,
  "documentType" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "legNumber" INTEGER,
  "notes" TEXT,

  CONSTRAINT "booking_documents_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint
ALTER TABLE "booking_documents" 
ADD CONSTRAINT "booking_documents_bookingId_fkey" 
FOREIGN KEY ("bookingId") 
REFERENCES "bookings"("id") 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- Create index on bookingId for performance
CREATE INDEX "booking_documents_bookingId_idx" ON "booking_documents"("bookingId");