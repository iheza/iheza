import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { apiClient } from '../services/authService';
import { toast } from 'sonner';
import { QrCode, Plus, Download, Printer, Trash2, X, Calendar, Building, Clock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

function QRCodeManagement() {
  const currentUser = useSelector(selectCurrentUser);
  const [qrCodes, setQrCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedQR, setSelectedQR] = useState(null);
  const [formData, setFormData] = useState({
    school_name: '',
    chain: '',
    duration_days: 30,
    notes: ''
  });
  const qrPrintRef = useRef(null);

  const userRole = currentUser?.role?.toLowerCase();
  const canCreateQR = ['director', 'coordinator', 'principal'].includes(userRole);

  const CHAINS = [
    { value: 'ALL', label: 'All Schools' },
    { value: 'DUP', label: 'DUP - Deniz Upper Primary' },
    { value: 'DLP', label: 'DLP - Deniz Lower Primary' },
    { value: 'OLGUN', label: 'OLGUN - Olgun Boys Secondary' },
    { value: 'IHEZA', label: 'IHEZA - Headquarters' },
    { value: 'LALE', label: 'LALE - Lale Bustan Academy' }
  ];

  useEffect(() => {
    if (canCreateQR) {
      loadQRCodes();
    }
  }, [canCreateQR]);

  const loadQRCodes = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/qr-codes');
      setQrCodes(response.data);
    } catch (error) {
      console.error('Failed to load QR codes:', error);
      toast.error('Failed to load QR codes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    
    if (!formData.school_name || !formData.chain) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      const response = await apiClient.post('/qr-codes', formData);
      if (response.data.success) {
        toast.success('QR Code created successfully');
        setShowCreateModal(false);
        setFormData({ school_name: '', chain: '', duration_days: 30, notes: '' });
        loadQRCodes();
      }
    } catch (error) {
      toast.error('Failed to create QR code');
    }
  };

  const handleDelete = async (qrId) => {
    if (window.confirm('Are you sure you want to delete this QR code?')) {
      try {
        await apiClient.delete(`/qr-codes/${qrId}`);
        toast.success('QR code deleted');
        loadQRCodes();
      } catch (error) {
        toast.error('Failed to delete QR code');
      }
    }
  };

  const handleDownload = (qr) => {
    const svg = document.getElementById(`qr-svg-${qr.id}`);
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 500;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw QR code centered
      ctx.drawImage(img, 50, 30, 300, 300);
      
      // Add text
      ctx.fillStyle = '#1e3a5f';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(qr.school_name, 200, 360);
      
      ctx.font = '14px Arial';
      ctx.fillStyle = '#666';
      ctx.fillText(`Chain: ${qr.chain}`, 200, 385);
      ctx.fillText(`Code: ${qr.code}`, 200, 405);
      ctx.fillText(`Valid for ${qr.duration_days} days`, 200, 425);
      
      ctx.font = '10px Arial';
      ctx.fillText('IHEZA School Management System', 200, 470);
      
      const link = document.createElement('a');
      link.download = `QR_${qr.code}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    toast.success('QR code downloaded');
  };

  const handlePrint = (qr) => {
    setSelectedQR(qr);
    setShowPreviewModal(true);
    
    setTimeout(() => {
      const printContent = qrPrintRef.current;
      if (!printContent) return;
      
      const printWindow = window.open('', '', 'width=600,height=700');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>QR Code - ${qr.school_name}</title>
          <style>
            @page { size: A5; margin: 15mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 30px;
              background: white;
            }
            .qr-container {
              border: 3px solid #0f4c81;
              border-radius: 20px;
              padding: 30px;
              max-width: 350px;
              margin: 0 auto;
              background: white;
            }
            .school-logo {
              font-size: 28px;
              font-weight: bold;
              color: #0f4c81;
              margin-bottom: 5px;
            }
            .school-subtitle {
              font-size: 10px;
              color: #666;
              margin-bottom: 20px;
            }
            .qr-code-wrapper {
              padding: 20px;
              background: #f8fafc;
              border-radius: 15px;
              margin: 20px 0;
            }
            .school-name {
              font-size: 18px;
              font-weight: bold;
              color: #1e3a5f;
              margin-top: 15px;
            }
            .qr-info {
              font-size: 12px;
              color: #666;
              margin-top: 10px;
            }
            .qr-code {
              font-size: 14px;
              font-weight: bold;
              color: #0f4c81;
              margin-top: 10px;
              padding: 8px 16px;
              background: #e0f2fe;
              border-radius: 8px;
              display: inline-block;
            }
            .validity {
              font-size: 11px;
              color: #059669;
              margin-top: 15px;
              padding: 5px 15px;
              background: #ecfdf5;
              border-radius: 5px;
              display: inline-block;
            }
            .footer {
              font-size: 9px;
              color: #999;
              margin-top: 20px;
              border-top: 1px solid #eee;
              padding-top: 15px;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
        setShowPreviewModal(false);
      }, 500);
    }, 100);
  };

  const isExpired = (expiryDate) => {
    return new Date(expiryDate) < new Date();
  };

  if (!canCreateQR) {
    return (
      <div className="qr-management-page">
        <div className="empty-state">
          <QrCode size={48} />
          <p>Only Directors, Coordinators, and Principals can manage QR codes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="qr-management-page">
      <style>{`
        .qr-management-page {
          padding: 1.5rem;
        }
        
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
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
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border-radius: 0.5rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          color: white;
        }
        
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        }
        
        .btn-secondary {
          background: rgba(51, 65, 85, 0.5);
          color: #f8fafc;
          border: 1px solid rgba(71, 85, 105, 0.5);
        }
        
        .btn-success {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }
        
        .qr-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        
        .qr-card {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 1rem;
          padding: 1.5rem;
          text-align: center;
          transition: all 0.2s;
        }
        
        .qr-card:hover {
          border-color: rgba(139, 92, 246, 0.5);
          transform: translateY(-2px);
        }
        
        .qr-card.expired {
          opacity: 0.6;
          border-color: rgba(239, 68, 68, 0.3);
        }
        
        .qr-wrapper {
          background: white;
          border-radius: 12px;
          padding: 1rem;
          display: inline-block;
          margin-bottom: 1rem;
        }
        
        .qr-school-name {
          font-size: 1.125rem;
          font-weight: 700;
          color: #f8fafc;
          margin-bottom: 0.5rem;
        }
        
        .qr-chain {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          background: rgba(139, 92, 246, 0.2);
          border-radius: 9999px;
          color: #a78bfa;
          font-size: 0.8rem;
          margin-bottom: 0.5rem;
        }
        
        .qr-code-text {
          font-family: monospace;
          font-size: 0.875rem;
          color: #94a3b8;
          margin-bottom: 0.5rem;
        }
        
        .qr-validity {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          margin-bottom: 1rem;
        }
        
        .qr-validity.valid {
          color: #22c55e;
        }
        
        .qr-validity.expired {
          color: #ef4444;
        }
        
        .qr-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: center;
        }
        
        .action-btn {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.5rem 0.75rem;
          background: transparent;
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 0.5rem;
          color: #94a3b8;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .action-btn:hover {
          background: rgba(139, 92, 246, 0.1);
          border-color: rgba(139, 92, 246, 0.5);
          color: #a78bfa;
        }
        
        .action-btn.delete:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.5);
          color: #ef4444;
        }
        
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        
        .modal {
          background: #1e293b;
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 1rem;
          width: 100%;
          max-width: 450px;
          max-height: 90vh;
          overflow-y: auto;
        }
        
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem;
          border-bottom: 1px solid rgba(51, 65, 85, 0.5);
        }
        
        .modal-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #f8fafc;
        }
        
        .modal-close {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
        }
        
        .modal-body {
          padding: 1.5rem;
        }
        
        .form-group {
          margin-bottom: 1rem;
        }
        
        .form-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #94a3b8;
          margin-bottom: 0.5rem;
        }
        
        .form-input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(51, 65, 85, 0.5);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 0.5rem;
          color: #f8fafc;
          font-size: 0.95rem;
        }
        
        .form-input:focus {
          outline: none;
          border-color: #8b5cf6;
        }
        
        .modal-footer {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          padding: 1.5rem;
          border-top: 1px solid rgba(51, 65, 85, 0.5);
        }
        
        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #64748b;
        }
        
        .empty-state svg {
          margin-bottom: 1rem;
          opacity: 0.5;
        }
        
        .print-preview {
          display: none;
        }
        
        .qr-print-container {
          background: white;
          padding: 30px;
          text-align: center;
        }
        
        .print-school-logo {
          font-size: 28px;
          font-weight: bold;
          color: #0f4c81;
        }
        
        .print-school-subtitle {
          font-size: 10px;
          color: #666;
          margin-bottom: 20px;
        }
        
        .print-qr-wrapper {
          padding: 20px;
          background: #f8fafc;
          border-radius: 15px;
          display: inline-block;
          margin: 20px 0;
        }
        
        .print-school-name {
          font-size: 18px;
          font-weight: bold;
          color: #1e3a5f;
          margin-top: 15px;
        }
        
        .print-qr-info {
          font-size: 12px;
          color: #666;
          margin-top: 10px;
        }
        
        .print-qr-code {
          font-size: 14px;
          font-weight: bold;
          color: #0f4c81;
          margin-top: 10px;
        }
        
        .print-validity {
          font-size: 11px;
          color: #059669;
          margin-top: 15px;
        }
        
        .print-footer {
          font-size: 9px;
          color: #999;
          margin-top: 20px;
          border-top: 1px solid #eee;
          padding-top: 15px;
        }
      `}</style>
      
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <QrCode size={20} color="white" />
          </span>
          QR Code Management
        </h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
          data-testid="create-qr-btn"
        >
          <Plus size={18} />
          Create QR Code
        </button>
      </div>
      
      {loading ? (
        <div className="empty-state">Loading QR codes...</div>
      ) : qrCodes.length === 0 ? (
        <div className="empty-state">
          <QrCode size={48} />
          <p>No QR codes created yet. Click "Create QR Code" to get started.</p>
        </div>
      ) : (
        <div className="qr-grid" data-testid="qr-grid">
          {qrCodes.map((qr) => (
            <div key={qr.id} className={`qr-card ${isExpired(qr.expiry_date) ? 'expired' : ''}`}>
              <div className="qr-wrapper">
                <QRCodeSVG 
                  id={`qr-svg-${qr.id}`}
                  value={qr.code}
                  size={180}
                  level="H"
                  includeMargin={true}
                />
              </div>
              
              <div className="qr-school-name">{qr.school_name}</div>
              <div className="qr-chain">{qr.chain}</div>
              <div className="qr-code-text">{qr.code}</div>
              
              <div className={`qr-validity ${isExpired(qr.expiry_date) ? 'expired' : 'valid'}`}>
                <Clock size={14} />
                {isExpired(qr.expiry_date) 
                  ? 'Expired' 
                  : `Valid for ${qr.duration_days} days`
                }
              </div>
              
              <div className="qr-actions">
                <button 
                  className="action-btn"
                  onClick={() => handleDownload(qr)}
                  title="Download QR Code"
                >
                  <Download size={14} /> Download
                </button>
                <button 
                  className="action-btn"
                  onClick={() => handlePrint(qr)}
                  title="Print QR Code"
                >
                  <Printer size={14} /> Print
                </button>
                <button 
                  className="action-btn delete"
                  onClick={() => handleDelete(qr.id)}
                  title="Delete QR Code"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Create QR Code Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Create New QR Code</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">School Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.school_name}
                    onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                    placeholder="e.g., Deniz Upper Primary School"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">School Chain *</label>
                  <select
                    className="form-input"
                    value={formData.chain}
                    onChange={(e) => setFormData({ ...formData, chain: e.target.value })}
                    required
                  >
                    <option value="">Select Chain</option>
                    {CHAINS.map(chain => (
                      <option key={chain.value} value={chain.value}>{chain.label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Duration (Days) *</label>
                  <select
                    className="form-input"
                    value={formData.duration_days}
                    onChange={(e) => setFormData({ ...formData, duration_days: parseInt(e.target.value) })}
                    required
                  >
                    <option value={7}>7 Days</option>
                    <option value={14}>14 Days</option>
                    <option value={30}>30 Days (1 Month)</option>
                    <option value={60}>60 Days (2 Months)</option>
                    <option value={90}>90 Days (3 Months)</option>
                    <option value={180}>180 Days (6 Months)</option>
                    <option value={365}>365 Days (1 Year)</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Notes (Optional)</label>
                  <textarea
                    className="form-input"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes about this QR code..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">
                  <QrCode size={18} />
                  Create QR Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Print Preview (hidden, used for printing) */}
      {selectedQR && (
        <div className="print-preview" ref={qrPrintRef}>
          <div className="qr-print-container">
            <div className="print-school-logo">IHEZA</div>
            <div className="print-school-subtitle">Institute of Holistic Education of Zanzibar</div>
            
            <div className="print-qr-wrapper">
              <QRCodeSVG value={selectedQR.code} size={200} level="H" />
            </div>
            
            <div className="print-school-name">{selectedQR.school_name}</div>
            <div className="print-qr-info">Chain: {selectedQR.chain}</div>
            <div className="print-qr-code">{selectedQR.code}</div>
            <div className="print-validity">Valid for {selectedQR.duration_days} days</div>
            
            <div className="print-footer">
              IHEZA School Management System<br />
              Scan this code to check in for attendance
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QRCodeManagement;
