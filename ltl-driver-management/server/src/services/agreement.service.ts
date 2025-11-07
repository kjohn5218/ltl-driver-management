import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { format } from 'date-fns';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AgreementSigningData {
  carrierId: number;
  carrierName: string;
  carrierDOT: string;
  carrierAddress: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zipCode: string;
  };
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  ipAddress: string;
  userAgent?: string;
  geolocation?: {
    city?: string;
    state?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  username: string;
  agreementVersion: string;
  agreementTitle: string;
  agreementFilePath?: string;
  timestamp: Date;
}

export class AgreementService {
  private static affidavitsDir = path.join(process.cwd(), 'uploads', 'carrier-agreements');
  
  static {
    // Ensure directories exist
    if (!fs.existsSync(this.affidavitsDir)) {
      fs.mkdirSync(this.affidavitsDir, { recursive: true });
    }
  }

  private static formatGeolocation(geo?: AgreementSigningData['geolocation']): string {
    if (!geo || (!geo.city && !geo.state && !geo.country)) {
      return 'Location not available';
    }
    
    const parts = [];
    if (geo.city && geo.city !== 'Unknown') parts.push(geo.city);
    if (geo.state && geo.state !== 'Unknown') parts.push(geo.state);
    if (geo.country && geo.country !== 'Unknown') {
      // Convert country code to full name if needed
      const countryNames: { [key: string]: string } = {
        'US': 'United States of America',
        'CA': 'Canada',
        'MX': 'Mexico',
        'GB': 'United Kingdom',
        'Unknown': 'Unknown'
      };
      parts.push(countryNames[geo.country] || geo.country);
    }
    
    let location = parts.length > 0 ? parts.join(', ') : 'Location not available';
    
    if (geo.latitude && geo.longitude && geo.latitude !== 0 && geo.longitude !== 0) {
      location += ` Lat ${geo.latitude.toFixed(10)}, Long ${geo.longitude.toFixed(10)}`;
    }
    
    return location;
  }

  private static generateAffidavitHTML(data: AgreementSigningData): string {
    const signedDate = format(data.timestamp, 'M/d/yyyy');
    const fullAddress = [
      data.carrierAddress.street1,
      data.carrierAddress.street2,
      `${data.carrierAddress.city}, ${data.carrierAddress.state} ${data.carrierAddress.zipCode}`
    ].filter(Boolean).join(', ');
    
    const geolocation = this.formatGeolocation(data.geolocation);
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: Arial, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          color: #000;
          background: white;
          padding: 40px;
        }
        
        .affidavit-container {
          max-width: 800px;
          margin: 0 auto;
        }
        
        h1 {
          text-align: center;
          font-size: 28px;
          margin-bottom: 40px;
          font-weight: bold;
        }
        
        .content {
          text-align: justify;
          margin-bottom: 30px;
        }
        
        .details-section {
          margin-top: 30px;
          background-color: #f5f5f5;
          padding: 20px;
          border-radius: 5px;
        }
        
        .details-title {
          font-weight: bold;
          font-size: 16px;
          margin-bottom: 15px;
          color: #d32f2f;
        }
        
        .details-content {
          line-height: 1.8;
        }
        
        .footer {
          margin-top: 40px;
          text-align: left;
          font-size: 13px;
          line-height: 1.6;
        }
        
        .signature-box {
          border: 2px solid #333;
          padding: 20px;
          margin: 30px 0;
          background-color: #fafafa;
        }
        
        .signature-line {
          border-bottom: 1px solid #333;
          margin-bottom: 5px;
          padding-bottom: 2px;
        }
        
        .timestamp {
          font-style: italic;
          color: #666;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="affidavit-container">
        <h1>Signed Agreement Affidavit</h1>
        
        <div class="content">
          <p>
            On behalf of <strong>${data.carrierName}</strong> (DOT#: ${data.carrierDOT}) with offices at ${fullAddress}, 
            on <strong>${signedDate}</strong>, <strong>${data.signerName}, ${data.signerTitle}</strong>, 
            agreed to CrossCountry Freight Solutions, Inc.'s online agreement, version #: 
            <strong>[${data.agreementVersion}]</strong>.
          </p>
        </div>
        
        <div class="details-section">
          <div class="details-title">Details:</div>
          <div class="details-content">
            On ${signedDate}, ${data.signerName}, ${data.signerTitle}, securely signed in to 
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}">${process.env.FRONTEND_URL || 'http://localhost:3000'}</a> from IP Address 
            <strong>${data.ipAddress}</strong> at approximate location: ${geolocation}. 
            Method used: Device/Browser, using the confirmed and password protected username of 
            <strong>${data.username}</strong>. During the carrier's online registration, 
            ${data.signerName}, ${data.signerTitle}, certified under penalty of perjury under the laws 
            of the United States of America to having authorization by ${data.carrierName} to sign 
            agreements on their behalf.
          </div>
        </div>
        
        <div class="footer">
          <p>Email receipt of the signed agreement was sent to <strong>${data.signerEmail}</strong> on ${signedDate}.</p>
        </div>
        
        <div class="signature-box">
          <div class="signature-line">
            <strong>Digital Signature:</strong> ${data.signerName}
          </div>
          <div class="signature-line">
            <strong>Title:</strong> ${data.signerTitle}
          </div>
          <div class="signature-line">
            <strong>Date:</strong> ${signedDate}
          </div>
          <div class="signature-line">
            <strong>IP Address:</strong> ${data.ipAddress}
          </div>
        </div>
        
        <div class="timestamp">
          Document generated on ${format(new Date(), 'MMMM d, yyyy \'at\' h:mm:ss a zzz')}
        </div>
      </div>
    </body>
    </html>
    `;
  }

  static async generateAgreementAffidavit(data: AgreementSigningData): Promise<{
    affidavitPath: string;
    agreementWithAffidavitPath: string;
    agreementRecord: any;
  }> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      // Generate affidavit PDF
      const page = await browser.newPage();
      const html = this.generateAffidavitHTML(data);
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const affidavitFilename = `affidavit_${data.carrierId}_${Date.now()}.pdf`;
      const affidavitPath = path.join(this.affidavitsDir, affidavitFilename);
      
      await page.pdf({
        path: affidavitPath,
        format: 'letter',
        printBackground: true,
        margin: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in'
        }
      });

      // If agreement file exists, merge affidavit with agreement
      let agreementWithAffidavitPath = '';
      let agreementHash = '';
      
      if (data.agreementFilePath && fs.existsSync(data.agreementFilePath)) {
        // Read the agreement file and calculate hash
        const agreementBuffer = fs.readFileSync(data.agreementFilePath);
        agreementHash = crypto.createHash('sha256').update(agreementBuffer).digest('hex');
        
        // For now, we'll store the affidavit separately. In a production system,
        // you might want to convert DOCX to PDF or merge PDFs using pdf-lib
        // Note: The agreement is currently a DOCX file, not a PDF
        agreementWithAffidavitPath = affidavitPath; // Just use affidavit for now
      }

      // Store the agreement signing record in the database
      const agreementRecord = await prisma.carrierAgreement.create({
        data: {
          carrierId: data.carrierId,
          agreementVersion: data.agreementVersion,
          agreementTitle: data.agreementTitle,
          signedAt: data.timestamp,
          signedBy: data.signerName,
          signedByTitle: data.signerTitle,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          geolocation: data.geolocation ? JSON.stringify(data.geolocation) : null,
          username: data.username,
          affidavitPdfPath: affidavitPath,
          agreementPdfPath: agreementWithAffidavitPath || null,
          agreementHash: agreementHash || null
        }
      });

      return {
        affidavitPath,
        agreementWithAffidavitPath,
        agreementRecord
      };
    } finally {
      await browser.close();
    }
  }

  static async getCarrierAgreements(carrierId: number) {
    return await prisma.carrierAgreement.findMany({
      where: { carrierId },
      orderBy: { signedAt: 'desc' }
    });
  }

  static async getLatestAgreement(carrierId: number) {
    return await prisma.carrierAgreement.findFirst({
      where: { carrierId },
      orderBy: { signedAt: 'desc' }
    });
  }
}