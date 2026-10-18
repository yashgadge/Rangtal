import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AdminLogin from './pages/Login';
import AdminLayout from './components/AdminLayout';
import NetworkIndicator from './components/NetworkIndicator';

// Lazy loading all major pages
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Registrations = React.lazy(() => import('./pages/Registrations'));
const Packages = React.lazy(() => import('./pages/Packages'));
const Colleges = React.lazy(() => import('./pages/Colleges'));
const Passes = React.lazy(() => import('./pages/Passes'));
const Checkins = React.lazy(() => import('./pages/Checkins'));
const Participants = React.lazy(() => import('./pages/Participants'));
const Complimentary = React.lazy(() => import('./pages/Complimentary'));
const PrintParticipants = React.lazy(() => import('./pages/PrintParticipants'));
const Verification = React.lazy(() => import('./pages/Verification'));
const Payments = React.lazy(() => import('./pages/Payments'));
const AuditLogs = React.lazy(() => import('./pages/AuditLogs'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Volunteers = React.lazy(() => import('./pages/Volunteers'));
const Scanner = React.lazy(() => import('./pages/Scanner'));
const HostelList = React.lazy(() => import('./pages/HostelList'));

const ProtectedRoute = ({ children }) => {
  const { status } = useAuth();
  
  if (status === 'INITIALIZING') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#050505' }}>
        <div style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-heading)', fontSize: '1.5rem', letterSpacing: '2px', animation: 'pulse 1.5s infinite' }}>
          RANGTAL ADMIN
        </div>
      </div>
    );
  }
  
  if (status === 'UNAUTHENTICATED' || status === 'DISABLED' || status === 'ERROR') {
    return <Navigate to="/login" />;
  }
  
  return children;
};

const SuperAdminRoute = ({ children }) => {
  const { role, status } = useAuth();
  if (status === 'INITIALIZING') return null;
  if (role !== 'SUPER_ADMIN') return <Navigate to="/dashboard" replace />;
  return children;
};

const PageLoader = () => (
  <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
    <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
  </div>
);

function AppRoutes() {
  return (
    <>
      <NetworkIndicator />
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
      <Route path="/print-participants" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}><PrintParticipants /></Suspense>
        </ProtectedRoute>
      } />
      <Route path="/" element={
        <ProtectedRoute>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={
          <Suspense fallback={<PageLoader />}><Dashboard /></Suspense>
        } />
        <Route path="registrations" element={
          <Suspense fallback={<PageLoader />}><Registrations /></Suspense>
        } />
        <Route path="participants" element={
          <Suspense fallback={<PageLoader />}><Participants /></Suspense>
        } />
        <Route path="verification" element={
          <Suspense fallback={<PageLoader />}><Verification /></Suspense>
        } />
        <Route path="payments" element={
          <Suspense fallback={<PageLoader />}><Payments /></Suspense>
        } />
        <Route path="passes" element={
          <Suspense fallback={<PageLoader />}><Passes /></Suspense>
        } />
        <Route path="check-ins" element={
          <Suspense fallback={<PageLoader />}><Checkins /></Suspense>
        } />
        <Route path="complimentary" element={
          <SuperAdminRoute>
            <Suspense fallback={<PageLoader />}><Complimentary /></Suspense>
          </SuperAdminRoute>
        } />
        <Route path="volunteers" element={
          <Suspense fallback={<PageLoader />}><Volunteers /></Suspense>
        } />
        <Route path="packages" element={
          <Suspense fallback={<PageLoader />}><Packages /></Suspense>
        } />
        <Route path="colleges" element={
          <Suspense fallback={<PageLoader />}><Colleges /></Suspense>
        } />
        <Route path="audit-logs" element={
          <Suspense fallback={<PageLoader />}><AuditLogs /></Suspense>
        } />
        <Route path="scanner" element={
          <Suspense fallback={<PageLoader />}><Scanner /></Suspense>
        } />
        <Route path="hostel" element={
          <Suspense fallback={<PageLoader />}><HostelList /></Suspense>
        } />
        <Route path="settings" element={
          <Suspense fallback={<PageLoader />}><Settings /></Suspense>
        } />
      </Route>
    </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
