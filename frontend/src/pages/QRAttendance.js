import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { apiClient } from '../services/authService';
import { toast } from 'sonner';
import { QrCode, Camera, Check, X, RefreshCw, Users, Clock, UserCheck, CameraOff, ScanLine, LogIn, LogOut, AlertTriangle, CheckCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

const SCHOOL_CHAINS = [
  { prefix: 'IHEZA', name: 'IHEZA Education Group' },
  { prefix: 'DUP', name: 'Deniz Upper Primary' },
  { prefix: 'DLP', name: 'Deniz Lower Primary' },
  { prefix: 'LALE', name: 'Lale Bustan Children\'s Academy' },
  { prefix: 'OLGUN', name: 'Olgun Boys Secondary School' },
];

function QRAttendance() {
  const currentUser = useSelector(selectCurrentUser);
  const [mode, setMode] = useState('scan'); // 'scan' or 'view'
  const [staff, setStaff] = useState([]);
  const [selectedChain, setSelectedChain] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [myAttendance, setMyAttendance] = useState(null);
  
  // QR Scanner state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scannerError, setScannerError] = useState(null);
  const [qrVerified, setQrVerified] = useState(false);
  const [verifiedQrCode, setVerifiedQrCode] = useState(null);
  const [processingAction, setProcessingAction] = useState(false);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  const today = new Date().toISOString().split('T')[0];

  // Determine what action is available (Check In or Check Out)
  const getAvailableAction = () => {
    if (!myAttendance) return 'check_in';
    if (myAttendance.check_in_time && !myAttendance.check_out_time) return 'check_out';
    if (myAttendance.check_out_time) return 'completed';
    return 'check_in';
  };

  const availableAction = getAvailableAction();

  useEffect(() => {
    if (currentUser?.chain) {
      if (currentUser.role === 'director' || currentUser.role === 'coordinator') {
        setSelectedChain('');
      } else {
        setSelectedChain(currentUser.chain);
      }
    }
    loadStaff();
    loadTodayAttendance();
    loadMyAttendance();
  }, [currentUser]);

  useEffect(() => {
    if (selectedChain || currentUser?.role === 'director' || currentUser?.role === 'coordinator') {
      loadStaff();
      loadTodayAttendance();
    }
  }, [selectedChain]);

  const loadStaff = async () => {
    try {
      const response = await apiClient.get('/users');
      let staffData = response.data;
      if (selectedChain) {
        staffData = staffData.filter(s => s.chain === selectedChain);
      }
      setStaff(staffData);
    } catch (error) {
      console.error('Failed to load staff:', error);
    }
  };

  const loadTodayAttendance = async () => {
    try {
      setLoading(true);
      const params = { chain: selectedChain || undefined };
      const response = await apiClient.get('/attendance/staff-today', { params });
      setTodayAttendance(response.data);
    } catch (error) {
      console.error('Failed to load attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMyAttendance = async () => {
    if (!currentUser?.id) return;
    try {
      const response = await apiClient.get('/attendance/staff-today');
      const myRecord = response.data.find(a => a.target_id === currentUser.id);
      setMyAttendance(myRecord || null);
    } catch (error) {
      console.error('Failed to load my attendance:', error);
    }
  };

  const getAttendanceStatus = (staffId) => {
    const record = todayAttendance.find(a => a.target_id === staffId);
    if (!record) return { status: 'absent', checkIn: null, checkOut: null, isLate: false };
    return { 
      status: record.check_out_time ? 'left' : (record.is_late ? 'late' : 'present'),
      checkIn: record.check_in_time,
      checkOut: record.check_out_time,
      isLate: record.is_late,
      lateDuration: record.late_duration
    };
  };

  const presentCount = todayAttendance.filter(a => !a.check_out_time).length;
  const lateCount = todayAttendance.filter(a => a.is_late).length;
  const leftCount = todayAttendance.filter(a => a.check_out_time).length;
  const totalStaff = staff.length;
  const notCheckedIn = totalStaff - todayAttendance.length;

  const canSelectChain = currentUser?.role === 'director' || currentUser?.role === 'coordinator';

  // Verify QR Code and auto-fill access code
  const verifyAndPrepareCheckin = async (scannedCode) => {
    try {
      // Parse QR code - format: PREFIX-QR-XXXXXXXX
      const qrCodePattern = /^([A-Z]+)-QR-([A-Z0-9]+)$/i;
      const match = scannedCode.toUpperCase().trim().match(qrCodePattern);
      
      if (!match) {
        toast.error('Invalid QR code format. Please scan a valid attendance QR code.');
        setScanResult({
          success: false,
          message: 'Invalid QR code format'
        });
        setTimeout(() => setScanResult(null), 3000);
        return;
      }

      const chainPrefix = match[1];
      
      // Verify the QR code with backend
      const verifyResponse = await apiClient.post('/qr-codes/verify', {
        qr_code: scannedCode.toUpperCase().trim()
      });

      if (!verifyResponse.data.valid) {
        toast.error(verifyResponse.data.message || 'QR code verification failed');
        setScanResult({
          success: false,
          message: verifyResponse.data.message || 'QR code verification failed'
        });
        setTimeout(() => setScanResult(null), 3000);
        return;
      }

      // Check if user's chain matches the QR code chain
      const userChain = currentUser?.chain;
      if (userChain && chainPrefix !== userChain && chainPrefix !== 'IHEZA') {
        toast.error(`This QR code is for ${chainPrefix}. Your account is registered under ${userChain}.`);
        setScanResult({
          success: false,
          message: `Chain mismatch: QR code for ${chainPrefix}, your account is ${userChain}`
        });
        setTimeout(() => setScanResult(null), 5000);
        return;
      }

      // QR verified successfully
      setQrVerified(true);
      setVerifiedQrCode(scannedCode.toUpperCase().trim());
      
      toast.success(`QR Code Verified! School: ${verifyResponse.data.school_name}`);
      
      setScanResult({
        success: true,
        qrVerified: true,
        school_name: verifyResponse.data.school_name,
        chain: verifyResponse.data.chain,
        message: 'QR Code verified! Ready to record attendance.'
      });

    } catch (error) {
      console.error('QR verification error:', error);
      toast.error(error.response?.data?.detail || 'Failed to verify QR code');
      setScanResult({
        success: false,
        message: error.response?.data?.detail || 'Failed to verify QR code'
      });
      setTimeout(() => setScanResult(null), 3000);
    }
  };

  // Process attendance (auto-determine check-in or check-out)
  const processAttendance = async () => {
    if (!currentUser?.access_code && !currentUser?.accessCode) {
      toast.error('Unable to get your access code. Please try again.');
      return;
    }

    if (availableAction === 'completed') {
      toast.info('You have already completed attendance for today');
      return;
    }

    setProcessingAction(true);

    try {
      const accessCode = currentUser.access_code || currentUser.accessCode;
      const action = availableAction; // 'check_in' or 'check_out'
      
      const response = await apiClient.post('/attendance/qr-checkin', {
        access_code: accessCode,
        action: action,
        qr_code: verifiedQrCode
      });

      if (response.data.success) {
        const resultAction = response.data.action;
        const staffMember = response.data.staff;
        
        setScanResult({
          success: true,
          action: resultAction,
          staff: staffMember,
          checkInTime: response.data.check_in_time,
          checkOutTime: response.data.check_out_time,
          isLate: response.data.is_late,
          lateDuration: response.data.late_duration
        });

        if (resultAction === 'check_in') {
          if (response.data.is_late) {
            toast.warning(`Checked in LATE (${response.data.late_duration} after 8:00 AM)`);
          } else {
            toast.success(`Checked in successfully at ${response.data.check_in_time}`);
          }
        } else if (resultAction === 'check_out') {
          toast.success(`Checked out successfully at ${response.data.check_out_time}`);
        }
        
        // Refresh data
        loadTodayAttendance();
        loadMyAttendance();
        
        // Reset QR verification after successful action
        setTimeout(() => {
          setQrVerified(false);
          setVerifiedQrCode(null);
          setScanResult(null);
        }, 5000);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to process attendance';
      toast.error(errorMsg);
      setScanResult({
        success: false,
        message: errorMsg
      });
      setTimeout(() => setScanResult(null), 5000);
    } finally {
      setProcessingAction(false);
    }
  };

  // QR Scanner Functions
  const startScanner = async () => {
    try {
      setScannerError(null);
      
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("qr-reader");
      }
      
      const qrCodeSuccessCallback = async (decodedText) => {
        await stopScanner();
        await verifyAndPrepareCheckin(decodedText);
      };
      
      const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };
      
      await html5QrCodeRef.current.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        () => {}
      );
      
      setIsCameraActive(true);
    } catch (err) {
      console.error("Scanner error:", err);
      setScannerError(err.message || "Failed to start camera");
      setIsCameraActive(false);
    }
  };
  
  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
      setIsCameraActive(false);
    } catch (err) {
      console.error("Error stopping scanner:", err);
    }
  };

  const resetScan = () => {
    setQrVerified(false);
    setVerifiedQrCode(null);
    setScanResult(null);
  };
  
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, []);

  return (
    <div className="qr-attendance-page">
      <style>{`
        .qr-attendance-page {
          padding: 1.5rem;
        }
        
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .page-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #0f4c81;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .page-title-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .my-status-card {
          padding: 1rem 1.5rem;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid #e2e8f0;
          border-radius: 1rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .my-status-card.checked-in {
          border-color: rgba(34, 197, 94, 0.5);
          background: rgba(34, 197, 94, 0.1);
        }
        
        .my-status-card.late {
          border-color: rgba(245, 158, 11, 0.5);
          background: rgba(245, 158, 11, 0.1);
        }
        
        .my-status-card.checked-out {
          border-color: rgba(99, 102, 241, 0.5);
          background: rgba(99, 102, 241, 0.1);
        }
        
        .mode-tabs {
          display: flex;
          gap: 0.5rem;
          padding: 0.25rem;
          background: rgba(14, 165, 233, 0.1);
          border-radius: 0.75rem;
          width: fit-content;
          margin-bottom: 1.5rem;
        }
        
        .mode-tab {
          padding: 0.75rem 1.5rem;
          background: transparent;
          border: none;
          border-radius: 0.5rem;
          color: #0369a1;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .mode-tab:hover {
          background: rgba(14, 165, 233, 0.1);
        }
        
        .mode-tab.active {
          background: #0369a1;
          color: white;
        }
        
        .content-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }
        
        @media (max-width: 1024px) {
          .content-grid {
            grid-template-columns: 1fr;
          }
        }
        
        .section-card {
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid #e2e8f0;
          border-radius: 1rem;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #e2e8f0;
          background: linear-gradient(90deg, #0369a1 0%, #0284c7 100%);
        }
        
        .section-title {
          font-size: 1rem;
          font-weight: 600;
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .section-content {
          padding: 1.5rem;
        }
        
        .filter-row {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .filter-select {
          flex: 1;
          padding: 0.75rem 1rem;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          color: #1e293b;
        }
        
        .filter-select:disabled {
          opacity: 0.6;
          background: #f8fafc;
        }
        
        .scan-result {
          padding: 1.5rem;
          border-radius: 0.75rem;
          margin-bottom: 1rem;
          text-align: center;
          animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .scan-result.success { background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); }
        .scan-result.qr-verified { background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(14, 165, 233, 0.3); }
        .scan-result.late { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); }
        .scan-result.checkout { background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); }
        .scan-result.error { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); }
        
        .scan-result-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem;
        }
        
        .scan-result.success .scan-result-icon { background: #22c55e; }
        .scan-result.qr-verified .scan-result-icon { background: #0ea5e9; }
        .scan-result.late .scan-result-icon { background: #f59e0b; }
        .scan-result.checkout .scan-result-icon { background: #6366f1; }
        .scan-result.error .scan-result-icon { background: #ef4444; }
        
        .scan-result-name {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 0.25rem;
        }
        
        .scan-result-action {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        
        .scan-result.success .scan-result-action { color: #22c55e; }
        .scan-result.qr-verified .scan-result-action { color: #0ea5e9; }
        .scan-result.late .scan-result-action { color: #f59e0b; }
        .scan-result.checkout .scan-result-action { color: #6366f1; }
        
        .scan-result-time {
          font-size: 0.875rem;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        
        .late-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.75rem;
          background: rgba(245, 158, 11, 0.2);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 9999px;
          color: #f59e0b;
          font-size: 0.75rem;
          font-weight: 600;
          margin-top: 0.5rem;
        }
        
        .attendance-list {
          max-height: 500px;
          overflow-y: auto;
        }
        
        .attendance-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem;
          border-radius: 0.5rem;
          margin-bottom: 0.5rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
        
        .attendance-item-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .attendance-avatar {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: white;
          font-size: 0.875rem;
        }
        
        .attendance-name {
          font-weight: 500;
          color: #1e293b;
          font-size: 0.875rem;
        }
        
        .attendance-role {
          font-size: 0.75rem;
          color: #64748b;
          text-transform: capitalize;
        }
        
        .attendance-chain {
          font-size: 0.7rem;
          color: #0369a1;
          background: rgba(14, 165, 233, 0.1);
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
          margin-top: 0.25rem;
          display: inline-block;
        }
        
        .attendance-times {
          text-align: right;
          font-size: 0.75rem;
        }
        
        .time-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          justify-content: flex-end;
          color: #64748b;
        }
        
        .time-row.in { color: #22c55e; }
        .time-row.out { color: #6366f1; }
        .time-row.late { color: #f59e0b; }
        
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        
        .status-badge.present { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
        .status-badge.late { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
        .status-badge.left { background: rgba(99, 102, 241, 0.2); color: #6366f1; }
        .status-badge.absent { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        
        .stats-bar {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }
        
        .stat-item {
          flex: 1;
          min-width: 100px;
          padding: 1rem;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          text-align: center;
        }
        
        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1e293b;
        }
        
        .stat-label {
          font-size: 0.7rem;
          color: #64748b;
        }
        
        .empty-state {
          text-align: center;
          padding: 2rem;
          color: #64748b;
        }
        
        .qr-scanner-section {
          margin-bottom: 1.5rem;
          padding: 1.5rem;
          background: linear-gradient(135deg, rgba(14, 165, 233, 0.05), rgba(14, 165, 233, 0.02));
          border: 1px solid rgba(14, 165, 233, 0.2);
          border-radius: 0.75rem;
        }
        
        .qr-scanner-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }
        
        .qr-scanner-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #0369a1;
          font-weight: 600;
          font-size: 0.9rem;
        }
        
        .camera-toggle-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%);
          border: none;
          border-radius: 0.5rem;
          color: white;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .camera-toggle-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
        }
        
        .camera-toggle-btn.stop {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        }
        
        #qr-reader {
          width: 100%;
          max-width: 400px;
          margin: 0 auto;
          border-radius: 0.75rem;
          overflow: hidden;
        }
        
        .scanner-placeholder {
          width: 100%;
          max-width: 400px;
          height: 280px;
          margin: 0 auto;
          background: rgba(14, 165, 233, 0.05);
          border: 2px dashed rgba(14, 165, 233, 0.3);
          border-radius: 0.75rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          color: #64748b;
          text-align: center;
          padding: 1rem;
        }
        
        .scanner-error {
          padding: 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 0.5rem;
          color: #dc2626;
          text-align: center;
          margin-top: 1rem;
        }
        
        .scanning-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 0.5rem;
          color: #22c55e;
          font-size: 0.875rem;
          margin-top: 1rem;
          animation: pulse 2s infinite;
          justify-content: center;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .verified-section {
          margin-top: 1.5rem;
          padding: 1.5rem;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05));
          border: 2px solid rgba(34, 197, 94, 0.3);
          border-radius: 0.75rem;
          text-align: center;
        }
        
        .verified-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: rgba(34, 197, 94, 0.2);
          border-radius: 9999px;
          color: #22c55e;
          font-weight: 600;
          margin-bottom: 1rem;
        }
        
        .user-info-display {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          padding: 1rem;
          margin-bottom: 1rem;
        }
        
        .user-access-code {
          font-family: monospace;
          font-size: 1.1rem;
          font-weight: 600;
          color: #0369a1;
          background: rgba(14, 165, 233, 0.1);
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          display: inline-block;
        }
        
        .action-button {
          width: 100%;
          padding: 1rem;
          border: none;
          border-radius: 0.75rem;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.2s;
        }
        
        .action-button.check-in {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
        }
        
        .action-button.check-out {
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: white;
        }
        
        .action-button.completed {
          background: #e2e8f0;
          color: #64748b;
          cursor: not-allowed;
        }
        
        .action-button:not(.completed):hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .action-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        .reset-btn {
          margin-top: 0.75rem;
          padding: 0.5rem 1rem;
          background: transparent;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          color: #64748b;
          cursor: pointer;
          font-size: 0.875rem;
        }
        
        .reset-btn:hover {
          background: #f8fafc;
        }
        
        .late-warning {
          margin-top: 0.75rem;
          padding: 0.5rem 1rem;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 0.5rem;
          color: #d97706;
          font-size: 0.875rem;
          text-align: center;
        }
      `}</style>
      
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <QrCode size={20} color="white" />
          </span>
          Staff QR Attendance
        </h1>
        
        {/* My Status Card */}
        {myAttendance ? (
          <div className={`my-status-card ${myAttendance.check_out_time ? 'checked-out' : myAttendance.is_late ? 'late' : 'checked-in'}`}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Your Status</div>
              <div style={{ fontWeight: 600, color: '#1e293b' }}>
                {myAttendance.check_out_time ? 'Checked Out' : myAttendance.is_late ? 'Checked In (Late)' : 'Checked In'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: '#22c55e' }}>In: {myAttendance.check_in_time}</div>
              {myAttendance.check_out_time && (
                <div style={{ fontSize: '0.75rem', color: '#6366f1' }}>Out: {myAttendance.check_out_time}</div>
              )}
              {myAttendance.is_late && (
                <div style={{ fontSize: '0.7rem', color: '#f59e0b' }}>Late: {myAttendance.late_duration}</div>
              )}
            </div>
          </div>
        ) : (
          <div className="my-status-card">
            <X size={20} color="#ef4444" />
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Your Status</div>
              <div style={{ fontWeight: 600, color: '#ef4444' }}>Not Checked In</div>
            </div>
          </div>
        )}
      </div>
      
      <div className="mode-tabs">
        <button 
          className={`mode-tab ${mode === 'scan' ? 'active' : ''}`}
          onClick={() => setMode('scan')}
          data-testid="mode-scan-btn"
        >
          <Camera size={18} /> Scan QR
        </button>
        <button 
          className={`mode-tab ${mode === 'view' ? 'active' : ''}`}
          onClick={() => setMode('view')}
          data-testid="mode-view-btn"
        >
          <Users size={18} /> View All
        </button>
      </div>
      
      <div className="filter-row">
        <select
          className="filter-select"
          value={selectedChain}
          onChange={(e) => setSelectedChain(e.target.value)}
          disabled={!canSelectChain}
          data-testid="chain-filter"
        >
          {canSelectChain && <option value="">All Schools</option>}
          {SCHOOL_CHAINS.filter(c => c.prefix !== 'IHEZA').map(chain => (
            <option key={chain.prefix} value={chain.prefix}>
              {`${chain.prefix} - ${chain.name}`}
            </option>
          ))}
        </select>
      </div>
      
      <div className="stats-bar">
        <div className="stat-item">
          <div className="stat-value">{totalStaff}</div>
          <div className="stat-label">Total Staff</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: '#22c55e' }}>{presentCount}</div>
          <div className="stat-label">Present</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: '#f59e0b' }}>{lateCount}</div>
          <div className="stat-label">Late</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: '#6366f1' }}>{leftCount}</div>
          <div className="stat-label">Left</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: '#ef4444' }}>{notCheckedIn}</div>
          <div className="stat-label">Not Checked In</div>
        </div>
      </div>
      
      <div className="content-grid">
        <div className="section-card">
          <div className="section-header">
            <h3 className="section-title">
              <QrCode size={18} /> Scan to Check In/Out
            </h3>
          </div>
          <div className="section-content">
            {/* Show scan result */}
            {scanResult && !scanResult.qrVerified && (
              <div className={`scan-result ${
                scanResult.success 
                  ? (scanResult.action === 'check_out' ? 'checkout' : (scanResult.isLate ? 'late' : 'success'))
                  : 'error'
              }`}>
                <div className="scan-result-icon">
                  {scanResult.success ? (
                    scanResult.action === 'check_out' ? <LogOut size={32} color="white" /> :
                    scanResult.isLate ? <AlertTriangle size={32} color="white" /> :
                    <LogIn size={32} color="white" />
                  ) : (
                    <X size={32} color="white" />
                  )}
                </div>
                {scanResult.success ? (
                  <>
                    <div className="scan-result-name">
                      {scanResult.staff?.first_name} {scanResult.staff?.last_name}
                    </div>
                    <div className="scan-result-action">
                      {scanResult.action === 'check_in' && (scanResult.isLate ? 'CHECKED IN (LATE)' : 'CHECKED IN')}
                      {scanResult.action === 'check_out' && 'CHECKED OUT'}
                      {scanResult.action === 'already_complete' && 'ALREADY COMPLETED'}
                    </div>
                    <div className="scan-result-time">
                      <Clock size={14} />
                      {scanResult.action === 'check_out' 
                        ? `Out at ${scanResult.checkOutTime}`
                        : `In at ${scanResult.checkInTime}`
                      }
                    </div>
                    {scanResult.isLate && scanResult.lateDuration && (
                      <div className="late-badge">
                        <AlertTriangle size={12} />
                        {scanResult.lateDuration} late
                      </div>
                    )}
                  </>
                ) : (
                  <div className="scan-result-name">{scanResult.message}</div>
                )}
              </div>
            )}
            
            {/* QR Scanner Section */}
            {!qrVerified ? (
              <div className="qr-scanner-section">
                <div className="qr-scanner-header">
                  <div className="qr-scanner-title">
                    <ScanLine size={18} />
                    Scan School QR Code
                  </div>
                  <button 
                    className={`camera-toggle-btn ${isCameraActive ? 'stop' : ''}`}
                    onClick={isCameraActive ? stopScanner : startScanner}
                    data-testid="camera-toggle-btn"
                  >
                    {isCameraActive ? (
                      <><CameraOff size={18} /> Stop</>
                    ) : (
                      <><Camera size={18} /> Start Camera</>
                    )}
                  </button>
                </div>
                
                <div id="qr-reader" ref={scannerRef}></div>
                
                {!isCameraActive && !scannerError && (
                  <div className="scanner-placeholder">
                    <QrCode size={48} color="#0369a1" />
                    <span style={{ fontWeight: 500, color: '#0369a1' }}>
                      Scan the school's attendance QR code
                    </span>
                    <span style={{ fontSize: '0.75rem' }}>
                      The QR code is printed on the wall by the principal
                    </span>
                  </div>
                )}
                
                {isCameraActive && (
                  <div className="scanning-indicator">
                    <ScanLine size={16} />
                    Scanning... Point at QR code
                  </div>
                )}
                
                {scannerError && (
                  <div className="scanner-error">
                    Camera Error: {scannerError}
                  </div>
                )}
              </div>
            ) : (
              /* QR Verified - Show Action Button */
              <div className="verified-section">
                {scanResult?.qrVerified && (
                  <div className="scan-result qr-verified" style={{ marginBottom: '1rem' }}>
                    <div className="scan-result-icon">
                      <CheckCircle size={32} color="white" />
                    </div>
                    <div className="scan-result-action">QR CODE VERIFIED</div>
                    <div className="scan-result-name">{scanResult.school_name}</div>
                  </div>
                )}
                
                <div className="user-info-display">
                  <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Your Access Code:</div>
                  <div className="user-access-code">
                    {currentUser?.access_code || currentUser?.accessCode}
                  </div>
                </div>
                
                <button
                  className={`action-button ${availableAction === 'check_in' ? 'check-in' : availableAction === 'check_out' ? 'check-out' : 'completed'}`}
                  onClick={processAttendance}
                  disabled={processingAction || availableAction === 'completed'}
                  data-testid="attendance-action-btn"
                >
                  {processingAction ? (
                    <>Processing...</>
                  ) : availableAction === 'check_in' ? (
                    <><LogIn size={20} /> Check In</>
                  ) : availableAction === 'check_out' ? (
                    <><LogOut size={20} /> Check Out</>
                  ) : (
                    <><Check size={20} /> Attendance Completed</>
                  )}
                </button>
                
                {availableAction === 'check_in' && (
                  <div className="late-warning">
                    <AlertTriangle size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                    Check-in after 8:00 AM will be marked as LATE
                  </div>
                )}
                
                <button className="reset-btn" onClick={resetScan}>
                  <RefreshCw size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                  Scan Different QR Code
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="section-card">
          <div className="section-header">
            <h3 className="section-title">
              <Users size={18} /> Today's Attendance
            </h3>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
              onClick={() => { loadTodayAttendance(); loadMyAttendance(); }}
            >
              <RefreshCw size={16} color="white" />
            </button>
          </div>
          <div className="section-content">
            {loading ? (
              <div className="empty-state">Loading...</div>
            ) : staff.length === 0 ? (
              <div className="empty-state">No staff found</div>
            ) : (
              <div className="attendance-list">
                {staff.map(member => {
                  const { status, checkIn, checkOut, isLate, lateDuration } = getAttendanceStatus(member.id);
                  const roleColor = {
                    director: '#0f4c81',
                    coordinator: '#7c3aed',
                    principal: '#059669',
                    teacher: '#d97706',
                    academic: '#2563eb',
                    secretary: '#dc2626',
                    section_leader: '#ec4899',
                  }[member.role] || '#64748b';
                  
                  return (
                    <div key={member.id} className="attendance-item">
                      <div className="attendance-item-info">
                        <div className="attendance-avatar" style={{ background: roleColor }}>
                          {member.first_name?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <div className="attendance-name">
                            {member.first_name} {member.last_name}
                          </div>
                          <div className="attendance-role">
                            {member.role?.replace('_', ' ')}
                          </div>
                          <div className="attendance-chain">{member.chain}</div>
                        </div>
                      </div>
                      <div className="attendance-times">
                        <span className={`status-badge ${status}`}>
                          {status === 'present' && <><Check size={12} /> Present</>}
                          {status === 'late' && <><AlertTriangle size={12} /> Late</>}
                          {status === 'left' && <><LogOut size={12} /> Left</>}
                          {status === 'absent' && <><X size={12} /> Absent</>}
                        </span>
                        {checkIn && (
                          <div className={`time-row ${isLate ? 'late' : 'in'}`}>
                            <LogIn size={10} /> {checkIn}
                            {isLate && lateDuration && <span>({lateDuration})</span>}
                          </div>
                        )}
                        {checkOut && (
                          <div className="time-row out">
                            <LogOut size={10} /> {checkOut}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default QRAttendance;
