import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Carriers } from './pages/Carriers';
import { Routes as RoutesPage } from './pages/Routes';
import { Locations } from './pages/Locations';
import { Bookings } from './pages/Bookings';
import { NewBookingSimplified as NewBooking } from './pages/NewBookingSimplified';
import { Invoices } from './pages/Invoices';
import { Reports } from './pages/Reports';
import { ConfirmationPage } from './pages/ConfirmationPage';
import { CarrierRegistration } from './pages/CarrierRegistration';
import { Administration } from './pages/Administration';
import { Drivers } from './pages/Drivers';
import { DocumentUpload } from './pages/DocumentUpload';
import { Equipment } from './pages/Equipment';
import { Dispatch } from './pages/Dispatch';
import { TransferScans } from './pages/TransferScans';
import { PrintHazmatBOL } from './pages/PrintHazmatBOL';
import { RateCards } from './pages/RateCards';
import { Payroll } from './pages/Payroll';
import { Loadsheets } from './pages/Loadsheets';
import { LoadsheetForm } from './pages/LoadsheetForm';
import { ContractPowerHome } from './pages/ContractPowerHome';
import { LateLinehaulReport } from './pages/LateLinehaulReport';
import { LoadFactorReport } from './pages/LoadFactorReport';
import { KPIDashboard } from './pages/reports/KPIDashboard';
import { CostPerMileReport } from './pages/reports/CostPerMileReport';
import { CCFSContractReport } from './pages/reports/CCFSContractReport';
import { EnhancedLoadFactorReport } from './pages/reports/EnhancedLoadFactorReport';
import { PayRules } from './pages/PayRules';
import { DriverSelfService } from './pages/DriverSelfService';
import { LinehaulLanes } from './pages/LinehaulLanes';
import { SSOCallback } from './pages/SSOCallback';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Create router with future flags
const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginForm />
  },
  {
    path: '/register',
    element: <RegisterForm />
  },
  {
    path: '/register/carrier',
    element: <CarrierRegistration />
  },
  {
    path: '/confirm/:token',
    element: <ConfirmationPage />
  },
  {
    path: '/documents/upload/:token',
    element: <DocumentUpload />
  },
  {
    path: '/driver',
    element: <DriverSelfService />
  },
  {
    path: '/sso/callback',
    element: <SSOCallback />
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard" replace />
          },
          {
            path: 'dashboard',
            element: <Dashboard />
          },
          {
            path: 'carriers',
            element: <Carriers />
          },
          {
            path: 'drivers',
            element: <Drivers />
          },
          {
            path: 'routes',
            element: <RoutesPage />
          },
          {
            path: 'locations',
            element: <Locations />
          },
          {
            path: 'pay-rules',
            element: <PayRules />
          },
          {
            path: 'linehaul-lanes',
            element: <LinehaulLanes />
          },
          {
            path: 'contract-power',
            element: <ContractPowerHome />
          },
          {
            path: 'bookings',
            children: [
              {
                index: true,
                element: <Bookings />
              },
              {
                path: 'new',
                element: <NewBooking />
              }
            ]
          },
          {
            path: 'invoices',
            element: <Invoices />
          },
          {
            path: 'reports',
            element: <Reports />
          },
          {
            path: 'reports/late-linehaul',
            element: <LateLinehaulReport />
          },
          {
            path: 'reports/load-factor',
            element: <LoadFactorReport />
          },
          {
            path: 'reports/kpi-dashboard',
            element: <KPIDashboard />
          },
          {
            path: 'reports/cost-per-mile',
            element: <CostPerMileReport />
          },
          {
            path: 'reports/ccfs-vs-contract',
            element: <CCFSContractReport />
          },
          {
            path: 'reports/load-factor-enhanced',
            element: <EnhancedLoadFactorReport />
          },
          {
            path: 'administration',
            element: <Administration />
          },
          {
            path: 'dispatch',
            element: <Dispatch />
          },
          {
            path: 'transfer-scans',
            element: <TransferScans />
          },
          {
            path: 'print-hazmat-bol',
            element: <PrintHazmatBOL />
          },
          {
            path: 'equipment',
            element: <Equipment />
          },
          {
            path: 'rate-cards',
            element: <RateCards />
          },
          {
            path: 'payroll',
            element: <Payroll />
          },
          {
            path: 'loadsheets',
            children: [
              {
                index: true,
                element: <Loadsheets />
              },
              {
                path: 'new',
                element: <LoadsheetForm />
              },
              {
                path: ':id',
                element: <LoadsheetForm />
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '/unauthorized',
    element: (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">403</h1>
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-8">You don't have permission to access this page.</p>
          <a
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    )
  },
  {
    path: '*',
    element: (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
          <p className="text-gray-600 mb-8">Page not found</p>
          <a
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    )
  }
]);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;