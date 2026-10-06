import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './VolunteerLayout.css';
import { ScanLine, LogOut, Users } from 'lucide-react';

export default function VolunteerLayout() {
  const { user, volunteerData, logout } = useAuth();

  return (
    <div className="volunteer-layout" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#050505', color: 'white' }}>
      
      <main className="volunteer-main" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Outlet />
      </main>
      
      <nav className="bottom-nav" style={{ 
        display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem 1.25rem 1rem', 
        background: 'rgba(10, 10, 10, 0.95)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.1)',
        zIndex: 50, paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))'
      }}>
        <NavLink to="/scanner" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} style={({isActive}) => ({ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', color: isActive ? 'var(--color-gold)' : 'var(--text-secondary)', textDecoration: 'none', flex: 1, fontFamily: 'sans-serif' })}>
          <ScanLine size={24} style={{ display: 'block' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500, letterSpacing: '0.5px' }}>Scan Pass</span>
        </NavLink>
        
        <NavLink to="/participants" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} style={({isActive}) => ({ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', color: isActive ? 'var(--color-gold)' : 'var(--text-secondary)', textDecoration: 'none', flex: 1, fontFamily: 'sans-serif' })}>
          <Users size={24} style={{ display: 'block' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500, letterSpacing: '0.5px' }}>Participants</span>
        </NavLink>
        
        <button onClick={logout} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--color-error)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, flex: 1, fontFamily: 'sans-serif' }}>
          <LogOut size={24} style={{ display: 'block' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500, letterSpacing: '0.5px' }}>Sign Out</span>
        </button>
      </nav>
    </div>
  );
}
