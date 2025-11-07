-- AlterTable
ALTER TABLE "invoices" 
ADD COLUMN "baseAmount" DECIMAL(8,2) NOT NULL DEFAULT 0.00,
ADD COLUMN "lineItemsAmount" DECIMAL(8,2) NOT NULL DEFAULT 0.00,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "sentToAPAt" TIMESTAMP(3),
ADD COLUMN "sentToAPBy" TEXT,
ADD COLUMN "includesDocuments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notes" TEXT;

-- Update baseAmount for existing invoices from booking rate
UPDATE "invoices" 
SET "baseAmount" = "amount", 
    "updatedAt" = CURRENT_TIMESTAMP 
WHERE "baseAmount" = 0.00;

-- CreateTable
CREATE TABLE "invoice_attachments" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentId" INTEGER,
    "filename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_attachments_invoiceId_idx" ON "invoice_attachments"("invoiceId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_createdAt_idx" ON "invoices"("createdAt");

-- AddForeignKey
ALTER TABLE "invoice_attachments" ADD CONSTRAINT "invoice_attachments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update enum
ALTER TYPE "InvoiceStatus" RENAME VALUE 'SENT' TO 'SENT_TO_AP';