import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma, BookingStatus } from '@prisma/client';
import { sendBookingConfirmation, sendBookingCancellation } from '../services/notification.service';

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
        invoice: true
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
      type = 'POWER_ONLY',
      trailerLength,
      bookingGroupId,
      legNumber = 1,
      isParent = true,
      parentBookingId,
      rateType = 'FLAT_RATE',
      baseRate,
      fscRate
    } = req.body;

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
    }

    // Check if route exists
    const route = await prisma.route.findUnique({
      where: { id: parseInt(routeId) }
    });

    if (!route) {
      return res.status(404).json({ message: 'Route not found' });
    }

    // Allow multiple bookings for the same carrier, route, and date
    // This supports scenarios where a carrier might make multiple trips on the same route in a day

    const booking = await prisma.booking.create({
      data: {
        carrierId: carrierId ? parseInt(carrierId) : undefined,
        routeId: parseInt(routeId),
        bookingDate: new Date(bookingDate),
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
        type: type as any,
        trailerLength: trailerLength ? parseInt(trailerLength) : undefined
      },
      include: {
        carrier: true,
        route: true,
        childBookings: true,
        parentBooking: true
      }
    });

    return res.status(201).json(booking);
  } catch (error) {
    console.error('Create booking error:', error);
    return res.status(500).json({ message: 'Failed to create booking' });
  }
};

export const updateBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const booking = await prisma.booking.update({
      where: { id: parseInt(id) },
      data: {
        bookingDate: updateData.bookingDate ? new Date(updateData.bookingDate) : undefined,
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
        type: updateData.type || undefined,
        trailerLength: updateData.trailerLength ? parseInt(updateData.trailerLength) : undefined
      },
      include: {
        carrier: true,
        route: true
      }
    });

    return res.json(booking);
  } catch (error) {
    console.error('Update booking error:', error);
    return res.status(500).json({ message: 'Failed to update booking' });
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
    await sendBookingConfirmation(updatedBooking);

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
    await sendBookingCancellation(updatedBooking, reason);

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