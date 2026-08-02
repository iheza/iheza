import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { studentService } from '../services/studentService';
import { toast } from '../hooks/useSoundEnabledToast';
import { 
  DollarSign, Edit2, Trash2, Search, X, 
  CreditCard, Users, MessageCircle, Check, AlertCircle, Image, Upload, Eye, Download, Receipt
} from 'lucide-react';
import ChainToggle from '../components/ChainToggle';
import { API_URL } from '../config/api';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';

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
  
  // All Students table view state
  const [allStudentFees, setAllStudentFees] = useState([]);
  const [loadingAllFees, setLoadingAllFees] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, page_size: 50, total: 0, total_pages: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [activeTab, setActiveTab] = useState(
    ['secretary', 'principal'].includes(currentUser?.role?.toLowerCase()) ? 'payments' : 'all-students'
  ); // 'payments' or 'all-students'
  
  // Receipt viewer modal state
  const [receiptViewer, setReceiptViewer] = useState({ open: false, images: [], currentIndex: 0, studentName: '', studentId: '' });


  // Fee type options for payment modal
  const FEE_TYPE_OPTIONS = [
    { id: 'full_day', name: 'Full Day (Continuing)', amount: 1975000 },
    { id: 'half_day', name: 'Half Day (Tuition)', amount: 1575000 },
    { id: 'uniform', name: 'Uniform Fee', amount: 100000 },
    { id: 'admission', name: 'Admission Fee', amount: 160000 },
    { id: 'custom', name: 'Custom Amount', amount: 0 }
  ];

  const canManageFees = ['secretary', 'principal', 'director', 'coordinator'].includes(currentUser?.role?.toLowerCase());
  const canViewPayments = ['secretary', 'principal'].includes(currentUser?.role?.toLowerCase());
  const canUploadReceipts = currentUser?.role === 'secretary';

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
    // Accept either student.id or student.admission_no as the identifier
    const studentId = student?.id || student?.admission_no;
    if (!student || !studentId) {
      toast.error('Invalid student selected');
      return;
    }
    setSelectedStudent(student);
    setEditingTotalFees(false);
    
    // Try fetching with the resolved studentId
    const tryFetch = async (id) => {
      const response = await fetch(`${API_URL}/api/student-fees/${encodeURIComponent(id)}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    };
    
    try {
      let data = await tryFetch(studentId);
      
      // If 404 and we have both id and admission_no, try the other one
      if (!data && student?.id && student?.admission_no && studentId !== student.admission_no) {
        data = await tryFetch(student.admission_no);
      }
      
      if (!data) {
        toast.error('Student fee data not found');
        setStudentFeeData(null);
        return;
      }
      
      setStudentFeeData(data);
      setTotalFeesInput(data.total_fees?.toString() || '0');
    } catch (error) {
      console.error('Failed to load student fees:', error);
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
      const response = await fetch(`${API_URL}/api/student-fees/${encodeURIComponent(selectedStudent.id || selectedStudent.admission_no)}/total`, {
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
          student_id: selectedStudent.id || selectedStudent.admission_no,
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

  // Receipt image upload handler (for individual payments)
  const handleUploadReceipt = (paymentId) => {
    // Create a hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Image = event.target.result;
        
        try {
          const response = await fetch(`${API_URL}/api/payments/${paymentId}/receipt`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ receipt_image: base64Image })
          });
          
          if (response.ok) {
            toast.success('Receipt uploaded successfully');
            // Refresh the student fee data to show the receipt
            handleSelectStudent(selectedStudent);
          } else {
            const err = await response.json();
            toast.error(err.detail || 'Failed to upload receipt');
          }
        } catch (error) {
          toast.error('Failed to upload receipt');
        }
      };
      reader.readAsDataURL(file);
    };
    fileInput.click();
  };

  // Delete a specific receipt image from the viewer (Secretary only)
  const handleDeleteReceiptImage = async (studentId, receiptId) => {
    if (!window.confirm('Delete this receipt image? This cannot be undone.')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/student-fees/${encodeURIComponent(studentId)}/receipt/${receiptId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        toast.success('Receipt image deleted');
        // Remove from local state
        const updatedImages = receiptViewer.images.filter(img => img.id !== receiptId);
        setReceiptViewer(prev => ({ ...prev, images: updatedImages }));
        // Refresh the all student fees table
        loadAllStudentFees();
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to delete receipt image');
      }
    } catch (error) {
      toast.error('Failed to delete receipt image');
    }
  };

  // Receipt image upload handler for the All Students table (stores at student level, not payment level)
  const handleUploadStudentReceipt = (studentId) => {
    // Create a hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Image = event.target.result;
        
        try {
          const response = await fetch(`${API_URL}/api/student-fees/${encodeURIComponent(studentId)}/receipt`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ receipt_image: base64Image })
          });
          
          if (response.ok) {
            toast.success('Receipt uploaded successfully');
            // Refresh the all student fees table to show the receipt
            loadAllStudentFees();
          } else {
            const err = await response.json();
            toast.error(err.detail || 'Failed to upload receipt');
          }
        } catch (error) {
          toast.error('Failed to upload receipt');
        }
      };
      reader.readAsDataURL(file);
    };
    fileInput.click();
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
    const studentChain = selectedStudent.chain?.toUpperCase();
    
    let paymentHistory = '';
    if (studentFeeData.payments?.length > 0) {
      paymentHistory = '\n\n*Payment History:*\n';
      studentFeeData.payments.forEach(p => {
        paymentHistory += `- TZS ${p.amount?.toLocaleString()} (${p.reference_no}) - ${new Date(p.created_at).toLocaleDateString()}\n`;
      });
    }
    
    let message;
    if (studentChain === 'LALE') {
      message = `*LALE BUSTANI CHILDREN'S ACADEMY - Fee Statement*\n\n` +
        `*Student:* ${studentName}\n` +
        `*Admission No:* ${admNo}\n\n` +
        `*Total Fees:* TZS ${totalFee}\n` +
        `*Paid:* TZS ${paidAmount}\n` +
        `*Balance:* TZS ${balance}\n` +
        `*Status:* ${status}` +
        paymentHistory +
        `\n\n_Lale Bustani Children's Academy_\n_Email: lalebustaniacademy@gmail.com_\n_Phone: +255 779 206 080_\n_Bank: EXIM BANK - 0150020984 (HOLISTIC EDUCATION OF ZANZIBAR)_`;
    } else {
      message = `*IHEZA SCHOOL - Fee Statement*\n\n` +
        `*Student:* ${studentName}\n` +
        `*Admission No:* ${admNo}\n\n` +
        `*Total Fees:* TZS ${totalFee}\n` +
        `*Paid:* TZS ${paidAmount}\n` +
        `*Balance:* TZS ${balance}\n` +
        `*Status:* ${status}` +
        paymentHistory +
        `\n\n_Deniz Primary School_\n_Email: denizprimary@gmail.com_\n_Phone: 0748 555525 / 0776101088_`;
    }
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Generate PDF with ALL receipt images using jsPDF - 2 images per page side by side
  const generateReceiptPdfBlob = async () => {
    if (!receiptViewer.images || receiptViewer.images.length === 0) return null;
    
    const studentName = receiptViewer.studentName || 'Student';
    
    // Create a new PDF document (A4 landscape for better image display)
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2 - 30; // leave room for header/footer
    
    // Determine chain name for header
    const getChainName = () => {
      const chain = selectedChain?.toUpperCase();
      if (chain === 'LALE') return 'LALE BUSTANI CHILDREN\'S ACADEMY';
      if (chain === 'DENIZ') return 'DENIZ LOWER PRIMARY';
      return 'IHEZA SCHOOL';
    };
    const chainName = getChainName();
    
    // Helper to add header to a page
    const addHeader = () => {
      pdf.setFontSize(16);
      pdf.setTextColor(15, 76, 129);
      pdf.text(`${getChainName()} - PAYMENT RECEIPT`, pageWidth / 2, margin + 5, { align: 'center' });
      pdf.setFontSize(10);
      pdf.setTextColor(80);
      pdf.text(studentName, pageWidth / 2, margin + 12, { align: 'center' });
      pdf.setDrawColor(15, 76, 129);
      pdf.setLineWidth(0.3);
      pdf.line(margin, margin + 15, pageWidth - margin, margin + 15);
    };
    
    // Helper to add footer to a page
    const addFooter = () => {
      pdf.setFontSize(7);
      pdf.setTextColor(150);
      pdf.text(`Generated on: ${new Date().toLocaleDateString()} - ${getChainName()} Management System`, pageWidth / 2, pageHeight - margin, { align: 'center' });
    };
    
    addHeader();
    addFooter();
    
    // Layout: 2 images per row, 2 rows per page = 4 images per page
    const cols = 2;
    const rowsPerPage = 2;
    const imagesPerPage = cols * rowsPerPage;
    const cellWidth = (usableWidth - 4) / cols; // small gap between columns
    const cellHeight = (usableHeight - 4) / rowsPerPage;
    
    // Filter out empty images
    const validImages = receiptViewer.images.filter(img => img?.image);
    
    for (let i = 0; i < validImages.length; i++) {
      const pageIndex = Math.floor(i / imagesPerPage);
      const posInPage = i % imagesPerPage;
      const col = posInPage % cols;
      const row = Math.floor(posInPage / cols);
      
      // Start a new page if needed (after first page)
      if (pageIndex > 0 && posInPage === 0) {
        pdf.addPage();
        addHeader();
        addFooter();
      }
      
      const x = margin + 1 + col * (cellWidth + 2);
      const y = margin + 18 + row * (cellHeight + 2);
      
      try {
        pdf.addImage(validImages[i].image, 'JPEG', x, y, cellWidth, cellHeight, undefined, 'FAST');
      } catch (e) {
        try {
          pdf.addImage(validImages[i].image, 'PNG', x, y, cellWidth, cellHeight, undefined, 'FAST');
        } catch (e2) {
          console.warn('Could not add image to PDF:', e2);
        }
      }
    }
    
    return pdf.output('blob');
  };

  // Share receipt(s) directly to WhatsApp as a PDF
  const handleShareReceiptToWhatsApp = async () => {
    if (!receiptViewer.images || receiptViewer.images.length === 0) {
      toast.error('No receipt images to share');
      return;
    }
    
    const studentName = receiptViewer.studentName || 'Student';
    
    toast.info('Generating PDF with all receipt images...');
    
    const blob = await generateReceiptPdfBlob();
    if (!blob) {
      toast.error('Failed to generate receipt PDF');
      return;
    }
    
    const fileName = `Receipt_${studentName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Try to use the Web Share API first (works on mobile browsers)
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Receipt - ${studentName}`,
            text: `Payment receipt for ${studentName}`,
            files: [file]
          });
          return;
        } catch (err) {
          // If share fails or user cancels, fall back
          if (err.name === 'AbortError') return;
        }
      }
    }
    
    // Fallback: Download the PDF and open WhatsApp with a pre-filled message
    saveAs(blob, fileName);
    toast.success('Receipt PDF downloaded! Share it via WhatsApp from your file manager.');
    
    // Open WhatsApp with a message
    const message = `Payment receipt for ${studentName} - ${chainName}\n\nReceipt PDF has been downloaded. Please attach the file from your device.`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Filter for Payments tab student list
  const filteredStudents = students.filter(s => {
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
    const admNo = s.admission_no?.toLowerCase() || '';
    return fullName.includes(searchTerm.toLowerCase()) || admNo.includes(searchTerm.toLowerCase());
  });

  // Filter for All Students table (uses allStudentFees data)
  const filteredAllStudentFees = allStudentFees.filter(s => {
    const fullName = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
    const admNo = (s.admission_no || '').toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) || admNo.includes(searchTerm.toLowerCase());
  });

  const getStatusBadge = (status) => {
    switch(status) {
      case 'fully_paid': return <span className="status-badge paid"><Check size={12}/> Fully Paid</span>;
      case 'partial': return <span className="status-badge partial"><AlertCircle size={12}/> Partial</span>;
      default: return <span className="status-badge unpaid"><AlertCircle size={12}/> Unpaid</span>;
    }
  };

  // Load all student fees for the table view (paginated)
  const loadAllStudentFees = async (page = currentPage, size = pageSize) => {
    setLoadingAllFees(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('page_size', size);
      if (selectedChain) {
        params.set('chain', selectedChain);
      }
      const url = `${API_URL}/api/all-student-fees?${params.toString()}`;
      const response = await fetch(url, { headers: getAuthHeaders() });
      if (!response.ok) {
        console.error('Server error response:', response.status, response.statusText);
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      // Handle both paginated response { students: [...], pagination: {...} } and flat array fallback
      if (data && data.students) {
        setAllStudentFees(data.students);
        setPagination(data.pagination || { page, page_size: size, total: 0, total_pages: 0 });
      } else if (Array.isArray(data)) {
        // Legacy flat array response
        setAllStudentFees(data);
        setPagination({ page: 1, page_size: data.length, total: data.length, total_pages: 1 });
      } else {
        setAllStudentFees([]);
        setPagination({ page: 1, page_size: size, total: 0, total_pages: 0 });
      }
    } catch (error) {
      console.error('Failed to load all student fees:', error);
      toast.error('Failed to load student fee data');
    } finally {
      setLoadingAllFees(false);
    }
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.total_pages) return;
    setCurrentPage(newPage);
    loadAllStudentFees(newPage, pageSize);
  };

  // Handle page size change
  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
    loadAllStudentFees(1, newSize);
  };

  useEffect(() => {
    if (activeTab === 'all-students') {
      setCurrentPage(1);
      loadAllStudentFees(1, pageSize);
    }
  }, [activeTab, selectedChain]);

  const exportToCSV = () => {
    if (!allStudentFees || allStudentFees.length === 0) {
      toast.error('No data to export');
      return;
    }
    
    const totalStudents = allStudentFees.length;
    const totalExpected = allStudentFees.reduce((sum, s) => sum + (s.total_fees || 0), 0);
    const totalCollected = allStudentFees.reduce((sum, s) => sum + (s.total_paid || 0), 0);
    const outstandingBalance = allStudentFees.reduce((sum, s) => sum + (s.balance || 0), 0);
    const collectionRate = totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(1) : '0.0';
    
    let csv = 'Financial Report\n\n';
    csv += `Total Students,${totalStudents}\n`;
    csv += `Total Expected,${totalExpected}\n`;
    csv += `Total Collected,${totalCollected}\n`;
    csv += `Outstanding Balance,${outstandingBalance}\n`;
    csv += `Collection Rate,${collectionRate}%\n`;
    
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
        
        /* Receipt icon animations */
        @keyframes receiptPulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        .receipt-icon-pulse {
          animation: receiptPulse 1.5s ease-in-out infinite;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .receipt-icon-static {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          opacity: 0.5;
        }
      `}</style>
      
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <DollarSign size={20} color="white" />
          </span>
          Fees Management
        </h1>
      </div>
      
      {/* Tabs */}
      <div className="tabs">
        {canViewPayments && (
          <button 
            className={`tab ${activeTab === 'payments' ? 'active' : ''}`}
            onClick={() => setActiveTab('payments')}
          >
            <CreditCard size={16} /> Payments
          </button>
        )}
        <button 
          className={`tab ${activeTab === 'all-students' ? 'active' : ''}`}
          onClick={() => setActiveTab('all-students')}
        >
          <Users size={16} /> All Students
        </button>
      </div>

      {activeTab === 'payments' ? (
        loading ? (
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
                  {filteredStudents.map((student, index) => (
                    <div
                      key={student.id || student.admission_no || index}
                      className={`student-item ${(selectedStudent?.id && selectedStudent.id === student.id) || (selectedStudent?.admission_no && selectedStudent.admission_no === student.admission_no) ? 'selected' : ''}`}
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
                    
                        {/* Receipt Images from student_fees level (uploaded from All Students table) */}
                    {studentFeeData.receipt_images && studentFeeData.receipt_images.length > 0 && (
                      <div className="payment-history">
                        <h4 style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>RECEIPT IMAGES</h4>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                          <button 
                            className="action-btn"
                            onClick={() => setReceiptViewer({ open: true, images: studentFeeData.receipt_images, currentIndex: 0, studentName: `${selectedStudent?.first_name || ''} ${selectedStudent?.last_name || ''}`, studentId: selectedStudent?.id || '' })}
                            title="View All Receipts"
                            style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', padding: '0.5rem 1rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                          >
                            <Eye size={16} /> View {studentFeeData.receipt_images.length} Receipt{studentFeeData.receipt_images.length > 1 ? 's' : ''}
                          </button>
                          {currentUser?.role === 'secretary' && (
                            <button 
                              className="action-btn"
                              onClick={() => handleUploadStudentReceipt(selectedStudent?.id || selectedStudent?.admission_no)}
                              title="Upload Another Receipt"
                              style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', padding: '0.5rem 1rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                            >
                              <Upload size={16} /> Upload Receipt
                            </button>
                          )}
                        </div>
                      </div>
                    )}

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
                                  {/* Receipt Image */}
                                  {p.receipt_image ? (
                                    <button 
                                      className="action-btn"
                                      onClick={() => setReceiptViewer({ open: true, images: [{ image: p.receipt_image, id: '1' }], currentIndex: 0, studentName: `${selectedStudent?.first_name || ''} ${selectedStudent?.last_name || ''}`, studentId: selectedStudent?.id || '' })}
                                      title="View Receipt"
                                      style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }}
                                    >
                                      <Image size={14} />
                                    </button>
                                  ) : currentUser?.role === 'secretary' && (
                                    <button 
                                      className="action-btn"
                                      onClick={() => handleUploadReceipt(p.id)}
                                      title="Upload Receipt"
                                      style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}
                                    >
                                      <Image size={14} />
                                    </button>
                                  )}

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
                ) : selectedStudent ? (
                  <div className="empty-state">
                    <AlertCircle size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p>No fee data available for this student</p>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                      {selectedStudent.admission_no}
                    </p>
                  </div>
                ) : (
                  <div className="empty-state">
                    <DollarSign size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p>Select a student to view their fee status and record payments</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )
      ) : null}

      {activeTab === 'all-students' && (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><Users size={16} /> All Students Fee Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* Search input for filtering by name or admission number */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Search by name or admission..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(51, 65, 85, 0.5)',
                    borderRadius: '0.5rem',
                    padding: '0.4rem 0.75rem 0.4rem 2rem',
                    color: '#f8fafc',
                    fontSize: '0.8rem',
                    width: '220px',
                    outline: 'none'
                  }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    style={{
                      position: 'absolute', right: '0.25rem', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem'
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {allStudentFees.length > 0 && (
                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                  {filteredAllStudentFees.length} of {allStudentFees.length} students
                </span>
              )}
            </div>
          </div>
          
          {loadingAllFees ? (
            <div className="empty-state">Loading student fee data...</div>
          ) : allStudentFees.length === 0 ? (
            <div className="empty-state">
              <Users size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>No student fee data available</p>
            </div>
          ) : (
            <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: '#94a3b8', fontWeight: 600 }}>Student</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: '#94a3b8', fontWeight: 600 }}>Class</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: '#94a3b8', fontWeight: 600 }}>Total Fee</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: '#94a3b8', fontWeight: 600 }}>Paid</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: '#94a3b8', fontWeight: 600 }}>Outstanding</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>Receipt</th>
                    {canViewPayments && (
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>Details</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredAllStudentFees.map((item, index) => (
                    <tr 
                      key={item.id || index}
                      style={{ 
                        borderBottom: '1px solid rgba(51, 65, 85, 0.3)',
                        transition: 'background 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => e.target.style.background = 'rgba(51, 65, 85, 0.3)'}
                      onMouseLeave={(e) => e.target.style.background = 'transparent'}
                      onClick={() => {
                        if (canViewPayments) {
                          setActiveTab('payments');
                          // Find and select this student from local students array
                          // Try matching by id first, then by admission_no (for DLP chain where IDs may differ)
                          const student = students.find(s => s.id === item.student_id) || 
                                          students.find(s => s.admission_no === item.admission_no);
                          if (student) {
                            handleSelectStudent(student);
                          } else {
                            // Student not found in local array, create a minimal student object from the fee data
                            // Use admission_no as primary id for DLP students since they may not have a local id
                            handleSelectStudent({
                              id: item.student_id || item.admission_no,
                              first_name: item.first_name,
                              last_name: item.last_name,
                              admission_no: item.admission_no,
                              chain: item.chain || selectedChain
                            });
                          }
                        }
                      }}
                    >
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="student-avatar" style={{ width: '28px', height: '28px', fontSize: '0.7rem' }}>
                            {item.first_name?.charAt(0)}
                          </div>
                          <div>
                            <div style={{ color: '#f8fafc', fontWeight: 500 }}>{item.first_name} {item.last_name}</div>
                            <div style={{ color: '#64748b', fontSize: '0.7rem', fontFamily: 'monospace' }}>{item.admission_no}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: '#94a3b8' }}>{item.class_name || '-'}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: '#f8fafc', fontWeight: 600 }}>
                        TZS {item.total_fees?.toLocaleString() || '0'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>
                        TZS {item.total_paid?.toLocaleString() || '0'}
                      </td>
                      <td style={{ 
                        padding: '0.75rem 0.5rem', 
                        textAlign: 'right', 
                        color: (item.balance > 0) ? '#ef4444' : '#22c55e', 
                        fontWeight: 600 
                      }}>
                        TZS {item.balance?.toLocaleString() || '0'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                        {getStatusBadge(item.status)}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                        {item.receipt_image ? (
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center', alignItems: 'center' }}>
                            <button 
                              className="receipt-icon-pulse"
                              onClick={(e) => {
                                e.stopPropagation();
                                // The list response only includes the latest receipt image
                                // (receipt_image) plus a receipt_count to keep the payload small.
                                // Fetch the full set of receipt images on demand when the
                                // user opens the viewer.
                                const studentId = item.student_id || item.id || item.admission_no;
                                const openViewer = (images) => {
                                  setReceiptViewer({ open: true, images, currentIndex: 0, studentName: `${item.first_name || ''} ${item.last_name || ''}`, studentId });
                                };
                                // Start with the latest image immediately for responsiveness
                                openViewer([{ image: item.receipt_image, id: 'latest' }]);
                                // Then fetch the full set of images in the background
                                fetch(`${API_URL}/api/student-fees/${encodeURIComponent(studentId)}`, { headers: getAuthHeaders() })
                                  .then(res => res.ok ? res.json() : null)
                                  .then(data => {
                                    if (data && data.receipt_images && data.receipt_images.length > 0) {
                                      openViewer(data.receipt_images);
                                    }
                                  })
                                  .catch(() => {});
                              }}
                              title="View Receipt"
                              style={{ 
                                background: 'rgba(34, 197, 94, 0.2)', 
                                color: '#22c55e',
                                border: 'none',
                                borderRadius: '0.5rem',
                                padding: '0.4rem',
                                cursor: 'pointer',
                                position: 'relative'
                              }}
                            >
                              <Receipt size={16} />
                              {item.receipt_count > 1 && (
                                <span style={{
                                  position: 'absolute',
                                  top: '-4px',
                                  right: '-4px',
                                  background: '#22c55e',
                                  color: 'white',
                                  borderRadius: '50%',
                                  width: '16px',
                                  height: '16px',
                                  fontSize: '0.6rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700
                                }}>
                                  {item.receipt_count}
                                </span>
                              )}
                            </button>
                          </div>
                        ) : currentUser?.role === 'secretary' ? (

                          <button 
                            className="action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUploadStudentReceipt(item.student_id || item.admission_no);
                            }}
                            title="Upload Receipt"
                            style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}
                          >
                            <Upload size={14} />
                          </button>
                        ) : (
                          <span className="receipt-icon-static" title="No receipt uploaded">
                            <Receipt size={16} style={{ color: '#ef4444' }} />
                          </span>
                        )}
                      </td>


                      {canViewPayments && (
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                          <button 
                            className="action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTab('payments');
                              // Try matching by id first, then by admission_no (for DLP chain where IDs may differ)
                              const student = students.find(s => s.id === item.student_id) || 
                                              students.find(s => s.admission_no === item.admission_no);
                              if (student) {
                                handleSelectStudent(student);
                              } else {
                                handleSelectStudent({
                                  id: item.student_id || item.admission_no,
                                  first_name: item.first_name,
                                  last_name: item.last_name,
                                  admission_no: item.admission_no,
                                  chain: item.chain || selectedChain
                                });
                              }
                            }}
                            title="View Payments"
                            style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            {pagination.total_pages > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 0.5rem 0',
                borderTop: '1px solid rgba(51, 65, 85, 0.3)',
                marginTop: '1rem',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                    Page {pagination.page} of {pagination.total_pages}
                    <span style={{ marginLeft: '0.5rem', color: '#64748b' }}>
                      ({pagination.total} total students)
                    </span>
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                    style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(51, 65, 85, 0.5)',
                      borderRadius: '0.375rem',
                      padding: '0.3rem 0.5rem',
                      color: '#f8fafc',
                      fontSize: '0.8rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="25">25 per page</option>
                    <option value="50">50 per page</option>
                    <option value="100">100 per page</option>
                    <option value="200">200 per page</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={pagination.page <= 1}
                    style={{
                      padding: '0.4rem 0.6rem',
                      background: pagination.page <= 1 ? 'rgba(51, 65, 85, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                      border: '1px solid rgba(71, 85, 105, 0.3)',
                      borderRadius: '0.375rem',
                      color: pagination.page <= 1 ? '#475569' : '#f8fafc',
                      cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}
                  >
                    First
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    style={{
                      padding: '0.4rem 0.6rem',
                      background: pagination.page <= 1 ? 'rgba(51, 65, 85, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                      border: '1px solid rgba(71, 85, 105, 0.3)',
                      borderRadius: '0.375rem',
                      color: pagination.page <= 1 ? '#475569' : '#f8fafc',
                      cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}
                  >
                    Prev
                  </button>
                  {/* Page number buttons */}
                  {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                    let pageNum;
                    if (pagination.total_pages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.total_pages - 2) {
                      pageNum = pagination.total_pages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        style={{
                          padding: '0.4rem 0.7rem',
                          background: pagination.page === pageNum ? '#22c55e' : 'rgba(51, 65, 85, 0.5)',
                          border: '1px solid rgba(71, 85, 105, 0.3)',
                          borderRadius: '0.375rem',
                          color: pagination.page === pageNum ? 'white' : '#f8fafc',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: pagination.page === pageNum ? 700 : 500
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.total_pages}
                    style={{
                      padding: '0.4rem 0.6rem',
                      background: pagination.page >= pagination.total_pages ? 'rgba(51, 65, 85, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                      border: '1px solid rgba(71, 85, 105, 0.3)',
                      borderRadius: '0.375rem',
                      color: pagination.page >= pagination.total_pages ? '#475569' : '#f8fafc',
                      cursor: pagination.page >= pagination.total_pages ? 'not-allowed' : 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}
                  >
                    Next
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.total_pages)}
                    disabled={pagination.page >= pagination.total_pages}
                    style={{
                      padding: '0.4rem 0.6rem',
                      background: pagination.page >= pagination.total_pages ? 'rgba(51, 65, 85, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                      border: '1px solid rgba(71, 85, 105, 0.3)',
                      borderRadius: '0.375rem',
                      color: pagination.page >= pagination.total_pages ? '#475569' : '#f8fafc',
                      cursor: pagination.page >= pagination.total_pages ? 'not-allowed' : 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
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

      {/* Receipt Viewer Modal - Shows ALL images in a 2-column grid */}
      {receiptViewer.open && (
        <div className="modal-overlay" onClick={() => setReceiptViewer({ ...receiptViewer, open: false })}>
          <div className="modal" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <Image size={18} style={{ marginRight: '0.5rem' }} />
                Receipts - {receiptViewer.studentName}
                {receiptViewer.images?.length > 0 && (
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: '0.5rem', fontWeight: 'normal' }}>
                    ({receiptViewer.images.length} image{receiptViewer.images.length > 1 ? 's' : ''})
                  </span>
                )}
              </h2>
              <button className="modal-close" onClick={() => setReceiptViewer({ ...receiptViewer, open: false })}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              {receiptViewer.images && receiptViewer.images.length > 0 ? (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '1rem',
                  maxHeight: '70vh',
                  overflowY: 'auto',
                  padding: '0.25rem'
                }}>
                  {receiptViewer.images.map((img, idx) => (
                    img?.image ? (
                      <div key={idx} style={{
                        background: 'rgba(51, 65, 85, 0.3)',
                        borderRadius: '0.5rem',
                        padding: '0.5rem',
                        border: '1px solid rgba(71, 85, 105, 0.3)',
                        position: 'relative'
                      }}>
                        <div style={{ 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0.35rem'
                        }}>
                          {receiptViewer.images.length > 1 && (
                            <div style={{ 
                              fontSize: '0.75rem', 
                              color: '#94a3b8'
                            }}>
                              Receipt {idx + 1}
                            </div>
                          )}
                          {currentUser?.role === 'secretary' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteReceiptImage(receiptViewer.studentId, img.id);
                              }}
                              title="Delete this receipt image"
                              style={{
                                background: 'rgba(239, 68, 68, 0.2)',
                                border: 'none',
                                borderRadius: '0.25rem',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '0.2rem 0.4rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                                lineHeight: 1
                              }}
                              onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.4)'}
                              onMouseLeave={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.2)'}
                            >
                              <X size={12} /> Remove
                            </button>
                          )}
                        </div>
                        <img 
                          src={img.image} 
                          alt={`Receipt ${idx + 1}`}
                          style={{ 
                            width: '100%',
                            height: 'auto',
                            borderRadius: '0.375rem',
                            display: 'block'
                          }} 
                        />
                      </div>
                    ) : null
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', color: '#64748b' }}>
                  <Image size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                  <p>No receipt image available</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setReceiptViewer({ ...receiptViewer, open: false })}
              >
                Close
              </button>
              <button 
                className="btn btn-success"
                onClick={handleShareReceiptToWhatsApp}
                style={{
                  background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 500,
                  fontSize: '0.85rem',
                  transition: 'all 0.2s'
                }}
              >
                <MessageCircle size={16} /> Share to WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}

export default FeesManagement;
