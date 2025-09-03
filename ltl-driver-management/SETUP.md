# LTL Driver Management System - Setup Guide

This guide will help you set up and run the LTL Driver Management System locally.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ and npm
- **PostgreSQL** 13+
- **Git**

## Setup Instructions

### 1. Clone and Navigate to the Project

```bash
cd ltl-driver-management
```

### 2. Database Setup

1. **Create a PostgreSQL database:**
   ```sql
   CREATE DATABASE ltl_management;
   CREATE USER admin WITH ENCRYPTED PASSWORD 'password';
   GRANT ALL PRIVILEGES ON DATABASE ltl_management TO admin;
   ```

2. **Set up environment variables:**
   ```bash
   # In server directory
   cd server
   cp .env.example .env
   ```
   
   Edit the `.env` file with your database credentials:
   ```env
   DATABASE_URL="postgresql://admin:password@localhost:5432/ltl_management"
   JWT_SECRET="your-secure-jwt-secret-key-here"
   JWT_EXPIRES_IN="7d"
   PORT=3001
   NODE_ENV="development"
   ```

### 3. Backend Setup

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Generate Prisma client
npm run generate

# Run database migrations
npm run migrate

# Seed the database with sample data
npm run seed
```

### 4. Frontend Setup

```bash
# Navigate to client directory (from project root)
cd client

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

Edit the `.env` file in the client directory:
```env
VITE_API_URL=http://localhost:3001/api
```

## Running the Application

### Start the Backend Server

```bash
cd server
npm run dev
```

The backend server will start on `http://localhost:3001`

### Start the Frontend Development Server

```bash
cd client
npm run dev
```

The frontend will start on `http://localhost:5173`

## Test Users

The database seed creates the following test users:

- **Admin User:**
  - Email: `admin@ltl.com`
  - Password: `admin123`

- **Dispatcher User:**
  - Email: `dispatcher@ltl.com`
  - Password: `dispatch123`

## Features Overview

### Authentication
- JWT-based authentication
- Role-based access control (Admin, Dispatcher, User, Carrier)
- Protected routes

### Carrier Management
- Add, edit, and manage carriers
- Track carrier credentials (MC/DOT numbers, insurance)
- Document upload for onboarding
- Performance ratings and metrics

### Route Management
- Define linehaul routes with origin/destination
- Set standard rates and schedules
- Track route performance

### Booking System
- Book carriers to specific routes and dates
- Track booking status (Pending → Confirmed → Completed)
- Handle cancellations and modifications

### Billing & Invoicing
- Generate invoices for completed runs
- Track payment status
- Revenue reporting

### Dashboard & Reports
- Real-time dashboard with key metrics
- Carrier performance reports
- Route analytics
- Data export capabilities

## API Documentation

The API includes the following main endpoints:

- **Authentication:** `/api/auth/*`
- **Carriers:** `/api/carriers/*`
- **Routes:** `/api/routes/*`
- **Bookings:** `/api/bookings/*`
- **Invoices:** `/api/invoices/*`
- **Reports:** `/api/reports/*`

## Troubleshooting

### Common Issues

1. **Database Connection Error:**
   - Verify PostgreSQL is running
   - Check DATABASE_URL in .env file
   - Ensure database and user exist

2. **Port Already in Use:**
   - Change PORT in server/.env file
   - Update VITE_API_URL in client/.env file

3. **CORS Issues:**
   - Ensure client URL is correctly configured in server
   - Check that both frontend and backend are running

### Support

For technical support or questions about the system, please refer to the code documentation or contact the development team.

## Development

### Available Scripts

**Backend (server directory):**
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed database with sample data

**Frontend (client directory):**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Project Structure

```
ltl-driver-management/
├── server/                 # Backend application
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Custom middleware
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utilities
│   └── prisma/            # Database schema & migrations
├── client/                # Frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── contexts/      # React contexts
│   │   └── services/      # API services
└── README.md
```

The application is now ready for development and testing!