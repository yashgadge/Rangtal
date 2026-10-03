import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertCircle, Info, AlertTriangle, X, Loader2 } from 'lucide-react';
import './Toast.css';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [loadingToasts, setLoadingToasts] = useState({});
  const MAX_TOASTS = 3;

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    setLoadingToasts((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const addToast = useCallback(({ id, type, title, message, duration }) => {
    setToasts((prev) => {
      // Prevent duplicate identical toasts in rapid succession
      if (prev.some(t => t.title === title && t.message === message && t.type === type)) {
        return prev; 
      }
      
      const newToast = { id: id || Date.now().toString(), type, title, message };
      
      const newToasts = [...prev, newToast];
      // Keep only max toasts
      if (newToasts.length > MAX_TOASTS) {
        newToasts.shift();
      }
      return newToasts;
    });

    if (duration !== Infinity) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = {
    success: (title, message = '') => {
      const id = Date.now().toString();
      addToast({ id, type: 'success', title, message, duration: 3000 });
      return id;
    },
    error: (title, message = '') => {
      const id = Date.now().toString();
      addToast({ id, type: 'error', title, message, duration: 6000 });
      return id;
    },
    warning: (title, message = '') => {
      const id = Date.now().toString();
      addToast({ id, type: 'warning', title, message, duration: 5000 });
      return id;
    },
    info: (title, message = '') => {
      const id = Date.now().toString();
      addToast({ id, type: 'info', title, message, duration: 4000 });
      return id;
    },
    loading: (title, message = '') => {
      const id = Date.now().toString();
      setLoadingToasts(prev => ({ ...prev, [id]: { type: 'loading', title, message } }));
      return id;
    },
    dismiss: (id) => {
      removeToast(id);
    },
    update: (id, type, title, message = '') => {
      setLoadingToasts(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      addToast({ id, type, title, message, duration: type === 'success' ? 3000 : 5000 });
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <Check size={18} color="var(--color-success, #22c55e)" />;
      case 'error': return <AlertCircle size={18} color="var(--color-error, #ef4444)" />;
      case 'warning': return <AlertTriangle size={18} color="var(--color-warning, #f59e0b)" />;
      case 'info': return <Info size={18} color="var(--color-info, #3b82f6)" />;
      case 'loading': return <Loader2 size={18} color="var(--color-gold, #FFD700)" className="toast-spin" />;
      default: return null;
    }
  };

  const allVisibleToasts = [...Object.entries(loadingToasts).map(([id, t]) => ({ id, ...t })), ...toasts].slice(-MAX_TOASTS);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" role="region" aria-live="polite">
        <AnimatePresence mode="popLayout">
          {allVisibleToasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="toast-surface"
              role="alert"
            >
              <div className="toast-icon">
                {getIcon(t.type)}
              </div>
              <div className="toast-content">
                <div className="toast-title">{t.title}</div>
                {t.message && <div className="toast-message">{t.message}</div>}
              </div>
              <button 
                className="toast-close" 
                onClick={() => removeToast(t.id)}
                aria-label="Close notification"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
