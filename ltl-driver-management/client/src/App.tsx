import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
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
// import { DocumentUpload } from './pages/DocumentUpload';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Toaster position="top-right" />
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
            <Route path="/register/carrier" element={<CarrierRegistration />} />
            <Route path="/confirm/:token" element={<ConfirmationPage />} />
            {/* <Route path="/upload-documents/:token" element={<DocumentUpload />} /> */}
            
            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/carriers"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Carriers />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/routes"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RoutesPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/locations"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Locations />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/bookings"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Bookings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/bookings/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <NewBooking />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/drivers"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Drivers />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Invoices />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Reports />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <Layout>
                    <Administration />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Unauthorized page */}
            <Route
              path="/unauthorized"
              element={
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
              }
            />
            
            {/* 404 fallback */}
            <Route
              path="*"
              element={
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
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;