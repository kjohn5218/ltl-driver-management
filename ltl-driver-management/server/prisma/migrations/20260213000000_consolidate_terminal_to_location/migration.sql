-- Phase 1: Consolidate Terminal to Location
-- This migration adds new Location-based FK columns alongside existing Terminal FKs
-- Data will be migrated, then old Terminal columns can be removed in a future cleanup migration

-- Step 1: Create LocationEquipmentRequirement table
CREATE TABLE "location_equipment_requirements" (
    "id" SERIAL NOT NULL,
    "locationId" INTEGER NOT NULL,
    "equipmentType" TEXT NOT NULL,
    "minCount" INTEGER NOT NULL DEFAULT 0,
    "maxCount" INTEGER,
    "dayOfWeek" INTEGER,
    "effectiveDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "seasonalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_equipment_requirements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "location_equipment_requirements_locationId_idx" ON "location_equipment_requirements"("locationId");
CREATE INDEX "location_equipment_requirements_equipmentType_idx" ON "location_equipment_requirements"("equipmentType");

ALTER TABLE "location_equipment_requirements" ADD CONSTRAINT "location_equipment_requirements_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 2: Add new Location FK columns to equipment tables
ALTER TABLE "equipment_trucks" ADD COLUMN "currentLocationId" INTEGER;
ALTER TABLE "equipment_trailers" ADD COLUMN "currentLocationId" INTEGER;
ALTER TABLE "equipment_dollies" ADD COLUMN "currentLocationId" INTEGER;

CREATE INDEX "equipment_trucks_currentLocationId_idx" ON "equipment_trucks"("currentLocationId");
CREATE INDEX "equipment_trailers_currentLocationId_idx" ON "equipment_trailers"("currentLocationId");
CREATE INDEX "equipment_dollies_currentLocationId_idx" ON "equipment_dollies"("currentLocationId");

ALTER TABLE "equipment_trucks" ADD CONSTRAINT "equipment_trucks_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "equipment_trailers" ADD CONSTRAINT "equipment_trailers_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "equipment_dollies" ADD CONSTRAINT "equipment_dollies_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 3: Add new Location FK columns to LinehaulProfile
ALTER TABLE "linehaul_profiles" ADD COLUMN "originLocationId" INTEGER;
ALTER TABLE "linehaul_profiles" ADD COLUMN "destinationLocationId" INTEGER;

CREATE INDEX "linehaul_profiles_originLocationId_idx" ON "linehaul_profiles"("originLocationId");
CREATE INDEX "linehaul_profiles_destinationLocationId_idx" ON "linehaul_profiles"("destinationLocationId");

ALTER TABLE "linehaul_profiles" ADD CONSTRAINT "linehaul_profiles_originLocationId_fkey" FOREIGN KEY ("originLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "linehaul_profiles" ADD CONSTRAINT "linehaul_profiles_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 4: Add new Location FK columns to RateCard
ALTER TABLE "rate_cards" ADD COLUMN "originLocationId" INTEGER;
ALTER TABLE "rate_cards" ADD COLUMN "destinationLocationId" INTEGER;

CREATE INDEX "rate_cards_originLocationId_idx" ON "rate_cards"("originLocationId");
CREATE INDEX "rate_cards_destinationLocationId_idx" ON "rate_cards"("destinationLocationId");

ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_originLocationId_fkey" FOREIGN KEY ("originLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 5: Add new Location FK column to Loadsheet
ALTER TABLE "loadsheets" ADD COLUMN "originLocationId" INTEGER;

CREATE INDEX "loadsheets_originLocationId_idx" ON "loadsheets"("originLocationId");

ALTER TABLE "loadsheets" ADD CONSTRAINT "loadsheets_originLocationId_fkey" FOREIGN KEY ("originLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 6: Add new Location FK column to LateDepartureReason
ALTER TABLE "late_departure_reasons" ADD COLUMN "accountableLocationId" INTEGER;

CREATE INDEX "late_departure_reasons_accountableLocationId_idx" ON "late_departure_reasons"("accountableLocationId");

ALTER TABLE "late_departure_reasons" ADD CONSTRAINT "late_departure_reasons_accountableLocationId_fkey" FOREIGN KEY ("accountableLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 7: Add new Location FK columns to ProfileOkayToLoad and ProfileOkayToDispatch
ALTER TABLE "profile_okay_to_load" ADD COLUMN "locationId" INTEGER;
ALTER TABLE "profile_okay_to_dispatch" ADD COLUMN "locationId" INTEGER;

CREATE INDEX "profile_okay_to_load_locationId_idx" ON "profile_okay_to_load"("locationId");
CREATE INDEX "profile_okay_to_dispatch_locationId_idx" ON "profile_okay_to_dispatch"("locationId");

ALTER TABLE "profile_okay_to_load" ADD CONSTRAINT "profile_okay_to_load_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_okay_to_dispatch" ADD CONSTRAINT "profile_okay_to_dispatch_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- DATA MIGRATION
-- ============================================

-- Step 8: Copy Terminal data to Location (if not already exists, mark as isPhysicalTerminal=true)
INSERT INTO "locations" ("code", "name", "address", "city", "state", "zipCode", "contact", "timeZone", "latitude", "longitude", "active", "createdAt", "updatedAt", "phone", "isPhysicalTerminal", "isVirtualTerminal")
SELECT
    t."code",
    t."name",
    t."address",
    t."city",
    t."state",
    t."zipCode",
    t."contact",
    t."timezone",
    t."latitude",
    t."longitude",
    t."active",
    t."createdAt",
    t."updatedAt",
    t."phone",
    true,  -- isPhysicalTerminal
    false  -- isVirtualTerminal
FROM "terminals" t
WHERE NOT EXISTS (
    SELECT 1 FROM "locations" l WHERE l."code" = t."code"
);

-- For terminals that already exist as locations, update them to be physical terminals
UPDATE "locations" l
SET "isPhysicalTerminal" = true
FROM "terminals" t
WHERE l."code" = t."code" AND l."isPhysicalTerminal" = false;

-- Step 9: Populate new Location FK columns by matching terminal codes

-- Equipment trucks: Map currentTerminalId to currentLocationId
UPDATE "equipment_trucks" et
SET "currentLocationId" = l.id
FROM "terminals" t
JOIN "locations" l ON l."code" = t."code"
WHERE et."currentTerminalId" = t.id AND et."currentLocationId" IS NULL;

-- Equipment trailers: Map currentTerminalId to currentLocationId
UPDATE "equipment_trailers" et
SET "currentLocationId" = l.id
FROM "terminals" t
JOIN "locations" l ON l."code" = t."code"
WHERE et."currentTerminalId" = t.id AND et."currentLocationId" IS NULL;

-- Equipment dollies: Map currentTerminalId to currentLocationId
UPDATE "equipment_dollies" ed
SET "currentLocationId" = l.id
FROM "terminals" t
JOIN "locations" l ON l."code" = t."code"
WHERE ed."currentTerminalId" = t.id AND ed."currentLocationId" IS NULL;

-- Linehaul profiles: Map originTerminalId and destinationTerminalId to location IDs
UPDATE "linehaul_profiles" lp
SET "originLocationId" = l.id
FROM "terminals" t
JOIN "locations" l ON l."code" = t."code"
WHERE lp."originTerminalId" = t.id AND lp."originLocationId" IS NULL;

UPDATE "linehaul_profiles" lp
SET "destinationLocationId" = l.id
FROM "terminals" t
JOIN "locations" l ON l."code" = t."code"
WHERE lp."destinationTerminalId" = t.id AND lp."destinationLocationId" IS NULL;

-- Rate cards: Map origin and destination terminal IDs to location IDs
UPDATE "rate_cards" rc
SET "originLocationId" = l.id
FROM "terminals" t
JOIN "locations" l ON l."code" = t."code"
WHERE rc."originTerminalId" = t.id AND rc."originLocationId" IS NULL;

UPDATE "rate_cards" rc
SET "destinationLocationId" = l.id
FROM "terminals" t
JOIN "locations" l ON l."code" = t."code"
WHERE rc."destinationTerminalId" = t.id AND rc."destinationLocationId" IS NULL;

-- Loadsheets: Map originTerminalId to originLocationId
UPDATE "loadsheets" ls
SET "originLocationId" = l.id
FROM "terminals" t
JOIN "locations" l ON l."code" = t."code"
WHERE ls."originTerminalId" = t.id AND ls."originLocationId" IS NULL;

-- Late departure reasons: Map accountableTerminalId to accountableLocationId
UPDATE "late_departure_reasons" ldr
SET "accountableLocationId" = l.id
FROM "terminals" t
JOIN "locations" l ON l."code" = t."code"
WHERE ldr."accountableTerminalId" = t.id AND ldr."accountableLocationId" IS NULL;

-- Profile okay to load: Map terminalId to locationId
UPDATE "profile_okay_to_load" pol
SET "locationId" = l.id
FROM "terminals" t
JOIN "locations" l ON l."code" = t."code"
WHERE pol."terminalId" = t.id AND pol."locationId" IS NULL;

-- Profile okay to dispatch: Map terminalId to locationId
UPDATE "profile_okay_to_dispatch" pod
SET "locationId" = l.id
FROM "terminals" t
JOIN "locations" l ON l."code" = t."code"
WHERE pod."terminalId" = t.id AND pod."locationId" IS NULL;

-- Step 10: Copy TerminalEquipmentRequirement to LocationEquipmentRequirement
INSERT INTO "location_equipment_requirements" ("locationId", "equipmentType", "minCount", "maxCount", "dayOfWeek", "effectiveDate", "expirationDate", "seasonalNote", "createdAt", "updatedAt")
SELECT
    l.id,
    ter."equipmentType",
    ter."minCount",
    ter."maxCount",
    ter."dayOfWeek",
    ter."effectiveDate",
    ter."expirationDate",
    ter."seasonalNote",
    ter."createdAt",
    ter."updatedAt"
FROM "terminal_equipment_requirements" ter
JOIN "terminals" t ON ter."terminalId" = t.id
JOIN "locations" l ON l."code" = t."code";
