import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';

// Import security middleware
import { 
  authLimiter, 
  passwordResetLimiter, 
  apiLimiter, 
  uploadLimiter 
} from './middleware/rateLimiter.middleware';
import { 
  securityMiddleware, 
  securityHeaders, 
  initializeSecurityTables 
} from './middleware/security.middleware';
import { csrfToken, csrfCookie } from './middleware/csrf.middleware';

// Import routes
import authRoutes from './routes/auth.routes';
import carrierRoutes from './routes/carrier.routes';
import routeRoutes from './routes/route.routes';
import bookingRoutes from './routes/booking.routes';
import invoiceRoutes from './routes/invoice.routes';
import reportRoutes from './routes/report.routes';
import settingsRoutes from './routes/settings.routes';
import locationRoutes from './routes/location.routes';
import userRoutes from './routes/user.routes';
import lineItemRoutes from './routes/lineItem.routes';
import driverRoutes from './routes/driver.routes';
import bookingDocumentRoutes from './routes/bookingDocument.routes';

// Dispatch & Fleet Management routes
import terminalRoutes from './routes/terminal.routes';
import equipmentRoutes from './routes/equipment.routes';
import linehaulProfileRoutes from './routes/linehaulProfile.routes';
import linehaulTripRoutes from './routes/linehaulTrip.routes';
import tripOperationsRoutes from './routes/tripOperations.routes';
import rateCardRoutes, { externalRateCardRouter } from './routes/rateCard.routes';
import payrollRoutes from './routes/payroll.routes';
import loadsheetRoutes from './routes/loadsheet.routes';
import tripDocumentRoutes from './routes/tripDocument.routes';
import lateDepartureReasonRoutes from './routes/lateDepartureReason.routes';
import cutPayRoutes from './routes/cutPay.routes';
import workdayRoutes, { externalWorkdayRouter } from './routes/workday.routes';
import interlineCarrierRoutes from './routes/interlineCarrier.routes';
import expectedShipmentRoutes from './routes/expectedShipment.routes';

// External integrations
import hrIntegrationRoutes from './routes/hrIntegration.routes';

// Public driver routes (no SSO auth required)
import publicDriverRoutes from './routes/publicDriver.routes';

// Load environment variables
dotenv.config();

// Validate critical environment variables
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('[SECURITY] JWT_SECRET must be set and at least 32 characters long');
  process.exit(1);
}

// Initialize Prisma Client
export const prisma = new PrismaClient();

// Create Express app
const app: Application = express();
const PORT = process.env.PORT || 3001;

// Request size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Security headers - must be before other middleware
app.use(securityHeaders);

// Enhanced Helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Remove unsafe-inline in production
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: { policy: "credentialless" },
  crossOriginOpenerPolicy: { policy: "same-origin" }
}));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
    
    // Allow requests with no origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

// Health check endpoint (before other security middleware)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Apply security middleware
app.use(securityMiddleware);

// Apply CSRF protection
app.use(csrfToken);
app.use(csrfCookie);

// Apply rate limiting based on endpoint type
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', passwordResetLimiter);
app.use('/api/auth/reset-password', passwordResetLimiter);
app.use('/api/documents/upload', uploadLimiter);

// Apply general API rate limiting
app.use('/api/', apiLimiter);

// Public driver routes (driver number + phone verification, no SSO/CSRF required)
// IMPORTANT: Must be registered BEFORE authenticated routes
app.use('/api/public/driver', publicDriverRoutes);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/carriers', carrierRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/users', userRoutes);
app.use('/api', lineItemRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/documents', bookingDocumentRoutes);

// Dispatch & Fleet Management routes
app.use('/api/terminals', terminalRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/linehaul-profiles', linehaulProfileRoutes);
app.use('/api/linehaul-trips', linehaulTripRoutes);
app.use('/api/trip-operations', tripOperationsRoutes);
app.use('/api/rate-cards', rateCardRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/loadsheets', loadsheetRoutes);
app.use('/api/trip-documents', tripDocumentRoutes);
app.use('/api/late-departure-reasons', lateDepartureReasonRoutes);
app.use('/api/cut-pay-requests', cutPayRoutes);
app.use('/api/workday', workdayRoutes);
app.use('/api/interline-carriers', interlineCarrierRoutes);
app.use('/api/expected-shipments', expectedShipmentRoutes);

// External integrations (API key authenticated, no CSRF)
app.use('/api/hr', hrIntegrationRoutes);
app.use('/api/external/rate-cards', externalRateCardRouter);
app.use('/api/external/workday', externalWorkdayRouter);

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Initialize security tables
    await initializeSecurityTables();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
      console.log(`🔒 Security features enabled`);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('⚠️  Running in development mode - some security features may be relaxed');
      }
    });
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await prisma.$disconnect();
  process.exit(0);
});