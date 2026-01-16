-- Migration: Add Dispatch & Fleet Management Module
-- This migration adds all the tables and enums needed for:
-- 1. Equipment Management (trucks, trailers, dollies)
-- 2. Linehaul Dispatch Operations
-- 3. Rate Management & Driver Pay

-- =============================================
-- NEW ENUM TYPES
-- =============================================

-- Equipment Status
CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE', 'DISPATCHED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE');

-- Truck Types
CREATE TYPE "TruckType" AS ENUM ('DAY_CAB', 'SLEEPER', 'STRAIGHT_TRUCK');

-- Trailer Types
CREATE TYPE "TrailerType" AS ENUM ('DRY_VAN_53', 'DRY_VAN_28', 'PUP_TRAILER', 'REEFER_53', 'REEFER_28', 'FLATBED', 'STEP_DECK', 'TANKER', 'INTERMODAL');

-- Dolly Types
CREATE TYPE "DollyType" AS ENUM ('A_DOLLY', 'B_DOLLY');

-- Trip Status
CREATE TYPE "TripStatus" AS ENUM ('PLANNED', 'ASSIGNED', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED', 'COMPLETED', 'CANCELLED');

-- Delay Codes
CREATE TYPE "DelayCode" AS ENUM ('EQUIPMENT_BREAKDOWN', 'DRIVER_UNAVAILABILITY', 'WEATHER_CONDITIONS', 'TRAFFIC_ROAD_CONDITIONS', 'SHIPPER_DELAY', 'RECEIVER_DELAY', 'DETENTION', 'OTHER');

-- Rate Method
CREATE TYPE "RateMethod" AS ENUM ('PER_MILE', 'FLAT_RATE', 'HOURLY', 'PERCENTAGE');

-- Rate Card Type
CREATE TYPE "RateCardType" AS ENUM ('DRIVER', 'CARRIER', 'LINEHAUL', 'OD_PAIR', 'DEFAULT');

-- Accessorial Type
CREATE TYPE "AccessorialType" AS ENUM ('LAYOVER', 'DETENTION', 'BREAKDOWN', 'HELPER', 'TRAINER', 'HAZMAT', 'TEAM_DRIVER', 'STOP_CHARGE', 'FUEL_SURCHARGE', 'OTHER');

-- Pay Period Status
CREATE TYPE "PayPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'LOCKED', 'EXPORTED');

-- Trip Pay Status
CREATE TYPE "TripPayStatus" AS ENUM ('PENDING', 'CALCULATED', 'REVIEWED', 'APPROVED', 'PAID', 'DISPUTED');

-- Driver Status
CREATE TYPE "DriverStatus" AS ENUM ('AVAILABLE', 'ON_DUTY', 'DRIVING', 'SLEEPER_BERTH', 'OFF_DUTY', 'PERSONAL_CONVEYANCE', 'YARD_MOVE');

-- =============================================
-- UPDATE USER ROLES ENUM
-- =============================================
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'YARD_MANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PAYROLL_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PAYROLL_CLERK';

-- =============================================
-- EXTEND CARRIER DRIVERS TABLE
-- =============================================
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "externalDriverId" TEXT;
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "licenseClass" TEXT;
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "licenseState" TEXT;
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "licenseExpiration" TIMESTAMP(3);
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "endorsements" TEXT;
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "medicalCardExpiration" TIMESTAMP(3);
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "dateOfHire" TIMESTAMP(3);
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "driverStatus" "DriverStatus" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "currentTerminalCode" TEXT;
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "currentLatitude" DECIMAL(10, 7);
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "currentLongitude" DECIMAL(10, 7);
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "lastStatusUpdate" TIMESTAMP(3);
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "hosDriveTimeRemaining" INTEGER;
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "hosDutyTimeRemaining" INTEGER;
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "hosCycleTimeRemaining" INTEGER;
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "hosLastUpdate" TIMESTAMP(3);
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "hosViolations" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "rating" DECIMAL(3, 2);
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "preferredRoutes" TEXT;
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "homeTerminalCode" TEXT;
ALTER TABLE "carrier_drivers" ADD COLUMN IF NOT EXISTS "teamDriverId" INTEGER;

-- Add indexes for carrier_drivers
CREATE INDEX IF NOT EXISTS "carrier_drivers_driverStatus_idx" ON "carrier_drivers"("driverStatus");
CREATE INDEX IF NOT EXISTS "carrier_drivers_externalDriverId_idx" ON "carrier_drivers"("externalDriverId");

-- =============================================
-- TERMINALS TABLE
-- =============================================
CREATE TABLE "terminals" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "timezone" TEXT,
    "latitude" DECIMAL(10, 7),
    "longitude" DECIMAL(10, 7),
    "phone" TEXT,
    "contact" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terminals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "terminals_code_key" ON "terminals"("code");

-- =============================================
-- EQUIPMENT TRUCKS TABLE
-- =============================================
CREATE TABLE "equipment_trucks" (
    "id" SERIAL NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "truckType" "TruckType" NOT NULL DEFAULT 'DAY_CAB',
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "vin" TEXT,
    "currentTerminalId" INTEGER,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "assignedDriverId" INTEGER,
    "lastLocationUpdate" TIMESTAMP(3),
    "maintenanceStatus" TEXT,
    "maintenanceNotes" TEXT,
    "nextMaintenanceDate" TIMESTAMP(3),
    "externalFleetId" TEXT,
    "owned" BOOLEAN NOT NULL DEFAULT true,
    "leaseExpiration" TIMESTAMP(3),
    "licensePlate" TEXT,
    "licensePlateState" TEXT,
    "fuelType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_trucks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "equipment_trucks_unitNumber_key" ON "equipment_trucks"("unitNumber");
CREATE INDEX "equipment_trucks_currentTerminalId_idx" ON "equipment_trucks"("currentTerminalId");
CREATE INDEX "equipment_trucks_status_idx" ON "equipment_trucks"("status");
CREATE INDEX "equipment_trucks_assignedDriverId_idx" ON "equipment_trucks"("assignedDriverId");

-- =============================================
-- EQUIPMENT TRAILERS TABLE
-- =============================================
CREATE TABLE "equipment_trailers" (
    "id" SERIAL NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "trailerType" "TrailerType" NOT NULL DEFAULT 'DRY_VAN_53',
    "lengthFeet" INTEGER,
    "capacityWeight" INTEGER,
    "capacityCube" INTEGER,
    "currentTerminalId" INTEGER,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "currentLocation" TEXT,
    "externalFleetId" TEXT,
    "owned" BOOLEAN NOT NULL DEFAULT true,
    "leaseExpiration" TIMESTAMP(3),
    "licensePlate" TEXT,
    "licensePlateState" TEXT,
    "lastInspectionDate" TIMESTAMP(3),
    "nextInspectionDate" TIMESTAMP(3),
    "maintenanceStatus" TEXT,
    "maintenanceNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_trailers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "equipment_trailers_unitNumber_key" ON "equipment_trailers"("unitNumber");
CREATE INDEX "equipment_trailers_currentTerminalId_idx" ON "equipment_trailers"("currentTerminalId");
CREATE INDEX "equipment_trailers_status_idx" ON "equipment_trailers"("status");
CREATE INDEX "equipment_trailers_trailerType_idx" ON "equipment_trailers"("trailerType");

-- =============================================
-- EQUIPMENT DOLLIES TABLE
-- =============================================
CREATE TABLE "equipment_dollies" (
    "id" SERIAL NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "dollyType" "DollyType" NOT NULL DEFAULT 'A_DOLLY',
    "currentTerminalId" INTEGER,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "externalFleetId" TEXT,
    "lastInspectionDate" TIMESTAMP(3),
    "nextInspectionDate" TIMESTAMP(3),
    "maintenanceStatus" TEXT,
    "maintenanceNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_dollies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "equipment_dollies_unitNumber_key" ON "equipment_dollies"("unitNumber");
CREATE INDEX "equipment_dollies_currentTerminalId_idx" ON "equipment_dollies"("currentTerminalId");
CREATE INDEX "equipment_dollies_status_idx" ON "equipment_dollies"("status");

-- =============================================
-- TERMINAL EQUIPMENT REQUIREMENTS TABLE
-- =============================================
CREATE TABLE "terminal_equipment_requirements" (
    "id" SERIAL NOT NULL,
    "terminalId" INTEGER NOT NULL,
    "equipmentType" TEXT NOT NULL,
    "minCount" INTEGER NOT NULL DEFAULT 0,
    "maxCount" INTEGER,
    "dayOfWeek" INTEGER,
    "effectiveDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "seasonalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terminal_equipment_requirements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "terminal_equipment_requirements_terminalId_idx" ON "terminal_equipment_requirements"("terminalId");
CREATE INDEX "terminal_equipment_requirements_equipmentType_idx" ON "terminal_equipment_requirements"("equipmentType");

-- =============================================
-- LINEHAUL PROFILES TABLE
-- =============================================
CREATE TABLE "linehaul_profiles" (
    "id" SERIAL NOT NULL,
    "profileCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originTerminalId" INTEGER NOT NULL,
    "destinationTerminalId" INTEGER NOT NULL,
    "standardDepartureTime" TEXT,
    "standardArrivalTime" TEXT,
    "distanceMiles" INTEGER,
    "transitTimeMinutes" INTEGER,
    "frequency" TEXT,
    "equipmentConfig" TEXT,
    "requiresTeamDriver" BOOLEAN NOT NULL DEFAULT false,
    "hazmatRequired" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linehaul_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "linehaul_profiles_profileCode_key" ON "linehaul_profiles"("profileCode");
CREATE INDEX "linehaul_profiles_originTerminalId_idx" ON "linehaul_profiles"("originTerminalId");
CREATE INDEX "linehaul_profiles_destinationTerminalId_idx" ON "linehaul_profiles"("destinationTerminalId");
CREATE INDEX "linehaul_profiles_active_idx" ON "linehaul_profiles"("active");

-- =============================================
-- LINEHAUL TRIPS TABLE
-- =============================================
CREATE TABLE "linehaul_trips" (
    "id" SERIAL NOT NULL,
    "tripNumber" TEXT NOT NULL,
    "linehaulProfileId" INTEGER,
    "dispatchDate" TIMESTAMP(3) NOT NULL,
    "plannedDeparture" TIMESTAMP(3),
    "actualDeparture" TIMESTAMP(3),
    "plannedArrival" TIMESTAMP(3),
    "actualArrival" TIMESTAMP(3),
    "status" "TripStatus" NOT NULL DEFAULT 'PLANNED',
    "driverId" INTEGER,
    "driverExternalId" TEXT,
    "teamDriverId" INTEGER,
    "truckId" INTEGER,
    "trailerId" INTEGER,
    "dollyId" INTEGER,
    "trailer2Id" INTEGER,
    "totalWeight" INTEGER,
    "totalPieces" INTEGER,
    "shipmentCount" INTEGER,
    "cubeUtilization" DECIMAL(5, 2),
    "originTerminalCode" TEXT,
    "destinationTerminalCode" TEXT,
    "actualMileage" INTEGER,
    "notes" TEXT,
    "specialInstructions" TEXT,
    "lastKnownLatitude" DECIMAL(10, 7),
    "lastKnownLongitude" DECIMAL(10, 7),
    "lastLocationUpdate" TIMESTAMP(3),
    "estimatedArrival" TIMESTAMP(3),
    "createdBy" INTEGER,
    "dispatchedBy" INTEGER,
    "dispatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linehaul_trips_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "linehaul_trips_tripNumber_key" ON "linehaul_trips"("tripNumber");
CREATE INDEX "linehaul_trips_dispatchDate_idx" ON "linehaul_trips"("dispatchDate");
CREATE INDEX "linehaul_trips_status_idx" ON "linehaul_trips"("status");
CREATE INDEX "linehaul_trips_driverId_idx" ON "linehaul_trips"("driverId");
CREATE INDEX "linehaul_trips_linehaulProfileId_idx" ON "linehaul_trips"("linehaulProfileId");

-- =============================================
-- TRIP SHIPMENTS TABLE
-- =============================================
CREATE TABLE "trip_shipments" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "proNumber" TEXT NOT NULL,
    "originTerminal" TEXT,
    "destinationTerminal" TEXT,
    "weight" INTEGER,
    "pieces" INTEGER,
    "handlingUnits" INTEGER,
    "serviceLevel" TEXT,
    "specialInstructions" TEXT,
    "hazmat" BOOLEAN NOT NULL DEFAULT false,
    "hazmatClass" TEXT,
    "externalShipmentId" TEXT,
    "loadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_shipments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trip_shipments_tripId_idx" ON "trip_shipments"("tripId");
CREATE INDEX "trip_shipments_proNumber_idx" ON "trip_shipments"("proNumber");

-- =============================================
-- TRIP DELAYS TABLE
-- =============================================
CREATE TABLE "trip_delays" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "delayCode" "DelayCode" NOT NULL,
    "delayReason" TEXT,
    "delayMinutes" INTEGER NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportedBy" INTEGER,
    "affectsShipments" BOOLEAN NOT NULL DEFAULT true,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_delays_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trip_delays_tripId_idx" ON "trip_delays"("tripId");
CREATE INDEX "trip_delays_delayCode_idx" ON "trip_delays"("delayCode");

-- =============================================
-- RATE CARDS TABLE
-- =============================================
CREATE TABLE "rate_cards" (
    "id" SERIAL NOT NULL,
    "rateType" "RateCardType" NOT NULL,
    "entityId" INTEGER,
    "originTerminalId" INTEGER,
    "destinationTerminalId" INTEGER,
    "linehaulProfileId" INTEGER,
    "rateMethod" "RateMethod" NOT NULL DEFAULT 'PER_MILE',
    "rateAmount" DECIMAL(8, 2) NOT NULL,
    "minimumAmount" DECIMAL(8, 2),
    "maximumAmount" DECIMAL(8, 2),
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "equipmentType" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "externalRateId" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_cards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rate_cards_rateType_idx" ON "rate_cards"("rateType");
CREATE INDEX "rate_cards_entityId_idx" ON "rate_cards"("entityId");
CREATE INDEX "rate_cards_effectiveDate_idx" ON "rate_cards"("effectiveDate");
CREATE INDEX "rate_cards_active_idx" ON "rate_cards"("active");

-- =============================================
-- ACCESSORIAL RATES TABLE
-- =============================================
CREATE TABLE "accessorial_rates" (
    "id" SERIAL NOT NULL,
    "rateCardId" INTEGER NOT NULL,
    "accessorialType" "AccessorialType" NOT NULL,
    "rateAmount" DECIMAL(8, 2) NOT NULL,
    "rateMethod" "RateMethod" NOT NULL DEFAULT 'FLAT_RATE',
    "minimumCharge" DECIMAL(8, 2),
    "maximumCharge" DECIMAL(8, 2),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accessorial_rates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "accessorial_rates_rateCardId_idx" ON "accessorial_rates"("rateCardId");
CREATE INDEX "accessorial_rates_accessorialType_idx" ON "accessorial_rates"("accessorialType");

-- =============================================
-- PAY PERIODS TABLE
-- =============================================
CREATE TABLE "pay_periods" (
    "id" SERIAL NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "PayPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedBy" INTEGER,
    "exportedAt" TIMESTAMP(3),
    "exportedBy" INTEGER,
    "exportBatchId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_periods_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pay_periods_periodStart_idx" ON "pay_periods"("periodStart");
CREATE INDEX "pay_periods_periodEnd_idx" ON "pay_periods"("periodEnd");
CREATE INDEX "pay_periods_status_idx" ON "pay_periods"("status");

-- =============================================
-- TRIP PAY TABLE
-- =============================================
CREATE TABLE "trip_pay" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "payPeriodId" INTEGER,
    "driverId" INTEGER,
    "driverExternalId" TEXT,
    "rateCardId" INTEGER,
    "basePay" DECIMAL(8, 2),
    "mileagePay" DECIMAL(8, 2),
    "accessorialPay" DECIMAL(8, 2),
    "bonusPay" DECIMAL(8, 2),
    "deductions" DECIMAL(8, 2),
    "totalGrossPay" DECIMAL(8, 2),
    "splitPercentage" DECIMAL(5, 2),
    "splitType" TEXT,
    "status" "TripPayStatus" NOT NULL DEFAULT 'PENDING',
    "calculatedAt" TIMESTAMP(3),
    "reviewedBy" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "approvedBy" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "externalPayrollId" TEXT,
    "exportedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_pay_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trip_pay_tripId_idx" ON "trip_pay"("tripId");
CREATE INDEX "trip_pay_payPeriodId_idx" ON "trip_pay"("payPeriodId");
CREATE INDEX "trip_pay_driverId_idx" ON "trip_pay"("driverId");
CREATE INDEX "trip_pay_status_idx" ON "trip_pay"("status");

-- =============================================
-- FOREIGN KEY CONSTRAINTS
-- =============================================

-- Equipment Trucks
ALTER TABLE "equipment_trucks" ADD CONSTRAINT "equipment_trucks_currentTerminalId_fkey"
    FOREIGN KEY ("currentTerminalId") REFERENCES "terminals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "equipment_trucks" ADD CONSTRAINT "equipment_trucks_assignedDriverId_fkey"
    FOREIGN KEY ("assignedDriverId") REFERENCES "carrier_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Equipment Trailers
ALTER TABLE "equipment_trailers" ADD CONSTRAINT "equipment_trailers_currentTerminalId_fkey"
    FOREIGN KEY ("currentTerminalId") REFERENCES "terminals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Equipment Dollies
ALTER TABLE "equipment_dollies" ADD CONSTRAINT "equipment_dollies_currentTerminalId_fkey"
    FOREIGN KEY ("currentTerminalId") REFERENCES "terminals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Terminal Equipment Requirements
ALTER TABLE "terminal_equipment_requirements" ADD CONSTRAINT "terminal_equipment_requirements_terminalId_fkey"
    FOREIGN KEY ("terminalId") REFERENCES "terminals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Linehaul Profiles
ALTER TABLE "linehaul_profiles" ADD CONSTRAINT "linehaul_profiles_originTerminalId_fkey"
    FOREIGN KEY ("originTerminalId") REFERENCES "terminals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "linehaul_profiles" ADD CONSTRAINT "linehaul_profiles_destinationTerminalId_fkey"
    FOREIGN KEY ("destinationTerminalId") REFERENCES "terminals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Linehaul Trips
ALTER TABLE "linehaul_trips" ADD CONSTRAINT "linehaul_trips_linehaulProfileId_fkey"
    FOREIGN KEY ("linehaulProfileId") REFERENCES "linehaul_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "linehaul_trips" ADD CONSTRAINT "linehaul_trips_driverId_fkey"
    FOREIGN KEY ("driverId") REFERENCES "carrier_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "linehaul_trips" ADD CONSTRAINT "linehaul_trips_teamDriverId_fkey"
    FOREIGN KEY ("teamDriverId") REFERENCES "carrier_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "linehaul_trips" ADD CONSTRAINT "linehaul_trips_truckId_fkey"
    FOREIGN KEY ("truckId") REFERENCES "equipment_trucks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "linehaul_trips" ADD CONSTRAINT "linehaul_trips_trailerId_fkey"
    FOREIGN KEY ("trailerId") REFERENCES "equipment_trailers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "linehaul_trips" ADD CONSTRAINT "linehaul_trips_dollyId_fkey"
    FOREIGN KEY ("dollyId") REFERENCES "equipment_dollies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "linehaul_trips" ADD CONSTRAINT "linehaul_trips_trailer2Id_fkey"
    FOREIGN KEY ("trailer2Id") REFERENCES "equipment_trailers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "linehaul_trips" ADD CONSTRAINT "linehaul_trips_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "linehaul_trips" ADD CONSTRAINT "linehaul_trips_dispatchedBy_fkey"
    FOREIGN KEY ("dispatchedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Trip Shipments
ALTER TABLE "trip_shipments" ADD CONSTRAINT "trip_shipments_tripId_fkey"
    FOREIGN KEY ("tripId") REFERENCES "linehaul_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trip Delays
ALTER TABLE "trip_delays" ADD CONSTRAINT "trip_delays_tripId_fkey"
    FOREIGN KEY ("tripId") REFERENCES "linehaul_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trip_delays" ADD CONSTRAINT "trip_delays_reportedBy_fkey"
    FOREIGN KEY ("reportedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rate Cards
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_originTerminalId_fkey"
    FOREIGN KEY ("originTerminalId") REFERENCES "terminals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_destinationTerminalId_fkey"
    FOREIGN KEY ("destinationTerminalId") REFERENCES "terminals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_linehaulProfileId_fkey"
    FOREIGN KEY ("linehaulProfileId") REFERENCES "linehaul_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Accessorial Rates
ALTER TABLE "accessorial_rates" ADD CONSTRAINT "accessorial_rates_rateCardId_fkey"
    FOREIGN KEY ("rateCardId") REFERENCES "rate_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Pay Periods
ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_closedBy_fkey"
    FOREIGN KEY ("closedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_exportedBy_fkey"
    FOREIGN KEY ("exportedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Trip Pay
ALTER TABLE "trip_pay" ADD CONSTRAINT "trip_pay_tripId_fkey"
    FOREIGN KEY ("tripId") REFERENCES "linehaul_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trip_pay" ADD CONSTRAINT "trip_pay_payPeriodId_fkey"
    FOREIGN KEY ("payPeriodId") REFERENCES "pay_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trip_pay" ADD CONSTRAINT "trip_pay_driverId_fkey"
    FOREIGN KEY ("driverId") REFERENCES "carrier_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trip_pay" ADD CONSTRAINT "trip_pay_rateCardId_fkey"
    FOREIGN KEY ("rateCardId") REFERENCES "rate_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trip_pay" ADD CONSTRAINT "trip_pay_reviewedBy_fkey"
    FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trip_pay" ADD CONSTRAINT "trip_pay_approvedBy_fkey"
    FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
