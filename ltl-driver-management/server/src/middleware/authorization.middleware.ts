import { Request, Response, NextFunction } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

// Extended request with user
interface AuthRequest extends Request {
  user?: any;
}

// Resource ownership verification
export const checkResourceOwnership = (resourceType: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const resourceId = parseInt(req.params.id || req.params[resourceType + 'Id']);
      if (!resourceId) {
        return res.status(400).json({ error: 'Invalid resource ID' });
      }

      // Admin users can access all resources
      if (user.role === UserRole.ADMIN) {
        return next();
      }

      let hasAccess = false;

      switch (resourceType) {
        case 'booking':
          const booking = await prisma.booking.findUnique({
            where: { id: resourceId },
            select: { 
              id: true,
              carrierId: true
            }
          });

          if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
          }

          // Check if user is a carrier associated with this booking
          if (user.role === UserRole.CARRIER && booking.carrierId) {
            const carrier = await prisma.carrier.findFirst({
              where: { 
                id: booking.carrierId,
                email: user.email
              }
            });
            hasAccess = !!carrier;
          } else {
            hasAccess = user.role === UserRole.DISPATCHER;
          }
          break;

        case 'carrier':
          const carrier = await prisma.carrier.findUnique({
            where: { id: resourceId },
            select: { 
              id: true,
              email: true 
            }
          });

          if (!carrier) {
            return res.status(404).json({ error: 'Carrier not found' });
          }

          // Check if user owns the carrier profile (by email match)
          hasAccess = carrier.email === user.email || user.role === UserRole.DISPATCHER;
          break;

        case 'invoice':
          const invoice = await prisma.invoice.findUnique({
            where: { id: resourceId },
            select: {
              id: true,
              bookingId: true
            }
          });

          if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
          }

          // Check through booking relationship
          const invoiceBooking = await prisma.booking.findUnique({
            where: { id: invoice.bookingId },
            select: { carrierId: true }
          });

          if (user.role === UserRole.CARRIER && invoiceBooking?.carrierId) {
            const invoiceCarrier = await prisma.carrier.findFirst({
              where: { 
                id: invoiceBooking.carrierId,
                email: user.email
              }
            });
            hasAccess = !!invoiceCarrier;
          } else {
            hasAccess = user.role === UserRole.DISPATCHER;
          }
          break;

        case 'driver':
          const driver = await prisma.carrierDriver.findUnique({
            where: { id: resourceId },
            select: {
              id: true,
              carrierId: true
            }
          });

          if (!driver) {
            return res.status(404).json({ error: 'Driver not found' });
          }

          // Check if user owns the carrier that owns the driver
          const driverCarrier = await prisma.carrier.findFirst({
            where: { 
              id: driver.carrierId,
              email: user.email
            }
          });
          hasAccess = !!driverCarrier || user.role === UserRole.DISPATCHER;
          break;

        case 'user':
          // Users can only access their own profile unless admin/dispatcher
          hasAccess = resourceId === user.id || user.role === UserRole.DISPATCHER;
          break;

        default:
          return res.status(400).json({ error: 'Invalid resource type' });
      }

      if (!hasAccess) {
        // Log unauthorized access attempt
        console.warn(`[SECURITY] Unauthorized access attempt by user ${user.id} to ${resourceType} ${resourceId}`);
        return res.status(403).json({ error: 'Access denied' });
      }

      next();
    } catch (error) {
      console.error(`[SECURITY] Error checking ownership for ${resourceType}:`, error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Check if user can access a specific carrier's resources
export const checkCarrierAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const carrierId = parseInt(req.params.carrierId || req.params.id);
    if (!carrierId) {
      return res.status(400).json({ error: 'Invalid carrier ID' });
    }

    // Admin and dispatcher can access all carriers
    if ([UserRole.ADMIN, UserRole.DISPATCHER].includes(user.role)) {
      return next();
    }

    // Check if user owns the carrier
    const carrier = await prisma.carrier.findUnique({
      where: { id: carrierId },
      select: { 
        id: true,
        email: true 
      }
    });

    if (!carrier) {
      return res.status(404).json({ error: 'Carrier not found' });
    }

    if (carrier.email !== user.email) {
      console.warn(`[SECURITY] Unauthorized carrier access attempt by user ${user.id} to carrier ${carrierId}`);
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  } catch (error) {
    console.error('[SECURITY] Error checking carrier access:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Sanitize response to remove sensitive fields based on user role
export const sanitizeResponse = (allowedFields: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    
    res.json = function(data: any) {
      if (req.user?.role === UserRole.ADMIN) {
        return originalJson(data);
      }

      // Recursively filter object to only include allowed fields
      const sanitize = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(sanitize);
        }
        
        if (obj && typeof obj === 'object' && obj.constructor === Object) {
          const sanitized: any = {};
          
          for (const key of allowedFields) {
            if (key in obj) {
              sanitized[key] = sanitize(obj[key]);
            }
          }
          
          return sanitized;
        }
        
        return obj;
      };

      return originalJson(sanitize(data));
    };
    
    next();
  };
};

// Log sensitive data access
export const logSensitiveAccess = (dataType: string) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    const user = req.user;
    const resourceId = req.params.id;
    
    console.log(`[AUDIT] User ${user?.id} (${user?.email}) accessed ${dataType} ${resourceId} at ${new Date().toISOString()}`);
    
    next();
  };
};