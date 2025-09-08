import nodemailer from 'nodemailer';
import { Booking, Carrier, Route } from '@prisma/client';

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
  route: Route;
}

export const sendBookingConfirmation = async (booking: BookingWithRelations) => {
  try {
    if (!booking.carrier || !booking.carrier.email) return;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: booking.carrier.email,
      subject: `Booking Confirmed - ${booking.route.name}`,
      html: `
        <h2>Booking Confirmation</h2>
        <p>Dear ${booking.carrier.name},</p>
        <p>Your booking has been confirmed with the following details:</p>
        <ul>
          <li><strong>Route:</strong> ${booking.route.name} (${booking.route.origin} to ${booking.route.destination})</li>
          <li><strong>Date:</strong> ${booking.bookingDate.toLocaleDateString()}</li>
          <li><strong>Distance:</strong> ${booking.route.distance} miles</li>
          <li><strong>Rate:</strong> $${booking.rate}</li>
          ${booking.route.departureTime ? `<li><strong>Departure Time:</strong> ${booking.route.departureTime}</li>` : ''}
          ${booking.route.arrivalTime ? `<li><strong>Arrival Time:</strong> ${booking.route.arrivalTime}</li>` : ''}
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

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: booking.carrier.email,
      subject: `Booking Cancelled - ${booking.route.name}`,
      html: `
        <h2>Booking Cancellation</h2>
        <p>Dear ${booking.carrier.name},</p>
        <p>Your booking has been cancelled:</p>
        <ul>
          <li><strong>Route:</strong> ${booking.route.name} (${booking.route.origin} to ${booking.route.destination})</li>
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
  pdfAttachment: Buffer,
  fileName: string
) => {
  try {
    if (!booking.carrier || !booking.carrier.email) return;

    const shipmentNumber = `CCFS${booking.id.toString().padStart(5, '0')}`;
    
    const mailOptions = {
      from: 'ratecon@ccfs.com',
      replyTo: 'ratecon@ccfs.com',
      to: booking.carrier.email,
      subject: `Rate Confirmation - ${shipmentNumber}`,
      html: `
        <h2>Rate Confirmation</h2>
        <p>Dear ${booking.carrier.name},</p>
        <p>Please find attached the rate confirmation for your upcoming shipment:</p>
        <ul>
          <li><strong>Shipment #:</strong> ${shipmentNumber}</li>
          <li><strong>Route:</strong> ${booking.route.origin} to ${booking.route.destination}</li>
          <li><strong>Date:</strong> ${booking.bookingDate.toLocaleDateString()}</li>
          <li><strong>Rate:</strong> $${booking.rate}</li>
        </ul>
        <p>Please review the attached rate confirmation and contact us if you have any questions.</p>
        <p>Best regards,<br>CrossCounty Freight Solutions</p>
      `,
      attachments: [
        {
          filename: fileName,
          content: pdfAttachment,
          contentType: 'application/pdf'
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    console.log(`Rate confirmation sent to ${booking.carrier.email}`);
  } catch (error) {
    console.error('Failed to send rate confirmation:', error);
    throw error;
  }
};