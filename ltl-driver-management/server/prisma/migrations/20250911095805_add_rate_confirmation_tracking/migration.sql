-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "confirmationIpAddress" TEXT,
ADD COLUMN     "confirmationSentAt" TIMESTAMP(3),
ADD COLUMN     "confirmationSentVia" TEXT,
ADD COLUMN     "confirmationSignature" TEXT,
ADD COLUMN     "confirmationSignedAt" TIMESTAMP(3),
ADD COLUMN     "confirmationSignedBy" TEXT,
ADD COLUMN     "confirmationToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "bookings_confirmationToken_key" ON "bookings"("confirmationToken");