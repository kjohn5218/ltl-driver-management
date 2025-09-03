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

    res.json({
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
    res.status(500).json({ message: 'Failed to fetch bookings' });
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
        invoice: true
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Get booking by id error:', error);
    res.status(500).json({ message: 'Failed to fetch booking' });
  }
};

export const createBooking = async (req: Request, res: Response) => {
  try {
    const { carrierId, routeId, bookingDate, rate, notes } = req.body;

    // Check if carrier exists and is active
    const carrier = await prisma.carrier.findUnique({
      where: { id: parseInt(carrierId) }
    });

    if (!carrier) {
      return res.status(404).json({ message: 'Carrier not found' });
    }

    if (carrier.status !== 'ACTIVE') {
      return res.status(400).json({ message: 'Carrier is not active' });
    }

    // Check if route exists
    const route = await prisma.route.findUnique({
      where: { id: parseInt(routeId) }
    });

    if (!route) {
      return res.status(404).json({ message: 'Route not found' });
    }

    // Check for existing booking on same date
    const existingBooking = await prisma.booking.findFirst({
      where: {
        carrierId: parseInt(carrierId),
        routeId: parseInt(routeId),
        bookingDate: new Date(bookingDate),
        status: {
          notIn: ['CANCELLED']
        }
      }
    });

    if (existingBooking) {
      return res.status(409).json({ message: 'Booking already exists for this carrier, route, and date' });
    }

    const booking = await prisma.booking.create({
      data: {
        carrierId: parseInt(carrierId),
        routeId: parseInt(routeId),
        bookingDate: new Date(bookingDate),
        rate: parseFloat(rate),
        notes,
        status: 'PENDING'
      },
      include: {
        carrier: true,
        route: true
      }
    });

    res.status(201).json(booking);
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ message: 'Failed to create booking' });
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
        notes: updateData.notes
      },
      include: {
        carrier: true,
        route: true
      }
    });

    res.json(booking);
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ message: 'Failed to update booking' });
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

    res.json(updatedBooking);
  } catch (error) {
    console.error('Confirm booking error:', error);
    res.status(500).json({ message: 'Failed to confirm booking' });
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

    res.json(updatedBooking);
  } catch (error) {
    console.error('Complete booking error:', error);
    res.status(500).json({ message: 'Failed to complete booking' });
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

    res.json(updatedBooking);
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ message: 'Failed to cancel booking' });
  }
};