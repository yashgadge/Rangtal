import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import VolunteerLogin from './pages/Login';

const Dashboard = () => {
  const { user, volunteerData, permissions, logout } = useAuth();
  return (
    <div style={{ color: 'var(--color-ivory)', padding: '2rem', fontFamily: 'var(--font-body)' }}>
      <h1>Volunteer Scanner Dashboard</h1>
      <p>Welcome, {volunteerData?.name || user?.email}</p>
      <p>Permissions: <strong style={{ color: 'var(--color-saffron)' }}>{permissions.join(', ')}</strong></p>
      <button onClick={logout} style={{ padding: '0.5rem 1rem', background: 'var(--color-maroon)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { status } = useAuth();
  if (status === 'INITIALIZING') return <div style={{ color: 'white', padding: '2rem' }}>Loading Auth...</div>;
  if (status === 'UNAUTHENTICATED' || status === 'DISABLED' || status === 'ERROR') return <Navigate to="/login" />;
  return children;
};

import VolunteerLayout from './components/VolunteerLayout';
import Scanner from './pages/Scanner';

const PlaceholderPage = ({ title }) => (
  <div style={{ textAlign: 'center', padding: '2rem' }}>
    <h2 style={{ color: 'var(--color-gold)', marginBottom: '1rem' }}>{title}</h2>
    <p style={{ color: '#aaa' }}>This feature is being connected to the backend.</p>
  </div>
);

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<VolunteerLogin />} />
      <Route path="/" element={
        <ProtectedRoute>
          <VolunteerLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/scanner" replace />} />
        <Route path="scanner" element={<Scanner />} />
        <Route path="lookup" element={<PlaceholderPage title="Manual Lookup" />} />
        <Route path="history" element={<PlaceholderPage title="Scan History" />} />
        <Route path="profile" element={<PlaceholderPage title="Volunteer Profile" />} />
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
