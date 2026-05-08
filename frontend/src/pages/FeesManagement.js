import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { studentService } from '../services/studentService';
import { toast } from 'sonner';
import { 
  DollarSign, Edit2, Trash2, Search, X, 
  CreditCard, Users, MessageCircle, Check, AlertCircle
} from 'lucide-react';
import ChainToggle from '../components/ChainToggle';
import { API_URL } from '../config/api';

function FeesManagement() {
  const currentUser = useSelector(selectCurrentUser);
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentFeeData, setStudentFeeData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Editable total fees state
  const [editingTotalFees, setEditingTotalFees] = useState(false);
  const [totalFeesInput, setTotalFeesInput] = useState('');
  const [savingTotalFees, setSavingTotalFees] = useState(false);
  const totalFeesTimeoutRef = useRef(null);
  
    const [selectedChain, setSelectedChain] = useState('');
  
  const [paymentForm, setPaymentForm] = useState({
    fee_structure_id: '', amount: '', payment_method: 'cash', reference_no: '', notes: '',
    uniform_fee: '', admission_fee: ''
  });

  const [editingPayment, setEditingPayment] = useState(null);
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);

  // Fee type options for payment modal
  const FEE_TYPE_OPTIONS = [
    { id: 'full_day', name: 'Full Day (Continuing)', amount: 1975000 },
    { id: 'half_day', name: 'Half Day (Tuition)', amount: 1575000 },
    { id: 'uniform', name: 'Uniform Fee', amount: 100000 },
    { id: 'admission', name: 'Admission Fee', amount: 160000 },
    { id: 'custom', name: 'Custom Amount', amount: 0 }
  ];

  const canManageFees = ['secretary', 'principal', 'director', 'coordinator'].includes(currentUser?.role?.toLowerCase());

  const getAuthHeaders = () => {
    const token = localStorage.getItem('sessionToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  };

  useEffect(() => {
    loadData(selectedChain);
  }, [selectedChain]);

  const loadData = async (chain = '') => {
    setLoading(true);
    const headers = getAuthHeaders();
    try {
      // Load students and payments
      const studentsData = await studentService.getStudents();
      setStudents(studentsData);
      
      let url = `${API_URL}/api/payments`;
      if (chain) {
        url += `?chain=${chain}`;
      }
      const response = await fetch(url, { headers });
      const data = await response.json();
      setPayments(data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStudent = async (student) => {
    setSelectedStudent(student);
    setEditingTotalFees(false);
    try {
      const response = await fetch(`${API_URL}/api/student-fees/${student.id}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setStudentFeeData(data);
      setTotalFeesInput(data.total_fees?.toString() || '0');
    } catch (error) {
      toast.error('Failed to load student fees');
    }
  };

  // Auto-save total fees with debounce
  const saveTotalFees = useCallback(async (newAmount) => {
    if (!selectedStudent) return;
    
    const numAmount = parseFloat(newAmount);
    if (isNaN(numAmount) || numAmount < 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    setSavingTotalFees(true);
    try {
      const response = await fetch(`${API_URL}/api/student-fees/${selectedStudent.id}/total`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ total_fees: numAmount })
      });
      
      if (response.ok) {
        const result = await response.json();
        // Update local state with new values
        setStudentFeeData(prev => ({
          ...prev,
          total_fees: result.total_fees,
          balance: result.balance,
          status: result.status === 'paid' ? 'fully_paid' : result.status
        }));
        toast.success('Total fees updated');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to update total fees');
      }
    } catch (error) {
      toast.error('Failed to update total fees');
    } finally {
      setSavingTotalFees(false);
      setEditingTotalFees(false);
    }
  }, [selectedStudent]);

  const handleTotalFeesChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, ''); // Only allow numbers
    setTotalFeesInput(value);
    
    // Clear existing timeout
    if (totalFeesTimeoutRef.current) {
      clearTimeout(totalFeesTimeoutRef.current);
    }
    
    // Set new timeout for auto-save after 1.5 seconds of no typing
    totalFeesTimeoutRef.current = setTimeout(() => {
      if (value && value !== studentFeeData?.total_fees?.toString()) {
        saveTotalFees(value);
      }
    }, 1500);
  };

  const handleTotalFeesBlur = () => {
    // Clear any pending timeout
    if (totalFeesTimeoutRef.current) {
      clearTimeout(totalFeesTimeoutRef.current);
    }
    
    // Save immediately on blur if value changed
    if (totalFeesInput && totalFeesInput !== studentFeeData?.total_fees?.toString()) {
      saveTotalFees(totalFeesInput);
    } else {
      setEditingTotalFees(false);
    }
  };

  const handleTotalFeesKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      setTotalFeesInput(studentFeeData?.total_fees?.toString() || '0');
      setEditingTotalFees(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;
    
    try {
      const response = await fetch(`${API_URL}/api/payments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          student_id: selectedStudent.id,
          fee_type: paymentForm.fee_structure_id, // full_day, half_day, uniform, admission, custom
          amount: parseFloat(paymentForm.amount),
          payment_method: paymentForm.payment_method,
          reference_no: paymentForm.reference_no,
          notes: paymentForm.notes,
          uniform_fee_details: paymentForm.uniform_fee,
          admission_fee_details: paymentForm.admission_fee,
          chain: selectedStudent.chain,
          received_by: currentUser?.id || 'unknown'
        })
      });
      
      if (response.ok) {
        toast.success('Payment recorded');
        setShowPaymentModal(false);
        setPaymentForm({ fee_structure_id: '', amount: '', payment_method: 'cash', reference_no: '', notes: '', uniform_fee: '', admission_fee: '' });
        handleSelectStudent(selectedStudent);
        loadData();
      } else {
        throw new Error('Failed to record payment');
      }
    } catch (error) {
      toast.error('Failed to record payment');
    }
  };

  const handleEditPayment = (payment) => {
    setEditingPayment(payment);
    setPaymentForm({
      fee_structure_id: payment.fee_type || '',
      amount: payment.amount?.toString() || '',
      payment_method: payment.payment_method || 'cash',
      reference_no: payment.reference_no || '',
      notes: payment.notes || '',
      uniform_fee: payment.uniform_fee_details || '',
      admission_fee: payment.admission_fee_details || ''
    });
    setShowEditPaymentModal(true);
  };

  const handleUpdatePayment = async (e) => {
    e.preventDefault();
    if (!editingPayment) return;
    
    try {
      const response = await fetch(`${API_URL}/api/payments/${editingPayment.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fee_type: paymentForm.fee_structure_id,
          amount: parseFloat(paymentForm.amount),
          payment_method: paymentForm.payment_method,
          reference_no: paymentForm.reference_no,
          notes: paymentForm.notes,
          uniform_fee_details: paymentForm.uniform_fee,
          admission_fee_details: paymentForm.admission_fee
        })
      });
      
      if (response.ok) {
        toast.success('Payment updated successfully');
        setShowEditPaymentModal(false);
        setEditingPayment(null);
        setPaymentForm({ fee_structure_id: '', amount: '', payment_method: 'cash', reference_no: '', notes: '', uniform_fee: '', admission_fee: '' });
        handleSelectStudent(selectedStudent);
        loadData();
      } else {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to update payment');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to update payment');
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Are you sure you want to delete this payment record? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/payments/${paymentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        toast.success('Payment deleted successfully');
        handleSelectStudent(selectedStudent);
        loadData();
      } else {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to delete payment');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete payment');
    }
  };

  // WhatsApp share function for payment info
  const shareToWhatsApp = () => {
    if (!selectedStudent || !studentFeeData) return;
    
    const studentName = `${selectedStudent.first_name} ${selectedStudent.last_name}`;
    const admNo = selectedStudent.admission_no;
    const totalFee = studentFeeData.total_fees?.toLocaleString() || '0';
    const paidAmount = studentFeeData.total_paid?.toLocaleString() || '0';
    const balance = studentFeeData.balance?.toLocaleString() || '0';
    const status = studentFeeData.status === 'fully_paid' ? 'Fully Paid' : studentFeeData.status === 'partial' ? 'Partial' : 'Unpaid';
    
    let paymentHistory = '';
    if (studentFeeData.payments?.length > 0) {
      paymentHistory = '\n\n*Payment History:*\n';
      studentFeeData.payments.forEach(p => {
        paymentHistory += `- TZS ${p.amount?.toLocaleString()} (${p.reference_no}) - ${new Date(p.created_at).toLocaleDateString()}\n`;
      });
    }
    
    const message = `*IHEZA SCHOOL - Fee Statement*\n\n` +
      `*Student:* ${studentName}\n` +
      `*Admission No:* ${admNo}\n\n` +
      `*Total Fees:* TZS ${totalFee}\n` +
      `*Paid:* TZS ${paidAmount}\n` +
      `*Balance:* TZS ${balance}\n` +
      `*Status:* ${status}` +
      paymentHistory +
      `\n\n_Deniz Primary School_\n_Email: denizprimary@gmail.com_\n_Phone: 0748 555525 / 0776101088_`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const filteredStudents = students.filter(s => {
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
    const admNo = s.admission_no?.toLowerCase() || '';
    return fullName.includes(searchTerm.toLowerCase()) || admNo.includes(searchTerm.toLowerCase());
  });

  const getStatusBadge = (status) => {
    switch(status) {
      case 'fully_paid': return <span className="status-badge paid"><Check size={12}/> Fully Paid</span>;
      case 'partial': return <span className="status-badge partial"><AlertCircle size={12}/> Partial</span>;
      default: return <span className="status-badge unpaid"><AlertCircle size={12}/> Unpaid</span>;
    }
  };

  const exportToCSV = () => {
    if (!financialReport) return;
    
    let csv = 'Financial Report\n\n';
    csv += `Total Students,${financialReport.total_students}\n`;
    csv += `Total Expected,${financialReport.total_expected}\n`;
    csv += `Total Collected,${financialReport.total_collected}\n`;
    csv += `Outstanding Balance,${financialReport.outstanding_balance}\n`;
    csv += `Collection Rate,${financialReport.collection_rate}%\n`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="fees-page">
      <ChainToggle selectedChain={selectedChain} onChainChange={(chain) => {
        setSelectedChain(chain);
        loadData(chain);
      }} />
      <style>{`
        .fees-page { padding: 1.5rem; }
        .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
        .page-title { font-size: 1.5rem; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 0.75rem; }
        .page-title-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        
        .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; padding: 0.25rem; background: rgba(51, 65, 85, 0.3); border-radius: 0.75rem; width: fit-content; }
        .tab { padding: 0.75rem 1.5rem; background: transparent; border: none; border-radius: 0.5rem; color: #94a3b8; font-weight: 500; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem; }
        .tab:hover { color: #f8fafc; }
        .tab.active { background: #22c55e; color: white; }
        
        .content-grid { display: grid; grid-template-columns: 350px 1fr; gap: 1.5rem; }
        @media (max-width: 1024px) { .content-grid { grid-template-columns: 1fr; } }
        
        .panel { background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 1rem; padding: 1.25rem; }
        .panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
        .panel-title { font-size: 0.875rem; font-weight: 600; color: #94a3b8; display: flex; align-items: center; gap: 0.5rem; }
        
        .structure-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .structure-card { background: rgba(51, 65, 85, 0.3); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.75rem; padding: 1rem; }
        .structure-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.5rem; }
        .structure-name { font-weight: 600; color: #f8fafc; }
        .structure-amount { font-size: 1.25rem; font-weight: 700; color: #22c55e; }
        .structure-meta { font-size: 0.75rem; color: #64748b; }
        .structure-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
        
        .search-box { position: relative; margin-bottom: 1rem; }
        .search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #64748b; }
        .search-input { width: 100%; padding: 0.75rem 0.75rem 0.75rem 2.5rem; background: rgba(51, 65, 85, 0.5); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.5rem; color: #f8fafc; font-size: 0.875rem; }
        
        .student-list { max-height: 400px; overflow-y: auto; }
        .student-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s; }
        .student-item:hover { background: rgba(51, 65, 85, 0.5); }
        .student-item.selected { background: rgba(34, 197, 94, 0.2); border: 1px solid rgba(34, 197, 94, 0.5); }
        .student-avatar { width: 36px; height: 36px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 600; color: white; font-size: 0.875rem; }
        .student-info { flex: 1; }
        .student-name { font-weight: 500; color: #f8fafc; font-size: 0.875rem; }
        .student-code { font-size: 0.7rem; color: #64748b; font-family: monospace; }
        
        .fee-summary { }
        .summary-header { text-align: center; padding: 1.5rem; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 0.75rem 0.75rem 0 0; margin: -1.25rem -1.25rem 1rem; }
        .summary-name { font-size: 1.25rem; font-weight: 600; color: white; }
        .summary-code { font-size: 0.75rem; color: rgba(255,255,255,0.8); }
        
        .fee-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem; }
        .fee-stat { text-align: center; padding: 1rem; background: rgba(51, 65, 85, 0.3); border-radius: 0.5rem; }
        .fee-stat-value { font-size: 1.25rem; font-weight: 700; }
        .fee-stat-label { font-size: 0.7rem; color: #64748b; text-transform: uppercase; }
        
        .status-badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
        .status-badge.paid { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
        .status-badge.partial { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
        .status-badge.unpaid { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        
        .fee-breakdown { margin-top: 1rem; }
        .fee-item { display: flex; justify-content: space-between; padding: 0.75rem; border-bottom: 1px solid rgba(51, 65, 85, 0.5); }
        .fee-item:last-child { border-bottom: none; }
        
        .payment-history { margin-top: 1rem; }
        .payment-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(51, 65, 85, 0.3); border-radius: 0.5rem; margin-bottom: 0.5rem; }
        .payment-amount { font-weight: 600; color: #22c55e; }
        .payment-date { font-size: 0.75rem; color: #64748b; }
        .payment-item .action-btn { padding: 0.35rem; border-radius: 0.35rem; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .payment-item .action-btn.edit { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
        .payment-item .action-btn.edit:hover { background: rgba(59, 130, 246, 0.4); }
        .payment-item .action-btn.delete { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        .payment-item .action-btn.delete:hover { background: rgba(239, 68, 68, 0.4); }
        
        /* Financial Report */
        .report-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
        @media (max-width: 768px) { .report-cards { grid-template-columns: repeat(2, 1fr); } }
        .report-card { background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 1rem; padding: 1.25rem; text-align: center; }
        .report-value { font-size: 1.75rem; font-weight: 700; color: #f8fafc; }
        .report-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; margin-top: 0.25rem; }
        
        .progress-bar { height: 12px; background: rgba(51, 65, 85, 0.5); border-radius: 6px; overflow: hidden; margin: 1rem 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%); border-radius: 6px; transition: width 0.5s ease; }
        
        /* Modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal { background: #1e293b; border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 1rem; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem; border-bottom: 1px solid rgba(51, 65, 85, 0.5); }
        .modal-title { font-size: 1.125rem; font-weight: 600; color: #f8fafc; }
        .modal-close { background: none; border: none; color: #64748b; cursor: pointer; padding: 0.5rem; }
        .modal-body { padding: 1.25rem; }
        .modal-footer { display: flex; gap: 1rem; justify-content: flex-end; padding: 1.25rem; border-top: 1px solid rgba(51, 65, 85, 0.5); }
        
        .form-group { margin-bottom: 1rem; }
        .form-label { display: block; font-size: 0.75rem; font-weight: 500; color: #94a3b8; margin-bottom: 0.5rem; text-transform: uppercase; }
        .form-input, .form-select { width: 100%; padding: 0.75rem; background: rgba(51, 65, 85, 0.5); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.5rem; color: #f8fafc; font-size: 0.875rem; }
        .form-input:focus, .form-select:focus { outline: none; border-color: #22c55e; }
        
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        
        .empty-state { text-align: center; padding: 3rem; color: #64748b; }
        
        .action-btn { padding: 0.5rem; background: rgba(51, 65, 85, 0.5); border: none; border-radius: 0.5rem; color: #94a3b8; cursor: pointer; transition: all 0.2s; }
        .action-btn:hover { background: rgba(51, 65, 85, 0.8); color: #f8fafc; }
        .action-btn.edit:hover { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
        .action-btn.delete:hover { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
      `}</style>
      
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <DollarSign size={20} color="white" />
          </span>
          Fees Management
        </h1>
      </div>
      
      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : (
        <>
          {/* Payments Section */}
          <div className="content-grid">
              <div className="panel">
                <div className="panel-title"><Users size={16} /> Select Student</div>
                
                <div className="search-box">
                  <Search className="search-icon" size={16} />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search student..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="student-list">
                  {filteredStudents.map(student => (
                    <div
                      key={student.id}
                      className={`student-item ${selectedStudent?.id === student.id ? 'selected' : ''}`}
                      onClick={() => handleSelectStudent(student)}
                    >
                      <div className="student-avatar">
                        {student.first_name?.charAt(0)}
                      </div>
                      <div className="student-info">
                        <div className="student-name">{student.first_name} {student.last_name}</div>
                        <div className="student-code">{student.admission_no}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="panel">
                {!selectedStudent ? (
                  <div className="empty-state">
                    <DollarSign size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p>Select a student to view their fee status and record payments</p>
                  </div>
                ) : studentFeeData ? (
                  <div className="fee-summary">
                    <div className="summary-header">
                      <div className="summary-name">
                        {selectedStudent.first_name} {selectedStudent.last_name}
                      </div>
                      <div className="summary-code">{selectedStudent.admission_no}</div>
                    </div>
                    
                    <div className="fee-stats">
                      <div className="fee-stat" style={{ position: 'relative' }}>
                        {canManageFees && editingTotalFees ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                            <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>TZS</span>
                            <input
                              type="text"
                              value={totalFeesInput}
                              onChange={handleTotalFeesChange}
                              onBlur={handleTotalFeesBlur}
                              onKeyDown={handleTotalFeesKeyDown}
                              autoFocus
                              data-testid="total-fees-input"
                              style={{
                                width: '120px',
                                padding: '0.25rem 0.5rem',
                                fontSize: '1.25rem',
                                fontWeight: 700,
                                color: '#f8fafc',
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: '2px solid #3b82f6',
                                borderRadius: '0.375rem',
                                textAlign: 'center',
                                outline: 'none'
                              }}
                            />
                            {savingTotalFees && (
                              <div style={{ 
                                position: 'absolute', 
                                top: '-0.5rem', 
                                right: '0.5rem',
                                fontSize: '0.65rem',
                                color: '#3b82f6',
                                background: 'rgba(59, 130, 246, 0.2)',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '0.25rem'
                              }}>
                                Saving...
                              </div>
                            )}
                          </div>
                        ) : (
                          <div 
                            className="fee-stat-value" 
                            style={{ 
                              color: '#f8fafc',
                              cursor: canManageFees ? 'pointer' : 'default',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.375rem',
                              transition: 'background 0.2s',
                              ...(canManageFees && { ':hover': { background: 'rgba(255,255,255,0.1)' } })
                            }}
                            onClick={() => {
                              if (canManageFees) {
                                setEditingTotalFees(true);
                                setTotalFeesInput(studentFeeData.total_fees?.toString() || '0');
                              }
                            }}
                            onMouseEnter={(e) => {
                              if (canManageFees) {
                                e.target.style.background = 'rgba(255,255,255,0.1)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'transparent';
                            }}
                            title={canManageFees ? 'Click to edit total fees' : ''}
                            data-testid="total-fees-display"
                          >
                            TZS {studentFeeData.total_fees?.toLocaleString()}
                            {canManageFees && (
                              <Edit2 size={12} style={{ marginLeft: '0.5rem', opacity: 0.5 }} />
                            )}
                          </div>
                        )}
                        <div className="fee-stat-label">Total Fees</div>
                      </div>
                      <div className="fee-stat">
                        <div className="fee-stat-value" style={{ color: '#22c55e' }}>
                          TZS {studentFeeData.total_paid?.toLocaleString()}
                        </div>
                        <div className="fee-stat-label">Paid</div>
                      </div>
                      <div className="fee-stat">
                        <div className="fee-stat-value" style={{ color: '#ef4444' }}>
                          TZS {studentFeeData.balance?.toLocaleString()}
                        </div>
                        <div className="fee-stat-label">Balance</div>
                      </div>
                    </div>
                    
                    <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                      {getStatusBadge(studentFeeData.status)}
                    </div>
                    
                    {canManageFees && (
                      <button 
                        className="btn btn-success" 
                        style={{ width: '100%', marginBottom: '1rem' }}
                        onClick={() => setShowPaymentModal(true)}
                      >
                        <CreditCard size={16} /> Record Payment
                      </button>
                    )}
                    
                    {/* WhatsApp Share Button */}
                    <button 
                      className="btn btn-whatsapp" 
                      style={{ 
                        width: '100%', 
                        marginBottom: '1rem',
                        background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        fontWeight: 500,
                        transition: 'all 0.2s'
                      }}
                      onClick={shareToWhatsApp}
                    >
                      <MessageCircle size={16} /> Share to WhatsApp
                    </button>
                    
                    <div className="fee-breakdown">
                      <h4 style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>FEE BREAKDOWN</h4>
                      {studentFeeData.fee_structures?.map(fs => (
                        <div key={fs.id} className="fee-item">
                          <span style={{ color: '#f8fafc' }}>{fs.name}</span>
                          <span style={{ color: '#94a3b8' }}>TZS {fs.amount?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    
                    {studentFeeData.payments?.length > 0 && (
                      <div className="payment-history">
                        <h4 style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>PAYMENT HISTORY</h4>
                        {studentFeeData.payments.map(p => (
                          <div key={p.id} className="payment-item">
                            <div>
                              <div className="payment-amount">TZS {p.amount?.toLocaleString()}</div>
                              <div className="payment-date">{p.reference_no} • {p.payment_method}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div className="payment-date">
                                {new Date(p.created_at).toLocaleDateString()}
                              </div>
                              <button 
                                className="action-btn edit"
                                onClick={() => handleEditPayment(p)}
                                title="Edit Payment"
                                data-testid={`edit-payment-${p.id}`}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                className="action-btn delete"
                                onClick={() => handleDeletePayment(p.id)}
                                title="Delete Payment"
                                data-testid={`delete-payment-${p.id}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="empty-state">Loading fee data...</div>
                )}
              </div>
            </div>
        </>
      )}
      
      {/* Payment Modal */}
      {showPaymentModal && selectedStudent && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Record Payment</h2>
              <button className="modal-close" onClick={() => setShowPaymentModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="modal-body">
                <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
                  Recording payment for: <strong style={{ color: '#f8fafc' }}>
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </strong>
                </p>
                
                <div className="form-group">
                  <label className="form-label">Fee Type *</label>
                  <select
                    className="form-select"
                    value={paymentForm.fee_structure_id}
                    onChange={(e) => {
                      const selected = FEE_TYPE_OPTIONS.find(f => f.id === e.target.value);
                      setPaymentForm({
                        ...paymentForm, 
                        fee_structure_id: e.target.value,
                        amount: selected && selected.amount > 0 ? selected.amount.toString() : paymentForm.amount
                      });
                    }}
                    required
                  >
                    <option value="">Select Fee</option>
                    {FEE_TYPE_OPTIONS.map(feeType => (
                      <option key={feeType.id} value={feeType.id}>
                        {feeType.name} {feeType.amount > 0 ? `- TZS ${feeType.amount.toLocaleString()}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Amount (TZS) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                    required
                    placeholder="Enter payment amount"
                  />
                </div>
                
                {/* Uniform Fee Text Area */}
                <div className="form-group">
                  <label className="form-label">Uniform Fee Details (Optional)</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={paymentForm.uniform_fee || ''}
                    onChange={(e) => setPaymentForm({...paymentForm, uniform_fee: e.target.value})}
                    placeholder="e.g., T-shirt: 25,000, Trouser: 40,000, Sport Wear: 35,000"
                    style={{ resize: 'vertical', minHeight: '60px' }}
                  />
                </div>
                
                {/* Admission Fee Text Area */}
                <div className="form-group">
                  <label className="form-label">Admission Fee Details (Optional)</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={paymentForm.admission_fee || ''}
                    onChange={(e) => setPaymentForm({...paymentForm, admission_fee: e.target.value})}
                    placeholder="e.g., New student admission form fee"
                    style={{ resize: 'vertical', minHeight: '60px' }}
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-select"
                      value={paymentForm.payment_method}
                      onChange={(e) => setPaymentForm({...paymentForm, payment_method: e.target.value})}
                    >
                      <option value="cash">Cash</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="mobile">Mobile Money</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reference No.</label>
                    <input
                      type="text"
                      className="form-input"
                      value={paymentForm.reference_no}
                      onChange={(e) => setPaymentForm({...paymentForm, reference_no: e.target.value})}
                      placeholder="Auto-generated if empty"
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                    placeholder="Optional notes"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">
                  <CreditCard size={16} /> Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {showEditPaymentModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Edit Payment</h2>
              <button className="modal-close" onClick={() => { setShowEditPaymentModal(false); setEditingPayment(null); }}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleUpdatePayment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Fee Type</label>
                  <select
                    className="form-select"
                    value={paymentForm.fee_structure_id}
                    onChange={(e) => {
                      const selectedType = FEE_TYPE_OPTIONS.find(f => f.id === e.target.value);
                      setPaymentForm({
                        ...paymentForm,
                        fee_structure_id: e.target.value,
                        amount: selectedType && selectedType.id !== 'custom' ? selectedType.amount.toString() : paymentForm.amount
                      });
                    }}
                  >
                    <option value="">Select Fee Type</option>
                    {FEE_TYPE_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name} {opt.amount > 0 ? `(TZS ${opt.amount.toLocaleString()})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Amount (TZS) *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-select"
                      value={paymentForm.payment_method}
                      onChange={(e) => setPaymentForm({...paymentForm, payment_method: e.target.value})}
                    >
                      <option value="cash">Cash</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="mobile">Mobile Money</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Reference No.</label>
                  <input
                    type="text"
                    className="form-input"
                    value={paymentForm.reference_no}
                    onChange={(e) => setPaymentForm({...paymentForm, reference_no: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowEditPaymentModal(false); setEditingPayment(null); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">
                  <Check size={16} /> Update Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default FeesManagement;
