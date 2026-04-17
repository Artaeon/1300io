import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import InspectionWizard from './components/InspectionWizard';
import InspectionFinish from './components/InspectionFinish';
import Login from './components/Login';
import Setup from './components/Setup';
import AddProperty from './components/AddProperty';
import EditProperty from './components/EditProperty';
import PropertyDetail from './components/PropertyDetail';
import UserManagement from './components/admin/UserManagement';
import ChecklistManagement from './components/admin/ChecklistManagement';
import OrganizationManagement from './components/admin/OrganizationManagement';
import AuditLogs from './components/admin/AuditLogs';
import Impressum from './components/Impressum';
import Datenschutz from './components/Datenschutz';
import AGB from './components/AGB';
import VerifyEmail from './components/VerifyEmail';
import RequestVerification from './components/RequestVerification';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import NotFound from './components/NotFound';
import ErrorBoundary from './components/ErrorBoundary';
import CookieBanner from './components/CookieBanner';
import OfflineBanner from './components/OfflineBanner';
import SkipToContent from './components/SkipToContent';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
};

// Gate that hides the whole app behind the first-run wizard until an
// ADMIN user exists. Polls /api/setup/status once at mount; while the
// call is in flight we render a neutral loading screen (so there's no
// flash of /login before we know whether to redirect).
function SetupGate({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState('loading'); // 'loading' | 'initialized' | 'uninitialized'

  useEffect(() => {
    let cancelled = false;
    fetch('/api/setup/status', { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('status fetch failed'))))
      .then((data) => {
        if (cancelled) return;
        setStatus(data.initialized ? 'initialized' : 'uninitialized');
      })
      .catch(() => {
        // If the API is unreachable we still want the shell to render so
        // the user sees a real error (OfflineBanner, route-level fetch
        // failures) instead of being stuck on a spinner forever.
        if (!cancelled) setStatus('initialized');
      });
    return () => { cancelled = true; };
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-950">
        <div className="text-sm text-gray-500 dark:text-gray-400" role="status">
          Lade…
        </div>
      </div>
    );
  }

  const markInitialized = () => setStatus('initialized');

  if (status === 'uninitialized') {
    // Allow legal pages so the footer links don't 404 even during setup.
    const legalPaths = ['/impressum', '/datenschutz', '/agb'];
    if (location.pathname === '/setup' || legalPaths.includes(location.pathname)) {
      return children(markInitialized);
    }
    return <Navigate to="/setup" replace />;
  }

  // status === 'initialized' — no one should be on /setup anymore.
  if (location.pathname === '/setup') {
    return <Navigate to="/login" replace />;
  }
  return children(markInitialized);
}

function AppRoutes({ onInitialized }) {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<Setup onInitialized={onInitialized} />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/request-verification" element={<RequestVerification />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/impressum" element={<Impressum />} />
      <Route path="/datenschutz" element={<Datenschutz />} />
      <Route path="/agb" element={<AGB />} />

      <Route path="/" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />

      <Route path="/properties/new" element={
        <ProtectedRoute><AddProperty /></ProtectedRoute>
      } />

      <Route path="/properties/:id" element={
        <ProtectedRoute><PropertyDetail /></ProtectedRoute>
      } />

      <Route path="/properties/:id/edit" element={
        <ProtectedRoute><EditProperty /></ProtectedRoute>
      } />

      <Route path="/inspection/new/:propertyId" element={
        <ProtectedRoute><InspectionWizard /></ProtectedRoute>
      } />

      <Route path="/inspection/finish/:id" element={
        <ProtectedRoute><InspectionFinish /></ProtectedRoute>
      } />

      {/* Admin Routes */}
      <Route path="/admin/users" element={
        <AdminRoute><UserManagement /></AdminRoute>
      } />
      <Route path="/admin/checklist" element={
        <AdminRoute><ChecklistManagement /></AdminRoute>
      } />
      <Route path="/admin/organizations" element={
        <AdminRoute><OrganizationManagement /></AdminRoute>
      } />
      <Route path="/admin/audit-logs" element={
        <AdminRoute><AuditLogs /></AdminRoute>
      } />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
        <Router>
          <AuthProvider>
            <div className="min-h-screen bg-gray-100/50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans">
              <SkipToContent />
              <OfflineBanner />
              <main id="main-content">
              <SetupGate>
                {(onInitialized) => <AppRoutes onInitialized={onInitialized} />}
              </SetupGate>
              </main>
              <CookieBanner />
            </div>
          </AuthProvider>
        </Router>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
