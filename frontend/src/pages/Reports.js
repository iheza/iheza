import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { dataService } from '../services/dataService';
import { studentService } from '../services/studentService';
import { apiClient } from '../services/authService';
import { toast } from 'sonner';
import { BarChart3, Users, Calendar, DollarSign, Download, Search, Filter, RefreshCw, Plus, FileText } from 'lucide-react';
import ChainToggle from '../components/ChainToggle';
import { API_URL } from '../config/api';
import { exportReportCard, exportAttendanceReport } from '../utils/docExport';

function Reports() {
  const currentUser = useSelector(selectCurrentUser);
  const [activeTab, setActiveTab] = useState('attendance');
  const [attendanceReport, setAttendanceReport] = useState(null);
  const [detailedAttendance, setDetailedAttendance] = useState(null);
  const [feesReport, setFeesReport] = useState(null);
  const [loading, setLoading] = useState(false);
  
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

  // Generate current month for default
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  return (
    <div className="reports-page">
      <ChainToggle selectedChain={selectedChain} onChainChange={(chain) => {
        setSelectedChain(chain);
        loadReports(chain);
      }} />
      <style>{`
        .reports-page {
          padding: 1.5rem;
        }
        
        .page-header {
          margin-bottom: 1.5rem;
        }
        
        .page-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .page-title-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          padding: 0.25rem;
          background: rgba(51, 65, 85, 0.3);
          border-radius: 0.75rem;
          width: fit-content;
        }
        
        .tab {
          padding: 0.75rem 1.5rem;
          background: transparent;
          border: none;
          border-radius: 0.5rem;
          color: #94a3b8;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .tab:hover {
          color: #f8fafc;
        }
        
        .tab.active {
          background: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
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
          justify-content: space-between;
          margin-bottom: 1rem;
        }
        
        .filters-title {
          font-size: 1rem;
          font-weight: 600;
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .filter-mode-toggle {
          display: flex;
          gap: 0.5rem;
          padding: 0.25rem;
          background: rgba(51, 65, 85, 0.5);
          border-radius: 0.5rem;
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
        }
        
        .mode-btn.active {
          background: #8b5cf6;
          color: white;
        }
        
        .filters-row {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: flex-end;
        }
        
        .filter-group {
          flex: 1;
          min-width: 150px;
        }
        
        .filter-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 500;
          color: #94a3b8;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
        }
        
        .filter-input {
          width: 100%;
          padding: 0.625rem 0.75rem;
          background: rgba(51, 65, 85, 0.5);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 0.5rem;
          color: #f8fafc;
          font-size: 0.875rem;
        }
        
        .filter-input:focus {
          outline: none;
          border-color: #8b5cf6;
        }
        
        .filter-actions {
          display: flex;
          gap: 0.5rem;
        }
        
        .btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1rem;
          border-radius: 0.5rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          font-size: 0.875rem;
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
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .stat-card {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 1rem;
          padding: 1.5rem;
          text-align: center;
        }
        
        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: #f8fafc;
        }
        
        .stat-value.present { color: #22c55e; }
        .stat-value.absent { color: #ef4444; }
        .stat-value.rate { color: #3b82f6; }
        
        .stat-label {
          font-size: 0.875rem;
          color: #64748b;
          margin-top: 0.25rem;
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
      
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <BarChart3 size={20} color="white" />
          </span>
          Reports & Analytics
        </h1>
      </div>
      
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
          data-testid="reports-tab-attendance"
        >
          <Calendar size={18} /> Attendance
        </button>
        {canViewFinancialReports && (
          <button 
            className={`tab ${activeTab === 'financial' ? 'active' : ''}`}
            onClick={() => setActiveTab('financial')}
            data-testid="reports-tab-financial"
          >
            <DollarSign size={18} /> Financial Reports
          </button>
        )}
        <button 
          className={`tab ${activeTab === 'academic' ? 'active' : ''}`}
          onClick={() => setActiveTab('academic')}
          data-testid="reports-tab-academic"
        >
          <Users size={18} /> Academic
        </button>
      </div>
      
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
          <div className="table-container">
            <div className="table-header">
              <div className="table-title">Attendance Records</div>
              <span className="records-count">
                {detailedAttendance?.records?.length || 0} records
              </span>
            </div>
            
            {loading ? (
              <div className="empty-state">Loading attendance data...</div>
            ) : detailedAttendance?.records?.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Staff Name</th>
                    <th>Position</th>
                    <th>Status</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Late</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedAttendance.records.slice(0, 50).map((record, idx) => (
                    <tr key={idx}>
                      <td>{record.date}</td>
                      <td>{record.staff_name || 'N/A'}</td>
                      <td>
                        <span className="role-badge">{record.staff_role || 'N/A'}</span>
                      </td>
                      <td>
                        <span className={`status-badge ${record.status || 'absent'}`}>
                          {record.status || 'absent'}
                        </span>
                      </td>
                      <td style={{ color: '#22c55e', fontWeight: 500 }}>{record.check_in_time || '-'}</td>
                      <td style={{ color: '#6366f1', fontWeight: 500 }}>{record.check_out_time || '-'}</td>
                      <td style={{ color: record.is_late ? '#f59e0b' : '#64748b', fontWeight: record.is_late ? 600 : 400 }}>
                        {record.is_late ? record.check_in_time : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
    </div>
  );
}


// Financial Reports Tab Component - Secretary, Director, Principal only
function FinancialReportsTab({ currentUser, selectedChain }) {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [feeTypeFilter, setFeeTypeFilter] = useState('all');
  const [showSpecialDetailsModal, setShowSpecialDetailsModal] = useState(false);
  const [specialNotes, setSpecialNotes] = useState('');
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState(null);

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
    { value: 'unpaid', label: 'Unpaid' }
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
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedChain) params.append('chain', selectedChain);
      const url = `${API_URL}/api/all-student-fees${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setStudents(data);
      }
    } catch (error) {
      console.error('Failed to load student fees:', error);
    } finally {
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
      result = result.filter(s => s.status === statusFilter);
    }
    
    // Fee type filter - uses the fee_type from student data
    if (feeTypeFilter !== 'all') {
      result = result.filter(s => s.fee_type === feeTypeFilter);
    }
    
    setFilteredStudents(result);
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
      csv += `"${s.name}","${s.admission_no}","${s.class_name}",${s.total_fee || 0},${s.paid || 0},${s.outstanding || 0},"${s.status}","${s.fee_type || 'tuition'}"\n`;
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
                <td>TZS ${(s.total_fee || 0).toLocaleString()}</td>
                <td style="color: green;">TZS ${(s.paid || 0).toLocaleString()}</td>
                <td style="color: red;">TZS ${(s.outstanding || 0).toLocaleString()}</td>
                <td class="${s.status}">${s.status === 'paid' ? 'Fully Paid' : s.status === 'partial' ? 'Partial' : 'Unpaid'}</td>
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

  // Calculate totals
  const totals = {
    totalStudents: filteredStudents.length,
    totalExpected: filteredStudents.reduce((sum, s) => sum + (s.total_fee || 0), 0),
    totalCollected: filteredStudents.reduce((sum, s) => sum + (s.paid || 0), 0),
    totalOutstanding: filteredStudents.reduce((sum, s) => sum + (s.outstanding || 0), 0),
    paidCount: filteredStudents.filter(s => s.status === 'paid').length,
    partialCount: filteredStudents.filter(s => s.status === 'partial').length,
    unpaidCount: filteredStudents.filter(s => s.status === 'unpaid').length
  };

  return (
    <div>
      <style>{`
        .fin-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .fin-stat-card {
          background: white;
          border-radius: 0.75rem;
          padding: 1.25rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border-left: 4px solid #0ea5e9;
        }
        
        .fin-stat-card.success { border-left-color: #22c55e; }
        .fin-stat-card.warning { border-left-color: #f59e0b; }
        .fin-stat-card.danger { border-left-color: #ef4444; }
        
        .fin-stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1e293b;
        }
        
        .fin-stat-label {
          font-size: 0.75rem;
          color: #64748b;
          margin-top: 0.25rem;
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
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading...</div>
        ) : (
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
              {filteredStudents.map(student => (
                <tr key={student.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{student.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{student.admission_no}</div>
                  </td>
                  <td>{student.class_name}</td>
                  <td>TZS {(student.total_fee || 0).toLocaleString()}</td>
                  <td style={{ color: '#22c55e', fontWeight: 500 }}>TZS {(student.paid || 0).toLocaleString()}</td>
                  <td style={{ color: '#ef4444', fontWeight: 500 }}>TZS {(student.outstanding || 0).toLocaleString()}</td>
                  <td>
                    <span className={`fin-status-badge ${student.status}`}>
                      {student.status === 'paid' ? 'Fully Paid' : student.status === 'partial' ? 'Partial' : 'Unpaid'}
                    </span>
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
        )}
      </div>
      
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
            {classes.map(cls => (
              <option key={cls.id} value={cls.name}>{cls.name}</option>
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
              {students.map(student => (
                <option key={student.id} value={student.id}>
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
