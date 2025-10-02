import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';

interface BookingData {
  id: number;
  bookingDate: string | Date;
  rate: number | any; // Handle Prisma Decimal type
  carrier: {
    name: string;
  } | null;
  route: {
    origin: string;
    destination: string;
    distance: number | any; // Handle Prisma Decimal type
    departureTime?: string | null;
  } | null;
  // Origin-destination booking fields
  origin?: string | null;
  destination?: string | null;
  estimatedMiles?: number | any | null;
  childBookings?: Array<{
    route: {
      origin: string;
      destination: string;
      distance: number | any; // Handle Prisma Decimal type
    } | null;
    rate: number | any; // Handle Prisma Decimal type
    origin?: string | null;
    destination?: string | null;
    estimatedMiles?: number | any | null;
  }>;
  type: string;
  trailerLength?: number | null;
  driverName?: string | null;
  phoneNumber?: string | null;
  confirmationSignedBy?: string | null;
  confirmationSignedAt?: string | Date | null;
  notes?: string | null;
  lineItems?: Array<{
    id: number;
    category: string;
    description: string;
    amount: number | any;
    quantity: number;
    unitPrice?: number | any | null;
  }>;
}

export class PDFService {
  private static uploadsDir = path.join(process.cwd(), 'uploads', 'signed-confirmations');

  static {
    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  private static generateLineItemsHTML(booking: BookingData): string {
    if (!booking.lineItems || booking.lineItems.length === 0) {
      return '';
    }

    const lineItemsHTML = booking.lineItems.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${Number(item.amount).toFixed(2)}</td>
      </tr>
    `).join('');

    const lineItemsTotal = booking.lineItems.reduce((sum, item) => sum + Number(item.amount), 0);

    return `
    <div class="line-items-section" style="margin-top: 30px;">
      <div class="section-title">Additional Charges</div>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <thead>
          <tr style="background-color: #f8f9fa;">
            <th style="padding: 12px 8px; border-bottom: 2px solid #dee2e6; text-align: left; font-weight: 600;">Description</th>
            <th style="padding: 12px 8px; border-bottom: 2px solid #dee2e6; text-align: center; font-weight: 600;">Qty</th>
            <th style="padding: 12px 8px; border-bottom: 2px solid #dee2e6; text-align: right; font-weight: 600;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHTML}
        </tbody>
        <tfoot>
          <tr style="background-color: #f8f9fa; font-weight: 600;">
            <td style="padding: 12px 8px; border-top: 2px solid #dee2e6;" colspan="2">Additional Charges Total:</td>
            <td style="padding: 12px 8px; border-top: 2px solid #dee2e6; text-align: right;">$${lineItemsTotal.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    `;
  }

  private static generateRouteItemsHTML(booking: BookingData): string {
    // Parse multi-leg booking from notes if present
    const notes = booking.notes || '';
    const hasMultiLeg = notes.includes('--- Multi-Leg Booking ---');
    
    if (hasMultiLeg) {
      const legs = [];
      const lines = notes.split('\n');
      for (const line of lines) {
        // Updated regex to handle optional date and departure time: "Leg 1: A → B (May 15) Depart: 06:00 ($100.00)"
        const legMatch = line.match(/^Leg (\d+): (.+) → (.+?)(?:\s*\(([^)]+)\))?(?:\s+Depart:\s*(\d{2}:\d{2}))?\s*\(\$(.+)\)$/);
        if (legMatch) {
          legs.push({
            legNumber: parseInt(legMatch[1]),
            origin: legMatch[2],
            destination: legMatch[3],
            dateInfo: legMatch[4], // Extracted date info like "Sep 11"
            departureTime: legMatch[5], // Extracted departure time like "06:00"
            rate: legMatch[6] // Rate moved to position 6
          });
        }
      }
      
      if (legs.length > 0) {
        // Calculate dates for each leg based on booking date
        let currentLegDate = new Date(booking.bookingDate);
        
        return legs.map((leg, index) => {
          // If leg has date info, parse it to determine the actual date
          let legDateStr;
          if (leg.dateInfo && leg.dateInfo.trim()) {
            // If date info is present (like "Sep 11"), use it to calculate the actual date
            const bookingYear = currentLegDate.getFullYear();
            try {
              const parsedDate = new Date(`${leg.dateInfo} ${bookingYear}`);
              if (!isNaN(parsedDate.getTime())) {
                legDateStr = format(parsedDate, 'MMM dd, yyyy');
              } else {
                legDateStr = format(currentLegDate, 'MMM dd, yyyy');
              }
            } catch {
              legDateStr = format(currentLegDate, 'MMM dd, yyyy');
            }
          } else {
            legDateStr = format(currentLegDate, 'MMM dd, yyyy');
            // Advance date for next leg if no explicit date info
            if (index < legs.length - 1) {
              currentLegDate = new Date(currentLegDate.getTime() + 24 * 60 * 60 * 1000);
            }
          }
          
          // Use departure time from parsed leg data, fall back to main route time
          const legDepartureTime = leg.departureTime || booking.route?.departureTime || 'TBD';

          const routeHTML = `
          <div class="route-item">
            <div class="route-header">
              <div class="route-path">Leg ${leg.legNumber}: ${leg.origin} → ${leg.destination}</div>
              <div class="route-rate">$${leg.rate}</div>
            </div>
            <div style="margin-top: 10px;">
              <div style="display: flex; justify-content: space-between;">
                <span><strong>Departure Date:</strong> ${legDateStr}</span>
                <span><strong>Departure Time:</strong> ${legDepartureTime}</span>
              </div>
            </div>
          </div>
          `;
          
          return routeHTML;
        }).join('');
      }
    }
    
    // Fall back to single route, origin-destination, or child bookings
    const routeOrigin = booking.route?.origin || booking.origin || 'N/A';
    const routeDestination = booking.route?.destination || booking.destination || 'N/A';
    
    let singleRouteHTML = `
    <div class="route-item">
      <div class="route-header">
        <div class="route-path">${routeOrigin} → ${routeDestination}</div>
        <div class="route-rate">$${Number(booking.rate).toFixed(2)}</div>
      </div>
      <div>Distance: ${Number(booking.route?.distance || booking.estimatedMiles || 0)} miles</div>
      <div style="margin-top: 10px;">
        <div style="display: flex; justify-content: space-between;">
          <span><strong>Departure Date:</strong> ${format(new Date(booking.bookingDate), 'MMM dd, yyyy')}</span>
          <span><strong>Departure Time:</strong> ${booking.route?.departureTime || 'TBD'}</span>
        </div>
      </div>
    </div>
    `;
    
    if (booking.childBookings && booking.childBookings.length > 0) {
      singleRouteHTML += booking.childBookings.map((child) => `
        <div class="route-item">
          <div class="route-header">
            <div class="route-path">${child.route ? `${child.route.origin} → ${child.route.destination}` : `${child.origin} → ${child.destination}`}</div>
            <div class="route-rate">$${Number(child.rate).toFixed(2)}</div>
          </div>
          <div>Distance: ${child.route ? Number(child.route.distance) : Number(child.estimatedMiles || 0)} miles</div>
        </div>
      `).join('');
    }
    
    return singleRouteHTML;
  }

  static async generateSignedRateConfirmationPDF(
    booking: BookingData,
    signedBy: string,
    signedAt: Date
  ): Promise<string> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      const shipmentNumber = `CCFS${booking.id.toString().padStart(5, '0')}`;
      
      // Generate filename
      const filename = `signed-confirmation-${shipmentNumber}-${Date.now()}.pdf`;
      const filePath = path.join(this.uploadsDir, filename);


      // Calculate total rate including line items (convert Decimal to number)
      const baseRate = booking.childBookings 
        ? Number(booking.rate) + booking.childBookings.reduce((sum, child) => sum + Number(child.rate), 0)
        : Number(booking.rate);
      
      const lineItemsTotal = booking.lineItems 
        ? booking.lineItems.reduce((sum, item) => sum + Number(item.amount), 0)
        : 0;
      
      const totalRate = baseRate + lineItemsTotal;

      // HTML template for the signed rate confirmation
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Rate Confirmation - ${shipmentNumber}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 40px;
              line-height: 1.4;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              border-bottom: 2px solid #0066cc;
              padding-bottom: 20px;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              color: #0066cc;
              margin-bottom: 10px;
            }
            .document-title {
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .shipment-number {
              font-size: 16px;
              color: #666;
            }
            .content {
              margin-bottom: 40px;
            }
            .section {
              margin-bottom: 30px;
            }
            .section-title {
              font-size: 16px;
              font-weight: bold;
              color: #0066cc;
              margin-bottom: 15px;
              border-bottom: 1px solid #ddd;
              padding-bottom: 5px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 20px;
            }
            .info-item {
              margin-bottom: 10px;
            }
            .info-label {
              font-weight: bold;
              color: #555;
              margin-bottom: 3px;
            }
            .info-value {
              color: #333;
            }
            .route-section {
              background-color: #f9f9f9;
              padding: 20px;
              border-radius: 5px;
              margin-bottom: 20px;
            }
            .route-item {
              margin-bottom: 15px;
              padding: 15px;
              background-color: white;
              border-radius: 3px;
              border-left: 4px solid #0066cc;
            }
            .route-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
            }
            .route-path {
              font-weight: bold;
              font-size: 14px;
            }
            .route-rate {
              font-weight: bold;
              color: #0066cc;
              font-size: 14px;
            }
            .total-section {
              background-color: #f0f8ff;
              padding: 20px;
              border-radius: 5px;
              margin-top: 20px;
              border: 2px solid #0066cc;
            }
            .total-rate {
              text-align: right;
              font-size: 18px;
              font-weight: bold;
              color: #0066cc;
            }
            .signature-section {
              margin-top: 50px;
              border: 2px solid #0066cc;
              padding: 30px;
              border-radius: 10px;
              background-color: #f0f8ff;
            }
            .signature-title {
              font-size: 18px;
              font-weight: bold;
              color: #0066cc;
              text-align: center;
              margin-bottom: 25px;
            }
            .signature-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin-bottom: 20px;
            }
            .signature-field {
              text-align: center;
            }
            .signature-line {
              border-bottom: 2px solid #333;
              margin-bottom: 10px;
              padding-bottom: 5px;
              min-height: 20px;
              font-size: 16px;
              font-weight: bold;
            }
            .signature-label {
              font-size: 12px;
              color: #666;
            }
            .status-approved {
              color: #0066cc;
              font-weight: bold;
              font-size: 18px;
            }
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">CrossCounty Freight Solutions</div>
            <div class="document-title">RATE CONFIRMATION</div>
            <div class="shipment-number">Shipment #: ${shipmentNumber}</div>
          </div>

          <div class="content">
            <div class="section">
              <div class="section-title">Carrier Information</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Carrier Name:</div>
                  <div class="info-value">${booking.carrier?.name || 'N/A'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Driver Name:</div>
                  <div class="info-value">${booking.driverName || 'TBD'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Phone Number:</div>
                  <div class="info-value">${booking.phoneNumber || 'TBD'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Service Date:</div>
                  <div class="info-value">${format(new Date(booking.bookingDate), 'PPP')}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Route Information</div>
              <div class="route-section">
                ${this.generateRouteItemsHTML(booking)}
                
                ${lineItemsTotal > 0 ? `
                <div style="margin-top: 20px;">
                  <div style="font-weight: 600; margin-bottom: 10px; color: #0066cc;">Base Rate: $${baseRate.toFixed(2)}</div>
                </div>
                ` : ''}
                
                <div class="total-section">
                  <div class="total-rate">Total Rate: $${totalRate.toFixed(2)}</div>
                </div>
              </div>
            </div>

            ${this.generateLineItemsHTML(booking)}

            ${booking.type === 'POWER_AND_TRAILER' ? `
            <div class="section">
              <div class="section-title">Equipment</div>
              <div class="info-item">
                <div class="info-label">Type:</div>
                <div class="info-value">Power and Trailer (${booking.trailerLength}' trailer)</div>
              </div>
            </div>
            ` : ''}

            <div class="signature-section">
              <div class="signature-title">ELECTRONIC SIGNATURE AGREEMENT</div>
              <div class="signature-info">
                <div class="signature-field">
                  <div class="signature-line">${signedBy}</div>
                  <div class="signature-label">SIGNATURE</div>
                </div>
                <div class="signature-field">
                  <div class="signature-line">${format(signedAt, 'PPP p')}</div>
                  <div class="signature-label">DATE & TIME</div>
                </div>
              </div>
              <div style="text-align: center; margin-top: 20px;">
                <div class="status-approved">✓ APPROVED</div>
              </div>
              <div style="margin-top: 15px; font-size: 12px; color: #666; text-align: center;">
                This document has been electronically signed and is legally binding.
              </div>
            </div>
          </div>

          <div class="footer">
            Generated on ${format(new Date(), 'PPP p')} | CrossCounty Freight Solutions<br>
            This is a digitally signed rate confirmation.
          </div>
        </body>
        </html>
      `;

      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });

      return `signed-confirmations/${filename}`;
    } finally {
      await browser.close();
    }
  }

  static getSignedPDFPath(relativePath: string): string {
    return path.join(process.cwd(), 'uploads', relativePath);
  }

  static signedPDFExists(relativePath: string): boolean {
    const fullPath = this.getSignedPDFPath(relativePath);
    return fs.existsSync(fullPath);
  }

  // Generate invoice PDF
  static async generateInvoicePDF(invoice: any): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // Calculate totals
      const baseAmount = Number(invoice.baseAmount) || 0;
      const lineItemsAmount = Number(invoice.lineItemsAmount) || 0;
      const totalAmount = Number(invoice.amount) || 0;

      // Generate line items HTML if they exist
      const lineItemsHTML = invoice.booking?.lineItems && invoice.booking.lineItems.length > 0 
        ? invoice.booking.lineItems.map((item: any) => `
            <tr>
              <td style="padding: 12px 8px; border-bottom: 1px solid #ddd; text-align: left;">${item.description}</td>
              <td style="padding: 12px 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.category}</td>
              <td style="padding: 12px 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
              <td style="padding: 12px 8px; border-bottom: 1px solid #ddd; text-align: right;">$${Number(item.amount).toFixed(2)}</td>
            </tr>
          `).join('')
        : '';

      // HTML template for the invoice
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Invoice - ${invoice.invoiceNumber}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 40px;
              line-height: 1.4;
              color: #333;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 40px;
              border-bottom: 2px solid #2c3e50;
              padding-bottom: 20px;
            }
            .company-info h1 {
              font-size: 32px;
              margin: 0 0 5px 0;
              color: #2c3e50;
            }
            .invoice-info {
              text-align: right;
            }
            .invoice-info h2 {
              font-size: 24px;
              margin: 0 0 10px 0;
              color: #2c3e50;
            }
            .status-badge {
              display: inline-block;
              padding: 6px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: bold;
              text-transform: uppercase;
            }
            .status-pending { background-color: #fff3cd; color: #856404; }
            .status-sent { background-color: #d1ecf1; color: #0c5460; }
            .status-paid { background-color: #d4edda; color: #155724; }
            .billing-section {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin-bottom: 40px;
            }
            .bill-to, .remit-to {
              padding: 20px;
              border-radius: 8px;
            }
            .bill-to {
              background-color: #f8f9fa;
              border-left: 4px solid #2c3e50;
            }
            .remit-to {
              background-color: #f0f8ff;
              border-left: 4px solid #007bff;
            }
            .section-title {
              font-size: 16px;
              font-weight: bold;
              color: #2c3e50;
              margin-bottom: 15px;
            }
            .service-details {
              background-color: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 30px;
            }
            .service-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
            }
            .service-item label {
              font-size: 12px;
              color: #666;
              display: block;
              margin-bottom: 5px;
            }
            .service-item value {
              font-weight: bold;
              color: #333;
            }
            .services-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .services-table th {
              background-color: #f8f9fa;
              padding: 15px 8px;
              border: 1px solid #dee2e6;
              text-align: left;
              font-weight: 600;
              color: #2c3e50;
            }
            .services-table td {
              padding: 12px 8px;
              border: 1px solid #dee2e6;
            }
            .services-table .amount {
              text-align: right;
              font-weight: bold;
            }
            .totals-section {
              display: flex;
              justify-content: flex-end;
              margin-bottom: 40px;
            }
            .totals-table {
              width: 300px;
              border-collapse: collapse;
            }
            .totals-table td {
              padding: 8px 12px;
              border-bottom: 1px solid #dee2e6;
            }
            .totals-table .total-row {
              background-color: #f8f9fa;
              font-weight: bold;
              font-size: 18px;
              color: #28a745;
            }
            .payment-terms {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin-top: 40px;
              padding-top: 30px;
              border-top: 1px solid #dee2e6;
            }
            .payment-section {
              background-color: #f0f8ff;
              padding: 20px;
              border-radius: 8px;
            }
            .payment-section h4 {
              margin-top: 0;
              color: #2c3e50;
            }
            .notes-section {
              background-color: #fff3cd;
              padding: 20px;
              border-radius: 8px;
              margin-top: 30px;
            }
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 1px solid #dee2e6;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              <h1>INVOICE</h1>
              <p style="margin: 0; color: #666;">${invoice.invoiceNumber}</p>
            </div>
            <div class="invoice-info">
              <p style="margin: 0; color: #666;">Invoice Date</p>
              <p style="font-size: 16px; font-weight: bold; margin: 5px 0;">${format(new Date(invoice.createdAt), 'MMM dd, yyyy')}</p>
              <div class="status-badge status-${invoice.status.toLowerCase().replace('_', '-')}">
                ${invoice.status.replace('_', ' ')}
              </div>
            </div>
          </div>

          <div class="billing-section">
            <div class="bill-to">
              <h3 class="section-title">Bill To:</h3>
              <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">
                CrossCountry Freight Solutions, Inc.
              </div>
              <div style="color: #666;">Linehaul Department</div>
              <div style="color: #666;">PO Box 4030</div>
              <div style="color: #666;">Bismarck, ND 58501</div>
            </div>

            <div class="remit-to">
              <h3 class="section-title">Remit To:</h3>
              <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">
                ${invoice.carrierName || invoice.booking?.carrier?.name || 'N/A'}
              </div>
              ${invoice.carrierContactPerson ? `<div style="color: #666;">Attn: ${invoice.carrierContactPerson}</div>` : ''}
              ${invoice.carrierStreetAddress1 ? `<div style="color: #666;">${invoice.carrierStreetAddress1}</div>` : ''}
              ${invoice.carrierStreetAddress2 ? `<div style="color: #666;">${invoice.carrierStreetAddress2}</div>` : ''}
              ${(invoice.carrierCity || invoice.carrierState || invoice.carrierZipCode) ? 
                `<div style="color: #666;">${[invoice.carrierCity, invoice.carrierState, invoice.carrierZipCode].filter(Boolean).join(', ')}</div>` : ''}
              ${invoice.carrierPhone ? `<div style="color: #666;">Phone: ${invoice.carrierPhone}</div>` : ''}
              ${invoice.carrierEmail ? `<div style="color: #666;">Email: ${invoice.carrierEmail}</div>` : ''}
            </div>
          </div>

          <div class="service-details">
            <h3 class="section-title">Service Details:</h3>
            <div class="service-grid">
              <div class="service-item">
                <label>Booking ID</label>
                <div style="font-weight: bold;">#${invoice.booking?.id || 'N/A'}</div>
              </div>
              <div class="service-item">
                <label>Service Date</label>
                <div style="font-weight: bold;">${format(new Date(invoice.booking?.bookingDate || invoice.createdAt), 'MMM dd, yyyy')}</div>
              </div>
              ${invoice.booking?.manifestNumber ? `
              <div class="service-item">
                <label>Manifest Number</label>
                <div style="font-weight: bold;">${invoice.booking.manifestNumber}</div>
              </div>
              ` : ''}
              <div class="service-item">
                <label>Route</label>
                <div style="font-weight: bold;">${invoice.booking?.route?.name || 'Custom Route'}</div>
                <div style="font-size: 12px; color: #666;">
                  ${invoice.booking?.route?.origin || invoice.booking?.origin || 'N/A'} → ${invoice.booking?.route?.destination || invoice.booking?.destination || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          <table class="services-table">
            <thead>
              <tr>
                <th>Service Description</th>
                <th style="text-align: right;">Payment Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div style="font-weight: bold;">Linehaul Transportation Services - ${invoice.booking?.route?.name || 'Custom Route'}</div>
                  <div style="font-size: 12px; color: #666; margin-top: 5px;">
                    Route: ${invoice.booking?.route?.origin || invoice.booking?.origin || 'N/A'} to ${invoice.booking?.route?.destination || invoice.booking?.destination || 'N/A'}
                  </div>
                  <div style="font-size: 12px; color: #666;">
                    Service Date: ${format(new Date(invoice.booking?.bookingDate || invoice.createdAt), 'MMM dd, yyyy')}
                  </div>
                </td>
                <td class="amount">$${baseAmount.toFixed(2)}</td>
              </tr>
              ${lineItemsHTML}
            </tbody>
          </table>

          <div class="totals-section">
            <table class="totals-table">
              <tr>
                <td>Base Service Rate:</td>
                <td style="text-align: right; font-weight: bold;">$${baseAmount.toFixed(2)}</td>
              </tr>
              ${lineItemsAmount > 0 ? `
              <tr>
                <td>Additional Payments:</td>
                <td style="text-align: right; font-weight: bold;">$${lineItemsAmount.toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr class="total-row">
                <td>Total Payment Due:</td>
                <td style="text-align: right;">$${totalAmount.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div class="payment-terms">
            <div class="payment-section">
              <h4>Payment Terms:</h4>
              <p style="margin: 0 0 10px 0; font-size: 14px;">Net 30 days from invoice date</p>
              <p style="margin: 0 0 10px 0; font-size: 14px;">Payment due: ${format(new Date(new Date(invoice.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000), 'MMM dd, yyyy')}</p>
              <p style="margin: 0; font-size: 14px;">Payment will be processed to carrier via ACH or check</p>
            </div>
            <div class="payment-section">
              <h4>Invoice Questions:</h4>
              <p style="margin: 0 0 5px 0; font-size: 14px;">CrossCountry Freight Solutions, Inc.</p>
              <p style="margin: 0 0 5px 0; font-size: 14px;">Linehaul Department</p>
              <p style="margin: 0 0 5px 0; font-size: 14px;">accounts@ccfs.com</p>
              <p style="margin: 0; font-size: 14px;">Phone: (701) 555-0123</p>
            </div>
          </div>

          ${invoice.notes ? `
          <div class="notes-section">
            <h4 style="margin-top: 0; color: #856404;">Notes:</h4>
            <p style="margin: 0; font-size: 14px;">${invoice.notes}</p>
          </div>
          ` : ''}

          <div class="footer">
            Generated on ${format(new Date(), 'PPP p')} | CrossCountry Freight Solutions, Inc.<br>
            Linehaul Department - Invoice Processing System
          </div>
        </body>
        </html>
      `;

      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }
}