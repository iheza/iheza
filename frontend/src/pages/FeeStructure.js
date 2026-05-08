import React from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { ArrowLeft, Phone, Mail, MapPin, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// DLP Fee Structure Component
const DLPFeeStructure = ({ navigate }) => {
  const shareToWhatsApp = () => {
    const message = `IHEZA - DENIZ LOWER PRIMARY
SCHOOL FEES STRUCTURE 2026

1. NEW ADMISSION
- Admission Fees: 150,000/-
- Caution Fees: 20,000/-
- Application Form: 10,000/-
Total Entry Fees: 180,000/-

Note: Entrance fees for learners from LALE BUSTANI is 100,000/-
Old students pay ONLY caution fees

OTHER FEES:
- English Story Books: 50,000/-
- Events and Trips: 70,000/-
- Fine Art and Craft: FREE

2. SCHOOL FEES
Monthly: 160,000/-
First Installment: 875,000/-
Second Installment: 875,000/-
TOTAL ANNUAL: 2,050,000/-

3. UNIFORM: 100,000/-
- School T-Shirt: 25,000/-
- Trousers/Skirt: 35,000/-
- Sports T-Shirt: 15,000/-
- Sports Trousers: 25,000/-

4. DISCOUNTS
- 3rd Child: 50,000/-
- 4th Child: 75,000/-
- 5th Child: 80,000/-

5. PAYMENT DETAILS
Bank: EXIM BANK
Account: IHEZA - DENIZ LOWER PRIMARY
Number: 0150028734

Contact: 0748 555525 / 0776101088`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="fee-structure-page">
      <style>{`
        .fee-structure-page {
          padding: 1.5rem;
          max-width: 1200px;
          margin: 0 auto;
          min-height: 100vh;
        }
        .fee-header {
          background: linear-gradient(135deg, #0f4c81 0%, #1a5f9e 100%);
          color: white;
          padding: 2rem;
          border-radius: 1rem;
          text-align: center;
          margin-bottom: 2rem;
          box-shadow: 0 4px 20px rgba(15, 76, 129, 0.3);
        }
        .fee-header h1 {
          font-size: 1.75rem;
          font-weight: 700;
          margin: 0 0 0.5rem;
        }
        .fee-subtitle {
          font-size: 1.125rem;
          opacity: 0.9;
          margin: 0 0 1rem;
        }
        .header-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin-top: 1.5rem;
        }
        .header-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border-radius: 0.5rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        .btn-back {
          background: rgba(255,255,255,0.2);
          color: white;
        }
        .btn-back:hover {
          background: rgba(255,255,255,0.3);
        }
        .btn-whatsapp {
          background: #25d366;
          color: white;
        }
        .btn-whatsapp:hover {
          background: #128c7e;
        }
        .section-card {
          background: white;
          border-radius: 1rem;
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(0,0,0,0.1);
          margin-bottom: 1.5rem;
        }
        .section-header {
          padding: 1rem 1.5rem;
          color: white;
          font-weight: 700;
          font-size: 1.1rem;
        }
        .section-header.green { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); }
        .section-header.blue { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
        .section-header.purple { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
        .section-header.orange { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
        .section-header.teal { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); }
        .section-content {
          padding: 1rem 1.5rem;
        }
        .fee-table {
          width: 100%;
          border-collapse: collapse;
        }
        .fee-table th, .fee-table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }
        .fee-table th {
          background: #f8fafc;
          font-weight: 600;
          color: #475569;
          font-size: 0.85rem;
        }
        .fee-table td {
          color: #1e293b;
        }
        .fee-table .amount {
          font-weight: 600;
          color: #0f4c81;
          text-align: right;
        }
        .fee-table .total-row {
          background: #f0f9ff;
          font-weight: 700;
        }
        .fee-table .total-row td {
          color: #0f4c81;
        }
        .fee-table .free {
          color: #22c55e;
          font-weight: 600;
        }
        .note-box {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 1rem;
          margin: 1rem 0;
          border-radius: 0 0.5rem 0.5rem 0;
          font-size: 0.9rem;
          color: #92400e;
        }
        .school-fees-breakdown {
          overflow-x: auto;
        }
        .breakdown-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 600px;
        }
        .breakdown-table th, .breakdown-table td {
          padding: 0.75rem;
          text-align: center;
          border: 1px solid #e2e8f0;
        }
        .breakdown-table th {
          background: #0f4c81;
          color: white;
          font-weight: 600;
          font-size: 0.85rem;
        }
        .breakdown-table td {
          color: #1e293b;
        }
        .breakdown-table td:first-child {
          text-align: left;
          font-weight: 500;
        }
        .breakdown-table .total-row {
          background: #f0f9ff;
          font-weight: 700;
        }
        .breakdown-table .grand-total {
          background: #0f4c81;
          color: white;
          font-weight: 700;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }
        .bank-card {
          background: linear-gradient(135deg, #1e3a5f 0%, #0f4c81 100%);
          color: white;
          border-radius: 1rem;
          padding: 1.5rem;
        }
        .bank-card h3 {
          margin: 0 0 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .bank-item {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.2);
        }
        .bank-item:last-child {
          border-bottom: none;
        }
        .bank-label {
          opacity: 0.8;
        }
        .bank-value {
          font-weight: 600;
        }
        @media (max-width: 768px) {
          .fee-structure-page { padding: 1rem; }
          .fee-header h1 { font-size: 1.25rem; }
          .header-actions { flex-direction: column; }
          .breakdown-table { font-size: 0.8rem; }
        }
      `}</style>

      <div className="fee-header">
        <h1>IHEZA - DENIZ LOWER PRIMARY</h1>
        <p className="fee-subtitle">SCHOOL FEES STRUCTURE 2026</p>
        <div className="header-actions">
          <button className="header-btn btn-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} /> Back
          </button>
          <button className="header-btn btn-whatsapp" onClick={shareToWhatsApp}>
            Share to WhatsApp
          </button>
        </div>
      </div>

      {/* 1. NEW ADMISSION */}
      <div className="section-card">
        <div className="section-header green">1. NEW ADMISSION</div>
        <div className="section-content">
          <h4 style={{ margin: '0 0 1rem', color: '#475569' }}>ENTRY FEES</h4>
          <table className="fee-table">
            <thead>
              <tr>
                <th>PARTICULAR</th>
                <th style={{ textAlign: 'right' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Admission Fees</td>
                <td className="amount">150,000/-</td>
              </tr>
              <tr>
                <td>Caution Fees</td>
                <td className="amount">20,000/-</td>
              </tr>
              <tr>
                <td>Application Form</td>
                <td className="amount">10,000/-</td>
              </tr>
              <tr className="total-row">
                <td>TOTAL</td>
                <td className="amount">180,000/-</td>
              </tr>
            </tbody>
          </table>

          <div className="note-box">
            <strong>NOTE:</strong> Entrance fees for learners coming from LALE BUSTANI is <strong>100,000/-</strong>. Old students will ONLY pay caution fees.
          </div>

          <h4 style={{ margin: '1.5rem 0 1rem', color: '#475569' }}>OTHER FEES</h4>
          <table className="fee-table">
            <thead>
              <tr>
                <th>PARTICULAR</th>
                <th style={{ textAlign: 'right' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>English Story Books</td>
                <td className="amount">50,000/-</td>
              </tr>
              <tr>
                <td>Events and Trips</td>
                <td className="amount">70,000/-</td>
              </tr>
              <tr>
                <td>Fine Art and Craft</td>
                <td className="amount free">FREE</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. SCHOOL FEES BREAKDOWN */}
      <div className="section-card">
        <div className="section-header blue">2. SCHOOL FEES BREAKDOWN</div>
        <div className="section-content school-fees-breakdown">
          <table className="breakdown-table">
            <thead>
              <tr>
                <th>PARTICULAR</th>
                <th>MONTHLY</th>
                <th>FIRST INSTALLMENT</th>
                <th>SECOND INSTALLMENT</th>
                <th>TOTAL ANNUAL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Tuition Fees</td>
                <td>75,000/-</td>
                <td>450,000/-</td>
                <td>450,000/-</td>
                <td>900,000/-</td>
              </tr>
              <tr>
                <td>Meals</td>
                <td>85,000/-</td>
                <td>425,000/-</td>
                <td>425,000/-</td>
                <td>850,000/-</td>
              </tr>
              <tr>
                <td>Madrassa</td>
                <td className="free">FREE</td>
                <td className="free">FREE</td>
                <td className="free">FREE</td>
                <td className="free">FREE</td>
              </tr>
              <tr className="total-row">
                <td>Subtotal</td>
                <td>160,000/-</td>
                <td>875,000/-</td>
                <td>875,000/-</td>
                <td>-</td>
              </tr>
              <tr>
                <td>New Admission</td>
                <td>-</td>
                <td>180,000/-</td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr>
                <td>Other (Books, Events)</td>
                <td>-</td>
                <td>120,000/-</td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr className="grand-total">
                <td>TOTAL</td>
                <td>-</td>
                <td>1,175,000/-</td>
                <td>875,000/-</td>
                <td>2,050,000/-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. UNIFORM */}
      <div className="section-card">
        <div className="section-header purple">3. UNIFORM</div>
        <div className="section-content">
          <table className="fee-table">
            <thead>
              <tr>
                <th>PARTICULAR</th>
                <th style={{ textAlign: 'right' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>School T-Shirt</td>
                <td className="amount">25,000/-</td>
              </tr>
              <tr>
                <td>Trousers/Skirt</td>
                <td className="amount">35,000/-</td>
              </tr>
              <tr>
                <td>Sports T-Shirt</td>
                <td className="amount">15,000/-</td>
              </tr>
              <tr>
                <td>Sports Trousers</td>
                <td className="amount">25,000/-</td>
              </tr>
              <tr className="total-row">
                <td>TOTAL</td>
                <td className="amount">100,000/-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. DISCOUNT */}
      <div className="section-card">
        <div className="section-header orange">4. DISCOUNT</div>
        <div className="section-content">
          <table className="fee-table">
            <thead>
              <tr>
                <th>PARTICULAR</th>
                <th style={{ textAlign: 'right' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>3rd Child</td>
                <td className="amount" style={{ color: '#22c55e' }}>- 50,000/-</td>
              </tr>
              <tr>
                <td>4th Child</td>
                <td className="amount" style={{ color: '#22c55e' }}>- 75,000/-</td>
              </tr>
              <tr>
                <td>5th Child</td>
                <td className="amount" style={{ color: '#22c55e' }}>- 80,000/-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. PAYMENT DETAILS */}
      <div className="section-card">
        <div className="section-header teal">5. PAYMENT DETAILS</div>
        <div className="section-content">
          <div className="bank-card">
            <h3><CreditCard size={20} /> EXIM BANK</h3>
            <div className="bank-item">
              <span className="bank-label">Bank Name</span>
              <span className="bank-value">EXIM BANK</span>
            </div>
            <div className="bank-item">
              <span className="bank-label">Account Name</span>
              <span className="bank-value">IHEZA - DENIZ LOWER PRIMARY</span>
            </div>
            <div className="bank-item">
              <span className="bank-label">Account Number</span>
              <span className="bank-value">0150028734</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// DUP Fee Structure Component (Original)
const DUPFeeStructure = ({ navigate }) => {
  const feeStructure = [
    { id: 'full-day-header', name: 'FULL DAY', amount: 0, type: 'header', description: 'Full Day Program' },
    { id: 'admission', name: 'Admission Form', amount: 160000, type: 'new-student', description: 'New student only' },
    { id: 'tuition-full', name: 'Tuition Fee', amount: 960000, type: 'tuition', description: 'Full year tuition' },
    { id: 'meal-full', name: 'Meal', amount: 850000, type: 'meal', description: 'Full year meals' },
    { id: 'madrasa', name: 'Madrasa', amount: 0, type: 'free', description: 'All students - Free' },
    { id: 'story-books', name: 'Story Books', amount: 80000, type: 'books', description: 'All students' },
    { id: 'event-trips', name: 'Event and Trips', amount: 70000, type: 'events', description: 'All students' },
    { id: 'origami', name: 'Origami Program', amount: 0, type: 'free', description: 'Grade 5 - Free' },
    { id: 'vocational', name: 'Vocational Training', amount: 0, type: 'free', description: 'Grade 7 - Free' },
    { id: 'tech-ai', name: 'Tech & AI', amount: 0, type: 'free', description: 'Grade 6 & 7 - Free' },
    { id: 'caution', name: 'Caution Fee', amount: 15000, type: 'caution', description: 'All students' },
    { id: 'exams', name: 'Exams', amount: 35000, type: 'exams', description: 'Grade 4 & 7 - CASH' },
    { id: 'remedial', name: 'Remedial Fee', amount: 50000, type: 'remedial', description: 'Grade 4 & 7 - CASH' },
    { id: 'half-day-header', name: 'HALF DAY', amount: 0, type: 'header', description: 'Half Day Program' },
    { id: 'tuition-half', name: 'Tuition Fee', amount: 960000, type: 'tuition', description: 'Full year tuition' },
    { id: 'meal-half', name: 'Meal', amount: 450000, type: 'meal', description: 'Half day meals' },
    { id: 'story-books-half', name: 'Story Books', amount: 80000, type: 'books', description: 'All students' },
    { id: 'event-trips-half', name: 'Event and Trips', amount: 70000, type: 'events', description: 'All students' },
    { id: 'caution-half', name: 'Caution Fee', amount: 15000, type: 'caution', description: 'All students' },
  ];

  const shareToWhatsApp = () => {
    const message = `Deniz Primary School Fee Structure 2025
    
FULL DAY PROGRAM:
- New Student Total: TZS 2,135,000
- Continuing Student: TZS 1,975,000
- First Installment: TZS 987,500
- Second Installment: TZS 987,500

HALF DAY PROGRAM:
- Continuing Student: TZS 1,575,000
- First Installment: TZS 787,500
- Second Installment: TZS 787,500

UNIFORM: TZS 100,000
- T-shirt: TZS 25,000
- Trouser/Skirt: TZS 40,000
- Sport Wear: TZS 35,000

Bank: EXIM BANK
Account: DENIZ UPPER PRIMARY
Number: 0150028733-TZS

Contact: +255757102325
Email: denizprimary@gmail.com`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="fee-structure-page">
      <style>{`
        .fee-structure-page {
          padding: 1.5rem;
          max-width: 1200px;
          margin: 0 auto;
          min-height: 100vh;
        }
        .fee-header {
          background: linear-gradient(135deg, #0f4c81 0%, #1a5f9e 100%);
          color: white;
          padding: 2rem;
          border-radius: 1rem;
          text-align: center;
          margin-bottom: 2rem;
          box-shadow: 0 4px 20px rgba(15, 76, 129, 0.3);
        }
        .fee-header h1 {
          font-size: 1.75rem;
          font-weight: 700;
          margin: 0 0 0.5rem;
        }
        .fee-subtitle {
          font-size: 1.125rem;
          opacity: 0.9;
          margin: 0 0 1rem;
        }
        .school-info {
          font-size: 0.875rem;
          opacity: 0.8;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 1rem;
        }
        .header-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin-top: 1.5rem;
        }
        .header-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border-radius: 0.5rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        .btn-back {
          background: rgba(255,255,255,0.2);
          color: white;
        }
        .btn-back:hover {
          background: rgba(255,255,255,0.3);
        }
        .btn-whatsapp {
          background: #25d366;
          color: white;
        }
        .btn-whatsapp:hover {
          background: #128c7e;
        }
        .programs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        .program-section {
          background: white;
          border-radius: 1rem;
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(0,0,0,0.1);
        }
        .program-header {
          padding: 1.25rem;
          color: white;
        }
        .program-section.full-day .program-header {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
        }
        .program-section.half-day .program-header {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }
        .program-header h2 {
          font-size: 1.25rem;
          margin: 0 0 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .program-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.875rem;
        }
        .total-amount {
          font-size: 1.25rem;
          font-weight: 700;
        }
        .fee-grid {
          padding: 1rem;
        }
        .fee-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          border-bottom: 1px solid #f1f5f9;
        }
        .fee-item:last-child {
          border-bottom: none;
        }
        .fee-item.free {
          background: #f0fdf4;
        }
        .fee-name {
          font-weight: 500;
          color: #1e293b;
        }
        .fee-description {
          font-size: 0.75rem;
          color: #64748b;
        }
        .fee-amount {
          font-weight: 600;
          color: #0f4c81;
        }
        .fee-item.free .fee-amount {
          color: #22c55e;
        }
        .installment-section {
          background: #f8fafc;
          padding: 1rem;
          border-top: 1px solid #e2e8f0;
        }
        .installment-section h3 {
          font-size: 0.875rem;
          font-weight: 600;
          color: #64748b;
          margin: 0 0 0.75rem;
        }
        .installment-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .installment-item {
          background: white;
          padding: 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid #e2e8f0;
        }
        .installment-type {
          font-size: 0.75rem;
          color: #64748b;
          text-transform: uppercase;
        }
        .installment-amount {
          font-size: 1.125rem;
          font-weight: 700;
          color: #1e293b;
        }
        .installment-breakdown {
          font-size: 0.75rem;
          color: #64748b;
          margin-top: 0.25rem;
        }
        .additional-info-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        .info-card {
          background: white;
          border-radius: 1rem;
          padding: 1.25rem;
          box-shadow: 0 2px 12px rgba(0,0,0,0.1);
        }
        .info-card h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .uniform-grid, .discount-grid {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .uniform-item, .discount-item {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem;
          background: #f8fafc;
          border-radius: 0.25rem;
        }
        .uniform-name, .discount-type {
          color: #475569;
        }
        .uniform-price {
          font-weight: 600;
          color: #0f4c81;
        }
        .discount-amount {
          font-weight: 600;
          color: #22c55e;
        }
        .bank-details {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .bank-item {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem;
          background: #f8fafc;
          border-radius: 0.25rem;
        }
        .bank-label {
          color: #64748b;
          font-size: 0.875rem;
        }
        .bank-value {
          font-weight: 600;
          color: #1e293b;
        }
        .payment-instructions {
          background: white;
          border-radius: 1rem;
          padding: 1.25rem;
          box-shadow: 0 2px 12px rgba(0,0,0,0.1);
        }
        .payment-instructions h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .instructions-content {
          font-size: 0.875rem;
          color: #475569;
          line-height: 1.6;
        }
        .instructions-content p {
          margin: 0 0 0.75rem;
        }
        @media (max-width: 768px) {
          .fee-structure-page {
            padding: 1rem;
          }
          .fee-header h1 {
            font-size: 1.5rem;
          }
          .programs-grid {
            grid-template-columns: 1fr;
          }
          .header-actions {
            flex-direction: column;
          }
        }
      `}</style>

      <div className="fee-header">
        <h1>Deniz Primary School - Fee Structure 2025</h1>
        <p className="fee-subtitle">Grade 4, 5, 6 and 7 Only</p>
        <div className="school-info">
          <span><Mail size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> denizprimary@gmail.com</span>
          <span><MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> P.O.BOX: 2254, MPENDAE - ZANZIBAR</span>
          <span><Phone size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> +255757102325 / +255678436080</span>
        </div>
        <div className="header-actions">
          <button className="header-btn btn-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} /> Back
          </button>
          <button className="header-btn btn-whatsapp" onClick={shareToWhatsApp}>
            Share to WhatsApp
          </button>
        </div>
      </div>

      <div className="programs-grid">
        {/* FULL DAY PROGRAM */}
        <div className="program-section full-day">
          <div className="program-header">
            <h2>FULL DAY PROGRAM</h2>
            <div className="program-total">
              <span className="total-label">Total Fee for New Student (Full Year):</span>
              <span className="total-amount">2,135,000/=</span>
            </div>
          </div>
          
          <div className="fee-grid">
            {feeStructure
              .filter(f => !f.id.includes('-half') && f.id !== 'half-day-header' && f.type !== 'header')
              .map(fee => (
                <div key={fee.id} className={`fee-item ${fee.type || ''}`}>
                  <div>
                    <div className="fee-name">{fee.name}</div>
                    <div className="fee-description">{fee.description}</div>
                  </div>
                  <div className="fee-amount">
                    {fee.amount === 0 ? 'Free' : `${fee.amount.toLocaleString()}/=`}
                  </div>
                </div>
              ))}
          </div>

          <div className="installment-section">
            <h3>Payment Installments (Full Day)</h3>
            <div className="installment-grid">
              <div className="installment-item">
                <div className="installment-type">New Student Total</div>
                <div className="installment-amount">2,135,000/=</div>
                <div className="installment-breakdown">
                  First Installment: 1,145,000/= | Second Installment: 980,000/=
                </div>
              </div>
              <div className="installment-item">
                <div className="installment-type">Continuing Student Total</div>
                <div className="installment-amount">1,975,000/=</div>
                <div className="installment-breakdown">
                  First Installment: 987,500/= | Second Installment: 987,500/=
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* HALF DAY PROGRAM */}
        <div className="program-section half-day">
          <div className="program-header">
            <h2>HALF DAY PROGRAM</h2>
            <div className="program-total">
              <span className="total-label">Total Fee for Continuing Student:</span>
              <span className="total-amount">1,575,000/=</span>
            </div>
          </div>
          
          <div className="fee-grid">
            {feeStructure
              .filter(f => f.id.includes('-half') && f.type !== 'header')
              .map(fee => (
                <div key={fee.id} className={`fee-item ${fee.type || ''}`}>
                  <div>
                    <div className="fee-name">{fee.name}</div>
                    <div className="fee-description">{fee.description}</div>
                  </div>
                  <div className="fee-amount">
                    {fee.amount === 0 ? 'Free' : `${fee.amount.toLocaleString()}/=`}
                  </div>
                </div>
              ))}
          </div>

          <div className="installment-section">
            <h3>Payment Installments (Half Day)</h3>
            <div className="installment-grid">
              <div className="installment-item">
                <div className="installment-type">Continuing Student Total</div>
                <div className="installment-amount">1,575,000/=</div>
                <div className="installment-breakdown">
                  First Installment: 787,500/= | Second Installment: 787,500/=
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ADDITIONAL INFO */}
      <div className="additional-info-section">
        <div className="info-card">
          <h3>FULL UNIFORM - 100,000/=</h3>
          <div className="uniform-grid">
            <div className="uniform-item">
              <span className="uniform-name">T-shirt</span>
              <span className="uniform-price">25,000/=</span>
            </div>
            <div className="uniform-item">
              <span className="uniform-name">Trouser / Skirt</span>
              <span className="uniform-price">40,000/=</span>
            </div>
            <div className="uniform-item">
              <span className="uniform-name">Sport Wear</span>
              <span className="uniform-price">35,000/=</span>
            </div>
          </div>
        </div>

        <div className="info-card">
          <h3>Family Discounts</h3>
          <div className="discount-grid">
            <div className="discount-item">
              <span className="discount-type">3rd Child</span>
              <span className="discount-amount">- 50,000/=</span>
            </div>
            <div className="discount-item">
              <span className="discount-type">4th Child</span>
              <span className="discount-amount">- 75,000/=</span>
            </div>
            <div className="discount-item">
              <span className="discount-type">5th Child & Above</span>
              <span className="discount-amount">- 80,000/=</span>
            </div>
          </div>
        </div>

        <div className="info-card">
          <h3><CreditCard size={18} /> Bank Payment Details</h3>
          <div className="bank-details">
            <div className="bank-item">
              <span className="bank-label">Account Name:</span>
              <span className="bank-value">DENIZ UPPER PRIMARY</span>
            </div>
            <div className="bank-item">
              <span className="bank-label">Account Number:</span>
              <span className="bank-value">0150028733-TZS</span>
            </div>
            <div className="bank-item">
              <span className="bank-label">Bank Name:</span>
              <span className="bank-value">EXIM BANK</span>
            </div>
          </div>
        </div>
      </div>

      <div className="payment-instructions">
        <h3>Payment Instructions</h3>
        <div className="instructions-content">
          <p><strong>Payment Methods:</strong> Bank Transfer, Mobile Money (M-Pesa, Tigo Pesa, Airtel Money), or Cash at school office</p>
          <p><strong>Important:</strong> Always include student name and admission number as payment reference</p>
          <p><strong>Contact:</strong> For any questions regarding fees, please contact the school administration</p>
        </div>
      </div>
    </div>
  );
};

// Main FeeStructure Component - Routes to chain-specific structure
const FeeStructure = () => {
  const navigate = useNavigate();
  const currentUser = useSelector(selectCurrentUser);
  const userChain = currentUser?.chain?.toUpperCase();

  // Show DLP fee structure for DLP chain users
  if (userChain === 'DLP') {
    return <DLPFeeStructure navigate={navigate} />;
  }

  // Default to DUP fee structure for all other chains
  return <DUPFeeStructure navigate={navigate} />;
};

export default FeeStructure;
