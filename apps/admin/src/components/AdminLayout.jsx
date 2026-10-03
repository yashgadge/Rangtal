import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, Users, FileText, CheckSquare, 
  CreditCard, Ticket, CheckCircle, ShieldCheck, 
  Package, Building, FileClock, Settings, LogOut 
} from 'lucide-react';
import './AdminLayout.css';

const navSections = [
  {
    title: 'OVERVIEW',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }
    ]
  },
  {
    title: 'REGISTRATIONS',
    items: [
      { path: '/registrations', label: 'Registrations', icon: FileText },
      { path: '/participants', label: 'Participants', icon: Users },
      { path: '/verification', label: 'Verification', icon: CheckSquare }
    ]
  },
  {
    title: 'OPERATIONS',
    items: [
      { path: '/payments', label: 'Payments', icon: CreditCard },
      { path: '/passes', label: 'Passes', icon: Ticket },
      { path: '/check-ins', label: 'Check-ins', icon: CheckCircle }
    ]
  },
  {
    title: 'MANAGEMENT',
    items: [
      { path: '/volunteers', label: 'Volunteers', icon: ShieldCheck },
      { path: '/packages', label: 'Packages', icon: Package },
      { path: '/colleges', label: 'Colleges', icon: Building }
    ]
  },
  {
    title: 'SYSTEM',
    items: [
      { path: '/audit-logs', label: 'Audit Logs', icon: FileClock },
      { path: '/settings', label: 'Settings', icon: Settings }
    ]
  }
];

export default function AdminLayout() {
  const { user, role, logout } = useAuth();

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="font-display" style={{ color: 'var(--color-gold)', fontSize: '1.5rem', letterSpacing: '1px' }}>RANGTAL</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', letterSpacing: '2px', textTransform: 'uppercase' }}>Command Center</span>
        </div>
        
        <div className="nav-container">
          {navSections.map(section => (
            <div key={section.title} className="nav-section">
              <div className="nav-section-title">{section.title}</div>
              <nav className="nav-menu">
                {section.items.map(item => (
                  <NavLink key={item.path} to={item.path} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
                    <item.icon size={18} className="nav-icon" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
        </div>
        
        <div className="user-profile">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>{user?.email}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{role}</span>
          </div>
          <button className="logout-btn" onClick={logout} title="Sign Out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      
      <main className="main-content">
        <div className="top-bar">
          {/* We can add Breadcrumbs/Search here later */}
          <div style={{ flex: 1 }}></div>
          <div className="top-bar-actions">
             <div className="avatar">{user?.email?.charAt(0).toUpperCase() || 'A'}</div>
          </div>
        </div>
        
        <div className="content-scrollable">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
