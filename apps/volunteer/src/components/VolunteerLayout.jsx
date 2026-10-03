import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './VolunteerLayout.css';
import { ScanLine, LogOut } from 'lucide-react';

export default function VolunteerLayout() {
  const { user, volunteerData, logout } = useAuth();

  return (
    <div className="volunteer-layout" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#050505', color: 'white' }}>
      
      <main className="volunteer-main" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Outlet />
      </main>
      
      <nav className="bottom-nav" style={{ 
        display: 'flex', justifyContent: 'space-around', padding: '1rem', 
        background: 'var(--bg-elevated)', borderTop: '1px solid rgba(255,255,255,0.05)',
        zIndex: 50
      }}>
        <NavLink to="/scanner" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
          <ScanLine size={24} />
          <span style={{ fontSize: '0.75rem' }}>Scan Pass</span>
        </NavLink>
        
        <button onClick={logout} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: 'var(--color-error)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
          <LogOut size={24} />
          <span style={{ fontSize: '0.75rem' }}>Sign Out</span>
        </button>
      </nav>
    </div>
  );
}
