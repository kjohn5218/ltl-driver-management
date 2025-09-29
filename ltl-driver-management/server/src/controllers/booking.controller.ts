import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma, BookingStatus } from '@prisma/client';
import * as NotificationService from '../services/notification.service';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { PDFService } from '../services/pdf.service';

export const getBookings = async (req: Request, res: Response) => {
  try {
    const { 
      status, 
      carrierId, 
      routeId, 
      startDate, 
      endDate, 
      billable,
      page = 1, 
      limit = 20 
    } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    
    // Build filter
    const where: Prisma.BookingWhereInput = {};
    if (status) where.status = status as BookingStatus;
    if (carrierId) where.carrierId = parseInt(carrierId as string);
    if (routeId) where.routeId = parseInt(routeId as string);
    if (billable !== undefined) where.billable = billable === 'true';
    
    // Date range filter
    if (startDate || endDate) {
      where.bookingDate = {};
      if (startDate) where.bookingDate.gte = new Date(startDate as string);
      if (endDate) where.bookingDate.lte = new Date(endDate as string);
    }

    // Get total count
    const total = await prisma.booking.count({ where });

    // Get bookings with pagination
    const bookings = await prisma.booking.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { bookingDate: 'desc' },
      include: {
        carrier: true,
        route: true,
        invoice: true,
        childBookings: {
          include: {
            route: true
          }
        },
        parentBooking: true
      }
    });

    return res.json({
      bookings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    return res.status(500).json({ message: 'Failed to fetch bookings' });
  }
};

export const getBookingById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: {
        carrier: {
          include: {
            documents: true
          }
        },
        route: true,
        invoice: true,
        lineItems: {
          include: {
            creator: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        childBookings: {
          include: {
            route: true
          }
        },
        parentBooking: true
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    return res.json(booking);
  } catch (error) {
    console.error('Get booking by id error:', error);
    return res.status(500).json({ message: 'Failed to fetch booking' });
  }
};

export const createBooking = async (req: Request, res: Response) => {
  try {
    // Handle both single booking and array of bookings
    const isArray = Array.isArray(req.body);
    const bookingsData = isArray ? req.body : [req.body];
    const createdBookings = [];

    for (const bookingData of bookingsData) {
      const { 
        carrierId, 
        routeId, 
        bookingDate, 
        rate, 
        notes, 
        billable = false, 
        status = 'PENDING',
        driverName,
        phoneNumber,
        carrierEmail,
        carrierReportTime,
        type = 'POWER_ONLY',
        trailerLength,
        bookingGroupId,
        legNumber = 1,
        isParent = true,
        parentBookingId,
        rateType = 'FLAT_RATE',
        baseRate,
        fscRate,
        // Origin-destination booking fields
        origin,
        destination,
        estimatedMiles,
        manifestNumber,
        // Route information fields
        routeName,
        routeFrequency,
        routeStandardRate,
        routeRunTime,
        // Origin details
        originAddress,
        originCity,
        originState,
        originZipCode,
        originContact,
        originTimeZone,
        originLatitude,
        originLongitude,
        // Destination details
        destinationAddress,
        destinationCity,
        destinationState,
        destinationZipCode,
        destinationContact,
        destinationTimeZone,
        destinationLatitude,
        destinationLongitude,
        // Time fields
        departureTime,
        arrivalTime,
        // Multi-leg time arrays
        legDepartureTimes,
        legArrivalTimes
      } = bookingData;

      // Check if carrier exists and is active (only if carrierId is provided)
      if (carrierId) {
        const carrier = await prisma.carrier.findUnique({
          where: { id: parseInt(carrierId) }
        });

        if (!carrier) {
          return res.status(404).json({ message: 'Carrier not found' });
        }

        if (carrier.status !== 'ACTIVE') {
          return res.status(400).json({ message: 'Carrier is not active' });
        }

        // Check insurance expiration
        if (carrier.insuranceExpiration) {
          const today = new Date();
          const expirationDate = new Date(carrier.insuranceExpiration);
          
          if (expirationDate < today) {
            return res.status(400).json({ 
              message: 'Carrier insurance has expired. Please update insurance information before booking.',
              carrierName: carrier.name,
              expirationDate: carrier.insuranceExpiration
            });
          }
          
          // Warn if insurance expires within 30 days
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(today.getDate() + 30);
          
          if (expirationDate < thirtyDaysFromNow) {
            console.warn(`Warning: Carrier ${carrier.name} insurance expires on ${carrier.insuranceExpiration}`);
          }
        }
      }

      // Check if route exists (only if routeId is provided)
      let route = null;
      if (routeId) {
        route = await prisma.route.findUnique({
          where: { id: parseInt(routeId) }
        });

        if (!route) {
          return res.status(404).json({ message: 'Route not found' });
        }
      } else {
        // For origin-destination bookings, validate that we have origin and destination
        if (!origin || !destination) {
          return res.status(400).json({ message: 'Origin and destination are required for non-route bookings' });
        }
      }

      // Create the booking
      const booking = await prisma.booking.create({
        data: {
          carrierId: carrierId ? parseInt(carrierId) : undefined,
          routeId: routeId ? parseInt(routeId) : undefined,
          bookingDate: new Date(bookingDate + 'T12:00:00'),
          rate: parseFloat(rate),
          notes,
          status: status as any,
          billable,
          bookingGroupId,
          legNumber,
          isParent,
          parentBookingId: parentBookingId ? parseInt(parentBookingId) : undefined,
          rateType: rateType as any,
          baseRate: baseRate ? parseFloat(baseRate) : undefined,
          fscRate: fscRate ? parseFloat(fscRate) : undefined,
          driverName: driverName || undefined,
          phoneNumber: phoneNumber || undefined,
          carrierEmail: carrierEmail || undefined,
          carrierReportTime: carrierReportTime || undefined,
          type: type as any,
          trailerLength: trailerLength ? parseInt(trailerLength) : undefined,
          // Origin-destination booking fields
          origin: origin || undefined,
          destination: destination || undefined,
          estimatedMiles: estimatedMiles ? parseFloat(estimatedMiles) : undefined,
          manifestNumber: manifestNumber || undefined,
          // Route information fields
          routeName: routeName || undefined,
          routeFrequency: routeFrequency || undefined,
          routeStandardRate: routeStandardRate ? parseFloat(routeStandardRate) : undefined,
          routeRunTime: routeRunTime ? parseInt(routeRunTime) : undefined,
          // Origin details
          originAddress: originAddress || undefined,
          originCity: originCity || undefined,
          originState: originState || undefined,
          originZipCode: originZipCode || undefined,
          originContact: originContact || undefined,
          originTimeZone: originTimeZone || undefined,
          originLatitude: originLatitude ? parseFloat(originLatitude) : undefined,
          originLongitude: originLongitude ? parseFloat(originLongitude) : undefined,
          // Destination details
          destinationAddress: destinationAddress || undefined,
          destinationCity: destinationCity || undefined,
          destinationState: destinationState || undefined,
          destinationZipCode: destinationZipCode || undefined,
          destinationContact: destinationContact || undefined,
          destinationTimeZone: destinationTimeZone || undefined,
          destinationLatitude: destinationLatitude ? parseFloat(destinationLatitude) : undefined,
          destinationLongitude: destinationLongitude ? parseFloat(destinationLongitude) : undefined,
          // Time fields
          departureTime: departureTime || undefined,
          arrivalTime: arrivalTime || undefined,
          // Multi-leg time arrays
          legDepartureTimes: legDepartureTimes || undefined,
          legArrivalTimes: legArrivalTimes || undefined
        },
        include: {
          carrier: true,
          route: true,
          childBookings: true,
          parentBooking: true
        }
      });

      createdBookings.push(booking);
    }

    // Return single booking or array based on input
    const result = isArray ? createdBookings : createdBookings[0];
    return res.status(201).json(result);
  } catch (error) {
    console.error('Create booking error:', error);
    console.error('Request body:', req.body);
    return res.status(500).json({ 
      message: 'Failed to create booking', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const updateBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log('Updating booking ID:', id);
    console.log('Update data received:', JSON.stringify(updateData, null, 2));

    // Sanitize data - convert empty strings to undefined for optional fields
    const sanitizeValue = (value: any) => {
      if (value === '' || value === null) return undefined;
      return value;
    };

    const booking = await prisma.booking.update({
      where: { id: parseInt(id) },
      data: {
        bookingDate: updateData.bookingDate ? (() => {
          const date = new Date(updateData.bookingDate);
          if (isNaN(date.getTime())) {
            throw new Error(`Invalid booking date: ${updateData.bookingDate}`);
          }
          return date;
        })() : undefined,
        rate: updateData.rate ? parseFloat(updateData.rate) : undefined,
        billable: updateData.billable,
        notes: updateData.notes,
        status: updateData.status,
        carrierId: updateData.carrierId !== undefined ? (updateData.carrierId ? parseInt(updateData.carrierId) : undefined) : undefined,
        rateType: updateData.rateType || undefined,
        baseRate: updateData.baseRate ? parseFloat(updateData.baseRate) : undefined,
        fscRate: updateData.fscRate ? parseFloat(updateData.fscRate) : undefined,
        driverName: updateData.driverName || undefined,
        phoneNumber: updateData.phoneNumber || undefined,
        carrierEmail: updateData.carrierEmail || undefined,
        carrierReportTime: updateData.carrierReportTime || undefined,
        type: updateData.type || undefined,
        trailerLength: updateData.trailerLength ? parseInt(updateData.trailerLength) : undefined,
        // Origin-destination booking fields
        origin: sanitizeValue(updateData.origin),
        destination: sanitizeValue(updateData.destination),
        estimatedMiles: updateData.estimatedMiles ? parseFloat(updateData.estimatedMiles) : undefined,
        // Route information fields
        routeFrequency: sanitizeValue(updateData.routeFrequency),
        routeStandardRate: updateData.routeStandardRate ? parseFloat(updateData.routeStandardRate) : undefined,
        routeRunTime: updateData.routeRunTime ? parseInt(updateData.routeRunTime) : undefined,
        // Origin details
        originAddress: sanitizeValue(updateData.originAddress),
        originCity: sanitizeValue(updateData.originCity),
        originState: sanitizeValue(updateData.originState),
        originZipCode: sanitizeValue(updateData.originZipCode),
        originContact: sanitizeValue(updateData.originContact),
        // Destination details
        destinationAddress: sanitizeValue(updateData.destinationAddress),
        destinationCity: sanitizeValue(updateData.destinationCity),
        destinationState: sanitizeValue(updateData.destinationState),
        destinationZipCode: sanitizeValue(updateData.destinationZipCode),
        destinationContact: sanitizeValue(updateData.destinationContact),
        // Time fields
        departureTime: sanitizeValue(updateData.departureTime),
        arrivalTime: sanitizeValue(updateData.arrivalTime)
      },
      include: {
        carrier: true,
        route: true,
        lineItems: true
      }
    });

    return res.json(booking);
  } catch (error) {
    console.error('Update booking error:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return res.status(500).json({ 
      message: 'Failed to update booking',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const confirmBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: {
        carrier: true,
        route: true
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status !== 'PENDING') {
      return res.status(400).json({ message: 'Booking cannot be confirmed in current status' });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: parseInt(id) },
      data: { status: 'CONFIRMED' },
      include: {
        carrier: true,
        route: true
      }
    });

    // Send confirmation notification
    await NotificationService.sendBookingConfirmation(updatedBooking);

    return res.json(updatedBooking);
  } catch (error) {
    console.error('Confirm booking error:', error);
    return res.status(500).json({ message: 'Failed to confirm booking' });
  }
};

export const completeBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (!['CONFIRMED', 'IN_PROGRESS'].includes(booking.status)) {
      return res.status(400).json({ message: 'Booking cannot be completed in current status' });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: parseInt(id) },
      data: { 
        status: 'COMPLETED',
        billable: true
      },
      include: {
        carrier: true,
        route: true
      }
    });

    return res.json(updatedBooking);
  } catch (error) {
    console.error('Complete booking error:', error);
    return res.status(500).json({ message: 'Failed to complete booking' });
  }
};

export const cancelBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: {
        carrier: true,
        route: true
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      return res.status(400).json({ message: 'Booking cannot be cancelled in current status' });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: parseInt(id) },
      data: { 
        status: 'CANCELLED',
        notes: reason ? `${booking.notes || ''}\nCancellation reason: ${reason}` : booking.notes
      },
      include: {
        carrier: true,
        route: true
      }
    });

    // Send cancellation notification
    await NotificationService.sendBookingCancellation(updatedBooking, reason);

    return res.json(updatedBooking);
  } catch (error) {
    console.error('Cancel booking error:', error);
    return res.status(500).json({ message: 'Failed to cancel booking' });
  }
};

export const deleteBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: {
        carrier: true,
        route: true,
        invoice: true
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if booking has an invoice - prevent deletion if invoiced
    if (booking.invoice) {
      return res.status(400).json({ message: 'Cannot delete booking that has an associated invoice' });
    }

    await prisma.booking.delete({
      where: { id: parseInt(id) }
    });

    return res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Delete booking error:', error);
    return res.status(500).json({ message: 'Failed to delete booking' });
  }
};

// Configure multer for file upload
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
}).single('pdf');

// Send rate confirmation email
export const sendRateConfirmation = async (req: Request, res: Response) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error('File upload error:', err);
      return res.status(400).json({ message: 'File upload failed' });
    }

    try {
      const { id } = req.params;
      const { email, sendMethod = 'email' } = req.body;
      const pdfBuffer = req.file?.buffer;

      if (!pdfBuffer) {
        return res.status(400).json({ message: 'PDF file is required' });
      }

      const booking = await prisma.booking.findUnique({
        where: { id: parseInt(id) },
        include: {
          carrier: true,
          route: true,
          lineItems: true,
          childBookings: {
            include: {
              route: true
            }
          }
        }
      });

      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      // Generate unique confirmation token
      const confirmationToken = uuidv4();

      // Update booking with confirmation details
      await prisma.booking.update({
        where: { id: parseInt(id) },
        data: {
          confirmationToken,
          confirmationSentAt: new Date(),
          confirmationSentVia: sendMethod,
          carrierEmail: email || booking.carrierEmail
        }
      });

      // Validate email configuration
      const recipientEmail = email || booking.carrierEmail || booking.carrier?.email || '';
      if (!recipientEmail) {
        return res.status(400).json({ message: 'No recipient email address available' });
      }

      // Check if email is configured
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || 
          process.env.EMAIL_USER === 'your-email@gmail.com' || 
          process.env.EMAIL_PASS === 'your-gmail-app-password-here') {
        console.warn('Email not configured - skipping email send');
        // Still create the confirmation token and URL for testing
        const confirmationUrl = `${process.env.FRONTEND_URL}/confirm/${confirmationToken}`;
        return res.json({ 
          message: 'Rate confirmation created successfully (email not configured)',
          confirmationToken,
          confirmationUrl,
          warning: 'Email sending is not configured. Please set EMAIL_USER and EMAIL_PASS environment variables.'
        });
      }

      // Send email with PDF attachment
      const confirmationUrl = `${process.env.FRONTEND_URL}/confirm/${confirmationToken}`;
      
      if (sendMethod === 'email') {
        await NotificationService.sendRateConfirmationEmail(
          booking,
          recipientEmail,
          pdfBuffer,
          confirmationUrl
        );
      } else if (sendMethod === 'sms') {
        // TODO: Implement SMS sending
        return res.status(501).json({ message: 'SMS functionality not yet implemented' });
      }

      return res.json({ 
        message: 'Rate confirmation sent successfully',
        confirmationToken,
        confirmationUrl
      });
    } catch (error) {
      console.error('Send rate confirmation error:', error);
      return res.status(500).json({ message: 'Failed to send rate confirmation' });
    }
  });
};

// Get confirmation details by token (public endpoint)
export const getConfirmationByToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const booking = await prisma.booking.findFirst({
      where: { confirmationToken: token },
      include: {
        carrier: true,
        route: true,
        lineItems: true,
        childBookings: {
          include: {
            route: true
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Confirmation not found' });
    }

    // Check if already signed
    if (booking.confirmationSignedAt) {
      return res.status(400).json({ 
        message: 'This confirmation has already been signed',
        signedAt: booking.confirmationSignedAt,
        signedBy: booking.confirmationSignedBy
      });
    }

    return res.json({
      booking: {
        id: booking.id,
        bookingDate: booking.bookingDate,
        rate: booking.rate,
        carrier: booking.carrier,
        route: booking.route,
        childBookings: booking.childBookings,
        type: booking.type,
        trailerLength: booking.trailerLength,
        driverName: booking.driverName,
        phoneNumber: booking.phoneNumber,
        notes: booking.notes
      }
    });
  } catch (error) {
    console.error('Get confirmation error:', error);
    return res.status(500).json({ message: 'Failed to get confirmation details' });
  }
};

// Submit signed confirmation (public endpoint)
export const submitSignedConfirmation = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { signedBy, signature, approved } = req.body;

    if (!signedBy) {
      return res.status(400).json({ message: 'Signer name is required' });
    }

    const booking = await prisma.booking.findFirst({
      where: { confirmationToken: token },
      include: {
        carrier: true,
        route: true,
        lineItems: true,
        childBookings: {
          include: {
            route: true
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Confirmation not found' });
    }

    if (booking.confirmationSignedAt) {
      return res.status(400).json({ message: 'This confirmation has already been signed' });
    }

    // Get client IP address
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const signedAt = new Date();

    let signedPdfPath = null;

    // Generate signed PDF if approved
    if (approved) {
      try {
        console.log('Generating signed PDF for booking:', booking.id);
        signedPdfPath = await PDFService.generateSignedRateConfirmationPDF(
          booking,
          signedBy,
          signedAt
        );
        console.log('Signed PDF generated at:', signedPdfPath);
      } catch (pdfError) {
        console.error('Error generating signed PDF:', pdfError);
        // Continue with the signature process even if PDF generation fails
      }
    }

    // Generate document upload token for approved confirmations
    let documentUploadToken = null;
    if (approved) {
      documentUploadToken = uuidv4();
    }

    // Update booking with signature details
    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        confirmationSignedAt: signedAt,
        confirmationSignedBy: signedBy,
        confirmationIpAddress: ipAddress,
        confirmationSignature: approved ? 'APPROVED' : (signature || 'REJECTED'),
        status: approved ? 'CONFIRMED' : booking.status,
        signedPdfPath: signedPdfPath,
        documentUploadToken: approved ? documentUploadToken : null,
        documentUploadTokenCreatedAt: approved ? signedAt : null
      },
      include: {
        carrier: true,
        route: true,
        childBookings: {
          include: {
            route: true
          }
        }
      }
    });

    // Send thank you email if approved
    if (approved && updatedBooking.carrier) {
      try {
        const recipientEmail = booking.carrierEmail || updatedBooking.carrier.email;
        if (recipientEmail) {
          await NotificationService.sendRateConfirmationSubmittedEmail(
            updatedBooking,
            recipientEmail,
            documentUploadToken!
          );
        }
      } catch (emailError) {
        console.error('Failed to send thank you email:', emailError);
        // Continue even if email fails
      }
    }

    return res.json({ 
      message: approved ? 'Confirmation approved successfully' : 'Confirmation rejected',
      booking: updatedBooking,
      signedPdf: signedPdfPath ? true : false,
      documentUploadUrl: approved ? `${process.env.API_BASE_URL || 'http://localhost:3001'}/api/bookings/documents/upload/${documentUploadToken}` : null
    });
  } catch (error) {
    console.error('Submit confirmation error:', error);
    return res.status(500).json({ message: 'Failed to submit confirmation' });
  }
};

// Serve signed PDF file
export const getSignedPDF = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      select: { signedPdfPath: true }
    });

    if (!booking || !booking.signedPdfPath) {
      return res.status(404).json({ message: 'Signed PDF not found' });
    }

    const fullPath = PDFService.getSignedPDFPath(booking.signedPdfPath);
    
    if (!PDFService.signedPDFExists(booking.signedPdfPath)) {
      return res.status(404).json({ message: 'PDF file not found on disk' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    return res.sendFile(fullPath);
  } catch (error) {
    console.error('Get signed PDF error:', error);
    return res.status(500).json({ message: 'Failed to retrieve signed PDF' });
  }
};

// Test email configuration endpoint
export const testEmailConfig = async (_req: Request, res: Response) => {
  try {
    const emailConfigured = process.env.EMAIL_USER && 
                           process.env.EMAIL_PASS &&
                           process.env.EMAIL_USER !== 'your-email@gmail.com' &&
                           process.env.EMAIL_PASS !== 'your-gmail-app-password-here';
    
    if (!emailConfigured) {
      return res.json({
        configured: false,
        message: 'Email is not configured',
        instructions: 'Please set EMAIL_USER and EMAIL_PASS environment variables in your .env file'
      });
    }

    return res.json({
      configured: true,
      message: 'Email configuration appears to be set up',
      emailUser: process.env.EMAIL_USER,
      emailHost: process.env.EMAIL_HOST || 'smtp.gmail.com',
      emailPort: process.env.EMAIL_PORT || '587',
      testEmailOverride: process.env.TEST_EMAIL_OVERRIDE || null,
      testModeActive: !!process.env.TEST_EMAIL_OVERRIDE
    });
  } catch (error) {
    console.error('Test email config error:', error);
    return res.status(500).json({ message: 'Failed to test email configuration' });
  }
};

// Get document upload page (public endpoint)
export const getDocumentUploadPage = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const booking = await prisma.booking.findFirst({
      where: { documentUploadToken: token },
      include: {
        carrier: true,
        route: true
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Upload link not found or expired' });
    }

    // Check if token is expired (24 hours)
    if (booking.documentUploadTokenCreatedAt) {
      const tokenAge = Date.now() - booking.documentUploadTokenCreatedAt.getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (tokenAge > twentyFourHours) {
        return res.status(410).json({ message: 'Upload link has expired' });
      }
    }

    const shipmentNumber = `CCFS${booking.id.toString().padStart(5, '0')}`;

    return res.json({
      shipmentNumber,
      carrierName: booking.carrier?.name || 'Unknown Carrier',
      route: booking.route 
        ? `${booking.route.origin} to ${booking.route.destination}`
        : `${booking.origin} to ${booking.destination}`,
      bookingDate: booking.bookingDate,
      documents: []
    });
  } catch (error) {
    console.error('Document upload page error:', error);
    return res.status(500).json({ message: 'Failed to load upload page' });
  }
};

// Upload documents for booking (public endpoint)
export const uploadBookingDocuments = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { documentType, uploadedBy } = req.body;

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const booking = await prisma.booking.findFirst({
      where: { documentUploadToken: token }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Upload link not found or expired' });
    }

    // Check if token is expired (24 hours)
    if (booking.documentUploadTokenCreatedAt) {
      const tokenAge = Date.now() - booking.documentUploadTokenCreatedAt.getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (tokenAge > twentyFourHours) {
        return res.status(410).json({ message: 'Upload link has expired' });
      }
    }

    const uploadedDocuments = [];

    for (const file of req.files as Express.Multer.File[]) {
      const document = await prisma.bookingDocument.create({
        data: {
          bookingId: booking.id,
          documentType: documentType || 'other',
          filename: file.originalname,
          filePath: file.path,
          uploadedBy: uploadedBy || 'Carrier'
        }
      });
      uploadedDocuments.push(document);
    }

    return res.json({
      message: `Successfully uploaded ${uploadedDocuments.length} document(s)`,
      documents: uploadedDocuments.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        documentType: doc.documentType,
        uploadedAt: doc.uploadedAt
      }))
    });
  } catch (error) {
    console.error('Document upload error:', error);
    return res.status(500).json({ message: 'Failed to upload documents' });
  }
};