/**
 * SMS Controller
 *
 * API endpoints for SMS messaging operations
 */

import { Request, Response } from 'express';
import { smsService } from '../services/sms.service';
import { prisma } from '../index';

/**
 * Get SMS service status
 * GET /api/sms/status
 */
export const getSMSStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = smsService.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting SMS status:', error);
    res.status(500).json({ message: 'Failed to get SMS status' });
  }
};

/**
 * Send a test SMS
 * POST /api/sms/test
 */
export const sendTestSMS = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber) {
      res.status(400).json({ message: 'Phone number is required' });
      return;
    }

    const testMessage = message || 'This is a test message from CCFS LTL Management System.';

    const result = await smsService.send({
      to: phoneNumber,
      message: testMessage,
      context: { type: 'test' },
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Test SMS sent successfully',
        messageId: result.messageId,
        provider: result.provider,
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send test SMS',
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error sending test SMS:', error);
    res.status(500).json({ message: 'Failed to send test SMS' });
  }
};

/**
 * Send trip assignment SMS to driver
 * POST /api/sms/trip-assignment
 */
export const sendTripAssignmentSMS = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId, driverId, phoneNumber } = req.body;

    if (!tripId) {
      res.status(400).json({ message: 'Trip ID is required' });
      return;
    }

    // Get trip details with driver
    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: tripId },
      include: {
        driver: true,
      },
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    // Determine phone number to use
    let phone = phoneNumber;
    if (!phone && driverId) {
      const driver = await prisma.carrierDriver.findUnique({
        where: { id: driverId },
        select: { phoneNumber: true },
      });
      phone = driver?.phoneNumber;
    }
    if (!phone && trip.driver?.phoneNumber) {
      phone = trip.driver.phoneNumber;
    }

    if (!phone) {
      res.status(400).json({ message: 'No phone number available for driver' });
      return;
    }

    // Format departure time from plannedDeparture
    const departureTime = trip.plannedDeparture
      ? trip.plannedDeparture.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : undefined;

    const result = await smsService.sendTripAssignment(
      phone,
      trip.tripNumber,
      trip.originTerminalCode || 'Unknown',
      trip.destinationTerminalCode || 'Unknown',
      trip.dispatchDate.toLocaleDateString(),
      departureTime
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Trip assignment SMS sent',
        messageId: result.messageId,
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send trip assignment SMS',
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error sending trip assignment SMS:', error);
    res.status(500).json({ message: 'Failed to send trip assignment SMS' });
  }
};

/**
 * Send booking confirmation SMS
 * POST /api/sms/booking-confirmation
 */
export const sendBookingConfirmationSMS = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId, phoneNumber } = req.body;

    if (!bookingId) {
      res.status(400).json({ message: 'Booking ID is required' });
      return;
    }

    // Get booking details
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        carrier: true,
        route: true,
      },
    });

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    // Determine phone number
    const phone = phoneNumber || booking.phoneNumber || booking.carrier?.phone;

    if (!phone) {
      res.status(400).json({ message: 'No phone number available' });
      return;
    }

    const route = booking.route
      ? `${booking.route.origin} to ${booking.route.destination}`
      : `${booking.origin} to ${booking.destination}`;

    const result = await smsService.sendBookingConfirmation(
      phone,
      booking.id,
      route,
      booking.bookingDate.toLocaleDateString(),
      Number(booking.rate)
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Booking confirmation SMS sent',
        messageId: result.messageId,
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send booking confirmation SMS',
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error sending booking confirmation SMS:', error);
    res.status(500).json({ message: 'Failed to send booking confirmation SMS' });
  }
};

/**
 * Send delay notification SMS
 * POST /api/sms/delay-notification
 */
export const sendDelayNotificationSMS = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId, phoneNumber, reason, newDepartureTime } = req.body;

    if (!tripId || !reason) {
      res.status(400).json({ message: 'Trip ID and reason are required' });
      return;
    }

    // Get trip details
    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: tripId },
      include: { driver: true },
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    const phone = phoneNumber || trip.driver?.phoneNumber;

    if (!phone) {
      res.status(400).json({ message: 'No phone number available' });
      return;
    }

    const result = await smsService.sendDelayNotification(
      phone,
      trip.tripNumber,
      reason,
      newDepartureTime
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Delay notification SMS sent',
        messageId: result.messageId,
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send delay notification SMS',
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error sending delay notification SMS:', error);
    res.status(500).json({ message: 'Failed to send delay notification SMS' });
  }
};

/**
 * Send custom SMS
 * POST /api/sms/send
 */
export const sendCustomSMS = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber, message, type, referenceId } = req.body;

    if (!phoneNumber || !message) {
      res.status(400).json({ message: 'Phone number and message are required' });
      return;
    }

    // Enforce message length limit
    if (message.length > 1600) {
      res.status(400).json({ message: 'Message too long. Maximum 1600 characters.' });
      return;
    }

    const result = await smsService.sendCustom(
      phoneNumber,
      message,
      type || 'custom',
      referenceId
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'SMS sent successfully',
        messageId: result.messageId,
        provider: result.provider,
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send SMS',
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error sending custom SMS:', error);
    res.status(500).json({ message: 'Failed to send SMS' });
  }
};

/**
 * Send bulk SMS to multiple recipients
 * POST /api/sms/bulk
 */
export const sendBulkSMS = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumbers, message, type } = req.body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      res.status(400).json({ message: 'Phone numbers array is required' });
      return;
    }

    if (!message) {
      res.status(400).json({ message: 'Message is required' });
      return;
    }

    // Limit bulk sends
    if (phoneNumbers.length > 100) {
      res.status(400).json({ message: 'Maximum 100 recipients per bulk send' });
      return;
    }

    const result = await smsService.sendBulk(phoneNumbers, message, { type });

    res.json({
      success: result.failed === 0,
      sent: result.sent,
      failed: result.failed,
      results: result.results.map(r => ({
        recipient: r.recipient,
        success: r.success,
        messageId: r.messageId,
        error: r.error,
      })),
    });
  } catch (error) {
    console.error('Error sending bulk SMS:', error);
    res.status(500).json({ message: 'Failed to send bulk SMS' });
  }
};
