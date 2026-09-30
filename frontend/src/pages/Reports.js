import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';

import { dataService } from '../services/dataService';
import { studentService } from '../services/studentService';
import { apiClient } from '../services/authService';
import { toast } from '../hooks/useSoundEnabledToast';
import { Users, Calendar, DollarSign, Download, Search, Filter, RefreshCw, FileText } from 'lucide-react';

import ChainToggle from '../components/ChainToggle';
import LoadingSpinner from '../components/LoadingSpinner';
import { API_URL } from '../config/api';
import { exportReportCard, exportAttendanceReport } from '../utils/docExport';
import UniformReport from './UniformReport';


function Reports() {
  const currentUser = useSelector(selectCurrentUser);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'attendance');

  // Keep activeTab in sync with the URL query param so that navigating
  // between the sidebar report sub-items (Attendance / Financial / Academic)
  // updates the displayed report without needing a full page reload.
  useEffect(() => {
    const tab = searchParams.get('tab') || 'attendance';
    setActiveTab(tab);
  }, [searchParams]);

  const [attendanceReport, setAttendanceReport] = useState(null);

  const [detailedAttendance, setDetailedAttendance] = useState(null);
  const [feesReport, setFeesReport] = useState(null);
  const [loading, setLoading] = useState(false);
  // Pagination for the attendance report table (20 rows per page)
  const [attendancePage, setAttendancePage] = useState(1);
  const attendancePageSize = 20;
  
  // Check if user can see Financial Reports (Secretary, Director, Principal only)
  const canViewFinancialReports = ['secretary', 'director', 'principal'].includes(currentUser?.role?.toLowerCase());
  
  // Attendance filters
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    month: '',
    role: ''
  });
  const [filterMode, setFilterMode] = useState('date');
  const [selectedChain, setSelectedChain] = useState(''); // 'date' or 'month'

  const STAFF_ROLES = [
    { value: '', label: 'All Positions' },
    { value: 'director', label: 'Director' },
    { value: 'coordinator', label: 'Coordinator' },
    { value: 'principal', label: 'Principal' },
    { value: 'academic', label: 'Academic' },
    { value: 'teacher', label: 'Teacher' },
    { value: 'secretary', label: 'Secretary' },
    { value: 'section_leader', label: 'Section Leader' }
  ];

  useEffect(() => {
    loadReports(selectedChain);
  }, [activeTab, selectedChain]);

  const loadReports = async (chain = '') => {
    try {
      setLoading(true);
      const filters = chain ? { chain } : {};
      if (activeTab === 'attendance') {
        const data = await dataService.getAttendanceReport(filters);
        setAttendanceReport(data);
        // Also load detailed report
        loadDetailedAttendance(chain);
      } else if (activeTab === 'financial') {
        const data = await dataService.getFeesReport(filters);
        setFeesReport(data);
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDetailedAttendance = async (chain = '') => {
    try {
      const params = new URLSearchParams();
      
      if (chain) params.append('chain', chain);
      
      if (filterMode === 'month' && filters.month) {
        params.append('month', filters.month);
      } else {
        if (filters.start_date) params.append('start_date', filters.start_date);
        if (filters.end_date) params.append('end_date', filters.end_date);
      }
      
      if (filters.role) params.append('role', filters.role);
      
      const response = await apiClient.get(`/reports/staff-attendance-detailed?${params.toString()}`);
      setDetailedAttendance(response.data);
    } catch (error) {
      console.error('Failed to load detailed attendance:', error);
    }
  };

  const handleSearch = () => {
    loadDetailedAttendance(selectedChain);
    toast.success('Filters applied');
  };

  const handleClearFilters = () => {
    setFilters({
      start_date: '',
      end_date: '',
      month: '',
      role: ''
    });
    loadDetailedAttendance(selectedChain);
    toast.success('Filters cleared');
  };

  const exportToDOC = () => {
    if (!detailedAttendance?.records?.length) {
      toast.error('No data to export');
      return;
    }
    
    try {
      exportAttendanceReport(detailedAttendance, filters);
      toast.success('Report exported as DOC');
    } catch (error) {
      console.error('Failed to export report:', error);
      toast.error('Failed to export report');
    }
  };

  return (
    <div className="reports-page">

      <ChainToggle selectedChain={selectedChain} onChainChange={(chain) => {
        // Only update state. The effect on [activeTab, selectedChain] below
        // already reloads reports, so calling loadReports here too would
        // double-fetch on every chain change.
        setSelectedChain(chain);
      }} />

      <style>{`
        .reports-page {
          padding: 1.5rem;
        }
        
        .filters-section {

          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 1rem;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }
        
        .filters-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: nowrap;
          margin-bottom: 0;
        }
        
        .filters-title {
          font-size: 1rem;
          font-weight: 600;
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          white-space: nowrap;
          flex-shrink: 0;
        }
        
        .filter-mode-toggle {
          display: flex;
          gap: 0.5rem;
          padding: 0.25rem;
          background: rgba(51, 65, 85, 0.5);
          border-radius: 0.5rem;
          flex-shrink: 0;
        }
        
        .mode-btn {
          padding: 0.5rem 1rem;
          background: transparent;
          border: none;
          border-radius: 0.375rem;
          color: #94a3b8;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        
        .mode-btn.active {
          background: #8b5cf6;
          color: white;
        }
        
        .filters-row {
          display: flex;
          gap: 0.75rem;
          flex-wrap: nowrap;
          align-items: flex-end;
          flex: 1;
          min-width: 0;
        }
        
        .filter-group {
          flex: 1;
          min-width: 0;
        }
        
        .filter-label {
          display: block;
          font-size: 0.7rem;
          font-weight: 500;
          color: #94a3b8;
          margin-bottom: 0.35rem;
          text-transform: uppercase;
          white-space: nowrap;
        }
        
        .filter-input {
          width: 100%;
          padding: 0.5rem 0.6rem;
          background: rgba(51, 65, 85, 0.5);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 0.5rem;
          color: #f8fafc;
          font-size: 0.8rem;
        }
        
        .filter-input:focus {
          outline: none;
          border-color: #8b5cf6;
        }
        
        .filter-actions {
          display: flex;
          gap: 0.4rem;
          flex-shrink: 0;
        }
        
        .btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          font-size: 0.8rem;
          white-space: nowrap;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          color: white;
        }
        
        .btn-secondary {
          background: rgba(51, 65, 85, 0.5);
          color: #f8fafc;
          border: 1px solid rgba(71, 85, 105, 0.5);
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }
        
        .stat-card {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 0.75rem;
          padding: 0 0.75rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 50px;
          min-height: 50px;
          max-height: 50px;
          overflow: hidden;
          box-sizing: border-box;
        }
        
        .stat-value {
          font-size: 1rem;
          font-weight: 700;
          color: #f8fafc;
          line-height: 1.1;
        }
        
        .stat-value.present { color: #22c55e; }
        .stat-value.absent { color: #ef4444; }
        .stat-value.rate { color: #3b82f6; }
        
        .stat-label {
          font-size: 0.55rem;
          color: #64748b;
          margin-top: 2px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          line-height: 1.1;
        }
        
        .table-container {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 1rem;
          overflow: hidden;
        }
        
        .table-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid rgba(51, 65, 85, 0.5);
        }
        
        .table-title {
          font-size: 1rem;
          font-weight: 600;
          color: #f8fafc;
        }
        
        .records-count {
          font-size: 0.8rem;
          color: #64748b;
          background: rgba(51, 65, 85, 0.5);
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
        }
        
        th {
          text-align: left;
          padding: 1rem 1.5rem;
          background: rgba(51, 65, 85, 0.3);
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          color: #94a3b8;
        }
        
        td {
          padding: 1rem 1.5rem;
          border-top: 1px solid rgba(51, 65, 85, 0.5);
          font-size: 0.875rem;
          color: #f8fafc;
        }
        
        tr:hover td {
          background: rgba(51, 65, 85, 0.2);
        }
        
        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .status-badge.present {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }
        
        .status-badge.absent {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }
        
        .status-badge.late {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        }
        
        .role-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          background: rgba(139, 92, 246, 0.2);
          border-radius: 0.375rem;
          color: #a78bfa;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: capitalize;
        }
        
        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #64748b;
        }
        
        .by-role-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 1rem;
          margin-top: 1.5rem;
        }
        
        .role-stat {
          background: rgba(51, 65, 85, 0.3);
          border-radius: 0.75rem;
          padding: 1rem;
          text-align: center;
        }
        
        .role-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: #f8fafc;
          text-transform: capitalize;
          margin-bottom: 0.5rem;
        }
        
        .role-rate {
          font-size: 1.5rem;
          font-weight: 700;
        }
      `}</style>
      
      {activeTab === 'attendance' && (

        <>
          {/* Filters Section */}
          <div className="filters-section">
            <div className="filters-header">
              <div className="filters-title">
                <Filter size={18} />
                Filter Staff Attendance
              </div>
              <div className="filter-mode-toggle">
                <button 
                  className={`mode-btn ${filterMode === 'date' ? 'active' : ''}`}
                  onClick={() => setFilterMode('date')}
                >
                  By Date Range
                </button>
                <button 
                  className={`mode-btn ${filterMode === 'month' ? 'active' : ''}`}
                  onClick={() => setFilterMode('month')}
                >
                  By Month
                </button>
              </div>
              <div className="filters-row">
                {filterMode === 'date' ? (
                  <>
                    <div className="filter-group">
                      <label className="filter-label">Start Date</label>
                      <input
                        type="date"
                        className="filter-input"
                        value={filters.start_date}
                        onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                      />
                    </div>
                    <div className="filter-group">
                      <label className="filter-label">End Date</label>
                      <input
                        type="date"
                        className="filter-input"
                        value={filters.end_date}
                        onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <div className="filter-group">
                    <label className="filter-label">Select Month</label>
                    <input
                      type="month"
                      className="filter-input"
                      value={filters.month}
                      onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                    />
                  </div>
                )}
                
                <div className="filter-group">
                  <label className="filter-label">Staff Position</label>
                  <select
                    className="filter-input"
                    value={filters.role}
                    onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                  >
                    {STAFF_ROLES.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="filter-actions">
                  <button className="btn btn-primary" onClick={handleSearch}>
                    <Search size={16} /> Search
                  </button>
                  <button className="btn btn-secondary" onClick={handleClearFilters}>
                    <RefreshCw size={16} /> Clear
                  </button>
                  <button className="btn btn-secondary" onClick={exportToDOC}>
                    <Download size={16} /> Export DOC
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Summary Stats */}
          {detailedAttendance?.summary && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{detailedAttendance.summary.total}</div>
                <div className="stat-label">Total Records</div>
              </div>
              <div className="stat-card">
                <div className="stat-value present">{detailedAttendance.summary.present}</div>
                <div className="stat-label">Present</div>
              </div>
              <div className="stat-card">
                <div className="stat-value absent">{detailedAttendance.summary.absent}</div>
                <div className="stat-label">Absent</div>
              </div>
              <div className="stat-card">
                <div className="stat-value rate">{detailedAttendance.summary.attendance_rate}%</div>
                <div className="stat-label">Attendance Rate</div>
              </div>
            </div>
          )}
          
          {/* Attendance by Role */}
          {detailedAttendance?.by_role && Object.keys(detailedAttendance.by_role).length > 0 && (
            <div className="table-container" style={{ marginBottom: '1.5rem' }}>
              <div className="table-header">
                <div className="table-title">Attendance by Position</div>
              </div>
              <div className="by-role-grid" style={{ padding: '1rem 1.5rem' }}>
                {Object.entries(detailedAttendance.by_role).map(([role, data]) => (
                  <div key={role} className="role-stat">
                    <div className="role-name">{role.replace('_', ' ')}</div>
                    <div className="role-rate" style={{ 
                      color: data.total > 0 ? (data.present / data.total >= 0.8 ? '#22c55e' : data.present / data.total >= 0.5 ? '#f59e0b' : '#ef4444') : '#64748b'
                    }}>
                      {data.total > 0 ? Math.round((data.present / data.total) * 100) : 0}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {data.present} / {data.total} present
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Detailed Records Table */}
          <div className="table-container" style={{ background: 'white' }}>
            <div className="table-header" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <div className="table-title" style={{ color: '#1e293b' }}>Attendance Records</div>
              <span className="records-count" style={{ background: '#e2e8f0', color: '#475569' }}>
                {detailedAttendance?.records?.length || 0} records
              </span>
            </div>
            
            {loading ? (
              <LoadingSpinner message="Loading attendance data..." />
            ) : detailedAttendance?.records?.length > 0 ? (
              <>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                <thead>
                  <tr>
                    <th style={{ background: '#f1f5f9', color: '#475569', borderBottom: '2px solid #e2e8f0', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Date</th>
                    <th style={{ background: '#f1f5f9', color: '#475569', borderBottom: '2px solid #e2e8f0', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Staff Name</th>
                    <th style={{ background: '#f1f5f9', color: '#475569', borderBottom: '2px solid #e2e8f0', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Position</th>
                    <th style={{ background: '#f1f5f9', color: '#475569', borderBottom: '2px solid #e2e8f0', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                    <th style={{ background: '#f1f5f9', color: '#475569', borderBottom: '2px solid #e2e8f0', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Check-in</th>
                    <th style={{ background: '#f1f5f9', color: '#475569', borderBottom: '2px solid #e2e8f0', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Check-out</th>
                    <th style={{ background: '#f1f5f9', color: '#475569', borderBottom: '2px solid #e2e8f0', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Late</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedAttendance.records.slice((attendancePage - 1) * attendancePageSize, attendancePage * attendancePageSize).map((record, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.75rem 1rem', color: '#1e293b', fontSize: '0.875rem' }}>{record.date}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#1e293b', fontSize: '0.875rem' }}>{record.staff_name || 'N/A'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                        <span style={{ display: 'inline-block', padding: '0.25rem 0.5rem', background: '#ede9fe', borderRadius: '0.375rem', color: '#7c3aed', fontSize: '0.75rem', fontWeight: 500, textTransform: 'capitalize' }}>{record.staff_role || 'N/A'}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                        <span style={{ display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', background: record.status === 'present' ? '#dcfce7' : record.status === 'late' ? '#fef3c7' : '#fee2e2', color: record.status === 'present' ? '#166534' : record.status === 'late' ? '#92400e' : '#991b1b' }}>
                          {record.status || 'absent'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#166534', fontWeight: 500, fontSize: '0.875rem' }}>{record.check_in_time || '-'}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#4338ca', fontWeight: 500, fontSize: '0.875rem' }}>{record.check_out_time || '-'}</td>
                      <td style={{ padding: '0.75rem 1rem', color: record.is_late ? '#b45309' : '#94a3b8', fontWeight: record.is_late ? 600 : 400, fontSize: '0.875rem' }}>
                        {record.is_late ? record.check_in_time : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Pagination Controls */}
              {detailedAttendance.records.length > attendancePageSize && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderTop: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Showing {(attendancePage - 1) * attendancePageSize + 1}–{Math.min(attendancePage * attendancePageSize, detailedAttendance.records.length)} of {detailedAttendance.records.length} records
                  </span>
                  <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <button
                      onClick={() => setAttendancePage(p => Math.max(1, p - 1))}
                      disabled={attendancePage === 1}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '0.375rem',
                        border: '1px solid #e2e8f0',
                        background: attendancePage === 1 ? '#f1f5f9' : 'white',
                        color: attendancePage === 1 ? '#94a3b8' : '#1e293b',
                        cursor: attendancePage === 1 ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 500
                      }}
                    >
                      ‹ Prev
                    </button>
                    {Array.from({ length: Math.ceil(detailedAttendance.records.length / attendancePageSize) }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === Math.ceil(detailedAttendance.records.length / attendancePageSize) || Math.abs(p - attendancePage) <= 2)
                      .reduce((acc, p, i, arr) => {
                        if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) => p === '...' ? (
                        <span key={`ellipsis-${i}`} style={{ padding: '0.35rem 0.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setAttendancePage(p)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #e2e8f0',
                            background: p === attendancePage ? '#0ea5e9' : 'white',
                            color: p === attendancePage ? 'white' : '#1e293b',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: p === attendancePage ? 600 : 500
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    <button
                      onClick={() => setAttendancePage(p => Math.min(Math.ceil(detailedAttendance.records.length / attendancePageSize), p + 1))}
                      disabled={attendancePage === Math.ceil(detailedAttendance.records.length / attendancePageSize)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '0.375rem',
                        border: '1px solid #e2e8f0',
                        background: attendancePage === Math.ceil(detailedAttendance.records.length / attendancePageSize) ? '#f1f5f9' : 'white',
                        color: attendancePage === Math.ceil(detailedAttendance.records.length / attendancePageSize) ? '#94a3b8' : '#1e293b',
                        cursor: attendancePage === Math.ceil(detailedAttendance.records.length / attendancePageSize) ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 500
                      }}
                    >
                      Next ›
                    </button>
                  </div>
                </div>
              )}
              </>
            ) : (
              <div className="empty-state">
                No attendance records found. Try adjusting your filters.
              </div>
            )}
          </div>
        </>
      )}
      
      {activeTab === 'financial' && canViewFinancialReports && (
        <FinancialReportsTab currentUser={currentUser} selectedChain={selectedChain} />
      )}
      
      {activeTab === 'academic' && (
        <AcademicReportsTab selectedChain={selectedChain} />
      )}

      {activeTab === 'uniform' && (
        <UniformReport />
      )}
    </div>
  );
}



// Financial Reports Tab Component - Secretary, Director, Principal only
function FinancialReportsTab({ currentUser, selectedChain }) {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [feeTypeFilter, setFeeTypeFilter] = useState('all');
  const [showSpecialDetailsModal, setShowSpecialDetailsModal] = useState(false);
  const [specialNotes, setSpecialNotes] = useState('');
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState(null);
  // Student detail card (opened by tapping a student's name) - shows all fee
  // details in a vertically scrollable card, ideal for mobile where the wide
  // table columns cannot all fit on screen.
  const [selectedStudentForCard, setSelectedStudentForCard] = useState(null);
  // Pagination for the financial report table (20 rows per page)
  const [page, setPage] = useState(1);
  const pageSize = 20;


  const isSecretary = currentUser?.role?.toLowerCase() === 'secretary';

  const FEE_TYPES = [
    { value: 'all', label: 'All Fee Types' },
    { value: 'tuition', label: 'Tuition Fee' },
    { value: 'half_day', label: 'Half Day' },
    { value: 'full_day', label: 'Full Day' },
    { value: 'uniform', label: 'Uniform Fee' },
    { value: 'admission', label: 'Admission Fee' }
  ];

  const STATUS_FILTERS = [
    { value: 'all', label: 'All Status' },
    { value: 'paid', label: 'Fully Paid' },
    { value: 'partial', label: 'Partial' },
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'graduated', label: 'Graduated' },
    { value: 'left', label: 'Left School' }
  ];


  useEffect(() => {
    loadAllStudentFees();
  }, [selectedChain]);

  useEffect(() => {
    applyFilters();
  }, [students, searchTerm, statusFilter, feeTypeFilter]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('sessionToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  };

  const loadAllStudentFees = async () => {
    // AbortController + timeout so a slow/hung backend (which Cloudflare
    // surfaces as a 520) doesn't leave the request hanging forever. After
    // 30s we abort and show a friendly message instead of silently retrying.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedChain) params.append('chain', selectedChain);
      // Use the dedicated lightweight financial-report-students endpoint.
      // This returns the summary totals AND the per-student table rows in ONE
      // fast response WITHOUT any receipt images. Previously this tab called
      // /api/all-student-fees?page_size=1000 which was heavy and caused Nginx
      // upstream timeouts (Cloudflare 520) because it had to process and strip
      // receipt images for every student.
      //
      // IMPORTANT: This tab paginates CLIENT-SIDE (20 rows per page), so we
      // must fetch EVERY student in one request. Without an explicit page_size
      // the backend defaulted to 50, which silently hid every student after
      // position 50 (e.g. names sorting late in the alphabet) from the report.
      params.append('page', '1');
      params.append('page_size', '1000');
      const url = `${API_URL}/api/financial-report-students${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        headers: getAuthHeaders(),
        signal: controller.signal
      });
      if (response.ok) {
        const data = await response.json();
        // New endpoint returns { summary: {...}, students: [...] }.
        // Fall back to the old shapes for safety.
        if (data && data.students) {
          setStudents(data.students);
          // Store the backend-computed summary so the active totals
          // (which EXCLUDE graduated / left-school students) are used.
          if (data.summary) {
            setSummary(data.summary);
          }
        } else if (Array.isArray(data)) {
          setStudents(data);
          setSummary(null);
        } else {
          setStudents([]);
          setSummary(null);
        }
      } else {
        // Non-OK response (e.g. Cloudflare 520, 500, 502). Show a friendly
        // message instead of silently failing.
        console.error(`Financial report request failed with HTTP ${response.status}`);
        toast.error('Server busy, please try again in a moment.');
      }
    } catch (error) {
      console.error('Failed to load student fees:', error);
      if (error?.name === 'AbortError') {
        // Request timed out (30s) — the backend is likely overloaded.
        toast.error('The report is taking too long to load. Please try again.');
      } else {
        toast.error('Server busy, please try again in a moment.');
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };


  const applyFilters = () => {
    let result = [...students];
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s => 
        s.name?.toLowerCase().includes(term) ||
        s.admission_no?.toLowerCase().includes(term) ||
        s.class_name?.toLowerCase().includes(term)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      // Graduated / left-school students are identified by their admission
      // status (student_status), not their fee status. All other filters use
      // the fee payment status.
      if (statusFilter === 'graduated' || statusFilter === 'left') {
        result = result.filter(s => (s.student_status || '').toLowerCase() === statusFilter);
      } else {
        result = result.filter(s => s.status === statusFilter);
      }
    }
    
    // Fee type filter - uses the fee_type from student data
    if (feeTypeFilter !== 'all') {
      result = result.filter(s => s.fee_type === feeTypeFilter);
    }
    
    setFilteredStudents(result);
    // Reset to first page whenever filters change
    setPage(1);
  };


  const handleSaveSpecialDetails = async (e) => {
    e.preventDefault();
    if (!selectedStudentForDetails) return;
    
    try {
      const response = await fetch(`${API_URL}/api/student-special-details`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          student_id: selectedStudentForDetails.id,
          special_notes: specialNotes,
          added_by: currentUser?.id
        })
      });
      
      if (response.ok) {
        toast.success('Special details saved successfully');
        setShowSpecialDetailsModal(false);
        setSpecialNotes('');
        setSelectedStudentForDetails(null);
        loadAllStudentFees();
      } else {
        throw new Error('Failed to save details');
      }
    } catch (error) {
      toast.error('Failed to save special details');
    }
  };

  const openSpecialDetailsModal = async (student) => {
    setSelectedStudentForDetails(student);
    setSpecialNotes(student.special_notes || '');
    setShowSpecialDetailsModal(true);
  };

  // Export functions
  const exportToCSV = () => {
    let csv = 'Student Financial Report\n\n';
    csv += 'Name,Admission No,Class,Total Fee,Paid,Outstanding,Status,Fee Type\n';
    
    filteredStudents.forEach(s => {
      const displayStatus = ['graduated', 'left'].includes((s.student_status || '').toLowerCase())
        ? ((s.student_status || '').toLowerCase() === 'graduated' ? 'Graduated' : 'Left School')
        : (s.status === 'paid' ? 'Fully Paid' : s.status === 'partial' ? 'Partial' : 'Unpaid');
      csv += `"${s.name}","${s.admission_no}","${s.class_name}",${s.total_fees || 0},${s.total_paid || s.paid || 0},${s.balance || s.outstanding || 0},"${displayStatus}","${s.fee_type || 'tuition'}"\n`;
    });

    
    csv += `\nTotal Students,${totals.totalStudents}\n`;
    csv += `Total Expected,${totals.totalExpected}\n`;
    csv += `Total Collected,${totals.totalCollected}\n`;
    csv += `Outstanding Balance,${totals.totalOutstanding}\n`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportToDOC = () => {
    const docContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" 
            xmlns:w="urn:schemas-microsoft-com:office:word">
      <head><meta charset="utf-8"><title>Financial Report</title>
      <style>
        body { font-family: Arial, sans-serif; background: white; color: #000; }
        h1 { color: #0f4c81; text-align: center; background: white; }
        p { color: #333; background: white; }
        .summary { margin: 20px 0; background: white; padding: 10px; }
        .summary-item { margin: 5px 0; color: #000; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; background: white; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; color: #000; background: white; }
        th { background: #f5f5f5; color: #000; }
        .paid { color: green; }
        .partial { color: orange; }
        .unpaid { color: red; }
        small { color: #666; }
      </style>
      </head>
      <body style="background: white;">
        <h1>IHEZA School - Financial Report</h1>
        <p style="text-align:center; color: #333;">${new Date().toLocaleDateString()}</p>
        
        <div class="summary">
          <div class="summary-item"><strong>Total Students:</strong> ${totals.totalStudents}</div>
          <div class="summary-item"><strong>Expected Revenue:</strong> TZS ${totals.totalExpected.toLocaleString()}</div>
          <div class="summary-item"><strong>Total Collected:</strong> TZS ${totals.totalCollected.toLocaleString()}</div>
          <div class="summary-item"><strong>Outstanding:</strong> TZS ${totals.totalOutstanding.toLocaleString()}</div>
        </div>
        
        <table>
          <thead>
            <tr><th>Student</th><th>Class</th><th>Total Fee</th><th>Paid</th><th>Outstanding</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${filteredStudents.map(s => `
              <tr>
                <td>${s.name}<br/><small>${s.admission_no}</small></td>
                <td>${s.class_name}</td>
                <td>TZS ${(s.total_fees || 0).toLocaleString()}</td>
                <td style="color: green;">TZS ${(s.total_paid || s.paid || 0).toLocaleString()}</td>
                <td style="color: red;">TZS ${(s.balance || s.outstanding || 0).toLocaleString()}</td>
                <td class="${['graduated', 'left'].includes((s.student_status || '').toLowerCase()) ? (s.student_status || '').toLowerCase() : s.status}">${['graduated', 'left'].includes((s.student_status || '').toLowerCase()) ? ((s.student_status || '').toLowerCase() === 'graduated' ? 'Graduated' : 'Left School') : (s.status === 'paid' ? 'Fully Paid' : s.status === 'partial' ? 'Partial' : 'Unpaid')}</td>

              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    const blob = new Blob([docContent], { type: 'application/msword' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial_report_${new Date().toISOString().split('T')[0]}.doc`;
    a.click();
  };

  // Calculate totals.
  // When the backend summary is available, use it for the ACTIVE student
  // totals (which EXCLUDE graduated / left-school students). This keeps the
  // financial report consistent with the admission status: when a student is
  // marked graduated or left school, they are removed from the outstanding
  // balance and active student counts. The per-student table still shows them
  // (so the school can see what they owe), but they no longer affect the
  // headline analytics.
  const totals = summary ? {
    totalStudents: summary.total_students || 0,
    totalExpected: summary.total_expected || 0,
    totalCollected: summary.total_collected || 0,
    totalOutstanding: summary.outstanding_balance || 0,
    paidCount: summary.paid_count || 0,
    partialCount: summary.partial_count || 0,
    unpaidCount: summary.unpaid_count || 0,
    graduatedCount: summary.graduated_count || 0,
    leftCount: summary.left_count || 0
  } : {
    totalStudents: filteredStudents.length,
    totalExpected: filteredStudents.reduce((sum, s) => sum + (s.total_fees || 0), 0),
    totalCollected: filteredStudents.reduce((sum, s) => sum + (s.total_paid || s.paid || 0), 0),
    totalOutstanding: filteredStudents.reduce((sum, s) => sum + (s.balance || s.outstanding || 0), 0),
    paidCount: filteredStudents.filter(s => s.status === 'paid').length,
    partialCount: filteredStudents.filter(s => s.status === 'partial').length,
    unpaidCount: filteredStudents.filter(s => s.status === 'unpaid').length,
    graduatedCount: filteredStudents.filter(s => (s.student_status || '').toLowerCase() === 'graduated').length,
    leftCount: filteredStudents.filter(s => (s.student_status || '').toLowerCase() === 'left').length
  };


  return (
    <div>
      <style>{`
        .fin-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(115px, 1fr));
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }
        
        .fin-stat-card {
          background: white;
          border-radius: 0.5rem;
          padding: 0 0.5rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border-left: 4px solid #0ea5e9;
          height: 50px;
          min-height: 50px;
          max-height: 50px;
          overflow: hidden;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          /* The card background should end exactly where the content ends:
             no extra empty space below the label. */
          align-content: center;
        }
        
        .fin-stat-card.success { border-left-color: #22c55e; }
        .fin-stat-card.warning { border-left-color: #f59e0b; }
        .fin-stat-card.danger { border-left-color: #ef4444; }
        
        .fin-stat-value {
          font-size: 0.8rem;
          font-weight: 700;
          color: #1e293b;
          line-height: 1.1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          width: 100%;
        }
        
        .fin-stat-label {
          font-size: 0.55rem;
          color: #64748b;
          margin-top: 2px;
          line-height: 1.1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          width: 100%;
        }

        
        .fin-filters {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          align-items: center;
        }
        
        .fin-filter-input {
          flex: 1;
          min-width: 200px;
          padding: 0.75rem 1rem;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          color: #1e293b;
        }
        
        .fin-filter-select {
          padding: 0.75rem 1rem;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          color: #1e293b;
          min-width: 150px;
        }
        
        .fin-table-container {
          background: white;
          border-radius: 0.75rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        
        .fin-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .fin-table th {
          background: #f8fafc;
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          color: #64748b;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .fin-table td {
          padding: 1rem;
          border-bottom: 1px solid #f1f5f9;
          color: #1e293b;
        }
        
        .fin-table tr:hover td {
          background: #f8fafc;
        }
        
        .fin-status-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
        }
        
        .fin-status-badge.paid {
          background: #dcfce7;
          color: #166534;
        }
        
        .fin-status-badge.partial {
          background: #fef3c7;
          color: #92400e;
        }
        
        .fin-status-badge.unpaid {
          background: #fee2e2;
          color: #991b1b;
        }
        
        .fin-status-badge.graduated {
          background: #dbeafe;
          color: #1e40af;
        }
        
        .fin-status-badge.left {
          background: #f3e8ff;
          color: #6b21a8;
        }
        
        .fin-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        
        .fin-btn-primary {
          background: #0ea5e9;
          color: white;
        }
        
        .fin-btn-primary:hover {
          background: #0284c7;
        }
        
        .fin-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .fin-modal {
          background: white;
          border-radius: 1rem;
          padding: 1.5rem;
          width: 90%;
          max-width: 500px;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        }
        
        .fin-modal-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 1rem;
        }
        
        .fin-form-group {
          margin-bottom: 1rem;
        }
        
        .fin-form-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #475569;
          margin-bottom: 0.5rem;
        }
        
        .fin-form-input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 0.875rem;
        }
        
        .fin-modal-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 1.5rem;
        }
        
        .fin-btn-secondary {
          background: #f1f5f9;
          color: #475569;
        }
        
        .fin-btn-secondary:hover {
          background: #e2e8f0;
        }

        /* Clickable student name in the financial table */
        .fin-student-name-btn {
          background: none;
          border: none;
          padding: 0;
          margin: 0;
          text-align: left;
          font: inherit;
          font-weight: 600;
          color: #0ea5e9;
          cursor: pointer;
          line-height: 1.3;
          transition: color 0.15s;
        }
        .fin-student-name-btn:hover {
          color: #0284c7;
          text-decoration: underline;
        }
        .fin-student-name-btn:focus-visible {
          outline: 2px solid #0ea5e9;
          outline-offset: 2px;
          border-radius: 4px;
        }

        /* Student detail card modal (vertically scrollable) */
        .fin-card-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          padding: 1rem;
        }
        .fin-card {
          background: #ffffff;
          border-radius: 1rem;
          width: 100%;
          max-width: 420px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35);
          animation: finCardIn 0.2s ease-out;
        }
        @keyframes finCardIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .fin-card-header {
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
          color: white;
          padding: 1.25rem 1.25rem 1rem;
          position: relative;
          flex-shrink: 0;
        }
        .fin-card-close {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          width: 30px;
          height: 30px;
          border-radius: 9999px;
          border: none;
          background: rgba(255,255,255,0.2);
          color: white;
          font-size: 1.1rem;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }
        .fin-card-close:hover {
          background: rgba(255,255,255,0.35);
        }
        .fin-card-name {
          font-size: 1.05rem;
          font-weight: 700;
          line-height: 1.25;
          padding-right: 2rem;
        }
        .fin-card-adm {
          font-size: 0.75rem;
          opacity: 0.9;
          margin-top: 0.25rem;
        }
        .fin-card-body {
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: 1rem 1.25rem 1.25rem;
          flex: 1;
        }
        .fin-card-status-row {
          display: flex;
          justify-content: center;
          margin-bottom: 1rem;
        }
        .fin-card-status-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.35rem 1rem;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .fin-card-status-badge.paid { background: #dcfce7; color: #166534; }
        .fin-card-status-badge.partial { background: #fef3c7; color: #92400e; }
        .fin-card-status-badge.unpaid { background: #fee2e2; color: #991b1b; }
        .fin-card-status-badge.graduated { background: #dbeafe; color: #1e40af; }
        .fin-card-status-badge.left { background: #f3e8ff; color: #6b21a8; }
        .fin-card-amounts {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .fin-card-amount {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          padding: 0.75rem;
          text-align: center;
        }
        .fin-card-amount.full {
          grid-column: 1 / -1;
        }
        .fin-card-amount .amt-label {
          font-size: 0.65rem;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 0.25rem;
        }
        .fin-card-amount .amt-value {
          font-size: 1rem;
          font-weight: 700;
          color: #1e293b;
          white-space: nowrap;
        }
        .fin-card-amount .amt-value.green { color: #16a34a; }
        .fin-card-amount .amt-value.red { color: #dc2626; }
        .fin-card-amount .amt-value.blue { color: #0284c7; }
        .fin-card-details {
          border-top: 1px solid #e2e8f0;
          padding-top: 0.75rem;
        }
        .fin-card-detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px dashed #f1f5f9;
          font-size: 0.85rem;
        }
        .fin-card-detail-row:last-child {
          border-bottom: none;
        }
        .fin-card-detail-row .d-label {
          color: #64748b;
        }
        .fin-card-detail-row .d-value {
          color: #1e293b;
          font-weight: 600;
          text-align: right;
          text-transform: capitalize;
        }
        .fin-card-hint {
          margin-top: 0.75rem;
          font-size: 0.7rem;
          color: #94a3b8;
          text-align: center;
        }
      `}</style>

      
      {/* Summary Stats */}
      <div className="fin-stats-grid">
        <div className="fin-stat-card">
          <div className="fin-stat-value">{totals.totalStudents}</div>
          <div className="fin-stat-label">Total Students</div>
        </div>
        <div className="fin-stat-card">
          <div className="fin-stat-value">TZS {totals.totalExpected.toLocaleString()}</div>
          <div className="fin-stat-label">Expected Revenue</div>
        </div>
        <div className="fin-stat-card success">
          <div className="fin-stat-value">TZS {totals.totalCollected.toLocaleString()}</div>
          <div className="fin-stat-label">Collected ({totals.paidCount} Paid)</div>
        </div>
        <div className="fin-stat-card warning">
          <div className="fin-stat-value">{totals.partialCount}</div>
          <div className="fin-stat-label">Partial Payments</div>
        </div>
        <div className="fin-stat-card danger">
          <div className="fin-stat-value">TZS {totals.totalOutstanding.toLocaleString()}</div>
          <div className="fin-stat-label">Outstanding ({totals.unpaidCount} Unpaid)</div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="fin-filters">
        <input
          type="text"
          className="fin-filter-input"
          placeholder="Search by name, admission no, or class..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="fin-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_FILTERS.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <select
          className="fin-filter-select"
          value={feeTypeFilter}
          onChange={(e) => setFeeTypeFilter(e.target.value)}
        >
          {FEE_TYPES.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <button className="fin-btn fin-btn-primary" onClick={loadAllStudentFees}>
          <RefreshCw size={16} /> Refresh
        </button>
        <button 
          className="fin-btn" 
          onClick={exportToDOC}
          style={{ background: '#6366f1', color: 'white' }}
        >
          <Download size={16} /> Export DOC
        </button>
        <button 
          className="fin-btn" 
          onClick={exportToCSV}
          style={{ background: '#22c55e', color: 'white' }}
        >
          <Download size={16} /> Export CSV
        </button>
      </div>
      
      {/* Student Fees Table */}
      <div className="fin-table-container">
        {loading ? (
          <LoadingSpinner message="Loading financial report..." />
        ) : (
          <>
          <table className="fin-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Total Fee</th>
                <th>Paid</th>
                <th>Outstanding</th>
                <th>Status</th>
                {isSecretary && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredStudents.slice((page - 1) * pageSize, page * pageSize).map((student, index) => (
                <tr key={`${student.id || student.admission_no || 'student'}-${index}`}>

                  <td>
                    <button
                      type="button"
                      className="fin-student-name-btn"
                      onClick={() => setSelectedStudentForCard(student)}
                      title="Tap to view full fee details"
                    >
                      {student.name}
                    </button>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{student.admission_no}</div>
                  </td>

                  <td>{student.class_name}</td>
                  <td>TZS {(student.total_fees || 0).toLocaleString()}</td>
                  <td style={{ color: '#22c55e', fontWeight: 500 }}>TZS {(student.total_paid || student.paid || 0).toLocaleString()}</td>
                  <td style={{ color: '#ef4444', fontWeight: 500 }}>TZS {(student.balance || student.outstanding || 0).toLocaleString()}</td>
                  <td>
                    {['graduated', 'left'].includes((student.student_status || '').toLowerCase()) ? (
                      <span className={`fin-status-badge ${(student.student_status || '').toLowerCase()}`}>
                        {(student.student_status || '').toLowerCase() === 'graduated' ? 'Graduated' : 'Left School'}
                      </span>
                    ) : (
                      <span className={`fin-status-badge ${student.status}`}>
                        {student.status === 'paid' ? 'Fully Paid' : student.status === 'partial' ? 'Partial' : 'Unpaid'}
                      </span>
                    )}
                  </td>

                  {isSecretary && (
                    <td>
                      <button 
                        className="fin-btn fin-btn-primary"
                        onClick={() => openSpecialDetailsModal(student)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                      >
                        <FileText size={14} /> Special Details
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={isSecretary ? 7 : 6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    No students found matching your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {/* Pagination Controls */}
          {filteredStudents.length > pageSize && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredStudents.length)} of {filteredStudents.length} students
              </span>
              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e2e8f0',
                    background: page === 1 ? '#f1f5f9' : 'white',
                    color: page === 1 ? '#94a3b8' : '#1e293b',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 500
                  }}
                >
                  ‹ Prev
                </button>
                {Array.from({ length: Math.ceil(filteredStudents.length / pageSize) }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === Math.ceil(filteredStudents.length / pageSize) || Math.abs(p - page) <= 2)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) => p === '...' ? (
                    <span key={`ellipsis-${i}`} style={{ padding: '0.35rem 0.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '0.375rem',
                        border: '1px solid #e2e8f0',
                        background: p === page ? '#0ea5e9' : 'white',
                        color: p === page ? 'white' : '#1e293b',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: p === page ? 600 : 500
                      }}
                    >
                      {p}
                    </button>
                  ))}
                <button
                  onClick={() => setPage(p => Math.min(Math.ceil(filteredStudents.length / pageSize), p + 1))}
                  disabled={page === Math.ceil(filteredStudents.length / pageSize)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e2e8f0',
                    background: page === Math.ceil(filteredStudents.length / pageSize) ? '#f1f5f9' : 'white',
                    color: page === Math.ceil(filteredStudents.length / pageSize) ? '#94a3b8' : '#1e293b',
                    cursor: page === Math.ceil(filteredStudents.length / pageSize) ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 500
                  }}
                >
                  Next ›
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>
      
      {/* Student Detail Card Modal - opened by tapping a student's name.
          Shows all fee details in a vertically scrollable card so that on
          mobile (where the wide table columns overflow) every field is still
          readable. */}
      {selectedStudentForCard && (
        <div className="fin-card-overlay" onClick={() => setSelectedStudentForCard(null)}>
          <div className="fin-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="fin-card-header">
              <button
                type="button"
                className="fin-card-close"
                onClick={() => setSelectedStudentForCard(null)}
                aria-label="Close"
              >
                ✕
              </button>
              <div className="fin-card-name">{selectedStudentForCard.name}</div>
              <div className="fin-card-adm">{selectedStudentForCard.admission_no}</div>
            </div>
            <div className="fin-card-body">
              <div className="fin-card-status-row">
                {['graduated', 'left'].includes((selectedStudentForCard.student_status || '').toLowerCase()) ? (
                  <span className={`fin-card-status-badge ${(selectedStudentForCard.student_status || '').toLowerCase()}`}>
                    {(selectedStudentForCard.student_status || '').toLowerCase() === 'graduated' ? 'Graduated' : 'Left School'}
                  </span>
                ) : (
                  <span className={`fin-card-status-badge ${selectedStudentForCard.status}`}>
                    {selectedStudentForCard.status === 'paid' ? 'Fully Paid' : selectedStudentForCard.status === 'partial' ? 'Partial' : 'Unpaid'}
                  </span>
                )}
              </div>

              <div className="fin-card-amounts">
                <div className="fin-card-amount full">
                  <div className="amt-label">Total Fee</div>
                  <div className="amt-value blue">TZS {(selectedStudentForCard.total_fees || 0).toLocaleString()}</div>
                </div>
                <div className="fin-card-amount">
                  <div className="amt-label">Paid</div>
                  <div className="amt-value green">TZS {(selectedStudentForCard.total_paid || selectedStudentForCard.paid || 0).toLocaleString()}</div>
                </div>
                <div className="fin-card-amount">
                  <div className="amt-label">Outstanding</div>
                  <div className="amt-value red">TZS {(selectedStudentForCard.balance || selectedStudentForCard.outstanding || 0).toLocaleString()}</div>
                </div>
              </div>

              <div className="fin-card-details">
                <div className="fin-card-detail-row">
                  <span className="d-label">Class</span>
                  <span className="d-value">{selectedStudentForCard.class_name || 'N/A'}</span>
                </div>
                <div className="fin-card-detail-row">
                  <span className="d-label">Fee Type</span>
                  <span className="d-value">{selectedStudentForCard.fee_type || 'tuition'}</span>
                </div>
                <div className="fin-card-detail-row">
                  <span className="d-label">Admission Status</span>
                  <span className="d-value">{selectedStudentForCard.student_status || 'active'}</span>
                </div>
                <div className="fin-card-detail-row">
                  <span className="d-label">Payment Status</span>
                  <span className="d-value">{selectedStudentForCard.status || 'unpaid'}</span>
                </div>
              </div>

              <div className="fin-card-hint">Scroll for more details</div>
            </div>
          </div>
        </div>
      )}

      {/* Special Details Modal - Secretary Only - Text Area for Notes */}
      {showSpecialDetailsModal && selectedStudentForDetails && (

        <div className="fin-modal-overlay" onClick={() => setShowSpecialDetailsModal(false)}>
          <div className="fin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3 className="fin-modal-title">Special Details</h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
              Student: <strong>{selectedStudentForDetails.name}</strong> ({selectedStudentForDetails.admission_no})
            </p>
            <form onSubmit={handleSaveSpecialDetails}>
              <div className="fin-form-group">
                <label className="fin-form-label">Special Notes & Details</label>
                <textarea
                  className="fin-form-input"
                  rows={8}
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="Enter any special details, notes, or remarks about this student's fees...

Example:
- Full day student (TZS 1,975,000)
- Uniform paid: T-shirt, Trouser, Sport wear
- Family discount: 3rd child (-50,000)
- Special arrangement for payment installments
- Notes about fee waivers or scholarships"
                  style={{ 
                    resize: 'vertical', 
                    minHeight: '200px',
                    fontFamily: 'inherit',
                    lineHeight: '1.5'
                  }}
                />
              </div>
              <div className="fin-modal-actions">
                <button type="button" className="fin-btn fin-btn-secondary" onClick={() => setShowSpecialDetailsModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn fin-btn-primary">
                  Save Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Academic Reports Tab Component - Shows student report cards for everyone
function AcademicReportsTab({ selectedChain }) {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const terms = ['Term 1', 'Term 2', 'Term 3', 'Final'];
  const academicYear = new Date().getFullYear().toString();

  useEffect(() => {
    loadClasses();
    // Reset selection when chain changes
    setSelectedClass('');
    setSelectedStudent(null);
    setReportData(null);
  }, [selectedChain]);

  useEffect(() => {
    if (selectedClass) {
      loadStudents();
    }
  }, [selectedClass, selectedChain]);

  useEffect(() => {
    if (selectedStudent) {
      loadReportCard();
    }
  }, [selectedStudent, selectedTerm]);

  const loadClasses = async () => {
    try {
      const data = await dataService.getClasses(selectedChain);
      setClasses(data);
    } catch (error) {
      console.error('Failed to load classes:', error);
    }
  };

  const loadStudents = async () => {
    try {
      const data = await studentService.getStudents(selectedClass, selectedChain);
      setStudents(data);
    } catch (error) {
      console.error('Failed to load students:', error);
    }
  };

  const loadReportCard = async () => {
    if (!selectedStudent) return;
    
    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/api/student-report-card/${selectedStudent.id}?term=${encodeURIComponent(selectedTerm)}&academic_year=${academicYear}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      } else {
        setReportData(null);
      }
    } catch (error) {
      console.error('Failed to load report card:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade) => {
    const colors = { A: '#22c55e', B: '#3b82f6', C: '#8b5cf6', D: '#f59e0b', F: '#ef4444' };
    return colors[grade] || '#64748b';
  };

  const renderStars = (count) => '★'.repeat(count || 0) + '☆'.repeat(5 - (count || 0));

  const handleDownloadReportCard = () => {
    if (!selectedStudent || !reportData) {
      toast.error('No report card data to download');
      return;
    }
    
    try {
      exportReportCard(reportData, selectedStudent);
      toast.success('Report card downloaded successfully');
    } catch (error) {
      console.error('Failed to download report card:', error);
      toast.error('Failed to download report card');
    }
  };

  return (
    <div>
      <style>{`
        .academic-filters {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }
        
        .academic-filter-group {
          flex: 1;
          min-width: 180px;
        }
        
        .academic-filter-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 500;
          color: #94a3b8;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
        }
        
        .academic-filter-select {
          width: 100%;
          padding: 0.75rem;
          background: rgba(51, 65, 85, 0.5);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 0.5rem;
          color: #f8fafc;
          font-size: 0.875rem;
        }
        
        .academic-filter-select:focus {
          outline: none;
          border-color: #8b5cf6;
        }
        
        .report-card-container {
          background: white;
          border-radius: 1rem;
          overflow: hidden;
          color: #333;
        }
        
        .rc-header {
          background: linear-gradient(135deg, #0f4c81 0%, #1a5f9e 100%);
          color: white;
          padding: 1.5rem;
          text-align: center;
        }
        
        .rc-school-name {
          font-size: 1.5rem;
          font-weight: 700;
        }
        
        .rc-school-subtitle {
          font-size: 0.75rem;
          opacity: 0.9;
        }
        
        .rc-title {
          margin-top: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          background: rgba(255,255,255,0.2);
          display: inline-block;
          padding: 0.5rem 1rem;
          border-radius: 4px;
        }
        
        .rc-student-info {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          padding: 1.5rem;
          background: #f8f9fa;
        }
        
        .rc-info-item label {
          font-size: 0.65rem;
          color: #666;
          text-transform: uppercase;
          display: block;
        }
        
        .rc-info-item span {
          font-weight: 600;
          color: #333;
        }
        
        .rc-grades-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .rc-grades-table th {
          background: #0f4c81;
          color: white;
          padding: 0.75rem;
          text-align: left;
          font-size: 0.75rem;
        }
        
        .rc-grades-table td {
          padding: 0.75rem;
          border-bottom: 1px solid #e0e0e0;
          color: #1a1a1a;
        }
        
        .rc-grades-table tr:nth-child(even) {
          background: #f9f9f9;
        }
        
        .rc-grades-table tr:nth-child(odd) {
          background: #ffffff;
        }
        
        .rc-grade-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 0.75rem;
          color: white;
        }
        
        .rc-summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          padding: 1.5rem;
          background: #f0f4f8;
        }
        
        .rc-summary-box {
          text-align: center;
        }
        
        .rc-summary-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #0f4c81;
        }
        
        .rc-summary-label {
          font-size: 0.65rem;
          color: #666;
          text-transform: uppercase;
        }
        
        .rc-section {
          padding: 1rem 1.5rem;
        }
        
        .rc-section-title {
          font-size: 0.75rem;
          font-weight: 600;
          background: #e8e8e8;
          padding: 0.5rem;
          margin-bottom: 0.5rem;
        }
        
        .rc-behavior-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 0.5rem;
          text-align: center;
        }
        
        .rc-behavior-label {
          font-size: 0.7rem;
          color: #666;
          text-transform: capitalize;
        }
        
        .rc-stars {
          color: #f59e0b;
        }
        
        .rc-comment-box {
          padding: 0.75rem;
          background: #f9f9f9;
          border-left: 3px solid #0f4c81;
          margin: 0.5rem 0;
        }
        
        .rc-comment-label {
          font-size: 0.65rem;
          color: #666;
          margin-bottom: 0.25rem;
        }
        
        .academic-empty {
          text-align: center;
          padding: 3rem;
          color: #64748b;
        }
        
        .academic-empty-icon {
          width: 64px;
          height: 64px;
          background: rgba(51, 65, 85, 0.3);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem;
        }
      `}</style>
      
      {/* Filters */}
      <div className="academic-filters">
        <div className="academic-filter-group">
          <label className="academic-filter-label">Select Class</label>
          <select
            className="academic-filter-select"
            value={selectedClass}
            onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudent(null); setReportData(null); }}
            data-testid="academic-class-select"
          >
            <option value="">Choose a class...</option>
            {classes.map((cls, index) => (
              <option key={`${cls.id ?? 'cls'}-${index}`} value={cls.name}>{cls.name}</option>
            ))}

          </select>
        </div>
        
        {selectedClass && (
          <div className="academic-filter-group">
            <label className="academic-filter-label">Select Student</label>
            <select
              className="academic-filter-select"
              value={selectedStudent?.id || ''}
              onChange={(e) => {
                const student = students.find(s => s.id === e.target.value);
                setSelectedStudent(student || null);
              }}
              data-testid="academic-student-select"
            >
              <option value="">Choose a student...</option>
              {students.map((student, index) => (
                <option key={`${student.id ?? student.admission_no ?? 'stu'}-${index}`} value={student.id}>
                  {student.first_name} {student.last_name} ({student.admission_no})
                </option>
              ))}

            </select>
          </div>
        )}
        
        <div className="academic-filter-group">
          <label className="academic-filter-label">Term</label>
          <select
            className="academic-filter-select"
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
          >
            {terms.map(term => (
              <option key={term} value={term}>{term}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Report Card Display */}
      {!selectedStudent ? (
        <div className="academic-empty">
          <div className="academic-empty-icon">
            <Users size={32} />
          </div>
          <h3 style={{ color: '#f8fafc', marginBottom: '0.5rem' }}>View Student Report Cards</h3>
          <p>Select a class and student above to view their academic report card</p>
        </div>
      ) : loading ? (
        <div className="academic-empty">Loading report card...</div>
      ) : (
        <div className="report-card-container">
          {/* Download Button */}
          <div style={{ 
            padding: '1rem 1.5rem', 
            background: '#f8fafc', 
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem'
          }}>
            <button
              onClick={handleDownloadReportCard}
              disabled={!reportData}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: reportData ? 'linear-gradient(135deg, #0369a1, #0284c7)' : '#94a3b8',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: reportData ? 'pointer' : 'not-allowed',
                fontWeight: 500,
                fontSize: '0.875rem'
              }}
              data-testid="download-report-card-btn"
            >
              <Download size={16} />
              Download as DOC
            </button>
          </div>
          
          <div className="rc-header">
            <div className="rc-school-name">IHEZA</div>
            <div className="rc-school-subtitle">The Institute of Holistic Education of Zanzibar</div>
            <div className="rc-title">STUDENT REPORT CARD - {selectedTerm.toUpperCase()} {academicYear}</div>
          </div>
          
          <div className="rc-student-info">
            <div className="rc-info-item">
              <label>Student Name</label>
              <span>{selectedStudent.first_name} {selectedStudent.last_name}</span>
            </div>
            <div className="rc-info-item">
              <label>Admission No.</label>
              <span>{selectedStudent.admission_no}</span>
            </div>
            <div className="rc-info-item">
              <label>Class</label>
              <span>{selectedStudent.class_name}</span>
            </div>
            <div className="rc-info-item">
              <label>Position</label>
              <span>{reportData?.position || '-'} / {reportData?.total_students || '-'}</span>
            </div>
          </div>
          
          <table className="rc-grades-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Score</th>
                <th>Grade</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {reportData?.grades?.length > 0 ? (
                reportData.grades.map((g, idx) => (
                  <tr key={idx}>
                    <td>{g.subject_name}</td>
                    <td>{g.score}</td>
                    <td>
                      <span className="rc-grade-badge" style={{ background: getGradeColor(g.grade) }}>
                        {g.grade}
                      </span>
                    </td>
                    <td>{g.remarks || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#666' }}>
                    No grades recorded for this term
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          
          <div className="rc-summary">
            <div className="rc-summary-box">
              <div className="rc-summary-value">{reportData?.grades?.length || 0}</div>
              <div className="rc-summary-label">Subjects</div>
            </div>
            <div className="rc-summary-box">
              <div className="rc-summary-value">{reportData?.total_score || 0}</div>
              <div className="rc-summary-label">Total Score</div>
            </div>
            <div className="rc-summary-box">
              <div className="rc-summary-value">{reportData?.average?.toFixed(1) || 0}</div>
              <div className="rc-summary-label">Average</div>
            </div>
            <div className="rc-summary-box">
              <div className="rc-summary-value">
                <span className="rc-grade-badge" style={{ background: getGradeColor(reportData?.overall_grade) }}>
                  {reportData?.overall_grade || '-'}
                </span>
              </div>
              <div className="rc-summary-label">Overall</div>
            </div>
          </div>
          
          {/* Behavior & Conduct */}
          {reportData?.behavior_marks && (
            <div className="rc-section">
              <div className="rc-section-title">BEHAVIOR & CONDUCT</div>
              <div className="rc-behavior-grid">
                {['neatness', 'cooperation', 'responsibility', 'punctuality', 'discipline'].map(mark => (
                  <div key={mark}>
                    <div className="rc-behavior-label">{mark}</div>
                    <div className="rc-stars">{renderStars(reportData.behavior_marks[mark])}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Comments */}
          <div className="rc-section">
            <div className="rc-section-title">COMMENTS</div>
            <div className="rc-comment-box">
              <div className="rc-comment-label">Teacher's Comment</div>
              <div>{reportData?.teacher_comment || 'No comment'}</div>
            </div>
            <div className="rc-comment-box">
              <div className="rc-comment-label">Principal's Comment</div>
              <div>{reportData?.principal_comment || 'No comment'}</div>
            </div>
          </div>
          
          {/* Status indicator */}
          {reportData?.sent_to_student && (
            <div style={{ padding: '1rem 1.5rem', background: '#dcfce7', color: '#166534', fontSize: '0.875rem' }}>
              ✓ This report card has been sent to the student's portal
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Reports;
