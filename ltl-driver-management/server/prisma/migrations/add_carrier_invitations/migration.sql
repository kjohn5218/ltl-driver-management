-- CreateTable
CREATE TABLE "carrier_invitations" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "registered_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carrier_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carrier_invitations_token_key" ON "carrier_invitations"("token");

-- CreateIndex
CREATE INDEX "carrier_invitations_email_idx" ON "carrier_invitations"("email");

-- CreateIndex
CREATE INDEX "carrier_invitations_status_idx" ON "carrier_invitations"("status");

-- AddForeignKey
ALTER TABLE "carrier_invitations" ADD CONSTRAINT "carrier_invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;