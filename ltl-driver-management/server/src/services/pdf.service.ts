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
  };
  childBookings?: Array<{
    route: {
      origin: string;
      destination: string;
      distance: number | any; // Handle Prisma Decimal type
    };
    rate: number | any; // Handle Prisma Decimal type
  }>;
  type: string;
  trailerLength?: number | null;
  driverName?: string | null;
  phoneNumber?: string | null;
  confirmationSignedBy?: string | null;
  confirmationSignedAt?: string | Date | null;
}

export class PDFService {
  private static uploadsDir = path.join(process.cwd(), 'uploads', 'signed-confirmations');

  static {
    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
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


      // Calculate total rate (convert Decimal to number)
      const totalRate = booking.childBookings 
        ? Number(booking.rate) + booking.childBookings.reduce((sum, child) => sum + Number(child.rate), 0)
        : Number(booking.rate);

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
                ${(() => {
                  // Parse multi-leg booking from notes if present
                  const notes = booking.notes || '';
                  const hasMultiLeg = notes.includes('--- Multi-Leg Booking ---');
                  
                  if (hasMultiLeg) {
                    const legs = [];
                    const lines = notes.split('\\n');
                    for (const line of lines) {
                      // Updated regex to handle optional date information: "Leg 1: A → B (May 15) ($100.00)"
                      const legMatch = line.match(/^Leg (\\d+): (.+) → (.+?)(?:\\s*\\([^$)]+\\))?\\s*\\(\\$(.+)\\)$/);
                      if (legMatch) {
                        legs.push({
                          legNumber: parseInt(legMatch[1]),
                          origin: legMatch[2],
                          destination: legMatch[3],
                          rate: legMatch[4]
                        });
                      }
                    }
                    
                    if (legs.length > 0) {
                      // Calculate dates for each leg based on booking date
                      let currentLegDate = new Date(booking.bookingDate);
                      
                      return legs.map((leg, index) => {
                        const legDateStr = format(currentLegDate, 'MMM dd, yyyy');
                        const result = `
                        <div class="route-item">
                          <div class="route-header">
                            <div class="route-path">Leg ${leg.legNumber}: ${leg.origin} → ${leg.destination}</div>
                            <div class="route-rate">$${leg.rate}</div>
                          </div>
                          <div style="margin-top: 10px;">
                            <div style="display: flex; justify-content: space-between;">
                              <span><strong>Departure Date:</strong> ${legDateStr}</span>
                              <span><strong>Departure Time:</strong> ${booking.route?.departureTime || 'TBD'}</span>
                            </div>
                          </div>
                        </div>
                        `;
                        
                        // Advance date if this was a midnight crossing route (indicated by date in next leg)
                        if (index < legs.length - 1 && notes.includes(\`Leg \${index + 2}:\`) && notes.includes('(') && notes.includes('$')) {
                          // Check if next leg has a date indicator - if so, advance date
                          const nextLegLine = lines.find(line => line.startsWith(\`Leg \${index + 2}:\`));
                          if (nextLegLine && nextLegLine.includes('(') && !nextLegLine.includes('$')) {
                            currentLegDate = new Date(currentLegDate.getTime() + 24 * 60 * 60 * 1000);
                          }
                        }
                        
                        return result;
                      }).join('');
                    }
                  }
                  
                  // Fall back to single route or child bookings
                  return \`
                  <div class="route-item">
                    <div class="route-header">
                      <div class="route-path">\${booking.route.origin} → \${booking.route.destination}</div>
                      <div class="route-rate">$\${Number(booking.rate).toFixed(2)}</div>
                    </div>
                    <div>Distance: \${Number(booking.route.distance)} miles</div>
                    <div style="margin-top: 10px;">
                      <div style="display: flex; justify-content: space-between;">
                        <span><strong>Departure Date:</strong> \${format(new Date(booking.bookingDate), 'MMM dd, yyyy')}</span>
                        <span><strong>Departure Time:</strong> \${booking.route?.departureTime || 'TBD'}</span>
                      </div>
                    </div>
                  </div>
                  \${booking.childBookings && booking.childBookings.length > 0 ? 
                    booking.childBookings.map((child) => \`
                      <div class="route-item">
                        <div class="route-header">
                          <div class="route-path">\${child.route.origin} → \${child.route.destination}</div>
                          <div class="route-rate">$\${Number(child.rate).toFixed(2)}</div>
                        </div>
                        <div>Distance: \${Number(child.route.distance)} miles</div>
                      </div>
                    \`).join('') : ''
                  }\`;
                })()}
                
                <div class="total-section">
                  <div class="total-rate">Total Rate: $${totalRate.toFixed(2)}</div>
                </div>
              </div>
            </div>

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
}