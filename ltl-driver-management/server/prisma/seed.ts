import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password.utils';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminPassword = await hashPassword('admin123');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ltl.com' },
    update: {},
    create: {
      email: 'admin@ltl.com',
      password: adminPassword,
      name: 'System Admin',
      role: 'ADMIN'
    }
  });
  console.log('✅ Admin user created:', admin.email);

  // Create dispatcher user
  const dispatcherPassword = await hashPassword('dispatch123');
  const dispatcher = await prisma.user.upsert({
    where: { email: 'dispatcher@ltl.com' },
    update: {},
    create: {
      email: 'dispatcher@ltl.com',
      password: dispatcherPassword,
      name: 'John Dispatcher',
      role: 'DISPATCHER'
    }
  });
  console.log('✅ Dispatcher user created:', dispatcher.email);

  // Create sample carriers
  const carriers = await Promise.all([
    prisma.carrier.create({
      data: {
        name: 'ABC Transport Co.',
        contactPerson: 'Mike Johnson',
        phone: '+1-555-0101',
        email: 'mike@abctransport.com',
        mcNumber: 'MC123456',
        dotNumber: 'DOT789012',
        insuranceExpiration: new Date('2024-12-31'),
        status: 'ACTIVE',
        rating: 4.5,
        ratePerMile: 2.50,
        onboardingComplete: true
      }
    }),
    prisma.carrier.create({
      data: {
        name: 'XYZ Logistics',
        contactPerson: 'Sarah Davis',
        phone: '+1-555-0102',
        email: 'sarah@xyzlogistics.com',
        mcNumber: 'MC654321',
        dotNumber: 'DOT210987',
        insuranceExpiration: new Date('2024-11-30'),
        status: 'ACTIVE',
        rating: 4.2,
        ratePerMile: 2.25,
        onboardingComplete: true
      }
    }),
    prisma.carrier.create({
      data: {
        name: 'QuickHaul Express',
        contactPerson: 'Tom Wilson',
        phone: '+1-555-0103',
        email: 'tom@quickhaul.com',
        mcNumber: 'MC987654',
        dotNumber: 'DOT456789',
        insuranceExpiration: new Date('2024-10-15'),
        status: 'PENDING',
        rating: null,
        ratePerMile: 2.75,
        onboardingComplete: false
      }
    })
  ]);
  console.log(`✅ ${carriers.length} carriers created`);

  // Create sample routes
  const routes = await Promise.all([
    prisma.route.create({
      data: {
        name: 'Atlanta to Charlotte',
        origin: 'Atlanta, GA',
        destination: 'Charlotte, NC',
        distance: 244,
        standardRate: 2.45,
        frequency: 'Daily',
        departureTime: new Date('1970-01-01T06:00:00Z'),
        arrivalTime: new Date('1970-01-01T10:30:00Z')
      }
    }),
    prisma.route.create({
      data: {
        name: 'Dallas to Houston',
        origin: 'Dallas, TX',
        destination: 'Houston, TX',
        distance: 239,
        standardRate: 2.35,
        frequency: 'Daily',
        departureTime: new Date('1970-01-01T08:00:00Z'),
        arrivalTime: new Date('1970-01-01T12:00:00Z')
      }
    }),
    prisma.route.create({
      data: {
        name: 'Miami to Orlando',
        origin: 'Miami, FL',
        destination: 'Orlando, FL',
        distance: 235,
        standardRate: 2.55,
        frequency: 'Monday, Wednesday, Friday',
        departureTime: new Date('1970-01-01T07:30:00Z'),
        arrivalTime: new Date('1970-01-01T11:45:00Z')
      }
    })
  ]);
  console.log(`✅ ${routes.length} routes created`);

  // Create carrier preferred routes
  await Promise.all([
    prisma.carrierPreferredRoute.create({
      data: {
        carrierId: carriers[0].id,
        routeId: routes[0].id
      }
    }),
    prisma.carrierPreferredRoute.create({
      data: {
        carrierId: carriers[0].id,
        routeId: routes[1].id
      }
    }),
    prisma.carrierPreferredRoute.create({
      data: {
        carrierId: carriers[1].id,
        routeId: routes[1].id
      }
    }),
    prisma.carrierPreferredRoute.create({
      data: {
        carrierId: carriers[1].id,
        routeId: routes[2].id
      }
    })
  ]);
  console.log('✅ Carrier preferred routes created');

  // Create sample bookings
  const bookings = await Promise.all([
    prisma.booking.create({
      data: {
        carrierId: carriers[0].id,
        routeId: routes[0].id,
        bookingDate: new Date('2024-03-15'),
        rate: 598.00,
        status: 'COMPLETED',
        billable: true,
        notes: 'On-time delivery, excellent service'
      }
    }),
    prisma.booking.create({
      data: {
        carrierId: carriers[1].id,
        routeId: routes[1].id,
        bookingDate: new Date('2024-03-16'),
        rate: 561.65,
        status: 'COMPLETED',
        billable: true
      }
    }),
    prisma.booking.create({
      data: {
        carrierId: carriers[0].id,
        routeId: routes[1].id,
        bookingDate: new Date('2024-03-18'),
        rate: 575.00,
        status: 'CONFIRMED',
        billable: false
      }
    }),
    prisma.booking.create({
      data: {
        carrierId: carriers[1].id,
        routeId: routes[2].id,
        bookingDate: new Date('2024-03-20'),
        rate: 599.25,
        status: 'PENDING',
        billable: false
      }
    })
  ]);
  console.log(`✅ ${bookings.length} bookings created`);

  // Create sample invoices for completed bookings
  const completedBookings = bookings.filter(b => b.status === 'COMPLETED');
  const invoices = await Promise.all(
    completedBookings.map((booking, index) =>
      prisma.invoice.create({
        data: {
          bookingId: booking.id,
          invoiceNumber: `INV-${String(index + 1).padStart(6, '0')}`,
          amount: booking.rate,
          status: index === 0 ? 'PAID' : 'PENDING',
          ...(index === 0 && { paidAt: new Date() })
        }
      })
    )
  );
  console.log(`✅ ${invoices.length} invoices created`);

  console.log('🎉 Database seed completed successfully!');
  console.log('');
  console.log('👤 Test Users:');
  console.log('Admin: admin@ltl.com / admin123');
  console.log('Dispatcher: dispatcher@ltl.com / dispatch123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });