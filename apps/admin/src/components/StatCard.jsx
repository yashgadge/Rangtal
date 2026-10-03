import React from 'react';
import { motion } from 'framer-motion';

export default function StatCard({ title, value, subtext, icon: Icon, color = 'var(--color-gold)' }) {
  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 300 }}
      className="surface"
      style={{
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{
        position: 'absolute',
        top: '-20px',
        right: '-20px',
        width: '100px',
        height: '100px',
        background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
        borderRadius: '50%'
      }} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {title}
        </h3>
        {Icon && <Icon size={20} color={color} style={{ opacity: 0.8 }} />}
      </div>
      
      <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </div>
      
      {subtext && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {subtext}
        </div>
      )}
    </motion.div>
  );
}
