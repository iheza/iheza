import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';

function UniformReport() {
  const currentUser = useSelector(selectCurrentUser);
  const currentUserName = currentUser?.name || currentUser?.first_name || 'User';
  const [savedMsg, setSavedMsg] = useState('');
  const [lastSaved, setLastSaved] = useState(null);
  const sheetRef = useRef(null);


  // Product → sizes mapping (per-size stock tracking — one row per size)

  const PRODUCTS = [
    { name: "Girls' T-Shirt", sizes: ["28", "30", "32", "34", "36", "38", "40", "42", "44", "46"] },
    { name: "Girls' Skirt", sizes: ["28", "30", "32", "34", "36", "38", "40", "42", "44", "46"] },
    { name: "Boys' T-Shirt", sizes: ["28", "30", "32", "34", "36", "38", "40", "42", "44", "46"] },
    { name: "Boys' Trousers", sizes: ["28", "30", "32", "34", "36", "38", "40", "42", "44", "46"] },
    { name: "Sports T-Shirt", sizes: ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL", "4XL"] },
    { name: "Sports Tracksuit", sizes: ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL", "4XL"] },
    { name: "Deniz Upper Long-Sleeve Sports Dress", sizes: ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL", "4XL"] },
  ];


  // Build initial per-size stock object (keyed by "Product__Size").
  // All values start at 0 — the Products & Sizes table is the source of truth
  // and is empty until stock entries/exits are recorded.
  const buildInitialStock = () => {
    const s = {};
    PRODUCTS.forEach(p => p.sizes.forEach(sz => { s[`${p.name}__${sz}`] = 0; }));
    return s;
  };


  // Stock values keyed by "Product__Size"
  const [stock, setStock] = useState(buildInitialStock);

  // Stock movement history — auto-populated from Stock Exit entries
  const [history, setHistory] = useState([]);
  // Track last processed exit quantity per row to avoid duplicate history entries
  const lastExitQtyRef = useRef({});



  // Per-size stock helpers
  const stockKey = (product, size) => `${product}__${size}`;
  const getStock = (product, size) => stock[stockKey(product, size)] || 0;
  const productTotal = (product) => {
    const p = PRODUCTS.find(x => x.name === product);
    if (!p) return 0;
    return p.sizes.reduce((sum, sz) => sum + (stock[stockKey(product, sz)] || 0), 0);
  };


  const today = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY

  // Collapsible sections — each section can be opened/closed via its header button.

  // All sections start open so the full report is visible on first load.
  const [openSections, setOpenSections] = useState({
    products: true,
    exit: true,
    physical: true,
    discrepancies: true,
    history: true,
  });

  const toggleSection = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));







  // Derived analytics from stock values (summed across all sizes per product)
  const totalItems = Object.values(stock).reduce((a, b) => a + (b || 0), 0);
  const pct = (v) => (totalItems > 0 ? ((v / totalItems) * 100).toFixed(1) : '0.0');
  const criticalCount = PRODUCTS.filter(p => productTotal(p.name) < 20).length;
  const maxStock = Math.max(1, ...PRODUCTS.map(p => productTotal(p.name)));




  const barHeight = (v) => Math.max(8, Math.round((v / maxStock) * 100));
  const barClass = (v) => (v < 20 ? 'low' : v < 50 ? 'medium' : 'high');
  const barColor = (v) => (v < 20 ? '#c0392b' : v < 50 ? '#856404' : '#1a7a3a');

  // Load saved edits from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('iheza_uniform_edits');
      if (saved) {
        const data = JSON.parse(saved);
        setLastSaved(data.savedAt || null);
        if (data.stock) {
          setStock(data.stock);
        }
        if (data.history && Array.isArray(data.history)) {
          setHistory(data.history);
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Persist stock movement history to localStorage whenever it changes
  // Skip the first render to avoid overwriting loaded history with empty array
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    try {
      const saved = localStorage.getItem('iheza_uniform_edits');
      const data = saved ? JSON.parse(saved) : {};
      data.history = history;
      localStorage.setItem('iheza_uniform_edits', JSON.stringify(data));
    } catch (e) {
      // ignore
    }
  }, [history]);



  // Read stock values from the Products & Sizes table (Section 1).
  // The table has one row per size; the product name appears only on the first
  // row of each product group, so we track the current product as we go.
  const readStockFromTable = () => {
    if (!sheetRef.current) return null;
    const productRows = sheetRef.current.querySelectorAll('table[data-section="products"] tbody tr');
    let newStock = { ...stock };
    let currentProduct = null;
    productRows.forEach((tr) => {
      const tds = tr.querySelectorAll('td');
      if (tds.length >= 4) {
        const name = (tds[1]?.textContent || '').trim();
        if (name) currentProduct = name;
        const size = (tds[2]?.textContent || '').trim();
        const val = parseInt((tds[3]?.textContent || '').replace(/[^\d-]/g, ''), 10) || 0;
        if (currentProduct && size) {
          newStock[stockKey(currentProduct, size)] = val;
        }
      }
    });
    return newStock;
  };






  // Apply saved edits to contentEditable cells after render
  useEffect(() => {
    try {
      const saved = localStorage.getItem('iheza_uniform_edits');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.cells && sheetRef.current) {
          const cells = sheetRef.current.querySelectorAll('td[contenteditable="true"]');
          cells.forEach((cell, idx) => {
            if (data.cells[idx] !== undefined) {
              cell.textContent = data.cells[idx];
            }
          });
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // LIVE updates: re-read stock values whenever any editable cell changes
  // NOTE: This handler is intentionally removed to avoid conflicts with
  // handleExitInput which manages stock deductions from the Stock Exit table.
  // Stock values are read and saved when the user clicks "Update".


  // Apply a quantity change to a specific product + size's stock
  const applyQty = (base, productName, size, qty) => {
    const next = { ...base };
    const key = stockKey(productName, size);
    next[key] = Math.max(0, (next[key] || 0) + qty);
    return next;
  };





  // SMART TABLE: when a stock exit quantity is edited, auto-apply the deduction
  // to the matching product + size in the Products & Sizes table, and add a
  // transaction to the Stock Movement History.
  const handleExitInput = (e) => {
    const td = e.target.closest('td');
    if (!td) return;
    const tr = td.closest('tr');
    if (!tr) return;
    const tds = tr.querySelectorAll('td');
    if (tds.length < 4) return;

    // Only trigger the smart deduction when the Quantity (index 3) cell is edited
    const cellIndex = Array.from(tds).indexOf(td);
    if (cellIndex !== 3) return;

    // Find the product name by walking up to the first row of this product group
    // (product name only appears on the first row of each product's size group)
    let productName = (tds[1]?.textContent || '').trim();
    if (!productName) {
      // Walk backwards through previous rows to find the product name
      const allRows = Array.from(tr.parentElement.querySelectorAll('tr'));
      const rowIdx = allRows.indexOf(tr);
      for (let i = rowIdx - 1; i >= 0; i--) {
        const prevName = (allRows[i].querySelectorAll('td')[1]?.textContent || '').trim();
        if (prevName) { productName = prevName; break; }
      }
    }
    const size = (tds[2]?.textContent || '').trim();
    const qty = parseInt((tds[3]?.textContent || '').replace(/[^\d-]/g, ''), 10) || 0;
    if (!productName || !size || qty <= 0) return;

    // Track previous quantity for this row to deduct only the difference
    const rowKey = `${productName}__${size}`;
    const prevQty = lastExitQtyRef.current[rowKey] || 0;
    const diff = qty - prevQty;
    if (diff === 0) return;

    // Apply the deduction difference to the specific product + size
    lastExitQtyRef.current[rowKey] = qty;
    setStock(prev => applyQty(prev, productName, size, -diff));

    // Add/update a transaction in the Stock Movement History
    const recipient = (tds[4]?.textContent || '').trim();
    const runningBalance = getStock(productName, size) - qty;
    setHistory(prev => {
      const existing = prev.filter(h => !(h.product === productName && h.size === size));
      return [...existing, {
        date: today,
        product: productName,
        size,
        type: 'Stock Exit',
        qty: -qty,
        user: currentUserName,
        recipient,
        runningBalance: Math.max(0, runningBalance),

      }];
    });
  };









  const handleUpdate = () => {

    if (!sheetRef.current) return;
    const cells = sheetRef.current.querySelectorAll('td[contenteditable="true"]');
    const values = Array.from(cells).map(c => c.textContent);

    let newStock = readStockFromTable() || stock;

    // Process Stock Exit rows (subtract from stock) — per product + size
    // Product name only appears on the first row of each product group,
    // so track the current product as we iterate through rows.
    const exitRowsEl = sheetRef.current.querySelectorAll('tr[data-rowtype="exit"]');
    let currentExitProduct = null;
    const newHistory = [];
    exitRowsEl.forEach((tr) => {
      const tds = tr.querySelectorAll('td');
      if (tds.length >= 4) {
        const name = (tds[1]?.textContent || '').trim();
        if (name) currentExitProduct = name;
        const size = (tds[2]?.textContent || '').trim();
        const qty = parseInt((tds[3]?.textContent || '').replace(/[^\d-]/g, ''), 10) || 0;
        if (currentExitProduct && size && qty > 0) {
          newStock = applyQty(newStock, currentExitProduct, size, -qty);
          const recipient = (tds[4]?.textContent || '').trim();
          newHistory.push({
            date: today,
            product: currentExitProduct,
            size,
            type: 'Stock Exit',
            qty: -qty,
            user: currentUserName,
            recipient,
            runningBalance: Math.max(0, newStock[stockKey(currentExitProduct, size)] || 0),

          });
        }
      }
    });
    if (newHistory.length > 0) setHistory(newHistory);





    // Update the Products & Sizes table stock cells to reflect the new stock (per size)
    if (sheetRef.current) {
      const productRows = sheetRef.current.querySelectorAll('table[data-section="products"] tbody tr');
      let currentProduct = null;
      productRows.forEach((tr) => {
        const tds = tr.querySelectorAll('td');
        if (tds.length >= 4) {
          const name = (tds[1]?.textContent || '').trim();
          if (name) currentProduct = name;
          const size = (tds[2]?.textContent || '').trim();
          if (currentProduct && size) {
            tds[3].textContent = newStock[stockKey(currentProduct, size)] || 0;
          }
        }
      });
    }




    const payload = {
      cells: values,
      stock: newStock,
      history: newHistory.length > 0 ? newHistory : history,
      savedAt: new Date().toLocaleString(),
    };

    try {
      localStorage.setItem('iheza_uniform_edits', JSON.stringify(payload));
      setStock(newStock);
      setLastSaved(payload.savedAt);
      setSavedMsg('✅ Changes saved! Stock exits applied to inventory.');

      setTimeout(() => setSavedMsg(''), 3000);
    } catch (e) {
      setSavedMsg('❌ Failed to save changes.');
      setTimeout(() => setSavedMsg(''), 3000);
    }
  };




  return (
    <div className="uniform-inventory-page">

      <style>{`
        .uniform-inventory-page * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .uniform-inventory-page {
          background: #eef2f7;
          font-family: 'Segoe UI', Roboto, system-ui, sans-serif;
          padding: 2rem 1rem;
        }

        .uniform-inventory-page .sheet {
          background: #ffffff;
          border-radius: 28px;
          box-shadow: 0 20px 60px rgba(0, 20, 40, 0.20);
          padding: 2rem 2rem 1.8rem;
          max-width: 1600px;
          margin: 0 auto;
          overflow-x: auto;
        }

        .uniform-inventory-page .header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 0.75rem 2rem;
          margin-bottom: 2rem;
          padding-bottom: 0.75rem;
          border-bottom: 2px solid #dce4f0;
        }

        .uniform-inventory-page .header h1 {
          font-weight: 700;
          font-size: 1.9rem;
          color: #0b1e33;
          letter-spacing: -0.5px;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .uniform-inventory-page .header h1 small {
          font-weight: 400;
          font-size: 0.85rem;
          color: #2c4a6a;
          background: #e8effa;
          padding: 0.2rem 1.2rem;
          border-radius: 40px;
          letter-spacing: 0.2px;
        }

        .uniform-inventory-page .badge {
          background: #dce4f0;
          padding: 0.3rem 1.4rem;
          border-radius: 40px;
          font-size: 0.8rem;
          font-weight: 500;
          color: #1c2f47;
          white-space: nowrap;
        }

        .uniform-inventory-page .section-title {
          font-weight: 600;
          font-size: 1.1rem;
          color: #0b1e33;
          margin: 1.8rem 0 0.8rem 0;
          padding: 0.4rem 0.8rem;
          background: #e8effa;
          border-radius: 8px;
          border-left: 4px solid #3a74b0;
        }

        /* ─── COLLAPSIBLE SECTION HEADER ─── */
        .uniform-inventory-page .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          cursor: pointer;
          user-select: none;
        }

        .uniform-inventory-page .section-header .section-label {
          font-weight: 600;
          font-size: 1.05rem;
          color: #0b1e33;
          line-height: 1.25;
        }

        .uniform-inventory-page .section-header .section-sub {
          font-weight: 400;
          font-size: 0.72rem;
          color: #5a6f8a;
          display: block;
          margin-top: 0.1rem;
        }

        .uniform-inventory-page .section-toggle-btn {
          background: #3a74b0;
          color: white;
          border: none;
          border-radius: 20px;
          padding: 0.25rem 0.9rem;
          font-size: 0.7rem;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background 0.15s ease;
        }

        .uniform-inventory-page .section-toggle-btn:hover {
          background: #2c5a8a;
        }

        .uniform-inventory-page .section-body {
          overflow: hidden;
          transition: max-height 0.25s ease, opacity 0.2s ease;
        }

        .uniform-inventory-page .section-body.closed {
          max-height: 0;
          opacity: 0;
          margin: 0;
        }


        .uniform-inventory-page .table-wrap {
          border-radius: 12px;
          background: #f8faff;
          border: 1px solid #d8e2f0;
          overflow-x: auto;
          margin-bottom: 1.5rem;
        }

        .uniform-inventory-page .timetable {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.7rem;
          min-width: 0;
          table-layout: auto;
        }

        .uniform-inventory-page .timetable th {
          font-weight: 600;
          color: #0a1f36;
          font-size: 0.6rem;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          padding: 0.4rem 0.2rem;
          border: 1px solid #cbd6e8;
          text-align: center;
          vertical-align: middle;
          position: sticky;
          top: 0;
          z-index: 10;
          white-space: nowrap;
          background: #dce6f4;
        }

        .uniform-inventory-page .timetable td {
          border: 1px solid #cbd6e8;
          padding: 0.3rem 0.15rem;
          text-align: center;
          vertical-align: middle;
          height: 34px;
          background: white;
          color: #16416b;
          transition: background 0.1s ease;
          word-break: break-word;
        }



        .uniform-inventory-page .timetable td[contenteditable="true"] {
          cursor: text;
          min-width: 50px;
        }

        .uniform-inventory-page .timetable td[contenteditable="true"]:hover {
          background: #f0f6fe;
        }

        .uniform-inventory-page .timetable td[contenteditable="true"]:focus {
          outline: 2px solid #3a74b0;
          outline-offset: -2px;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(58, 116, 176, 0.10);
          z-index: 2;
          position: relative;
        }

        /* ─── DASHBOARD CARDS ─── */


        .uniform-inventory-page .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .uniform-inventory-page .stat-card {
          background: white;
          border-radius: 12px;
          padding: 1.2rem 1rem;
          border: 1px solid #d8e2f0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          text-align: center;
          min-height: 110px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow: visible;
        }


        .uniform-inventory-page .stat-card .number {
          font-size: 1.4rem;
          font-weight: 700;
          color: #0b1e33;
          line-height: 1.2;
        }

        .uniform-inventory-page .stat-card .label {
          font-size: 0.6rem;
          color: #5a6f8a;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 0.2rem;
        }

        .uniform-inventory-page .stat-card .trend {
          font-size: 0.6rem;
          margin-top: 0.3rem;
        }


        .uniform-inventory-page .stat-card .trend.up { color: #1a7a3a; }
        .uniform-inventory-page .stat-card .trend.down { color: #c0392b; }
        .uniform-inventory-page .stat-card .trend.warning { color: #856404; }

        .uniform-inventory-page .stat-card.critical { border-left: 4px solid #c0392b; }
        .uniform-inventory-page .stat-card.warning { border-left: 4px solid #856404; }
        .uniform-inventory-page .stat-card.success { border-left: 4px solid #1a7a3a; }
        .uniform-inventory-page .stat-card.info { border-left: 4px solid #3a74b0; }

        /* ─── MINI BAR GRAPH ─── */
        .uniform-inventory-page .mini-bar-container {
          display: flex;
          align-items: flex-end;
          height: 120px;
          gap: 12px;
          padding: 0.5rem 0;
          justify-content: center;
        }

        .uniform-inventory-page .mini-bar {
          width: 50px;
          background: #3a74b0;
          border-radius: 6px 6px 0 0;
          transition: height 0.3s ease;
          position: relative;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          display: block;
        }


        .uniform-inventory-page .mini-bar.low { background: #c0392b; }
        .uniform-inventory-page .mini-bar.medium { background: #856404; }
        .uniform-inventory-page .mini-bar.high { background: #1a7a3a; }

        .uniform-inventory-page .mini-bar-value {
          font-size: 0.8rem;
          font-weight: 700;
          color: #0b1e33;
          margin-bottom: 4px;
        }

        .uniform-inventory-page .mini-bar-label {
          font-size: 0.6rem;
          color: #5a6f8a;
          text-align: center;
          margin-top: 4px;
        }

        .uniform-inventory-page .bar-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
        }



        /* ─── STOCK LEVEL INDICATOR ─── */
        .uniform-inventory-page .stock-indicator {
          display: inline-block;
          padding: 0.15rem 0.6rem;
          border-radius: 20px;
          font-size: 0.6rem;
          font-weight: 700;
        }

        .uniform-inventory-page .stock-indicator.critical {
          background: #ffebee;
          color: #c0392b;
          animation: uniformPulse 1.5s infinite;
        }

        .uniform-inventory-page .stock-indicator.low {
          background: #fff3cd;
          color: #856404;
        }

        .uniform-inventory-page .stock-indicator.ok {
          background: #e8f5e9;
          color: #1a7a3a;
        }

        @keyframes uniformPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .uniform-inventory-page .progress-bar {
          width: 100%;
          height: 8px;
          background: #e9ecef;
          border-radius: 10px;
          overflow: hidden;
          margin-top: 0.3rem;
        }

        .uniform-inventory-page .progress-bar .fill {
          height: 100%;
          border-radius: 10px;
          transition: width 0.5s ease;
        }

        .uniform-inventory-page .progress-bar .fill.critical { background: #c0392b; }
        .uniform-inventory-page .progress-bar .fill.warning { background: #856404; }
        .uniform-inventory-page .progress-bar .fill.ok { background: #1a7a3a; }

        .uniform-inventory-page .alert-banner {
          background: #ffebee;
          border: 1px solid #f5c6cb;
          border-radius: 8px;
          padding: 0.6rem 1rem;
          margin-bottom: 1rem;
          color: #721c24;
          font-weight: 600;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          gap: 0.8rem;
          flex-wrap: wrap;
        }

        .uniform-inventory-page .alert-banner .action-btn {
          background: #c0392b;
          color: white;
          border: none;
          padding: 0.2rem 1rem;
          border-radius: 20px;
          font-weight: 600;
          font-size: 0.7rem;
          cursor: pointer;
          margin-left: auto;
        }

        .uniform-inventory-page .footer {
          margin-top: 1.5rem;
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem 2rem;
          font-size: 0.7rem;
          color: #2f4b6e;
          border-top: 1px solid #dce4f0;
          padding-top: 1rem;
        }

        .uniform-inventory-page .footer .note {
          background: #eef4fc;
          padding: 0.15rem 1.2rem;
          border-radius: 30px;
        }

        .uniform-inventory-page .footer .friday-note {
          background: #f5efe4;
          color: #6d5535;
          padding: 0.15rem 1.2rem;
          border-radius: 30px;
        }

        @media (max-width: 820px) {
          .uniform-inventory-page .sheet { padding: 1rem 0.6rem; }
          .uniform-inventory-page .timetable { font-size: 0.6rem; min-width: 0; }
          .uniform-inventory-page .header h1 { font-size: 1.4rem; }
          .uniform-inventory-page .dashboard-grid { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
        }

        @media (max-width: 500px) {
          .uniform-inventory-page .timetable { font-size: 0.55rem; min-width: 0; }
          .uniform-inventory-page .header h1 { font-size: 1.1rem; }
          .uniform-inventory-page .dashboard-grid { grid-template-columns: 1fr 1fr; }
        }

      `}</style>

      <div className="sheet" ref={sheetRef}>

        {/* HEADER */}
        <div className="header">
          <h1>
            📋 IHEZA UNIFORM INVENTORY
            <small>Control System · 2026</small>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleUpdate}
              style={{
                background: '#1a7a3a',
                color: 'white',
                border: 'none',
                padding: '0.45rem 1.4rem',
                borderRadius: '40px',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(26,122,58,0.3)',
                transition: 'transform 0.1s ease',
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              💾 Update
            </button>
          </div>
        </div>

        {/* Action Items */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {criticalCount > 0 ? (
            <div style={{ background: '#fff5f5', borderRadius: '12px', border: '1px solid #f5c6cb', padding: '0.8rem 1rem' }}>
              <div style={{ fontWeight: 700, color: '#c0392b', fontSize: '0.8rem' }}>🚨 HIGH PRIORITY</div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
                <strong>🛒 Reorder:</strong> {productTotal("Boys' Trousers") < 20 ? `Boys' Trousers (Size 32)` : `${criticalCount} product(s) below reorder level`}<br />
                <span style={{ color: '#888', fontSize: '0.65rem' }}>{productTotal("Boys' Trousers") < 20 ? `Only ${productTotal("Boys' Trousers")} left — minimum stock should be 20` : 'Below minimum stock threshold'}</span>
              </div>


            </div>
          ) : (

            <div style={{ background: '#e8f5e9', borderRadius: '12px', border: '1px solid #a5d6a7', padding: '0.8rem 1rem' }}>
              <div style={{ fontWeight: 700, color: '#1a7a3a', fontSize: '0.8rem' }}>✅ ALL STOCK LEVELS OK</div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
                <strong>No reorder needed</strong><br />
                <span style={{ color: '#888', fontSize: '0.65rem' }}>All products above minimum stock threshold</span>
              </div>
            </div>
          )}
          <div style={{ background: '#eef4fc', borderRadius: '12px', border: '1px solid #b8d0ea', padding: '0.8rem 1rem' }}>
            <div style={{ fontWeight: 700, color: '#2c4a6a', fontSize: '0.8rem' }}>🟡 MEDIUM PRIORITY</div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
              <strong>📋 No pending investigations</strong><br />
              <span style={{ color: '#888', fontSize: '0.65rem' }}>No discrepancies recorded — all stock accounted for</span>
            </div>
          </div>

        </div>



        {/* Save confirmation message */}
        {savedMsg && (
          <div style={{
            background: savedMsg.includes('✅') ? '#e8f5e9' : '#ffebee',
            color: savedMsg.includes('✅') ? '#1a7a3a' : '#c0392b',
            border: `1px solid ${savedMsg.includes('✅') ? '#a5d6a7' : '#f5c6cb'}`,
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            marginBottom: '1rem',
            fontWeight: 600,
            fontSize: '0.8rem',
            textAlign: 'center',
          }}>
            {savedMsg}
          </div>
        )}
        {lastSaved && !savedMsg && (
          <div style={{
            background: '#eef4fc',
            color: '#2c4a6a',
            borderRadius: '8px',
            padding: '0.4rem 1rem',
            marginBottom: '1rem',
            fontWeight: 500,
            fontSize: '0.7rem',
            textAlign: 'center',
          }}>
            🕒 Last saved: {lastSaved}
          </div>
        )}


        {/* ─── ANALYTICS DASHBOARD (top) ─── */}
        <div style={{ marginTop: '50px' }}>
          {criticalCount > 0 && (
            <div className="alert-banner">
              <span style={{ fontSize: '1.2rem' }}>🔴</span>
              <span><strong>CRITICAL:</strong> {productTotal("Boys' Trousers") < 20 ? `Boys' Trousers (Size 32) — Only ${productTotal("Boys' Trousers")} left!` : `${criticalCount} product(s) below reorder level!`} <strong>REORDER NOW</strong></span>


              <span className="action-btn">🛒 Order Now</span>
            </div>
          )}



          <div className="dashboard-grid">
            <div className="stat-card critical">
              <div className="number">{criticalCount}</div>
              <div className="label">🔴 Critical Low Stock</div>
              <div className="trend down">⚠️ Below reorder level</div>
            </div>
            <div className="stat-card warning">
              <div className="number">0</div>
              <div className="label">📋 Pending Discrepancies</div>
              <div className="trend warning">⏳ Awaiting approval</div>
            </div>
            <div className="stat-card success">
              <div className="number">{totalItems}</div>
              <div className="label">📦 Total Items</div>
              <div className="trend up">📈 Current stock level</div>
            </div>
            <div className="stat-card info">
              <div className="number">0</div>
              <div className="label">📤 Items Issued (30 days)</div>
              <div className="trend">📊 No exits recorded</div>
            </div>

          </div>


          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #d8e2f0', padding: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#0b1e33', marginBottom: '0.8rem' }}>📊 Stock Distribution by Product</div>
            <div className="mini-bar-container">
              <div className="bar-wrapper">
                <div className="mini-bar-value" style={{ color: barColor(productTotal("Boys' Trousers")) }}>{productTotal("Boys' Trousers")}</div>
                <div className={`mini-bar ${barClass(productTotal("Boys' Trousers"))}`} style={{ height: `${barHeight(productTotal("Boys' Trousers"))}px` }}></div>
                <div className="mini-bar-label">Boys' Trousers<br /><strong style={{ color: barColor(productTotal("Boys' Trousers")) }}>{pct(productTotal("Boys' Trousers"))}%</strong></div>
              </div>
              <div className="bar-wrapper">
                <div className="mini-bar-value" style={{ color: barColor(productTotal("Boys' T-Shirt")) }}>{productTotal("Boys' T-Shirt")}</div>
                <div className={`mini-bar ${barClass(productTotal("Boys' T-Shirt"))}`} style={{ height: `${barHeight(productTotal("Boys' T-Shirt"))}px` }}></div>
                <div className="mini-bar-label">Boys' T-Shirt<br /><strong style={{ color: barColor(productTotal("Boys' T-Shirt")) }}>{pct(productTotal("Boys' T-Shirt"))}%</strong></div>
              </div>
              <div className="bar-wrapper">
                <div className="mini-bar-value" style={{ color: barColor(productTotal("Sports T-Shirt")) }}>{productTotal("Sports T-Shirt")}</div>
                <div className={`mini-bar ${barClass(productTotal("Sports T-Shirt"))}`} style={{ height: `${barHeight(productTotal("Sports T-Shirt"))}px` }}></div>
                <div className="mini-bar-label">Sports T-Shirt<br /><strong style={{ color: barColor(productTotal("Sports T-Shirt")) }}>{pct(productTotal("Sports T-Shirt"))}%</strong></div>
              </div>
              <div className="bar-wrapper">
                <div className="mini-bar-value" style={{ color: barColor(productTotal("Girls' T-Shirt")) }}>{productTotal("Girls' T-Shirt")}</div>
                <div className={`mini-bar ${barClass(productTotal("Girls' T-Shirt"))}`} style={{ height: `${barHeight(productTotal("Girls' T-Shirt"))}px` }}></div>
                <div className="mini-bar-label">Girls' T-Shirt<br /><strong style={{ color: barColor(productTotal("Girls' T-Shirt")) }}>{pct(productTotal("Girls' T-Shirt"))}%</strong></div>
              </div>
              <div className="bar-wrapper">
                <div className="mini-bar-value" style={{ color: barColor(productTotal("Girls' Skirt")) }}>{productTotal("Girls' Skirt")}</div>
                <div className={`mini-bar ${barClass(productTotal("Girls' Skirt"))}`} style={{ height: `${barHeight(productTotal("Girls' Skirt"))}px` }}></div>
                <div className="mini-bar-label">Girls' Skirt<br /><strong style={{ color: barColor(productTotal("Girls' Skirt")) }}>{pct(productTotal("Girls' Skirt"))}%</strong></div>
              </div>
              <div className="bar-wrapper">
                <div className="mini-bar-value" style={{ color: barColor(productTotal("Sports Tracksuit")) }}>{productTotal("Sports Tracksuit")}</div>
                <div className={`mini-bar ${barClass(productTotal("Sports Tracksuit"))}`} style={{ height: `${barHeight(productTotal("Sports Tracksuit"))}px` }}></div>
                <div className="mini-bar-label">Sports Tracksuit<br /><strong style={{ color: barColor(productTotal("Sports Tracksuit")) }}>{pct(productTotal("Sports Tracksuit"))}%</strong></div>
              </div>
              <div className="bar-wrapper">
                <div className="mini-bar-value" style={{ color: barColor(productTotal("Deniz Upper Long-Sleeve Sports Dress")) }}>{productTotal("Deniz Upper Long-Sleeve Sports Dress")}</div>
                <div className={`mini-bar ${barClass(productTotal("Deniz Upper Long-Sleeve Sports Dress"))}`} style={{ height: `${barHeight(productTotal("Deniz Upper Long-Sleeve Sports Dress"))}px` }}></div>
                <div className="mini-bar-label">Deniz Sports Dress<br /><strong style={{ color: barColor(productTotal("Deniz Upper Long-Sleeve Sports Dress")) }}>{pct(productTotal("Deniz Upper Long-Sleeve Sports Dress"))}%</strong></div>
              </div>
            </div>





          </div>


          <div className="table-wrap">
            <table className="timetable">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}>#</th>
                  <th>Product</th>
                  <th>Size</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Recent Movement</th>
                  <th>Pending Discrepancies</th>
                </tr>

              </thead>
              <tbody>
                <tr style={{ background: productTotal("Boys' Trousers") < 20 ? '#fff5f5' : 'white' }}>
                  <td style={{ fontWeight: 700, color: productTotal("Boys' Trousers") < 20 ? '#c0392b' : '#0b1e33' }}>{productTotal("Boys' Trousers") < 20 ? '🔴 1' : '1'}</td>
                  <td><strong>Boys' Trousers</strong></td>
                  <td>32</td>
                  <td style={{ fontWeight: 700, color: productTotal("Boys' Trousers") < 20 ? '#c0392b' : '#0b1e33', fontSize: '1.1rem' }}>{productTotal("Boys' Trousers")}</td>
                  <td>{productTotal("Boys' Trousers") < 20 ? <span className="stock-indicator critical">⚠️ CRITICAL</span> : <span className="stock-indicator ok">✅ OK</span>}</td>
                  <td>—</td>
                  <td style={{ color: '#1a7a3a' }}>✅ None</td>
                </tr>

                <tr>
                  <td>2</td>
                  <td>Boys' T-Shirt</td>
                  <td>32</td>
                  <td style={{ fontWeight: 700 }}>{productTotal("Boys' T-Shirt")}</td>
                  <td>{productTotal("Boys' T-Shirt") < 20 ? <span className="stock-indicator critical">⚠️ CRITICAL</span> : <span className="stock-indicator ok">✅ OK</span>}</td>
                  <td>—</td>
                  <td style={{ color: '#1a7a3a' }}>✅ None</td>
                </tr>

                <tr>
                  <td>3</td>
                  <td>Sports T-Shirt</td>
                  <td>L</td>
                  <td style={{ fontWeight: 700 }}>{productTotal("Sports T-Shirt")}</td>
                  <td>{productTotal("Sports T-Shirt") < 20 ? <span className="stock-indicator critical">⚠️ CRITICAL</span> : <span className="stock-indicator ok">✅ OK</span>}</td>
                  <td>—</td>
                  <td style={{ color: '#1a7a3a' }}>✅ None</td>
                </tr>

                <tr>
                  <td>4</td>
                  <td>Girls' T-Shirt</td>
                  <td>34</td>
                  <td style={{ fontWeight: 700 }}>{productTotal("Girls' T-Shirt")}</td>
                  <td>{productTotal("Girls' T-Shirt") < 20 ? <span className="stock-indicator critical">⚠️ CRITICAL</span> : <span className="stock-indicator ok">✅ OK</span>}</td>
                  <td>—</td>
                  <td style={{ color: '#1a7a3a' }}>✅ None</td>
                </tr>




              </tbody>


            </table>
          </div>

        </div>


        {/* ─── SECTION: PRODUCTS & SIZES ─── */}

        <div className="section-title">
          <div className="section-header" onClick={() => toggleSection('products')}>
            <div className="section-label">📦 Products & Sizes<span className="section-sub">Source of truth · one row per size</span></div>
            <button className="section-toggle-btn">{openSections.products ? '▲ Close' : '▼ Open'}</button>
          </div>
        </div>
        <div className={`section-body ${openSections.products ? '' : 'closed'}`}>
          <div className="table-wrap">
            <table className="timetable" data-section="products">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product Name</th>
                  <th>Size</th>
                  <th>Current Stock</th>
                  <th>Last Updated</th>
                </tr>
              </thead>

              <tbody>
                {PRODUCTS.map((p, pi) => (
                  p.sizes.map((sz, si) => (
                    <tr key={`${p.name}-${sz}`}>
                      <td>{si === 0 ? pi + 1 : ''}</td>
                      <td contentEditable="true" style={si === 0 ? { fontWeight: 700 } : {}}>{si === 0 ? p.name : ''}</td>
                      <td contentEditable="true">{sz}</td>
                      <td contentEditable="true"><span style={{ color: getStock(p.name, sz) < 20 ? '#c0392b' : '#16416b', fontWeight: 700 }}>{getStock(p.name, sz)}</span></td>
                      <td contentEditable="true">{si === 0 ? '' : ''}</td>

                    </tr>
                  ))
                ))}
              </tbody>



            </table>
          </div>
        </div>


        {/* ─── SECTION: STOCK EXIT ─── */}

        <div className="section-title">
          <div className="section-header" onClick={() => toggleSection('exit')}>
            <div className="section-label">📤 Stock Exit<span className="section-sub">Record issued items · auto-deducts stock</span></div>
            <button className="section-toggle-btn">{openSections.exit ? '▲ Close' : '▼ Open'}</button>
          </div>
        </div>
        <div className={`section-body ${openSections.exit ? '' : 'closed'}`}>
          <div className="table-wrap">
            <table className="timetable" onInput={handleExitInput}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Size</th>
                  <th>Quantity (-)</th>
                  <th>Recipient / Purpose</th>
                  <th>Person</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {PRODUCTS.map((p, pi) => (
                  p.sizes.map((sz, si) => (
                    <tr key={`exit-${p.name}-${sz}`} data-rowtype="exit" style={{ background: '#fdf0f0' }}>
                      <td style={{ fontWeight: 600 }}>{today}</td>
                      <td style={si === 0 ? { fontWeight: 700 } : {}}>{si === 0 ? p.name : ''}</td>
                      <td contentEditable="true" suppressContentEditableWarning>{sz}</td>
                      <td contentEditable="true" suppressContentEditableWarning style={{ color: '#c0392b', fontWeight: 700 }}></td>
                      <td contentEditable="true" suppressContentEditableWarning></td>
                      <td style={{ fontWeight: 700, color: '#16416b', background: '#fdf0f0' }}>{currentUserName}</td>

                      <td style={{ background: '#ffebee', color: '#c0392b', fontWeight: 600 }}>⏳ Pending</td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </div>





        {/* ─── SECTION: PHYSICAL STOCK COUNT ─── */}
        <div className="section-title">
          <div className="section-header" onClick={() => toggleSection('physical')}>
            <div className="section-label">🔍 Physical Stock Count<span className="section-sub">Actual warehouse count · compare to system</span></div>
            <button className="section-toggle-btn">{openSections.physical ? '▲ Close' : '▼ Open'}</button>
          </div>
        </div>
        <div className={`section-body ${openSections.physical ? '' : 'closed'}`}>
          <div className="table-wrap">
            <table className="timetable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Size</th>
                  <th>System Stock</th>
                  <th>Physical Count</th>
                  <th>Difference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: '#f9f9f9', fontStyle: 'italic', color: '#888' }}>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '0.3rem' }}>📋 System Stock auto-reads from Products & Sizes table (source of truth). Physical count does NOT auto-update system stock — discrepancy record created</td>
                </tr>

              </tbody>



            </table>
          </div>
        </div>

        {/* ─── SECTION: STOCK DISCREPANCIES ─── */}
        <div className="section-title">
          <div className="section-header" onClick={() => toggleSection('discrepancies')}>
            <div className="section-label">🔎 Stock Discrepancies<span className="section-sub">Investigation & resolution</span></div>
            <button className="section-toggle-btn">{openSections.discrepancies ? '▲ Close' : '▼ Open'}</button>
          </div>
        </div>
        <div className={`section-body ${openSections.discrepancies ? '' : 'closed'}`}>
          <div className="table-wrap">
            <table className="timetable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Size</th>
                  <th>System</th>
                  <th>Physical</th>
                  <th>Diff</th>
                  <th>Reason</th>
                  <th>Explanation</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: '#f9f9f9', fontStyle: 'italic', color: '#888' }}>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '0.3rem' }}>📝 Requires explanation + authorized approval before system adjustment</td>
                </tr>
              </tbody>

            </table>
          </div>
        </div>

        {/* ─── SECTION: STOCK MOVEMENT HISTORY ─── */}
        <div className="section-title">
          <div className="section-header" onClick={() => toggleSection('history')}>
            <div className="section-label">📜 Stock Movement History<span className="section-sub">Full audit trail</span></div>
            <button className="section-toggle-btn">{openSections.history ? '▲ Close' : '▼ Open'}</button>
          </div>
        </div>
        <div className={`section-body ${openSections.history ? '' : 'closed'}`}>
          <div className="table-wrap">
            <table className="timetable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Size</th>
                  <th>Transaction Type</th>
                  <th>Quantity</th>
                  <th>User</th>
                  <th>Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr style={{ background: '#f9f9f9', fontStyle: 'italic', color: '#888' }}>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '0.3rem' }}>📊 Complete transaction history — answers "Where did this stock go?"</td>
                  </tr>
                ) : (
                  history.map((h, i) => (
                    <tr key={`hist-${i}`} style={{ background: h.type === 'Stock Exit' ? '#fdf0f0' : '#f0f8f0' }}>
                      <td style={{ fontWeight: 600 }}>{h.date}</td>
                      <td style={{ fontWeight: 600 }}>{h.product}</td>
                      <td>{h.size}</td>
                      <td>
                        <span style={{
                          background: h.type === 'Stock Exit' ? '#ffebee' : '#e8f5e9',
                          color: h.type === 'Stock Exit' ? '#c0392b' : '#1a7a3a',
                          padding: '0.1rem 0.5rem',
                          borderRadius: '12px',
                          fontWeight: 700,
                          fontSize: '0.6rem',
                        }}>
                          {h.type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: h.qty < 0 ? '#c0392b' : '#1a7a3a' }}>
                        {h.qty > 0 ? `+${h.qty}` : h.qty}
                      </td>
                      <td>{h.user}</td>
                      <td style={{ fontWeight: 700 }}>{h.runningBalance}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>


        {/* ─── FOOTER ─── */}


        <div className="footer">
          <span className="note">📌 All cells editable — click to modify</span>
          <span className="friday-note">🔄 Core Principle: Stock quantities never manually changed — only via transactions</span>
          <span>✏️ IHEZA Inventory Control · 2026</span>
        </div>

      </div>
    </div>
  );
}

export default UniformReport;

