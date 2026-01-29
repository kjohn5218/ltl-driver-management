/**
 * Trip Document Service
 *
 * Orchestrates document generation for trips.
 * Generates Linehaul Manifests, Placard Information Sheets, and Hazmat BOLs.
 */

import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import { prisma } from '../index';
import { TripDocumentType } from '@prisma/client';
import { tmsMockService } from './tms.mock.service';
import { placardWizardMockService, HazmatItem } from './placardWizard.mock.service';
import { generateLinehaulManifestHTML, ManifestData } from '../templates/linehaulManifest.template';
import { generatePlacardSheetHTML, PlacardSheetData } from '../templates/placardSheet.template';
import { generateHazmatBOLHTML, HazmatBOLData } from '../templates/hazmatBOL.template';

// Generate document number
const generateDocumentNumber = async (type: TripDocumentType): Promise<string> => {
  const prefix = type === 'LINEHAUL_MANIFEST' ? 'LHM' : type === 'PLACARD_SHEET' ? 'PIS' : 'HBL';
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

  // Get count for today
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  const count = await prisma.tripDocument.count({
    where: {
      documentType: type,
      createdAt: {
        gte: startOfDay,
        lt: endOfDay,
      },
    },
  });

  return `${prefix}-${dateStr}-${String(count + 1).padStart(4, '0')}`;
};

// Generate QR code
const generateQRCode = async (url: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(url, {
      width: 80,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return '';
  }
};

// Convert HTML to PDF using Puppeteer
const generatePDFFromHTML = async (html: string): Promise<Buffer> => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'letter',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
};

/**
 * Trip Document Service
 */
export const tripDocumentService = {
  /**
   * Generate all documents for a trip (called on dispatch)
   */
  generateAllDocuments: async (tripId: number): Promise<void> => {
    console.log(`Generating documents for trip ${tripId}...`);

    try {
      // Get trip details
      const trip = await prisma.linehaulTrip.findUnique({
        where: { id: tripId },
        include: {
          driver: true,
          trailer: true,
          linehaulProfile: {
            include: {
              originTerminal: true,
              destinationTerminal: true,
            },
          },
        },
      });

      if (!trip) {
        throw new Error(`Trip ${tripId} not found`);
      }

      // Generate manifest
      await tripDocumentService.generateManifest(tripId);

      // Get TMS data to check for hazmat
      const tmsData = await tmsMockService.getTripData(tripId, trip.tripNumber);
      const hazmatShipments = tmsData.shipments.filter(s => s.hazmat !== undefined);

      // Generate placard sheet if there's hazmat
      if (hazmatShipments.length > 0) {
        await tripDocumentService.generatePlacardSheet(tripId);
      }

      console.log(`Documents generated successfully for trip ${tripId}`);
    } catch (error) {
      console.error(`Error generating documents for trip ${tripId}:`, error);
      throw error;
    }
  },

  /**
   * Generate Linehaul Manifest document
   */
  generateManifest: async (tripId: number): Promise<{ id: number; documentNumber: string }> => {
    // Get trip details
    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: tripId },
      include: {
        driver: true,
        trailer: true,
        linehaulProfile: {
          include: {
            originTerminal: true,
            destinationTerminal: true,
          },
        },
      },
    });

    if (!trip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    // Check if document already exists
    const existing = await prisma.tripDocument.findFirst({
      where: {
        tripId,
        documentType: 'LINEHAUL_MANIFEST',
      },
    });

    if (existing) {
      return { id: existing.id, documentNumber: existing.documentNumber };
    }

    // Get loadsheets associated with this trip to assign manifest numbers to shipments
    const loadsheets = await prisma.loadsheet.findMany({
      where: { linehaulTripId: tripId },
      select: {
        manifestNumber: true,
        destinationTerminalCode: true,
      },
    });

    // Create a map of destination terminal to manifest number for assignment
    const destToManifest = new Map<string, string>();
    loadsheets.forEach(ls => {
      if (ls.destinationTerminalCode && ls.manifestNumber) {
        destToManifest.set(ls.destinationTerminalCode, ls.manifestNumber);
      }
    });

    // Get shipment data from TMS
    const tmsData = await tmsMockService.getTripData(tripId, trip.tripNumber);
    const totals = await tmsMockService.getTripTotals(tmsData.shipments);

    // Generate document number
    const documentNumber = await generateDocumentNumber('LINEHAUL_MANIFEST');

    // Build trip display string
    const originCode = trip.originTerminalCode || trip.linehaulProfile?.originTerminal?.code || 'DEN';
    const destCode = trip.destinationTerminalCode || trip.linehaulProfile?.destinationTerminal?.code || 'GJT';
    const tripDisplay = `${tmsData.manifestNumber} - ${originCode} to ${destCode} - TRIP ${trip.tripNumber}`;

    // Helper function to assign manifest number to a shipment
    // In production, this would come from actual scanning data
    // For mock data, we match by destination terminal or distribute round-robin
    const getManifestNumberForShipment = (shipment: typeof tmsData.shipments[0], index: number): string | null => {
      // First try to match by destination terminal
      if (shipment.destTerminal && destToManifest.has(shipment.destTerminal)) {
        return destToManifest.get(shipment.destTerminal) || null;
      }
      // If no match and we have loadsheets, distribute round-robin
      if (loadsheets.length > 0) {
        return loadsheets[index % loadsheets.length].manifestNumber;
      }
      return null;
    };

    // Create document in database
    const tripDocument = await prisma.tripDocument.create({
      data: {
        tripId,
        documentType: 'LINEHAUL_MANIFEST',
        documentNumber,
        status: 'GENERATED',
        generatedAt: new Date(),
        manifestData: {
          create: {
            tripDisplay,
            manifestNumber: tmsData.manifestNumber,
            driverName: tmsData.driverName || trip.driver?.name,
            trailerNumber: tmsData.trailerNumber || trip.trailer?.unitNumber,
            originCode,
            destCode,
            effort: tmsData.effort,
            timeDue: tmsData.timeDue,
            lastLoad: tmsData.lastLoad,
            totalScans: totals.totalScans,
            totalPieces: totals.totalPieces,
            totalWeight: totals.totalWeight,
            dispatchedAt: trip.dispatchedAt || trip.actualDeparture,
            arrivedAt: trip.actualArrival,
            freightItems: {
              create: tmsData.shipments.map((shipment, index) => ({
                proNumber: shipment.proNumber,
                manifestNumber: getManifestNumberForShipment(shipment, index),
                destTerminal: shipment.destTerminal,
                destTerminalSub: shipment.destTerminalSub,
                scans: shipment.scans,
                pieces: shipment.pieces,
                weight: shipment.weight,
                consigneeName: shipment.consignee.name,
                consigneeCity: `${shipment.consignee.city} ${shipment.consignee.state}`,
                shipperName: shipment.shipper.name,
                shipperCity: `${shipment.shipper.city} ${shipment.shipper.state}`,
                expDeliveryDate: shipment.expDeliveryDate ? new Date() : null,
                loadedTerminal: shipment.loadedTerminal,
                unloadedTerminal: shipment.unloadedTerminal,
                isHazmat: shipment.hazmat !== undefined,
                hazmatClass: shipment.hazmat?.hazardClass,
                sortOrder: index,
              })),
            },
          },
        },
      },
    });

    return { id: tripDocument.id, documentNumber };
  },

  /**
   * Generate Placard Information Sheet
   */
  generatePlacardSheet: async (tripId: number): Promise<{ id: number; documentNumber: string }> => {
    // Get trip details
    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: tripId },
      include: {
        trailer: true,
        linehaulProfile: {
          include: {
            originTerminal: true,
            destinationTerminal: true,
          },
        },
      },
    });

    if (!trip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    // Check if document already exists
    const existing = await prisma.tripDocument.findFirst({
      where: {
        tripId,
        documentType: 'PLACARD_SHEET',
      },
    });

    if (existing) {
      return { id: existing.id, documentNumber: existing.documentNumber };
    }

    // Get hazmat shipments from TMS
    const tmsData = await tmsMockService.getTripData(tripId, trip.tripNumber);
    const hazmatShipments = tmsData.shipments.filter(s => s.hazmat !== undefined);

    if (hazmatShipments.length === 0) {
      throw new Error('No hazmat shipments found for trip');
    }

    // Convert to hazmat items for placard determination
    const hazmatItems: HazmatItem[] = hazmatShipments.map(s => ({
      proNumber: s.proNumber,
      unNumber: s.hazmat!.unNumber,
      hazardClass: s.hazmat!.hazardClass,
      packingGroup: s.hazmat!.packingGroup,
      shippingName: s.hazmat!.shippingName,
      weight: s.weight,
      isBulk: s.hazmat!.isBulk,
      isLimitedQty: s.hazmat!.isLimitedQty,
    }));

    // Determine required placards
    const placardResult = await placardWizardMockService.determinePlacards(hazmatItems);

    // Generate document number
    const documentNumber = await generateDocumentNumber('PLACARD_SHEET');

    // Build trip display string
    const originCode = trip.originTerminalCode || trip.linehaulProfile?.originTerminal?.code || 'DEN';
    const destCode = trip.destinationTerminalCode || trip.linehaulProfile?.destinationTerminal?.code || 'GJT';
    const tripDisplay = `${tmsData.manifestNumber} - ${originCode} to ${destCode} - TRIP ${trip.tripNumber}`;

    // Create document in database
    const tripDocument = await prisma.tripDocument.create({
      data: {
        tripId,
        documentType: 'PLACARD_SHEET',
        documentNumber,
        status: 'GENERATED',
        generatedAt: new Date(),
        placardData: {
          create: {
            tripDisplay,
            trailerNumber: tmsData.trailerNumber || trip.trailer?.unitNumber,
            hazmatItems: {
              create: hazmatItems.map((item, index) => ({
                proNumber: item.proNumber,
                unNumber: item.unNumber,
                hazardClass: item.hazardClass,
                packingGroup: item.packingGroup,
                weight: item.weight,
                isBulk: item.isBulk,
                isLimitedQty: item.isLimitedQty,
                shippingName: item.shippingName,
                sortOrder: index,
              })),
            },
            requiredPlacards: {
              create: placardResult.placards.map(p => ({
                placardClass: p.placardClass,
                placardLabel: p.placardLabel,
              })),
            },
          },
        },
      },
    });

    return { id: tripDocument.id, documentNumber };
  },

  /**
   * Get all documents for a trip
   */
  getTripDocuments: async (tripId: number): Promise<{
    documents: any[];
    hasHazmat: boolean;
  }> => {
    const documents = await prisma.tripDocument.findMany({
      where: { tripId },
      include: {
        manifestData: {
          include: {
            freightItems: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        placardData: {
          include: {
            hazmatItems: {
              orderBy: { sortOrder: 'asc' },
            },
            requiredPlacards: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const hasHazmat = documents.some(d => d.documentType === 'PLACARD_SHEET');

    return { documents, hasHazmat };
  },

  /**
   * Get document by ID
   */
  getDocumentById: async (documentId: number): Promise<any> => {
    return prisma.tripDocument.findUnique({
      where: { id: documentId },
      include: {
        trip: true,
        manifestData: {
          include: {
            freightItems: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        placardData: {
          include: {
            hazmatItems: {
              orderBy: { sortOrder: 'asc' },
            },
            requiredPlacards: true,
          },
        },
      },
    });
  },

  /**
   * Generate PDF for Linehaul Manifest
   */
  generateManifestPDF: async (documentId: number): Promise<Buffer> => {
    const document = await prisma.tripDocument.findUnique({
      where: { id: documentId },
      include: {
        manifestData: {
          include: {
            freightItems: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!document || !document.manifestData) {
      throw new Error('Manifest document not found');
    }

    const data = document.manifestData;
    const qrCodeDataUrl = await generateQRCode('https://driver.ccfs.com');

    const manifestData: ManifestData = {
      tripDisplay: data.tripDisplay,
      manifestNumber: data.manifestNumber,
      driverName: data.driverName || undefined,
      trailerNumber: data.trailerNumber || undefined,
      originCode: data.originCode,
      destCode: data.destCode,
      effort: data.effort || undefined,
      timeDue: data.timeDue || undefined,
      lastLoad: data.lastLoad || undefined,
      totalScans: data.totalScans,
      totalPieces: data.totalPieces,
      totalWeight: data.totalWeight,
      freightItems: data.freightItems.map(item => ({
        proNumber: item.proNumber,
        destTerminal: item.destTerminal || '',
        destTerminalSub: item.destTerminalSub || undefined,
        scans: item.scans,
        pieces: item.pieces,
        weight: item.weight,
        consigneeName: item.consigneeName || undefined,
        consigneeCity: item.consigneeCity || undefined,
        shipperName: item.shipperName || undefined,
        shipperCity: item.shipperCity || undefined,
        expDeliveryDate: item.expDeliveryDate ? `Exp Delv: ${item.expDeliveryDate.toLocaleDateString()}` : undefined,
        loadedTerminal: item.loadedTerminal || undefined,
        unloadedTerminal: item.unloadedTerminal || undefined,
        isHazmat: item.isHazmat,
      })),
      dispatchedAt: data.dispatchedAt || undefined,
      arrivedAt: data.arrivedAt || undefined,
      printedAt: new Date(),
      qrCodeDataUrl,
    };

    const html = generateLinehaulManifestHTML(manifestData);
    return generatePDFFromHTML(html);
  },

  /**
   * Generate PDF for Placard Sheet
   */
  generatePlacardSheetPDF: async (documentId: number): Promise<Buffer> => {
    const document = await prisma.tripDocument.findUnique({
      where: { id: documentId },
      include: {
        placardData: {
          include: {
            hazmatItems: {
              orderBy: { sortOrder: 'asc' },
            },
            requiredPlacards: true,
          },
        },
      },
    });

    if (!document || !document.placardData) {
      throw new Error('Placard sheet document not found');
    }

    const data = document.placardData;

    const placardSheetData: PlacardSheetData = {
      tripDisplay: data.tripDisplay,
      trailerNumber: data.trailerNumber || undefined,
      hazmatItems: data.hazmatItems.map(item => ({
        proNumber: item.proNumber,
        unNumber: item.unNumber,
        hazardClass: item.hazardClass,
        packingGroup: item.packingGroup || undefined,
        weight: item.weight || undefined,
        isBulk: item.isBulk,
        isLimitedQty: item.isLimitedQty,
        shippingName: item.shippingName,
      })),
      requiredPlacards: data.requiredPlacards.map(p => ({
        placardClass: p.placardClass,
        placardLabel: p.placardLabel,
        svg: placardWizardMockService.getPlacardSVG(p.placardClass),
      })),
      guidelineText: 'This sheet is a guideline for determining the required placards for a trailer at the time of dispatch. It cannot be used for shipping papers or other compliance paperwork. Verify the information listed below with the original BOLs before accepting the placard suggestions.',
      bulkPackagingText: 'Check whether bulk packaging rules apply, and if so display the UN# on the placard.',
      printedAt: new Date(),
    };

    const html = generatePlacardSheetHTML(placardSheetData);
    return generatePDFFromHTML(html);
  },

  /**
   * Generate PDF for Hazmat BOL
   */
  generateHazmatBOLPDF: async (tripId: number, proNumber: string): Promise<Buffer> => {
    // Get shipment data from TMS
    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    const tmsData = await tmsMockService.getTripData(tripId, trip.tripNumber);
    const shipment = tmsData.shipments.find(s => s.proNumber === proNumber && s.hazmat);

    if (!shipment || !shipment.hazmat) {
      throw new Error('Hazmat shipment not found');
    }

    // Build BOL data
    const bolData: HazmatBOLData = {
      accountNumber: '614658',
      shipperName: shipment.shipper.name.toUpperCase(),
      shipperAddress: '7250 E 56TH AVE',
      shipperCity: 'COMMERCE CITY',
      shipperState: 'CO',
      shipperZip: '80022',
      shipperPhone: '303-289-4707',
      proNumber: shipment.proNumber,
      shipDate: new Date(),
      printDate: new Date(),
      billingTerms: 'Prepaid',
      consigneeName: shipment.consignee.name,
      consigneeAddress: '711 Raptor Road',
      consigneeCity: shipment.consignee.city.toUpperCase(),
      consigneeState: shipment.consignee.state,
      consigneeZip: '81521',
      consigneePhone: '(970) 858-5400',
      quoteNumber: `QB0${Math.floor(Math.random() * 9000000) + 1000000}`,
      quoteAmount: 189.24,
      hazmatMaterials: [
        {
          units: 28,
          pkgType: 'Pieces',
          unNumber: shipment.hazmat.unNumber,
          description: `${shipment.hazmat.shippingName} (Group 31 Batteries, wet filled)`,
          hazmatClass: shipment.hazmat.hazardClass,
          weight: shipment.weight,
        },
      ],
      handlingUnits: [
        {
          units: 1,
          pkgType: 'Pallet',
          nmfcClass: '85',
          description: 'New HD Truck Parts',
          dimensions: '48 IN L, 32 IN W, 45 IN H',
          weight: 2166,
        },
      ],
      hazmatTotalWeight: shipment.weight,
      shipmentTotalUnits: 1,
      shipmentTotalWeight: 2166,
    };

    const html = generateHazmatBOLHTML(bolData);
    return generatePDFFromHTML(html);
  },

  /**
   * Regenerate a document
   */
  regenerateDocument: async (documentId: number): Promise<void> => {
    const document = await prisma.tripDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Delete existing document
    await prisma.tripDocument.delete({
      where: { id: documentId },
    });

    // Regenerate based on type
    if (document.documentType === 'LINEHAUL_MANIFEST') {
      await tripDocumentService.generateManifest(document.tripId);
    } else if (document.documentType === 'PLACARD_SHEET') {
      await tripDocumentService.generatePlacardSheet(document.tripId);
    }
  },
};
