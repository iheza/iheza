import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { apiClient } from '../services/authService';
import { useToast } from '../components/Common/Toast';
import { Save, Printer, Lock, Pencil, RefreshCw } from 'lucide-react';
import ChainToggle from '../components/ChainToggle';


// ─── Default timetable data (Deniz Primary 2026) ───
const DEFAULT_ROWS = [
  // ─── MONDAY ──────────────────────────────────────────────
  { day: 'Monday', cls: 'Grade 4', stream: 'A', s1: 'SCI & TECH 18', s2: 'SOCIAL 18', s3: '', s4: 'MATH’S 08', extra: 'ENG 17' },
  { day: 'Monday', cls: 'Grade 4', stream: 'B', s1: 'ENG 17', s2: 'KISW 09', s3: '', s4: 'MATH’S 15', extra: 'SOCIAL 18' },
  { day: 'Monday', cls: 'Grade 5', stream: 'A&B', s1: 'ENG 03', s2: 'REL 13', s3: '', s4: 'SOCIAL 17', extra: 'MATH’S 15' },
  { day: 'Monday', cls: 'Grade 6', stream: 'A&B', s1: 'CAS 09', s2: 'ARA 16', s3: '', s4: 'REL 16', extra: 'MATH’S 08' },
  { day: 'Monday', cls: 'Grade 7', stream: 'A', s1: 'ARA 16', s2: 'SCI & TECH 15', s3: '', s4: 'KISW 18', extra: 'CAS 09' },
  { day: 'Monday', cls: '', stream: '', s1: '', s2: '', s3: '☕ Recess', s4: '', extra: '', isRecess: true },

  // ─── TUESDAY ─────────────────────────────────────────────
  { day: 'Tuesday', cls: 'Grade 4', stream: 'A', s1: 'KISW 09', s2: 'MATH’S 8', s3: '', s4: 'ARA 16', extra: 'REL 16' },
  { day: 'Tuesday', cls: 'Grade 4', stream: 'B', s1: 'MATH’S 15', s2: 'ARA 13', s3: '', s4: 'CAS 03', extra: 'REL 13' },
  { day: 'Tuesday', cls: 'Grade 5', stream: 'A&B', s1: 'KISW 18', s2: 'ENG 03', s3: '', s4: 'SOCIAL 17', extra: 'CAS 09' },
  { day: 'Tuesday', cls: 'Grade 6', stream: 'A&B', s1: 'ARA 16', s2: 'KISW 18', s3: '', s4: 'MATH’S 08', extra: 'ENG 17' },
  { day: 'Tuesday', cls: 'Grade 7', stream: 'A', s1: 'ARA 16', s2: 'KISW 18', s3: '', s4: 'MATH’S 08', extra: 'ENG 17' },
  { day: 'Tuesday', cls: '', stream: '', s1: '', s2: '', s3: '☕ Recess', s4: '', extra: '', isRecess: true },

  // ─── WEDNESDAY ───────────────────────────────────────────
  { day: 'Wednesday', cls: 'Grade 4', stream: 'A', s1: 'MATH’S 08', s2: 'SOCIAL 17', s3: '', s4: 'REL 13', extra: 'ENG 03' },
  { day: 'Wednesday', cls: 'Grade 4', stream: 'B', s1: 'SCI & TECH 18', s2: 'ENG 17', s3: '', s4: 'REL 16', extra: 'KISW 09' },
  { day: 'Wednesday', cls: 'Grade 5', stream: 'A&B', s1: 'REL 13', s2: 'SCI & TECH 18', s3: '', s4: 'ARA 13', extra: 'MATH’S 15' },
  { day: 'Wednesday', cls: 'Grade 6', stream: 'A&B', s1: 'MATH’S 15', s2: 'SCI & TECH 03', s3: '', s4: 'CAS 09', extra: 'ARA 13' },
  { day: 'Wednesday', cls: 'Grade 7', stream: 'A', s1: 'ENG 03', s2: 'ARA 16', s3: '', s4: 'SCI & TECH 15', extra: 'SOCIAL 17' },
  { day: 'Wednesday', cls: '', stream: '', s1: '', s2: '', s3: '☕ Recess', s4: '', extra: '', isRecess: true },

  // ─── THURSDAY ────────────────────────────────────────────
  { day: 'Thursday', cls: 'Grade 4', stream: 'A&B', s1: 'ENG 03', s2: 'ARA 16', s3: '', s4: 'SCI & TECH 15', extra: 'SOCIAL 17' },
  { day: 'Thursday', cls: 'Grade 5', stream: 'A&B', s1: 'ENG 07', s2: 'ARA 16', s3: '', s4: 'SOCIAL 17', extra: 'MATH’S 08' },
  { day: 'Thursday', cls: 'Grade 6', stream: 'A&B', s1: 'SCI & TECH 15', s2: 'ENG 17', s3: '', s4: 'REL 16', extra: 'SOCIAL 17' },
  { day: 'Thursday', cls: 'Grade 7', stream: 'A', s1: 'KISW 18', s2: 'MATH’S 08', s3: '', s4: 'SCI & TECH 15', extra: 'CAS 09' },
  { day: 'Thursday', cls: '', stream: '', s1: '', s2: '', s3: '☕ Recess', s4: '', extra: '', isRecess: true },

  // ─── FRIDAY ──────────────────────────────────────────────
  { day: 'Friday', cls: 'Grade 4', stream: 'A', s1: 'Turkish language Sh. Khatour', s2: 'Reading 18', s3: 'ORIGAMI PROGRAM 09, 15 & 18', s4: 'Madrasa', extra: '' },
  { day: 'Friday', cls: 'Grade 4', stream: 'B', s1: '', s2: 'Reading 07', s3: 'ORIGAMI PROGRAM 09, 15 & 18', s4: 'Madrasa', extra: '' },
  { day: 'Friday', cls: 'Grade 5', stream: 'A&B', s1: 'Turkish language Sh. Khatour', s2: 'Reading 17', s3: 'ORIGAMI PROGRAM 09, 15 & 18', s4: 'Madrasa', extra: '' },
  { day: 'Friday', cls: 'Grade 6', stream: 'A&B', s1: 'Henna program (girls) 09', s2: 'Reading 15', s3: 'KISW 18', s4: 'FINE ART PROGRAM 17 / COMPUTER PROGRAM', extra: '' },
  { day: 'Friday', cls: 'Grade 7', stream: 'A', s1: 'Henna program (girls) 09', s2: 'Reading 16', s3: 'REL 13', s4: '', extra: '' },
  { day: 'Friday', cls: '', stream: '', s1: '', s2: '', s3: '☕ Recess', s4: '', extra: '', isRecess: true },
];


// Roles that can edit the timetable
const EDIT_ROLES = ['academic', 'principal'];


function Timetable() {

  const currentUser = useSelector(selectCurrentUser);
  const { addToast } = useToast();
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedChain, setSelectedChain] = useState('');

  const userRole = currentUser?.role?.toLowerCase();
  const canEdit = EDIT_ROLES.includes(userRole);

  // Load timetable from backend (optionally filtered by chain for Director/Coordinator)
  const loadTimetable = useCallback(async (chain = '') => {
    try {
      setLoading(true);
      const params = chain ? `?chain=${encodeURIComponent(chain)}` : '';
      const response = await apiClient.get(`/timetable${params}`);
      if (response.data && response.data.rows && response.data.rows.length > 0) {
        setRows(response.data.rows);
      } else {
        setRows(DEFAULT_ROWS);
      }
    } catch (error) {
      console.log('No saved timetable found, using default:', error.message);
      setRows(DEFAULT_ROWS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTimetable(selectedChain);
  }, [loadTimetable, selectedChain]);


  // Count rows per day for rowspan
  const dayCount = {};
  rows.forEach(r => {
    const key = r.day;
    dayCount[key] = (dayCount[key] || 0) + 1;
  });

  // Update a cell value
  const updateCell = (rowIndex, field, value) => {
    if (!canEdit) return;
    const updated = [...rows];
    updated[rowIndex] = { ...updated[rowIndex], [field]: value };
    setRows(updated);
  };

  // Save timetable to backend
  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await apiClient.post('/timetable', { rows, chain: selectedChain || undefined });
      addToast('Timetable saved successfully! ✓', 'success');
    } catch (error) {
      console.error('Failed to save timetable:', error);
      addToast('Failed to save timetable. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };


  // Reset to default
  const handleReset = async () => {
    if (!canEdit) return;
    if (window.confirm('Reset timetable to default data? This will overwrite current changes.')) {
      setRows(DEFAULT_ROWS);
      addToast('Timetable reset to default. Click Save to persist.', 'info');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // ─── Headers ───
  const monThuHeaders = [
    { label: '7:40 – 8:50', cls: 'header-main' },
    { label: '8:50 – 10:00', cls: 'header-main' },
    { label: '10:00 – 10:30', cls: 'header-recess', sub: '☕ Recess' },
    { label: '10:30 – 11:40', cls: 'header-main' },
    { label: '11:40 – 12:50', cls: 'header-main' },
    { label: 'Extra‑Curricular', cls: 'header-extra' },
    { label: '12:55 – 3:45', cls: 'header-afternoon', sub: 'Prayer · Lunch · Break · Madrasa' },
  ];

  // Render a cell based on row type
  // field: 's1'|'s2'|'s3'|'s4'|'extra'|'afternoon'
  const renderCell = (row, rowIndex, field) => {
    const isRecess = row.isRecess;
    const isFriday = row.day === 'Friday';
    // Only the first Friday row shows "SHORT DAY" (once)
    const isFirstFriday = isFriday && (rowIndex === 0 || rows[rowIndex - 1].day !== 'Friday');

    // Recess row (Mon-Fri)
    if (isRecess) {
      return (
        <td
          className="recess-cell"
          style={{ background: '#f5f0e8', borderColor: '#d5cdbc', color: '#6d5535', fontWeight: 600, fontSize: '0.7rem' }}
        >
          {field === 's3' ? '☕ Recess' : field === 'afternoon' ? (isFriday ? (isFirstFriday ? 'SHORT DAY' : '') : 'Prayer · Lunch · Break · Madrasa') : ''}
        </td>
      );
    }

    // Afternoon column (all regular rows)
    if (field === 'afternoon') {
      return (
        <td
          className="afternoon-block"
          style={{ background: '#edf3fb', color: '#12406b', fontWeight: 500, fontSize: '0.65rem', minWidth: '110px', lineHeight: '1.4' }}
        >
          {isFriday ? (isFirstFriday ? 'SHORT DAY' : '') : 'Prayer · Lunch · Break · Madrasa'}
        </td>
      );
    }


    // Regular editable cell (s1, s2, s3, s4, extra)
    const value = row[field] || '';
    return (
      <td
        contentEditable={canEdit}
        suppressContentEditableWarning
        onBlur={(e) => updateCell(rowIndex, field, e.target.textContent)}
        className={canEdit ? 'editable-cell' : 'view-cell'}
        style={{
          background: canEdit ? 'white' : '#f8fafc',
          cursor: canEdit ? 'text' : 'default',
        }}
      >
        {value}
      </td>
    );
  };


  return (
    <div className="timetable-page">
      <style>{`
        .timetable-page {
          padding: 1.5rem;
          background: #eef2f7;
          min-height: 100vh;
          font-family: 'Segoe UI', Roboto, system-ui, sans-serif;
        }

        .timetable-sheet {
          background: #ffffff;
          border-radius: 28px;
          box-shadow: 0 20px 60px rgba(0, 20, 40, 0.20);
          padding: 2rem 2rem 1.8rem;
          max-width: 1500px;
          width: 100%;
          margin: 0 auto;
          overflow-x: auto;
        }

        .timetable-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 0.75rem 2rem;
          margin-bottom: 2rem;
          padding-bottom: 0.75rem;
          border-bottom: 2px solid #dce4f0;
        }

        .timetable-header h1 {
          font-weight: 700;
          font-size: 1.9rem;
          color: #0b1e33;
          letter-spacing: -0.5px;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .timetable-header h1 small {
          font-weight: 400;
          font-size: 0.9rem;
          color: #2c4a6a;
          background: #e8effa;
          padding: 0.2rem 1.2rem;
          border-radius: 40px;
          letter-spacing: 0.2px;
        }

        .badge {
          background: #dce4f0;
          padding: 0.3rem 1.4rem;
          border-radius: 40px;
          font-size: 0.8rem;
          font-weight: 500;
          color: #1c2f47;
          white-space: nowrap;
        }

        .table-wrap {
          border-radius: 16px;
          background: #f8faff;
          border: 1px solid #d8e2f0;
          overflow-x: auto;
        }

        .timetable {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.78rem;
          min-width: 1300px;
        }

        .timetable th {
          font-weight: 600;
          color: #0a1f36;
          font-size: 0.7rem;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          padding: 0.6rem 0.3rem;
          border: 1px solid #cbd6e8;
          text-align: center;
          vertical-align: middle;
          position: sticky;
          top: 0;
          z-index: 10;
          white-space: nowrap;
        }

        .timetable .header-main { background: #dce6f4; }
        .timetable .header-extra { background: #e4edf9; }
        .timetable .header-afternoon { background: #dce6f4; font-size: 0.6rem; }
        .timetable .header-afternoon span { display: block; font-weight: 400; font-size: 0.55rem; color: #2a4b70; margin-top: 2px; }
        .timetable .header-recess { background: #f5f0e8; color: #6d5535; font-size: 0.6rem; }
        .timetable .header-recess span { display: block; font-weight: 400; font-size: 0.55rem; color: #8a7a5a; }
        .timetable .header-friday { background: #f0ebe0; color: #4d3f2b; font-size: 0.65rem; }
        .timetable .header-friday-end { background: #f0ebe0; color: #6d5535; font-size: 0.65rem; font-weight: 700; }

        .timetable .day-cell {
          font-weight: 700;
          font-size: 0.85rem;
          letter-spacing: 0.3px;
          color: #0b1f38;
          min-width: 75px;
          border-right: 2px solid #b8c6dc;
          text-align: center;
          vertical-align: middle;
        }
        .timetable .day-cell.monday { background: #d4e2f5; }
        .timetable .day-cell.tuesday { background: #deeaf8; }
        .timetable .day-cell.wednesday { background: #e6effa; }
        .timetable .day-cell.thursday { background: #eef4fc; }
        .timetable .day-cell.friday { background: #f5efe4; color: #4d3f2b; }

        .timetable .class-col {
          background: #f2f7ff;
          font-weight: 500;
          min-width: 68px;
          border: 1px solid #cbd6e8;
          text-align: center;
          vertical-align: middle;
          padding: 0.4rem 0.25rem;
        }

        .timetable .stream-col {
          background: #f2f7ff;
          font-weight: 500;
          min-width: 48px;
          border: 1px solid #cbd6e8;
          text-align: center;
          vertical-align: middle;
          padding: 0.4rem 0.25rem;
        }

        .timetable td {
          border: 1px solid #cbd6e8;
          padding: 0.4rem 0.25rem;
          text-align: center;
          vertical-align: middle;
          height: 42px;
          background: white;
          transition: background 0.1s ease;
        }

        .timetable td.editable-cell {
          cursor: text;
          min-width: 60px;
        }
        .timetable td.editable-cell:hover { background: #f0f6fe; }
        .timetable td.editable-cell:focus {
          outline: 2px solid #3a74b0;
          outline-offset: -2px;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(58, 116, 176, 0.10);
          z-index: 2;
          position: relative;
        }

        .timetable td.view-cell {
          cursor: default;
          min-width: 60px;
        }

        .timetable tr.friday-row td {
          background: #faf8f3;
          border-color: #d5cdbc;
        }
        .timetable tr.friday-row td.class-col,
        .timetable tr.friday-row td.stream-col {
          background: #f5efe4;
        }
        .timetable tr.friday-row td.editable-cell:hover { background: #f0ebe0; }
        .timetable tr.friday-row td.editable-cell:focus {
          outline: 2px solid #8a7a5a;
          box-shadow: 0 0 0 4px rgba(138, 122, 90, 0.12);
        }

        .timetable tr.recess-row td {
          background: #f5f0e8;
          border-color: #d5cdbc;
          font-weight: 600;
          color: #6d5535;
          font-size: 0.7rem;
        }
        .timetable tr.recess-row td.day-cell { background: #f5f0e8; }
        .timetable tr.recess-row td.class-col,
        .timetable tr.recess-row td.stream-col { background: #f5f0e8; }

        .timetable-footer {
          margin-top: 1.8rem;
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem 2rem;
          font-size: 0.75rem;
          color: #2f4b6e;
          border-top: 1px solid #dce4f0;
          padding-top: 1.2rem;
        }
        .timetable-footer .note { background: #eef4fc; padding: 0.2rem 1.4rem; border-radius: 30px; }
        .timetable-footer .friday-note { background: #f5efe4; color: #6d5535; padding: 0.2rem 1.4rem; border-radius: 30px; }
        .timetable-footer .prepared { font-weight: 500; letter-spacing: 0.2px; }

        .timetable-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
        }

        .timetable-action-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1.2rem;
          border-radius: 0.75rem;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          border: 2px solid transparent;
          transition: all 0.2s;
        }

        .timetable-action-btn.save-btn {
          background: #16a34a;
          color: white;
        }
        .timetable-action-btn.save-btn:hover { background: #15803d; }
        .timetable-action-btn.save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .timetable-action-btn.print-btn {
          background: white;
          color: #1e293b;
          border-color: #cbd5e1;
        }
        .timetable-action-btn.print-btn:hover { background: #f1f5f9; }

        .timetable-action-btn.reset-btn {
          background: white;
          color: #dc2626;
          border-color: #fecaca;
        }
        .timetable-action-btn.reset-btn:hover { background: #fef2f2; }

        .permission-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1rem;
          border-radius: 0.75rem;
          font-size: 0.8rem;
          font-weight: 500;
          margin-bottom: 1rem;
        }
        .permission-banner.edit {
          background: #dcfce7;
          color: #166534;
          border: 1px solid #86efac;
        }
        .permission-banner.view {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fcd34d;
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          color: #64748b;
          font-size: 0.9rem;
        }

        @media (max-width: 820px) {
          .timetable-sheet { padding: 1rem 0.8rem; }
          .timetable { font-size: 0.68rem; min-width: 1000px; }
          .timetable-header h1 { font-size: 1.4rem; }
          .timetable th, .timetable td { padding: 0.3rem 0.15rem; height: 38px; }
        }

        @media (max-width: 500px) {
          .timetable { font-size: 0.6rem; min-width: 850px; }
          .timetable-header h1 { font-size: 1.1rem; }
        }

        @media print {
          .timetable-page { padding: 0; background: white; }
          .timetable-actions, .permission-banner { display: none !important; }
          .timetable-sheet { box-shadow: none; border-radius: 0; padding: 0; }
        }
      `}</style>

      <div className="timetable-sheet">
        {/* HEADER */}
        <div className="timetable-header">
          <h1>
            📋 DENIZ PRIMARY SCHOOL
            <small>2026 · complete</small>
          </h1>
          <div className="badge">🕒 Mon–Fri · merged</div>
        </div>

        {/* Chain toggle (Director & Coordinator can filter by chain) */}
        <ChainToggle
          selectedChain={selectedChain}
          onChainChange={(chain) => setSelectedChain(chain)}
        />

        {/* Permission banner */}

        <div className={`permission-banner ${canEdit ? 'edit' : 'view'}`}>
          {canEdit ? (
            <>
              <Pencil size={16} />
              <span>Edit mode enabled — click any subject cell to modify. Only Academic & Principal can edit.</span>
            </>
          ) : (
            <>
              <Lock size={16} />
              <span>View-only mode — only Academic & Principal can edit this timetable.</span>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="timetable-actions no-print">
          {canEdit && (
            <>
              <button
                className="timetable-action-btn save-btn"
                onClick={handleSave}
                disabled={saving}
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Timetable'}
              </button>
              <button className="timetable-action-btn reset-btn" onClick={handleReset}>
                <RefreshCw size={16} />
                Reset to Default
              </button>
            </>
          )}
          <button className="timetable-action-btn print-btn" onClick={handlePrint}>
            <Printer size={16} />
            Print
          </button>
        </div>

        {/* TABLE */}
        {loading ? (
          <div className="loading-state">Loading timetable...</div>
        ) : (
          <div className="table-wrap">
            <table className="timetable">
              <thead>
                <tr>
                  <th className="header-main" rowSpan="2">Day</th>
                  <th className="header-main" rowSpan="2">Class</th>
                  <th className="header-main" rowSpan="2">Stream</th>
                  {monThuHeaders.map((h, i) => (
                    <th key={`mt-${i}`} className={h.cls} colSpan="1">
                      {h.label}
                      {h.sub && <span>{h.sub}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const isFirstOfDay = (idx === 0 || rows[idx - 1].day !== row.day);
                  const isRecess = row.isRecess;

                  return (
                    <tr
                      key={idx}
                      className={`${isRecess ? 'recess-row' : ''}`}
                    >
                      {/* Day cell */}
                      <td
                        className={`day-cell ${row.day.toLowerCase()}`}
                        rowSpan={isFirstOfDay ? dayCount[row.day] : undefined}
                        style={!isFirstOfDay ? { display: 'none' } : {}}
                      >
                        {isFirstOfDay ? row.day : ''}
                      </td>

                      {/* Class */}
                      <td className="class-col">{row.cls || ''}</td>

                      {/* Stream */}
                      <td className="stream-col">{row.stream || ''}</td>

                      {/* Period 1 */}
                      {renderCell(row, idx, 's1')}

                      {/* Period 2 */}
                      {renderCell(row, idx, 's2')}

                      {/* Period 3 */}
                      {renderCell(row, idx, 's3')}

                      {/* Period 4 */}
                      {renderCell(row, idx, 's4')}

                      {/* Period 5 (Extra) */}
                      {renderCell(row, idx, 'extra')}

                      {/* Period 6 (Afternoon) */}
                      {renderCell(row, idx, 'afternoon')}
                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        )}

        {/* FOOTER */}
        <div className="timetable-footer">
          <span className="note">
            {canEdit ? '📌 All subject cells editable — click to modify' : '🔒 View-only — Academic & Principal can edit'}
          </span>
          <span className="prepared">✏️ Academic Master · merged from all sources</span>
        </div>

      </div>
    </div>
  );
}

export default Timetable;
