import { Request, Response } from 'express';
import { prisma } from '../index';
import * as NotificationService from '../services/notification.service';
import { format } from 'date-fns';

// Request contract power for a loadsheet
export const requestContractPower = async (req: Request, res: Response) => {
  try {
    const {
      loadsheetId,
      manifestNumber,
      origin,
      destination,
      linehaulName,
      trailerNumber,
      trailerLength,
      weight,
      pieces,
      scheduledDate,
      scheduledTime,
      notes
    } = req.body;

    // Get user info from request (set by auth middleware)
    const userId = (req as any).user?.id;
    const userName = (req as any).user?.name || 'Unknown User';
    const userEmail = (req as any).user?.email || '';

    // Validate loadsheet exists
    const loadsheet = await prisma.loadsheet.findUnique({
      where: { id: parseInt(loadsheetId) }
    });

    if (!loadsheet) {
      return res.status(404).json({ success: false, message: 'Loadsheet not found' });
    }

    // Check if already requested
    if (loadsheet.contractPowerStatus) {
      return res.status(400).json({
        success: false,
        message: `Contract power already ${loadsheet.contractPowerStatus.toLowerCase()} for this load`
      });
    }

    // Create booking with PENDING status (will show as "Unbooked" on bookings page)
    const bookingDate = scheduledDate ? new Date(scheduledDate + 'T12:00:00') : new Date();

    const booking = await prisma.booking.create({
      data: {
        bookingDate,
        rate: 0, // Rate TBD
        status: 'PENDING',
        type: 'POWER_ONLY',
        origin,
        destination,
        manifestNumber,
        trailerLength: trailerLength || 53,
        notes: `Contract Power Request\n` +
          `Manifest: ${manifestNumber}\n` +
          `Linehaul: ${linehaulName}\n` +
          `Trailer: ${trailerNumber}\n` +
          `Weight: ${weight} lbs\n` +
          `Pieces: ${pieces}\n` +
          `Scheduled: ${scheduledDate} ${scheduledTime || ''}\n` +
          `Requested by: ${userName}\n` +
          (notes ? `\nNotes: ${notes}` : ''),
        rateType: 'FLAT_RATE',
        departureTime: scheduledTime || undefined
      }
    });

    // Update loadsheet with contract power request info
    await prisma.loadsheet.update({
      where: { id: parseInt(loadsheetId) },
      data: {
        contractPowerStatus: 'REQUESTED',
        contractPowerBookingId: booking.id,
        contractPowerRequestedAt: new Date(),
        contractPowerRequestedBy: userId
      }
    });

    // Send email notification
    const emailSubject = `Contract Power Request - ${manifestNumber} (${origin} → ${destination})`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Contract Power Request</h2>

        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Load Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6B7280; width: 40%;">Manifest Number:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: bold;">${manifestNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Linehaul:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: bold;">${linehaulName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Route:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: bold;">${origin} → ${destination}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Trailer:</td>
              <td style="padding: 8px 0; color: #111827;">${trailerNumber} (${trailerLength}′)</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Weight:</td>
              <td style="padding: 8px 0; color: #111827;">${weight?.toLocaleString() || 0} lbs</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Pieces:</td>
              <td style="padding: 8px 0; color: #111827;">${pieces || 0}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Scheduled Date:</td>
              <td style="padding: 8px 0; color: #111827;">${scheduledDate || 'Not specified'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Scheduled Time:</td>
              <td style="padding: 8px 0; color: #111827;">${scheduledTime || 'Not specified'}</td>
            </tr>
          </table>
        </div>

        ${notes ? `
        <div style="background-color: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #92400E;">Additional Notes</h4>
          <p style="color: #78350F; margin-bottom: 0;">${notes}</p>
        </div>
        ` : ''}

        <div style="background-color: #E0E7FF; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #3730A3;">Requested By</h4>
          <p style="color: #4338CA; margin-bottom: 0;">
            <strong>${userName}</strong><br/>
            ${userEmail ? `<a href="mailto:${userEmail}">${userEmail}</a><br/>` : ''}
            ${format(new Date(), 'MMMM d, yyyy \'at\' h:mm a')}
          </p>
        </div>

        <p style="color: #6B7280; font-size: 12px; margin-top: 30px;">
          This request has been logged in the system. Please book a carrier and assign a driver in the Bookings page.
          <br/><br/>
          Booking ID: ${booking.id}
        </p>
      </div>
    `;

    try {
      await NotificationService.sendEmail({
        to: 'linehaulmanagement@ccfs.com',
        subject: emailSubject,
        html: emailHtml
      });
      console.log('Contract power request email sent successfully');
    } catch (emailError) {
      console.error('Failed to send contract power request email:', emailError);
      // Don't fail the request if email fails
    }

    return res.json({
      success: true,
      message: 'Contract power request submitted successfully',
      bookingId: booking.id
    });

  } catch (error) {
    console.error('Contract power request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit contract power request'
    });
  }
};

// Get contract power request status for a loadsheet
export const getContractPowerStatus = async (req: Request, res: Response) => {
  try {
    const { loadsheetId } = req.params;

    const loadsheet = await prisma.loadsheet.findUnique({
      where: { id: parseInt(loadsheetId) },
      select: {
        contractPowerStatus: true,
        contractPowerBookingId: true,
        contractPowerCarrierName: true,
        contractPowerDriverName: true,
        contractPowerRequestedAt: true
      }
    });

    if (!loadsheet) {
      return res.status(404).json({ success: false, message: 'Loadsheet not found' });
    }

    return res.json({
      success: true,
      status: loadsheet.contractPowerStatus,
      bookingId: loadsheet.contractPowerBookingId,
      carrierName: loadsheet.contractPowerCarrierName,
      driverName: loadsheet.contractPowerDriverName,
      requestedAt: loadsheet.contractPowerRequestedAt
    });

  } catch (error) {
    console.error('Get contract power status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get contract power status'
    });
  }
};
