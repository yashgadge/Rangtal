import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './VolunteerLayout.css';

export default function VolunteerLayout() {
  const { user, volunteerData, permissions, logout } = useAuth();

  return (
    <div className="volunteer-layout">
      <header className="volunteer-header">
        <div className="brand">SCANNER</div>
        <div className="user-info">
          <span>{volunteerData?.name || user?.email}</span>
          <button className="logout-btn" onClick={logout}>Sign Out</button>
        </div>
      </header>
      
      <main className="volunteer-main">
        <Outlet />
      </main>
      
      <nav className="bottom-nav">
        <NavLink to="/scanner" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
          <div className="icon">📷</div>
          <span>Scan</span>
        </NavLink>
        <NavLink to="/lookup" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
          <div className="icon">🔍</div>
          <span>Lookup</span>
        </NavLink>
        <NavLink to="/history" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
          <div className="icon">📋</div>
          <span>History</span>
        </NavLink>
        <NavLink to="/profile" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
          <div className="icon">👤</div>
          <span>Profile</span>
        </NavLink>
      </nav>
    </div>
  );
}
