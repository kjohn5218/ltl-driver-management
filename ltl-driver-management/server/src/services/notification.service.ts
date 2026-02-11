import nodemailer from 'nodemailer';
import * as aws from '@aws-sdk/client-sesv2';
import { Booking, Carrier, Route } from '@prisma/client';
import { PDFService } from './pdf.service';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

// Create transporter based on EMAIL_PROVIDER setting
const createTransporter = (): nodemailer.Transporter => {
  const provider = process.env.EMAIL_PROVIDER?.toUpperCase();

  if (provider === 'SES') {
    // AWS SES v2 configuration
    const sesClient = new aws.SESv2Client({
      region: process.env.AWS_REGION || 'us-west-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });

    console.log('📧 Email provider: AWS SES (region: ' + (process.env.AWS_REGION || 'us-west-2') + ')');

    // Use type assertion for SES transport (nodemailer types don't include SES)
    return nodemailer.createTransport({
      SES: { sesClient, SendEmailCommand: aws.SendEmailCommand }
    } as nodemailer.TransportOptions);
  }

  // Default: SMTP configuration (Gmail or custom SMTP)
  console.log('📧 Email provider: SMTP (' + (process.env.EMAIL_HOST || 'smtp.gmail.com') + ')');

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

const transporter = createTransporter();

interface BookingWithRelations extends Booking {
  carrier: Carrier | null;
  route: Route | null;
  childBookings?: Array<{
    route: Route | null;
    [key: string]: any;
  }>;
}

export const sendEmail = async (options: EmailOptions) => {
  try {
    // Use test email override if configured
    const actualRecipient = process.env.TEST_EMAIL_OVERRIDE || options.to;
    
    const mailOptions = {
      from: options.from || process.env.EMAIL_USER || 'noreply@crosscountryfreight.com',
      to: actualRecipient,
      subject: options.subject + (process.env.TEST_EMAIL_OVERRIDE ? ' [TEST EMAIL]' : ''),
      html: process.env.TEST_EMAIL_OVERRIDE && process.env.TEST_EMAIL_OVERRIDE !== options.to ? 
        `<div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 15px 0; border-radius: 5px;">
          <strong>🧪 TEST EMAIL OVERRIDE:</strong> This email was originally intended for <strong>${options.to}</strong> but was redirected to this address for testing purposes.
        </div>
        ${options.html}` : options.html,
      attachments: options.attachments || []
    };
    
    if (process.env.TEST_EMAIL_OVERRIDE && process.env.TEST_EMAIL_OVERRIDE !== options.to) {
      console.log(`📧 Email override: Routing email from ${options.to} to ${process.env.TEST_EMAIL_OVERRIDE}`);
    }
    
    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to: ${actualRecipient}${actualRecipient !== options.to ? ` (originally intended for ${options.to})` : ''}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

export const sendBookingConfirmation = async (booking: BookingWithRelations) => {
  try {
    if (!booking.carrier || !booking.carrier.email) return;

    // Determine route information based on booking type
    const routeInfo = booking.route 
      ? {
          name: booking.route.name,
          origin: booking.route.origin,
          destination: booking.route.destination,
          distance: booking.route.distance?.toString() || 'N/A',
          departureTime: booking.route.departureTime,
          arrivalTime: booking.route.arrivalTime
        }
      : {
          name: `${booking.origin} → ${booking.destination}`,
          origin: booking.origin || 'N/A',
          destination: booking.destination || 'N/A',
          distance: booking.estimatedMiles?.toString() || 'N/A',
          departureTime: null,
          arrivalTime: null
        };

    await sendEmail({
      to: booking.carrier.email,
      subject: `Booking Confirmed - ${routeInfo.name}`,
      html: `
        <h2>Booking Confirmation</h2>
        <p>Dear ${booking.carrier.name},</p>
        <p>Your booking has been confirmed with the following details:</p>
        <ul>
          <li><strong>Route:</strong> ${routeInfo.name} (${routeInfo.origin} to ${routeInfo.destination})</li>
          <li><strong>Date:</strong> ${booking.bookingDate.toLocaleDateString()}</li>
          <li><strong>Distance:</strong> ${routeInfo.distance} miles</li>
          <li><strong>Rate:</strong> $${booking.rate}</li>
          ${routeInfo.departureTime ? `<li><strong>Departure Time:</strong> ${routeInfo.departureTime}</li>` : ''}
          ${routeInfo.arrivalTime ? `<li><strong>Arrival Time:</strong> ${routeInfo.arrivalTime}</li>` : ''}
          ${booking.carrierReportTime ? `<li><strong>Report Time:</strong> ${booking.carrierReportTime}</li>` : ''}
        </ul>
        ${booking.notes ? `<p><strong>Notes:</strong> ${booking.notes}</p>` : ''}
        <p>Please ensure all required documentation is up to date.</p>
        <p>Best regards,<br>LTL Management Team</p>
      `
    });

    console.log(`Confirmation email sent to ${booking.carrier.email}`);
  } catch (error) {
    console.error('Failed to send booking confirmation:', error);
  }
};

export const sendBookingCancellation = async (booking: BookingWithRelations, reason?: string) => {
  try {
    if (!booking.carrier || !booking.carrier.email) return;

    // Determine route information based on booking type
    const routeInfo = booking.route 
      ? {
          name: booking.route.name,
          origin: booking.route.origin,
          destination: booking.route.destination
        }
      : {
          name: `${booking.origin} → ${booking.destination}`,
          origin: booking.origin || 'N/A',
          destination: booking.destination || 'N/A'
        };

    await sendEmail({
      to: booking.carrier.email,
      subject: `Booking Cancelled - ${routeInfo.name}`,
      html: `
        <h2>Booking Cancellation</h2>
        <p>Dear ${booking.carrier.name},</p>
        <p>Your booking has been cancelled:</p>
        <ul>
          <li><strong>Route:</strong> ${routeInfo.name} (${routeInfo.origin} to ${routeInfo.destination})</li>
          <li><strong>Date:</strong> ${booking.bookingDate.toLocaleDateString()}</li>
        </ul>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>We apologize for any inconvenience.</p>
        <p>Best regards,<br>LTL Management Team</p>
      `
    });

    console.log(`Cancellation email sent to ${booking.carrier.email}`);
  } catch (error) {
    console.error('Failed to send booking cancellation:', error);
  }
};

export const sendInsuranceExpiryReminder = async (carrier: Carrier) => {
  try {
    if (!carrier.email || !carrier.insuranceExpiration) return;

    await sendEmail({
      to: carrier.email,
      subject: 'Insurance Expiry Reminder',
      html: `
        <h2>Insurance Expiry Reminder</h2>
        <p>Dear ${carrier.name},</p>
        <p>This is a reminder that your insurance is set to expire on <strong>${carrier.insuranceExpiration.toLocaleDateString()}</strong>.</p>
        <p>Please submit updated insurance documentation at your earliest convenience to maintain your active status.</p>
        <p>Best regards,<br>LTL Management Team</p>
      `
    });

    console.log(`Insurance reminder sent to ${carrier.email}`);
  } catch (error) {
    console.error('Failed to send insurance reminder:', error);
  }
};

export const sendBookingConfirmationWithUploadLink = async (booking: BookingWithRelations) => {
  try {
    if (!booking.carrier || !booking.carrier.email) return;
    if (!booking.documentUploadToken) {
      console.error('No document upload token generated for booking:', booking.id);
      return;
    }

    // Create upload URL using the token
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const uploadUrl = `${baseUrl}/upload-documents/${booking.documentUploadToken}`;

    // Determine route information based on booking type
    const routeInfo = booking.route 
      ? {
          name: booking.route.name,
          origin: booking.route.origin,
          destination: booking.route.destination,
          distance: booking.route.distance?.toString() || 'N/A',
          departureTime: booking.route.departureTime,
          arrivalTime: booking.route.arrivalTime
        }
      : {
          name: `${booking.origin} → ${booking.destination}`,
          origin: booking.origin || 'N/A',
          destination: booking.destination || 'N/A',
          distance: booking.estimatedMiles?.toString() || 'N/A',
          departureTime: booking.departureTime,
          arrivalTime: booking.arrivalTime
        };

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: booking.carrier.email,
      subject: `Booking Confirmed - ${routeInfo.name}`,
      html: `
        <h2>Booking Confirmation</h2>
        <p>Dear ${booking.carrier.name},</p>
        <p>Your booking has been confirmed with the following details:</p>
        <ul>
          <li><strong>Route:</strong> ${routeInfo.name} (${routeInfo.origin} to ${routeInfo.destination})</li>
          <li><strong>Date:</strong> ${booking.bookingDate.toLocaleDateString()}</li>
          <li><strong>Distance:</strong> ${routeInfo.distance} miles</li>
          <li><strong>Rate:</strong> $${booking.rate}</li>
          ${routeInfo.departureTime ? `<li><strong>Departure Time:</strong> ${routeInfo.departureTime}</li>` : ''}
          ${routeInfo.arrivalTime ? `<li><strong>Arrival Time:</strong> ${routeInfo.arrivalTime}</li>` : ''}
          ${booking.carrierReportTime ? `<li><strong>Report Time:</strong> ${booking.carrierReportTime}</li>` : ''}
        </ul>
        ${booking.notes ? `<p><strong>Notes:</strong> ${booking.notes}</p>` : ''}
        
        <div style="background-color: #f0f8ff; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3 style="color: #0066cc; margin-top: 0;">Action Required: Document Upload</h3>
          <p>At the completion of the trip, please use the link below to upload copies of the manifests for each leg of the trip and any other related documents:</p>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="${uploadUrl}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
              Upload Documents
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Or copy and paste this link into your browser:<br>
            <a href="${uploadUrl}" style="color: #0066cc;">${uploadUrl}</a>
          </p>
        </div>
        
        <p>Please ensure all required documentation is up to date.</p>
        <p>Best regards,<br>LTL Management Team</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Confirmation email with upload link sent to ${booking.carrier.email}`);
  } catch (error) {
    console.error('Failed to send booking confirmation with upload link:', error);
  }
};

export const sendRateConfirmationSubmittedEmail = async (
  booking: BookingWithRelations,
  recipientEmail: string,
  documentUploadToken: string
) => {
  // Use test email override in development if configured
  const actualRecipientEmail = process.env.TEST_EMAIL_OVERRIDE || recipientEmail;
  
  try {
    console.log(`Sending rate confirmation submission thank you email to: ${recipientEmail}`);
    const shipmentNumber = `CCFS${booking.id.toString().padStart(5, '0')}`;
    
    const fromEmail = process.env.EMAIL_USER || 'ratecon@ccfs.com';
    const uploadLink = `${process.env.CLIENT_BASE_URL || 'http://localhost:5174'}/documents/upload/${documentUploadToken}`;
    
    if (process.env.TEST_EMAIL_OVERRIDE && process.env.TEST_EMAIL_OVERRIDE !== recipientEmail) {
      console.log(`📧 Email override: Routing email from ${recipientEmail} to ${process.env.TEST_EMAIL_OVERRIDE}`);
    }

    // Parse route information similar to sendRateConfirmationEmail
    const routeInfo = (() => {
      const notes = booking.notes || '';
      const hasMultiLeg = notes.includes('--- Multi-Leg Booking ---');
      
      if (hasMultiLeg) {
        const legs = [];
        const lines = notes.split('\n');
        for (const line of lines) {
          const legMatch = line.match(/^Leg (\d+): (.+) → (.+?)(?:\s*\(([^)]+)\))?(?:\s+Depart:\s*(\d{2}:\d{2}))?\s*\(\$(.+)\)$/);
          if (legMatch) {
            legs.push({
              leg: legMatch[1],
              origin: legMatch[2],
              destination: legMatch[3],
              date: legMatch[4],
              departureTime: legMatch[5]
            });
          }
        }
        return legs;
      }
      
      if (booking.childBookings && booking.childBookings.length > 0) {
        const routes = [];
        if (booking.route) {
          routes.push({
            leg: '1',
            origin: booking.route.origin,
            destination: booking.route.destination,
            departureTime: booking.departureTime
          });
        } else if (booking.origin && booking.destination) {
          routes.push({
            leg: '1',
            origin: booking.origin,
            destination: booking.destination,
            departureTime: booking.departureTime
          });
        }
        booking.childBookings.forEach((child, index) => {
          if (child.route) {
            routes.push({
              leg: (index + 2).toString(),
              origin: child.route.origin,
              destination: child.route.destination,
              departureTime: child.departureTime
            });
          }
        });
        return routes;
      }
      
      return [{
        leg: '1',
        origin: booking.route?.origin || booking.origin || 'N/A',
        destination: booking.route?.destination || booking.destination || 'N/A',
        departureTime: booking.departureTime
      }];
    })();

    // Generate stops HTML
    const stopsHtml = routeInfo.map(leg => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">Stop ${leg.leg}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${leg.origin}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${leg.destination}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${leg.departureTime || 'TBD'}</td>
      </tr>
    `).join('');
    
    const mailOptions = {
      from: fromEmail,
      replyTo: fromEmail,
      to: actualRecipientEmail,
      subject: `Thank You - Rate Confirmation Received - ${shipmentNumber}${process.env.TEST_EMAIL_OVERRIDE ? ' [TEST EMAIL]' : ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Thank You for Submitting Your Rate Confirmation</h2>
          
          ${process.env.TEST_EMAIL_OVERRIDE && process.env.TEST_EMAIL_OVERRIDE !== recipientEmail ? 
            `<div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 10px 0; border-radius: 5px;">
              <strong>🧪 TEST EMAIL OVERRIDE:</strong> This email was originally intended for <strong>${recipientEmail}</strong> but was redirected to this address for testing purposes.
            </div>` : ''
          }
          
          <p>Dear ${booking.carrier?.name || 'Valued Partner'},</p>
          
          <p>Thank you for submitting your signed rate confirmation for <strong>Shipment #${shipmentNumber}</strong>. Your booking has been confirmed.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">Booking Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0;"><strong>Shipment #:</strong></td>
                <td style="padding: 8px 0;">${shipmentNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Booking Date:</strong></td>
                <td style="padding: 8px 0;">${booking.bookingDate.toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Total Rate:</strong></td>
                <td style="padding: 8px 0;">$${booking.rate.toString()}</td>
              </tr>
              ${booking.driverName ? `
              <tr>
                <td style="padding: 8px 0;"><strong>Driver:</strong></td>
                <td style="padding: 8px 0;">${booking.driverName}</td>
              </tr>
              ` : ''}
              ${booking.phoneNumber ? `
              <tr>
                <td style="padding: 8px 0;"><strong>Phone:</strong></td>
                <td style="padding: 8px 0;">${booking.phoneNumber}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          
          <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">📍 Important: Real-Time Tracking Required</h3>
            <p style="margin-bottom: 10px;">Departure and arrival of each stop <strong>MUST</strong> be recorded in real-time on a mobile browser at:</p>
            <p style="text-align: center; margin: 15px 0;">
              <a href="https://driver.ccfs.com" style="display: inline-block; background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">driver.ccfs.com</a>
            </p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <thead>
                <tr style="background-color: #f0f0f0;">
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Stop</th>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Origin</th>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Destination</th>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Departure</th>
                </tr>
              </thead>
              <tbody>
                ${stopsHtml}
              </tbody>
            </table>
          </div>
          
          <div style="background-color: #fff4e5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">📞 Support Information</h3>
            <p>For delays or assistance, contact:</p>
            <ul style="margin: 10px 0;">
              <li><strong>Linehaul Support:</strong> 701-204-0480 (M-F 9:30 PM – 6:30 AM CT)</li>
              <li><strong>CCFS Service Center:</strong> During regular business hours</li>
            </ul>
          </div>
          
          <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">💰 Billing Instructions</h3>
            <p>Upon completion of the trip, please submit:</p>
            <ol style="margin: 10px 0;">
              <li>Your invoice</li>
              <li>Copies of trip manifests</li>
            </ol>
            <p><strong>Submit documents via:</strong></p>
            <p style="text-align: center; margin: 15px 0;">
              <a href="${uploadLink}" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Upload Documents</a>
            </p>
            <p style="text-align: center; margin: 10px 0;">
              <em>- OR -</em>
            </p>
            <p style="text-align: center;">
              Email to: <a href="mailto:ratecon@ccfs.com">ratecon@ccfs.com</a>
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
          
          <p style="color: #666; font-size: 14px;">
            Thank you for your partnership. We look forward to a successful trip.
          </p>
          
          <p style="color: #666; font-size: 14px;">
            Best regards,<br>
            <strong>Cross Country Freight Solutions</strong><br>
            LTL Management Team
          </p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`Rate confirmation submission email sent to ${actualRecipientEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send rate confirmation submission email:', error);
    throw error;
  }
};

export const sendRateConfirmationEmail = async (
  booking: BookingWithRelations,
  recipientEmail: string,
  pdfAttachment: Buffer,
  confirmationUrl: string
) => {
  // Use test email override in development if configured
  const actualRecipientEmail = process.env.TEST_EMAIL_OVERRIDE || recipientEmail;
  
  try {
    console.log(`Attempting to send rate confirmation email to: ${recipientEmail}`);
    console.log('Booking data:', {
      id: booking.id,
      mainRoute: booking.route 
        ? `${booking.route.origin} to ${booking.route.destination}`
        : `${booking.origin} to ${booking.destination}`,
      childBookings: booking.childBookings?.map(cb => ({
        route: cb.route ? `${cb.route.origin} to ${cb.route.destination}` : 'Origin-Destination',
        rate: cb.rate
      }))
    });
    const shipmentNumber = `CCFS${booking.id.toString().padStart(5, '0')}`;
    
    const fromEmail = process.env.EMAIL_USER || 'ratecon@ccfs.com';
    
    if (process.env.TEST_EMAIL_OVERRIDE && process.env.TEST_EMAIL_OVERRIDE !== recipientEmail) {
      console.log(`📧 Email override: Routing email from ${recipientEmail} to ${process.env.TEST_EMAIL_OVERRIDE}`);
    }
    
    const mailOptions = {
      from: fromEmail,
      replyTo: fromEmail,
      to: actualRecipientEmail,
      subject: `Rate Confirmation - ${shipmentNumber}${process.env.TEST_EMAIL_OVERRIDE ? ' [TEST EMAIL]' : ''}`,
      html: `
        <h2>Rate Confirmation</h2>
        ${process.env.TEST_EMAIL_OVERRIDE && process.env.TEST_EMAIL_OVERRIDE !== recipientEmail ? 
          `<div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 10px 0; border-radius: 5px;">
            <strong>🧪 TEST EMAIL OVERRIDE:</strong> This email was originally intended for <strong>${recipientEmail}</strong> but was redirected to this address for testing purposes.
          </div>` : ''
        }
        <p>Dear ${booking.carrier?.name || 'Valued Partner'},</p>
        <p>Please find attached the rate confirmation for your upcoming route:</p>
        <ul>
          <li><strong>Shipment #:</strong> ${shipmentNumber}</li>
          <li><strong>Route:</strong> ${(() => {
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
                  legs.push(`${legMatch[2]} to ${legMatch[3]}`);
                }
              }
              return legs.length > 0 ? legs.join(' / ') : 
                (booking.route ? `${booking.route.origin} to ${booking.route.destination}` : 
                 `${booking.origin} to ${booking.destination}`);
            }
            
            // Check for child bookings (future implementation)
            if (booking.childBookings && booking.childBookings.length > 0) {
              const routes = booking.route 
                ? [booking.route.origin + ' to ' + booking.route.destination]
                : [`${booking.origin} to ${booking.destination}`];
              booking.childBookings.forEach((child) => {
                if (child.route) {
                  routes.push(child.route.origin + ' to ' + child.route.destination);
                }
              });
              return routes.join(' / ');
            }
            
            return booking.route 
              ? booking.route.origin + ' to ' + booking.route.destination
              : `${booking.origin} to ${booking.destination}`;
          })()}</li>
          <li><strong>Date:</strong> ${booking.bookingDate.toLocaleDateString()}</li>
          <li><strong>Total Rate:</strong> $${Number(booking.rate).toFixed(2)}</li>
        </ul>
        
        ${(() => {
          // Parse multi-leg details from notes
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
                  rate: legMatch[6] // Rate moved to position 6
                });
              }
            }
            
            if (legs.length > 0) {
              return `
              <div style="margin-top: 15px;">
                <strong>Route Details:</strong>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                  ${legs.map((leg) => `
                  <tr ${leg.legNumber === 1 ? 'style="background-color: #f5f5f5;"' : ''}>
                    <td style="padding: 8px; border: 1px solid #ddd;"><strong>Leg ${leg.legNumber}:</strong></td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${leg.origin} to ${leg.destination}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${leg.rate}</td>
                  </tr>
                  `).join('')}
                </table>
              </div>`;
            }
          }
          
          // Check for child bookings (future implementation)
          if (booking.childBookings && booking.childBookings.length > 0) {
            return `
            <div style="margin-top: 15px;">
              <strong>Route Details:</strong>
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <tr style="background-color: #f5f5f5;">
                  <td style="padding: 8px; border: 1px solid #ddd;"><strong>Leg 1:</strong></td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${booking.route ? `${booking.route.origin} to ${booking.route.destination}` : `${booking.origin} to ${booking.destination}`}</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${booking.route ? `${booking.route.distance} miles` : `${booking.estimatedMiles || 0} miles`}</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${Number(booking.rate).toFixed(2)}</td>
                </tr>
                ${booking.childBookings.map((child: any, index: number) => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd;"><strong>Leg ${index + 2}:</strong></td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${child.route ? `${child.route.origin} to ${child.route.destination}` : `${child.origin} to ${child.destination}`}</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${child.route ? `${child.route.distance} miles` : `${child.estimatedMiles || 0} miles`}</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${Number(child.rate).toFixed(2)}</td>
                </tr>
                `).join('')}
              </table>
            </div>`;
          }
          
          return '';
        })()}
        
        <div style="background-color: #f0f8ff; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3 style="color: #0066cc; margin-top: 0;">Action Required: Electronic Signature</h3>
          <p>Please review and electronically sign this rate confirmation by clicking the button below:</p>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="${confirmationUrl}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
              Sign Rate Confirmation
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Or copy and paste this link into your browser:<br>
            <a href="${confirmationUrl}" style="color: #0066cc;">${confirmationUrl}</a>
          </p>
        </div>
        
        <p>Please review the attached rate confirmation PDF and sign electronically using the link above.</p>
        <p>If you have any questions, please contact us at ratecon@ccfs.com</p>
        <p>Best regards,<br>CrossCounty Freight Solutions</p>
      `,
      attachments: [
        {
          filename: `rate-confirmation-${shipmentNumber}.pdf`,
          content: pdfAttachment,
          contentType: 'application/pdf'
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Rate confirmation sent successfully to ${actualRecipientEmail}${actualRecipientEmail !== recipientEmail ? ` (originally intended for ${recipientEmail})` : ''}`);
  } catch (error: any) {
    console.error('Failed to send rate confirmation email:', {
      error: error.message,
      code: error.code,
      originalRecipient: recipientEmail,
      actualRecipient: actualRecipientEmail,
      emailUser: process.env.EMAIL_USER
    });
    
    // Provide more specific error messages
    if (error.code === 'EAUTH') {
      throw new Error('Email authentication failed. Please check EMAIL_USER and EMAIL_PASS configuration.');
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('Email server not found. Please check EMAIL_HOST configuration.');
    } else if (error.code === 'ECONNECTION') {
      throw new Error('Failed to connect to email server.');
    } else {
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }
};

// Send invoice(s) to AP function
export const sendInvoicesToAP = async (invoices: any[], includeDocuments: boolean = true) => {
  try {
    const apEmail = 'ap@ccfs.com';
    
    // Generate PDF attachments for each invoice
    const attachments: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
    }> = [];
    
    console.log(`Generating PDFs for ${invoices.length} invoice(s)...`);
    
    for (const invoice of invoices) {
      try {
        const pdfBuffer = await PDFService.generateInvoicePDF(invoice);
        attachments.push({
          filename: `invoice-${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        });
        console.log(`✅ Generated PDF for invoice ${invoice.invoiceNumber}`);
      } catch (pdfError) {
        console.error(`❌ Failed to generate PDF for invoice ${invoice.invoiceNumber}:`, pdfError);
        // Continue with other invoices even if one fails
      }
    }
    
    // Generate invoice table rows
    const invoiceRows = invoices.map(invoice => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${invoice.invoiceNumber}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${invoice.carrierName || invoice.booking?.carrier?.name || 'N/A'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${invoice.booking?.route?.name || 'Custom Route'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${new Date(invoice.booking?.bookingDate).toLocaleDateString()}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${Number(invoice.amount).toFixed(2)}</td>
      </tr>
    `).join('');
    
    const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    
    const emailHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Carrier Payment Processing Required</h2>
        
        <p>The following invoice${invoices.length > 1 ? 's require' : ' requires'} payment processing:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 12px 8px; border: 1px solid #ddd; text-align: left;">Invoice #</th>
              <th style="padding: 12px 8px; border: 1px solid #ddd; text-align: left;">Carrier</th>
              <th style="padding: 12px 8px; border: 1px solid #ddd; text-align: left;">Route</th>
              <th style="padding: 12px 8px; border: 1px solid #ddd; text-align: left;">Service Date</th>
              <th style="padding: 12px 8px; border: 1px solid #ddd; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${invoiceRows}
          </tbody>
          <tfoot>
            <tr style="background-color: #e9ecef; font-weight: bold;">
              <td colspan="4" style="padding: 12px 8px; border: 1px solid #ddd; text-align: right;">Total Payment Required:</td>
              <td style="padding: 12px 8px; border: 1px solid #ddd; text-align: right; color: #28a745;">$${totalAmount.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        
        ${attachments.length > 0 ? `
        <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0;">📎 Attached Documents</h3>
          <p>This email includes the following invoice PDFs:</p>
          <ul>
            ${attachments.map(att => `<li>${att.filename}</li>`).join('')}
          </ul>
        </div>
        ` : ''}
        
        <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0;">Payment Instructions</h3>
          <ul>
            <li><strong>Payment Method:</strong> ACH or Check as per carrier preference</li>
            <li><strong>Payment Terms:</strong> Net 30 days from invoice date</li>
            <li><strong>Supporting Documents:</strong> ${includeDocuments ? 'Invoice PDFs attached to this email' : 'Available upon request'}</li>
          </ul>
        </div>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4 style="color: #856404; margin-top: 0;">📋 Action Required</h4>
          <p style="margin-bottom: 0;">Please process payment${invoices.length > 1 ? 's' : ''} to the carrier${invoices.length > 1 ? 's' : ''} listed above according to their remit-to information on file.</p>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          This email was generated automatically by the LTL Driver Management System.<br>
          For questions, contact the Linehaul Department.
        </p>
      </div>
    `;
    
    await sendEmail({
      to: apEmail,
      subject: `Carrier Payment Processing Required - ${invoices.length} Invoice${invoices.length > 1 ? 's' : ''}`,
      html: emailHTML,
      attachments: attachments
    });

    console.log(`✅ Invoice${invoices.length > 1 ? 's' : ''} sent to AP with ${attachments.length} PDF attachment${attachments.length > 1 ? 's' : ''}: ${invoices.map(inv => inv.invoiceNumber).join(', ')}`);
    return true;
  } catch (error) {
    console.error('Failed to send invoices to AP:', error);
    throw error;
  }
};