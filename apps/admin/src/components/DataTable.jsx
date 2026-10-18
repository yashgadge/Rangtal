import React, { useState, useMemo } from 'react';
import { Search, AlertCircle, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download } from 'lucide-react';

export default function DataTable({ 
  columns, 
  data, 
  loading, 
  error,
  onRowClick,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  actions,
  showSerial = false,
  exportable = false,
  exportFilename = "export.csv",
  selectable = false,
  selectedIds = new Set(),
  onSelectRow,
  onSelectAll,
  bulkActions,
  displayTotal
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

  const handleExport = () => {
    if (!sortedData || sortedData.length === 0) return;
    
    // Build CSV headers based on column definitions
    const exportColumns = columns.filter(c => c.header && c.header !== 'Actions' && c.header !== '');
    const headers = exportColumns.map(c => `"${c.header}"`).join(',');
    
    // Build CSV rows
    const rows = sortedData.map(row => {
      return exportColumns.map(c => {
        let val = '';
        if (c.accessorKey) {
          val = row[c.accessorKey];
        } else if (typeof c.sortKey === 'function') {
           val = c.sortKey(row);
        }
        
        let strVal = String(val == null ? '' : val).replace(/"/g, '""');
        return `"${strVal}"`;
      }).join(',');
    });
    
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', exportFilename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (key) => {
    if (!key) return;
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    if (!data) return [];
    let sortableItems = [...data];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aVal = typeof sortConfig.key === 'function' ? sortConfig.key(a) : a[sortConfig.key];
        let bVal = typeof sortConfig.key === 'function' ? sortConfig.key(b) : b[sortConfig.key];
        
        if (aVal == null) aVal = '';
        if (bVal == null) bVal = '';

        if (aVal < bVal) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset page if data length changes
  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [sortedData.length, currentPage, totalPages]);

  const isAllSelected = useMemo(() => {
    if (!sortedData || sortedData.length === 0) return false;
    return sortedData.every(r => selectedIds.has(r.id));
  }, [sortedData, selectedIds]);

  return (
    <div className="surface" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Toolbar */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '200px' }}>
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
          
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Total: {displayTotal !== undefined ? displayTotal : (data?.length || 0)}
          </div>
          
          {exportable && data?.length > 0 && (
            <button className="btn btn-secondary" onClick={handleExport} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>
        
        {actions && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {actions}
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectable && selectedIds && selectedIds.size > 0 && (
        <div style={{
          padding: '0.75rem 1.25rem',
          background: 'rgba(212, 175, 55, 0.15)',
          borderBottom: '1px solid var(--color-gold)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--color-gold)', fontSize: '0.9rem' }}>
            {selectedIds.size} item{selectedIds.size > 1 ? 's' : ''} selected
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {bulkActions}
          </div>
        </div>
      )}

      {/* Table Container */}
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table className="admin-table">
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={isAllSelected}
                    onChange={(e) => onSelectAll && onSelectAll(sortedData.map(r => r.id), e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: 'var(--color-gold)' }}
                  />
                </th>
              )}
              {showSerial && <th style={{ width: '50px' }}>#</th>}
              {columns.map((col, i) => {
                const isSortable = !!col.sortKey || !!col.accessorKey;
                const sortKey = col.sortKey || col.accessorKey;
                return (
                  <th 
                    key={i} 
                    onClick={() => isSortable && handleSort(sortKey)}
                    style={{ cursor: isSortable ? 'pointer' : 'default', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {col.header}
                      {isSortable && sortConfig.key === sortKey && (
                        sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // Loading Skeleton
              Array(pageSize).fill(0).map((_, i) => (
                <tr key={i}>
                  {selectable && <td><div style={{ height: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 2s infinite' }}></div></td>}
                  {showSerial && <td><div style={{ height: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 2s infinite' }}></div></td>}
                  {columns.map((_, j) => (
                    <td key={j}>
                      <div style={{ height: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 2s infinite' }}></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              // Error State
              <tr>
                <td colSpan={columns.length + (showSerial ? 1 : 0) + (selectable ? 1 : 0)} style={{ textAlign: 'center', padding: '3rem' }}>
                  <AlertCircle size={48} color="var(--color-error)" style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
                  <div style={{ color: 'var(--color-error)', fontWeight: 600 }}>Error loading data</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>{error.message || String(error)}</div>
                </td>
              </tr>
            ) : paginatedData.length > 0 ? (
              paginatedData.map((row, i) => {
                const isSelected = selectedIds.has(row.id);
                return (
                  <tr 
                    key={row.id || i} 
                    onClick={() => onRowClick && onRowClick(row)}
                    style={{ 
                      cursor: onRowClick ? 'pointer' : 'default',
                      background: isSelected ? 'rgba(212, 175, 55, 0.08)' : undefined
                    }}
                  >
                    {selectable && (
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => onSelectRow && onSelectRow(row.id)}
                          style={{ cursor: 'pointer', accentColor: 'var(--color-gold)' }}
                        />
                      </td>
                    )}
                    {showSerial && <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{(currentPage - 1) * pageSize + i + 1}</td>}
                    {columns.map((col, j) => (
                      <td key={j}>
                        {col.cell ? col.cell(row) : row[col.accessorKey]}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              // Empty State
              <tr>
                <td colSpan={columns.length + (showSerial ? 1 : 0) + (selectable ? 1 : 0)} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>NO RECORDS FOUND</div>
                  <div>There is currently no data matching this view.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!loading && !error && data && data.length > 0 && (
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Rows per page:
            <select 
              value={pageSize} 
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}
            >
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={100}>100</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length}
            </span>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)', padding: '0.4rem', borderRadius: '4px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)', padding: '0.4rem', borderRadius: '4px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
