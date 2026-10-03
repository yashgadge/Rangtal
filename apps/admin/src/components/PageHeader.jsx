import React from 'react';
import { motion } from 'framer-motion';

export default function PageHeader({ title, description, actions }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="page-header"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '2rem'
      }}
    >
      <div>
        <h1 style={{ color: 'var(--color-gold)', fontSize: '2rem', marginBottom: '0.25rem' }}>
          {title}
        </h1>
        {description && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </motion.div>
  );
}
