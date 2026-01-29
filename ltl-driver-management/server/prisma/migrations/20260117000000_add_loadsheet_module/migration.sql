-- Migration: Add Loadsheet Module
-- This migration adds all the tables and enums needed for:
-- Loadsheet Management (manifests, hazmat items, dispatch entries, freight placements)

-- =============================================
-- NEW ENUM TYPES
-- =============================================

-- Loadsheet Status
CREATE TYPE "LoadsheetStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'DISPATCHED');

-- Load Type
CREATE TYPE "LoadType" AS ENUM ('PURE', 'MIX');

-- =============================================
-- LOADSHEETS TABLE
-- =============================================
CREATE TABLE "loadsheets" (
    "id" SERIAL NOT NULL,
    "manifestNumber" TEXT NOT NULL,

    -- Header Section
    "trailerNumber" TEXT NOT NULL,
    "suggestedTrailerLength" INTEGER DEFAULT 53,
    "pintleHookRequired" BOOLEAN NOT NULL DEFAULT false,
    "targetDispatchTime" TEXT,
    "linehaulName" TEXT NOT NULL,
    "preloadManifest" TEXT,
    "originTerminalId" INTEGER,
    "originTerminalCode" TEXT,
    "linehaulTripId" INTEGER,

    -- Loading Info Section
    "loadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "straps" INTEGER,
    "closeTime" TEXT,
    "loadType" "LoadType" NOT NULL DEFAULT 'PURE',
    "loadbars" INTEGER,
    "loaderNumber" TEXT,
    "exceptions" TEXT,
    "capacity" TEXT,
    "blankets" INTEGER,
    "loaderName" TEXT,
    "sealNumber" TEXT,

    -- Trailer Condition
    "wallCondition" TEXT NOT NULL DEFAULT 'OK',
    "floorCondition" TEXT NOT NULL DEFAULT 'OK',
    "roofCondition" TEXT NOT NULL DEFAULT 'OK',
    "trailerConditionComment" TEXT,

    -- HAZMAT Placards (stored as JSON array)
    "hazmatPlacards" TEXT,

    -- Status and Audit
    "status" "LoadsheetStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "printedAt" TIMESTAMP(3),

    CONSTRAINT "loadsheets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loadsheets_manifestNumber_key" ON "loadsheets"("manifestNumber");
CREATE INDEX "loadsheets_status_idx" ON "loadsheets"("status");
CREATE INDEX "loadsheets_originTerminalId_idx" ON "loadsheets"("originTerminalId");
CREATE INDEX "loadsheets_loadDate_idx" ON "loadsheets"("loadDate");
CREATE INDEX "loadsheets_linehaulTripId_idx" ON "loadsheets"("linehaulTripId");

-- =============================================
-- LOADSHEET HAZMAT ITEMS TABLE
-- =============================================
CREATE TABLE "loadsheet_hazmat_items" (
    "id" SERIAL NOT NULL,
    "loadsheetId" INTEGER NOT NULL,
    "itemNumber" INTEGER NOT NULL,
    "proNumber" TEXT,
    "hazmatClass" TEXT,
    "weight" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loadsheet_hazmat_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "loadsheet_hazmat_items_loadsheetId_idx" ON "loadsheet_hazmat_items"("loadsheetId");

-- =============================================
-- LOADSHEET DISPATCH ENTRIES TABLE
-- =============================================
CREATE TABLE "loadsheet_dispatch_entries" (
    "id" SERIAL NOT NULL,
    "loadsheetId" INTEGER NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "dispatchTime" TEXT,
    "dispatchTerminal" TEXT,
    "nextTerminal" TEXT,
    "tractorNumber" TEXT,
    "driverNumber" TEXT,
    "driverName" TEXT,
    "supervisorNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loadsheet_dispatch_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "loadsheet_dispatch_entries_loadsheetId_idx" ON "loadsheet_dispatch_entries"("loadsheetId");

-- =============================================
-- LOADSHEET FREIGHT PLACEMENTS TABLE
-- =============================================
CREATE TABLE "loadsheet_freight_placements" (
    "id" SERIAL NOT NULL,
    "loadsheetId" INTEGER NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "loose" TEXT,
    "left" TEXT,
    "right" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loadsheet_freight_placements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "loadsheet_freight_placements_loadsheetId_idx" ON "loadsheet_freight_placements"("loadsheetId");

-- =============================================
-- FOREIGN KEY CONSTRAINTS
-- =============================================

-- Loadsheets
ALTER TABLE "loadsheets" ADD CONSTRAINT "loadsheets_originTerminalId_fkey"
    FOREIGN KEY ("originTerminalId") REFERENCES "terminals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "loadsheets" ADD CONSTRAINT "loadsheets_linehaulTripId_fkey"
    FOREIGN KEY ("linehaulTripId") REFERENCES "linehaul_trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Loadsheet Hazmat Items
ALTER TABLE "loadsheet_hazmat_items" ADD CONSTRAINT "loadsheet_hazmat_items_loadsheetId_fkey"
    FOREIGN KEY ("loadsheetId") REFERENCES "loadsheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Loadsheet Dispatch Entries
ALTER TABLE "loadsheet_dispatch_entries" ADD CONSTRAINT "loadsheet_dispatch_entries_loadsheetId_fkey"
    FOREIGN KEY ("loadsheetId") REFERENCES "loadsheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Loadsheet Freight Placements
ALTER TABLE "loadsheet_freight_placements" ADD CONSTRAINT "loadsheet_freight_placements_loadsheetId_fkey"
    FOREIGN KEY ("loadsheetId") REFERENCES "loadsheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
