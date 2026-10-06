import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Users, FileText, CheckSquare, 
  CreditCard, Ticket, CheckCircle, ShieldCheck, 
  Package, Building, FileClock, Settings, LogOut, ScanLine, Menu, X
} from 'lucide-react';
import './AdminLayout.css';

const navSectionsConfig = [
  {
    title: 'OVERVIEW',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: null } // Everyone sees Dashboard
    ]
  },
  {
    title: 'REGISTRATIONS',
    items: [
      { path: '/registrations', label: 'Registrations', icon: FileText, perm: 'REGISTRATIONS' },
      { path: '/participants', label: 'Participants', icon: Users, perm: ['PARTICIPANTS', 'MANUAL_CHECKIN'] },
      { path: '/hostel', label: 'Hostel Students', icon: Building, perm: ['PARTICIPANTS', 'HOSTEL_LIST'] },
      { path: '/verification', label: 'Verification', icon: CheckSquare, perm: 'VERIFICATION' }
    ]
  },
  {
    title: 'OPERATIONS',
    items: [
      { path: '/scanner', label: 'Scanner', icon: ScanLine, perm: 'SCAN_PASS' },
      { path: '/payments', label: 'Payments', icon: CreditCard, perm: 'PAYMENTS' },
      { path: '/passes', label: 'Passes', icon: Ticket, perm: 'PASSES' },
      { path: '/check-ins', label: 'Check-ins', icon: CheckCircle, perm: 'CHECKINS' }
    ]
  },
  {
    title: 'MANAGEMENT',
    items: [
      { path: '/volunteers', label: 'Volunteers', icon: ShieldCheck, perm: 'VOLUNTEERS' },
      { path: '/packages', label: 'Packages', icon: Package, perm: 'PACKAGES' },
      { path: '/colleges', label: 'Colleges', icon: Building, perm: 'COLLEGES' }
    ]
  },
  {
    title: 'SYSTEM',
    items: [
      { path: '/audit-logs', label: 'Audit Logs', icon: FileClock, perm: 'SUPER_ADMIN_ONLY' },
      { path: '/settings', label: 'Settings', icon: Settings, perm: 'SETTINGS' }
    ]
  }
];

export default function AdminLayout() {
  const { user, role, adminData, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const userPerms = adminData?.permissions || [];
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const visibleSections = navSectionsConfig.map(section => {
    const visibleItems = section.items.filter(item => {
      if (item.perm === 'SUPER_ADMIN_ONLY') return role === 'SUPER_ADMIN';
      if (isAdmin) return true;
      if (item.perm === null) return true; // Allowed for all logged in
      
      if (Array.isArray(item.perm)) {
        return item.perm.some(p => userPerms.includes(p));
      }
      return userPerms.includes(item.perm);
    });
    return { ...section, items: visibleItems };
  }).filter(section => section.items.length > 0);

  return (
    <div className="admin-layout">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mobile-overlay"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="brand">
          <span className="font-display" style={{ color: 'var(--color-gold)', fontSize: '1.5rem', letterSpacing: '1px' }}>RANGTAL</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', letterSpacing: '2px', textTransform: 'uppercase' }}>Command Center</span>
          <button className="mobile-close-btn" onClick={() => setMobileMenuOpen(false)}>
            <X size={24} />
          </button>
        </div>
        
        <div className="nav-container">
          {visibleSections.map(section => (
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
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={24} />
          </button>
          
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
            style={{ height: '100%' }}
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
