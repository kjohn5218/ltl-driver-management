import nodemailer from 'nodemailer';
import { Booking, Carrier, Route } from '@prisma/client';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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
    const mailOptions = {
      from: options.from || process.env.EMAIL_USER || 'noreply@crosscountryfreight.com',
      to: options.to,
      subject: options.subject,
      html: options.html
    };
    
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to:', options.to);
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
        <p>Please ensure all required documentation is up to date.</p>
        <p>Best regards,<br>LTL Management Team</p>
      `
    };

    await transporter.sendMail(mailOptions);
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

    const mailOptions = {
      from: process.env.EMAIL_USER,
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
    };

    await transporter.sendMail(mailOptions);
    console.log(`Cancellation email sent to ${booking.carrier.email}`);
  } catch (error) {
    console.error('Failed to send booking cancellation:', error);
  }
};

export const sendInsuranceExpiryReminder = async (carrier: Carrier) => {
  try {
    if (!carrier.email || !carrier.insuranceExpiration) return;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: carrier.email,
      subject: 'Insurance Expiry Reminder',
      html: `
        <h2>Insurance Expiry Reminder</h2>
        <p>Dear ${carrier.name},</p>
        <p>This is a reminder that your insurance is set to expire on <strong>${carrier.insuranceExpiration.toLocaleDateString()}</strong>.</p>
        <p>Please submit updated insurance documentation at your earliest convenience to maintain your active status.</p>
        <p>Best regards,<br>LTL Management Team</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Insurance reminder sent to ${carrier.email}`);
  } catch (error) {
    console.error('Failed to send insurance reminder:', error);
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