import puppeteer from 'puppeteer';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { createCanvas } from 'canvas';
import { prisma } from '../index';
import { generateLoadsheetHTML } from '../templates/loadsheet.template';

// Generate unique manifest number
// Format: 4 digits + 1 letter (e.g., "9686U")
export const generateManifestNumber = async (): Promise<string> => {
  // Get the last manifest number from the database
  const lastLoadsheet = await prisma.loadsheet.findFirst({
    orderBy: { id: 'desc' },
    select: { manifestNumber: true }
  });

  let nextNumber = 1;

  if (lastLoadsheet?.manifestNumber) {
    // Extract the numeric part (first 4 characters)
    const numericPart = parseInt(lastLoadsheet.manifestNumber.slice(0, -1), 10);
    if (!isNaN(numericPart)) {
      nextNumber = numericPart + 1;
      // Reset to 1 if we exceed 9999
      if (nextNumber > 9999) {
        nextNumber = 1;
      }
    }
  }

  // Generate check character (A-Z based on number)
  const checkCharIndex = nextNumber % 26;
  const checkChar = String.fromCharCode(65 + checkCharIndex); // A=65 in ASCII

  // Format: 4-digit number + check character
  const manifestNumber = `${nextNumber.toString().padStart(4, '0')}${checkChar}`;

  // Verify uniqueness
  const exists = await prisma.loadsheet.findUnique({
    where: { manifestNumber }
  });

  if (exists) {
    // Recursive call to get next available number (handles gaps)
    return generateManifestNumber();
  }

  return manifestNumber;
};

// Generate barcode as base64 data URL
export const generateBarcodeImage = (text: string): string => {
  try {
    const canvas = createCanvas(400, 100);
    JsBarcode(canvas, text, {
      format: 'CODE128',
      width: 2,
      height: 60,
      displayValue: true,
      fontSize: 12,
      margin: 5
    });
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error generating barcode:', error);
    return '';
  }
};

// Generate QR code as base64 data URL
export const generateQRCodeImage = async (url: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(url, {
      width: 80,
      margin: 1,
      errorCorrectionLevel: 'M'
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return '';
  }
};

// Generate the loadsheet barcode string
// Format: T-{LinehaulName}-{TrailerNumber}-{Origin}-{ManifestNumber}
export const generateLoadsheetBarcodeText = (
  linehaulName: string,
  trailerNumber: string,
  originTerminalCode: string,
  manifestNumber: string
): string => {
  return `T-${linehaulName}-${trailerNumber}-${originTerminalCode || 'XXX'}-${manifestNumber}`;
};

// Generate loadsheet PDF
export const generateLoadsheetPDF = async (loadsheetId: number): Promise<Buffer> => {
  // Fetch loadsheet with all relations
  const loadsheet = await prisma.loadsheet.findUnique({
    where: { id: loadsheetId },
    include: {
      originTerminal: true,
      linehaulTrip: true,
      hazmatItems: { orderBy: { itemNumber: 'asc' } },
      dispatchEntries: { orderBy: { rowNumber: 'asc' } },
      freightPlacements: { orderBy: { rowNumber: 'asc' } }
    }
  });

  if (!loadsheet) {
    throw new Error('Loadsheet not found');
  }

  // Generate barcodes and QR code
  const mainBarcodeText = generateLoadsheetBarcodeText(
    loadsheet.linehaulName,
    loadsheet.trailerNumber,
    loadsheet.originTerminalCode || '',
    loadsheet.manifestNumber
  );
  const mainBarcode = generateBarcodeImage(mainBarcodeText);
  const manifestBarcode = generateBarcodeImage(loadsheet.manifestNumber);
  const qrCode = await generateQRCodeImage('https://shipcc.com/lhpay');

  // Generate HTML
  const html = generateLoadsheetHTML({
    loadsheet,
    mainBarcode,
    manifestBarcode,
    qrCode,
    printedAt: new Date()
  });

  // Generate PDF using Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.25in',
        right: '0.25in',
        bottom: '0.25in',
        left: '0.25in'
      }
    });

    // Update printedAt timestamp
    await prisma.loadsheet.update({
      where: { id: loadsheetId },
      data: { printedAt: new Date() }
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
};
