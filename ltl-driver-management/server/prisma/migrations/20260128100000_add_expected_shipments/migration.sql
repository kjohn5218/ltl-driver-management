-- CreateTable
CREATE TABLE "expected_shipments" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT,
    "forecastDate" TIMESTAMP(3) NOT NULL,
    "originTerminalCode" TEXT NOT NULL,
    "destinationTerminalCode" TEXT NOT NULL,
    "laneName" TEXT,
    "expectedShipmentCount" INTEGER NOT NULL DEFAULT 0,
    "expectedPieces" INTEGER NOT NULL DEFAULT 0,
    "expectedWeight" INTEGER NOT NULL DEFAULT 0,
    "expectedCube" INTEGER,
    "guaranteedCount" INTEGER NOT NULL DEFAULT 0,
    "standardCount" INTEGER NOT NULL DEFAULT 0,
    "expeditedCount" INTEGER NOT NULL DEFAULT 0,
    "hazmatCount" INTEGER NOT NULL DEFAULT 0,
    "highValueCount" INTEGER NOT NULL DEFAULT 0,
    "oversizeCount" INTEGER NOT NULL DEFAULT 0,
    "estimatedTrailers" DECIMAL(4,1),
    "trailerUtilization" DECIMAL(5,2),
    "dataSource" TEXT NOT NULL DEFAULT 'TMS',
    "confidenceLevel" TEXT,
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expected_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expected_shipment_details" (
    "id" SERIAL NOT NULL,
    "expectedShipmentId" INTEGER,
    "externalProNumber" TEXT,
    "forecastDate" TIMESTAMP(3) NOT NULL,
    "originTerminalCode" TEXT NOT NULL,
    "destinationTerminalCode" TEXT NOT NULL,
    "pieces" INTEGER NOT NULL DEFAULT 1,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "cube" DECIMAL(8,2),
    "serviceLevel" TEXT NOT NULL DEFAULT 'STANDARD',
    "isHazmat" BOOLEAN NOT NULL DEFAULT false,
    "hazmatClass" TEXT,
    "isHighValue" BOOLEAN NOT NULL DEFAULT false,
    "isOversize" BOOLEAN NOT NULL DEFAULT false,
    "shipperName" TEXT,
    "shipperCity" TEXT,
    "consigneeName" TEXT,
    "consigneeCity" TEXT,
    "estimatedPickupTime" TIMESTAMP(3),
    "estimatedDeliveryTime" TIMESTAMP(3),
    "appointmentRequired" BOOLEAN NOT NULL DEFAULT false,
    "dataSource" TEXT NOT NULL DEFAULT 'TMS',
    "externalStatus" TEXT,
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expected_shipment_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expected_shipments_externalId_key" ON "expected_shipments"("externalId");

-- CreateIndex
CREATE INDEX "expected_shipments_forecastDate_idx" ON "expected_shipments"("forecastDate");

-- CreateIndex
CREATE INDEX "expected_shipments_originTerminalCode_idx" ON "expected_shipments"("originTerminalCode");

-- CreateIndex
CREATE INDEX "expected_shipments_destinationTerminalCode_idx" ON "expected_shipments"("destinationTerminalCode");

-- CreateIndex
CREATE INDEX "expected_shipments_laneName_idx" ON "expected_shipments"("laneName");

-- CreateIndex
CREATE UNIQUE INDEX "expected_shipments_forecastDate_originTerminalCode_destinationTerminalCode_key" ON "expected_shipments"("forecastDate", "originTerminalCode", "destinationTerminalCode");

-- CreateIndex
CREATE INDEX "expected_shipment_details_forecastDate_idx" ON "expected_shipment_details"("forecastDate");

-- CreateIndex
CREATE INDEX "expected_shipment_details_originTerminalCode_idx" ON "expected_shipment_details"("originTerminalCode");

-- CreateIndex
CREATE INDEX "expected_shipment_details_destinationTerminalCode_idx" ON "expected_shipment_details"("destinationTerminalCode");

-- CreateIndex
CREATE INDEX "expected_shipment_details_serviceLevel_idx" ON "expected_shipment_details"("serviceLevel");

-- CreateIndex
CREATE INDEX "expected_shipment_details_externalProNumber_idx" ON "expected_shipment_details"("externalProNumber");
