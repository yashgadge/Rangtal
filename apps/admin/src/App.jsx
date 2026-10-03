import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AdminLogin from './pages/Login';
import AdminLayout from './components/AdminLayout';
import Registrations from './pages/Registrations';
import Packages from './pages/Packages';
import Colleges from './pages/Colleges';
import Passes from './pages/Passes';
import Checkins from './pages/Checkins';
import Participants from './pages/Participants';
import Verification from './pages/Verification';
import Payments from './pages/Payments';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';

import Dashboard from './pages/Dashboard';
import Volunteers from './pages/Volunteers';

const ProtectedRoute = ({ children }) => {
  const { status } = useAuth();
  if (status === 'INITIALIZING') return <div style={{ color: 'white', padding: '2rem' }}>Loading Auth...</div>;
  if (status === 'UNAUTHENTICATED' || status === 'DISABLED' || status === 'ERROR') return <Navigate to="/login" />;
  return children;
};

const PlaceholderPage = ({ title }) => (
  <div style={{ color: 'var(--color-ivory)', padding: '2rem' }}>
    <h2 style={{ color: 'var(--color-gold)', marginBottom: '1rem', fontSize: '1.5rem' }}>{title}</h2>
    <p>This page is currently under construction. Core UI and layout will be connected shortly.</p>
  </div>
);

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/" element={
        <ProtectedRoute>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="registrations" element={<Registrations />} />
        <Route path="participants" element={<Participants />} />
        <Route path="verification" element={<Verification />} />
        <Route path="payments" element={<Payments />} />
        <Route path="passes" element={<Passes />} />
        <Route path="check-ins" element={<Checkins />} />
        <Route path="volunteers" element={<Volunteers />} />
        <Route path="packages" element={<Packages />} />
        <Route path="colleges" element={<Colleges />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
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
