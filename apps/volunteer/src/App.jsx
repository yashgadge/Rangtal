import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import VolunteerLogin from './pages/Login';
import VolunteerLayout from './components/VolunteerLayout';
import NetworkIndicator from './components/NetworkIndicator';

const Scanner = React.lazy(() => import('./pages/Scanner'));
const Participants = React.lazy(() => import('./pages/Participants'));

const ProtectedRoute = ({ children }) => {
  const { status } = useAuth();
  if (status === 'INITIALIZING') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#050505' }}>
        <div style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-heading)', fontSize: '1.2rem', letterSpacing: '2px', animation: 'pulse 1.5s infinite' }}>
          VERIFYING ACCESS...
        </div>
      </div>
    );
  }
  if (status === 'UNAUTHENTICATED' || status === 'DISABLED' || status === 'ERROR') {
    return <Navigate to="/login" />;
  }
  return children;
};

const PageLoader = () => (
  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
    <div style={{ color: 'var(--text-secondary)' }}>Loading Scanner...</div>
  </div>
);

function AppRoutes() {
  return (
    <>
      <NetworkIndicator />
      <Routes>
        <Route path="/login" element={<VolunteerLogin />} />
      <Route path="/" element={
        <ProtectedRoute>
          <VolunteerLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/scanner" replace />} />
        <Route path="scanner" element={
          <Suspense fallback={<PageLoader />}>
            <Scanner />
          </Suspense>
        } />
        <Route path="participants" element={
          <Suspense fallback={<PageLoader />}>
            <Participants />
          </Suspense>
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
