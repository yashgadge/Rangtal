import React from 'react';
import { Search } from 'lucide-react';

export default function DataTable({ 
  columns, 
  data, 
  loading, 
  onRowClick,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  actions
}) {
  return (
    <div className="surface" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Toolbar */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder={searchPlaceholder || "Search..."}
            value={searchValue || ''}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            style={{ 
              width: '100%', 
              background: 'var(--bg-secondary)', 
              border: '1px solid var(--border-light)', 
              color: 'var(--text-primary)',
              padding: '0.6rem 1rem 0.6rem 2.5rem',
              borderRadius: '8px',
              fontFamily: 'var(--font-body)'
            }}
          />
        </div>
        
        {actions && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {actions}
          </div>
        )}
      </div>

      {/* Table Container */}
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th key={i}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // Loading Skeleton
              Array(5).fill(0).map((_, i) => (
                <tr key={i}>
                  {columns.map((_, j) => (
                    <td key={j}>
                      <div style={{ height: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 2s infinite' }}></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : data && data.length > 0 ? (
              data.map((row, i) => (
                <tr 
                  key={row.id || i} 
                  onClick={() => onRowClick && onRowClick(row)}
                  style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {columns.map((col, j) => (
                    <td key={j}>
                      {col.cell ? col.cell(row) : row[col.accessorKey]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
