import { Request, Response } from 'express';
import { prisma } from '../index';

export const getDashboardMetrics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.bookingDate = {};
      if (startDate) dateFilter.bookingDate.gte = new Date(startDate as string);
      if (endDate) dateFilter.bookingDate.lte = new Date(endDate as string);
    }

    // Build current month filter for monthly expenses
    const currentMonth = new Date();
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const monthFilter = {
      bookingDate: {
        gte: monthStart,
        lte: monthEnd
      }
    };

    // Get metrics - focusing on expenses rather than revenue
    const [
      totalCarriers,
      activeCarriers,
      totalRoutes,
      totalBookings,
      completedBookings,
      pendingInvoices,
      totalExpenses,
      monthlyExpenses,
      unbookedRoutes,
      bookedRoutes,
      pendingRateConfirmations
    ] = await Promise.all([
      prisma.carrier.count(),
      prisma.carrier.count({ where: { status: 'ACTIVE' } }),
      prisma.route.count(),
      prisma.booking.count({ where: dateFilter }),
      prisma.booking.count({ where: { ...dateFilter, status: 'COMPLETED' } }),
      prisma.invoice.count({ where: { status: 'PENDING' } }),
      // Calculate total expenses from completed bookings
      prisma.booking.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { rate: true }
      }),
      // Calculate monthly expenses from completed bookings
      prisma.booking.aggregate({
        where: { ...monthFilter, status: 'COMPLETED' },
        _sum: { rate: true }
      }),
      // Count unbooked routes (PENDING status bookings)
      prisma.booking.count({ where: { status: 'PENDING' } }),
      // Count booked routes (CONFIRMED status bookings)
      prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      // Count pending rate confirmations (not CANCELLED/COMPLETED and either not sent or not signed)
      prisma.booking.count({ 
        where: { 
          status: { notIn: ['CANCELLED', 'COMPLETED'] },
          OR: [
            { confirmationSentAt: null },
            { confirmationSignedAt: null }
          ]
        } 
      })
    ]);

    // Get recent activities (carrier bookings)
    const recentBookings = await prisma.booking.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        carrier: true,
        route: true
      }
    });

    return res.json({
      metrics: {
        totalCarriers,
        activeCarriers,
        totalRoutes,
        totalBookings,
        completedBookings,
        pendingInvoices,
        totalExpenses: totalExpenses._sum.rate || 0,
        monthlyExpenses: monthlyExpenses._sum.rate || 0,
        unbookedRoutes,
        bookedRoutes,
        pendingRateConfirmations
      },
      recentActivities: recentBookings
    });
  } catch (error) {
    console.error('Get dashboard metrics error:', error);
    return res.status(500).json({ message: 'Failed to fetch dashboard metrics' });
  }
};

export const getCarrierPerformance = async (req: Request, res: Response) => {
  try {
    const { carrierId, startDate, endDate } = req.query;
    
    // Build filters
    const bookingFilter: any = {};
    if (carrierId) bookingFilter.carrierId = parseInt(carrierId as string);
    if (startDate || endDate) {
      bookingFilter.bookingDate = {};
      if (startDate) bookingFilter.bookingDate.gte = new Date(startDate as string);
      if (endDate) bookingFilter.bookingDate.lte = new Date(endDate as string);
    }

    // Get carrier performance data
    const carrierStats = await prisma.booking.groupBy({
      by: ['carrierId'],
      where: bookingFilter,
      _count: {
        id: true
      },
      _sum: {
        rate: true
      }
    });

    // Get carrier details - filter out null carrier IDs
    const carrierIds = carrierStats.map(stat => stat.carrierId).filter((id): id is number => id !== null);
    const carriers = await prisma.carrier.findMany({
      where: { id: { in: carrierIds } },
      include: {
        bookings: {
          where: bookingFilter,
          include: { route: true }
        }
      }
    });

    // Calculate performance metrics
    const performance = carriers.map(carrier => {
      const stats = carrierStats.find(s => s.carrierId === carrier.id);
      const completedBookings = carrier.bookings.filter((b: any) => b.status === 'COMPLETED').length;
      const cancelledBookings = carrier.bookings.filter((b: any) => b.status === 'CANCELLED').length;
      
      return {
        carrier: {
          id: carrier.id,
          name: carrier.name,
          rating: carrier.rating
        },
        metrics: {
          totalBookings: stats?._count.id || 0,
          completedBookings,
          cancelledBookings,
          completionRate: stats?._count.id ? (completedBookings / stats._count.id) * 100 : 0,
          totalRevenue: stats?._sum.rate || 0
        }
      };
    });

    return res.json(performance);
  } catch (error) {
    console.error('Get carrier performance error:', error);
    return res.status(500).json({ message: 'Failed to fetch carrier performance' });
  }
};

export const getRouteAnalytics = async (req: Request, res: Response) => {
  try {
    const { routeId, startDate, endDate } = req.query;
    
    // Build filters
    const bookingFilter: any = {};
    if (routeId) bookingFilter.routeId = parseInt(routeId as string);
    if (startDate || endDate) {
      bookingFilter.bookingDate = {};
      if (startDate) bookingFilter.bookingDate.gte = new Date(startDate as string);
      if (endDate) bookingFilter.bookingDate.lte = new Date(endDate as string);
    }

    // Get route statistics
    const routeStats = await prisma.booking.groupBy({
      by: ['routeId'],
      where: bookingFilter,
      _count: {
        id: true
      },
      _sum: {
        rate: true
      },
      _avg: {
        rate: true
      }
    });

    // Get route details
    const routeIds = routeStats.map(stat => stat.routeId).filter((id): id is number => id !== null);
    const routes = await prisma.route.findMany({
      where: { id: { in: routeIds } },
      include: {
        bookings: {
          where: bookingFilter,
          include: { carrier: true }
        }
      }
    });

    // Calculate analytics
    const analytics = routes.map(route => {
      const stats = routeStats.find(s => s.routeId === route.id);
      const routeWithBookings = route as any;
      const uniqueCarriers = new Set(routeWithBookings.bookings.map((b: any) => b.carrierId)).size;
      
      return {
        route: {
          id: route.id,
          name: route.name,
          origin: route.origin,
          destination: route.destination,
          distance: route.distance,
          standardRate: route.standardRate
        },
        analytics: {
          totalBookings: stats?._count.id || 0,
          totalRevenue: stats?._sum.rate || 0,
          averageRate: stats?._avg.rate || 0,
          uniqueCarriers,
          profitMargin: route.standardRate 
            ? ((Number(stats?._avg.rate) || 0) - parseFloat(route.standardRate.toString())) / parseFloat(route.standardRate.toString()) * 100 
            : 0
        }
      };
    });

    return res.json(analytics);
  } catch (error) {
    console.error('Get route analytics error:', error);
    return res.status(500).json({ message: 'Failed to fetch route analytics' });
  }
};

export const exportData = async (req: Request, res: Response) => {
  try {
    const { type, format, startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = new Date(startDate as string);
      if (endDate) dateFilter.createdAt.lte = new Date(endDate as string);
    }

    let data: any;
    
    switch (type) {
      case 'carriers':
        data = await prisma.carrier.findMany({ where: dateFilter });
        break;
      case 'routes':
        data = await prisma.route.findMany({ where: dateFilter });
        break;
      case 'bookings':
        data = await prisma.booking.findMany({
          where: dateFilter,
          include: { carrier: true, route: true }
        });
        break;
      case 'invoices':
        data = await prisma.invoice.findMany({
          where: dateFilter,
          include: { booking: { include: { carrier: true, route: true } } }
        });
        break;
      default:
        return res.status(400).json({ message: 'Invalid export type' });
    }

    if (format === 'csv') {
      // TODO: Implement CSV conversion
      return res.status(501).json({ message: 'CSV export not implemented yet' });
    } else {
      return res.json(data);
    }
  } catch (error) {
    console.error('Export data error:', error);
    return res.status(500).json({ message: 'Failed to export data' });
  }
};