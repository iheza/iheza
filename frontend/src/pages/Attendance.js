import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { dataService } from '../services/dataService';
import { studentService } from '../services/studentService';
import { toast } from 'sonner';
import { Printer, FileText, BookOpen } from 'lucide-react';
import ChainToggle from '../components/ChainToggle';

const SCHOOL_PREFIXES = ['DUP', 'DLP', 'LALE', 'OLGUN'];

function Attendance() {
  const currentUser = useSelector(selectCurrentUser);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [attendanceData, setAttendanceData] = useState({}); // { date: { studentId: status } }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Chain filtering for IHEZA users
  const [selectedChain, setSelectedChain] = useState('');
  const userChain = currentUser?.chain;
  const canFilterChains = userChain === 'IHEZA';

  // Get days in selected month
  const getDaysInMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  };

  const daysInMonth = getDaysInMonth();

  // Get day initial (M, T, W, T, F, S, S)
  const getDayInitial = (dayNumber) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1, dayNumber);
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // Sunday=0 to Saturday=6
    return dayNames[date.getDay()];
  };

  useEffect(() => {
    loadClasses();
    if (userChain && userChain !== 'IHEZA') {
      setSelectedChain(userChain);
    }
  }, [userChain]);

  useEffect(() => {
    // Reload classes when chain selection changes
    if (selectedChain || !canFilterChains) {
      loadClasses();
    }
  }, [selectedChain]);

  useEffect(() => {
    if (selectedClass && selectedMonth) {
      loadStudentsAndAttendance();
    }
  }, [selectedClass, selectedMonth, selectedChain]);

  const loadClasses = async () => {
    try {
      // Pass the selected chain to backend for Director/Coordinator filtering
      const data = await dataService.getClasses(selectedChain);
      const filteredClasses = canFilterChains 
        ? data 
        : data.filter(c => c.chain === userChain);
      setClasses(filteredClasses);
      if (filteredClasses.length > 0) {
        setSelectedClass(filteredClasses[0].name);
      }
    } catch (error) {
      console.error('Failed to load classes:', error);
    }
  };

  const getFilteredClasses = () => {
    if (!selectedChain && canFilterChains) return classes;
    return classes.filter(c => c.chain === (selectedChain || userChain));
  };

  const loadStudentsAndAttendance = async () => {
    if (!selectedClass) return;
    
    try {
      setLoading(true);
      console.log('Loading students for class:', selectedClass);
      const studentsData = await studentService.getStudents(selectedClass, selectedChain);
      console.log('Students loaded:', studentsData);
      setStudents(studentsData || []);
      
      // Load attendance for the current month
      const [year, month] = selectedMonth.split('-').map(Number);
      const attendanceMap = {};
      
      // Fetch all attendance for students in this class
      try {
        const attendanceParams = { 
          target_type: 'student'
        };
        // Add chain filter for Director/Coordinator
        if (selectedChain) {
          attendanceParams.chain = selectedChain;
        }
        
        const allAttendance = await dataService.getAttendance(attendanceParams);
        
        console.log('Raw attendance from API:', allAttendance?.length, 'records');
        
        if (allAttendance && Array.isArray(allAttendance)) {
          // Create a set of student IDs for quick lookup
          const studentIds = new Set((studentsData || []).map(s => s.id));
          console.log('Student IDs in class:', studentIds.size);
          console.log('Sample student IDs:', Array.from(studentIds).slice(0, 3));
          console.log('Selected month:', selectedMonth);
          
          // Filter to find records for selected month
          const monthRecords = allAttendance.filter(r => r.date?.startsWith(selectedMonth));
          console.log(`Records for ${selectedMonth}:`, monthRecords.length);
          
          // Show April records specifically
          if (monthRecords.length > 0) {
            console.log('Sample month records:', monthRecords.slice(0, 10).map(r => ({
              date: r.date,
              target_id: r.target_id,
              status: r.status,
              studentMatch: studentIds.has(r.target_id)
            })));
          } else {
            // Show unique months in the data
            const uniqueMonths = [...new Set(allAttendance.map(r => r.date?.substring(0, 7)))].sort();
            console.log('Available months in data:', uniqueMonths);
          }
          
          allAttendance.forEach(record => {
            const recordDate = record.date;
            const studentId = record.target_id;
            
            // Only include records for students in this class and from the selected month
            if (recordDate && recordDate.startsWith(selectedMonth) && studentIds.has(studentId)) {
              if (!attendanceMap[recordDate]) {
                attendanceMap[recordDate] = {};
              }
              attendanceMap[recordDate][studentId] = record.status;
            }
          });
        }
        console.log('Final attendanceMap:', JSON.stringify(attendanceMap));
      } catch (e) {
        console.log('Error loading attendance:', e);
      }
      
      setAttendanceData(attendanceMap);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  // Cycle through attendance states: empty -> / -> \ -> .
  const cycleAttendance = (studentId, day) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const currentStatus = attendanceData[dateStr]?.[studentId] || '';
    let newStatus = '';
    
    // Cycle: empty -> present (/) -> present (\) -> absent (.) -> empty
    if (currentStatus === '' || currentStatus === undefined) {
      newStatus = 'present';
    } else if (currentStatus === 'present') {
      newStatus = 'present_alt'; // Will display as \
    } else if (currentStatus === 'present_alt') {
      newStatus = 'absent';
    } else {
      newStatus = ''; // Clear
    }
    
    setAttendanceData(prev => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        [studentId]: newStatus
      }
    }));
  };

  const getAttendanceSymbol = (studentId, day) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const status = attendanceData[dateStr]?.[studentId];
    
    if (status === 'present' || status === 'late') return '/';
    if (status === 'present_alt') return '\\';
    if (status === 'absent') return '.';
    return '';
  };

  const getAttendanceClass = (studentId, day) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const status = attendanceData[dateStr]?.[studentId];
    
    if (status === 'present' || status === 'present_alt' || status === 'late') return 'present';
    if (status === 'absent') return 'absent';
    return '';
  };

  const saveAllAttendance = async () => {
    try {
      setSaving(true);
      const [year, month] = selectedMonth.split('-').map(Number);
      
      console.log('=== SAVING ATTENDANCE ===');
      console.log('attendanceData:', attendanceData);
      console.log('selectedMonth:', selectedMonth);
      console.log('selectedClass:', selectedClass);
      
      let totalRecordsSaved = 0;
      
      // Save attendance for each day that has data
      for (const [dateStr, dayData] of Object.entries(attendanceData)) {
        // Only save records for the selected month
        if (!dateStr.startsWith(selectedMonth)) {
          continue;
        }
        
        const records = [];
        
        for (const [studentId, status] of Object.entries(dayData)) {
          if (status) {
            // Keep the status as-is (present, present_alt, absent)
            // This preserves the / vs \ distinction
            records.push({
              id: `${studentId}-${dateStr}`,
              target_id: studentId,
              target_type: 'student',
              class_id: selectedClass,
              date: dateStr,
              status: status,
              recorded_by: currentUser?.name || 'system',
              chain: currentUser?.chain || 'DUP'
            });
          }
        }
        
        if (records.length > 0) {
          console.log(`Saving ${records.length} records for ${dateStr}:`, records);
          const response = await dataService.bulkRecordAttendance(records);
          console.log('API Response:', response);
          totalRecordsSaved += records.length;
        }
      }
      
      if (totalRecordsSaved > 0) {
        toast.success(`Attendance saved! (${totalRecordsSaved} records)`);
        console.log(`=== SAVED ${totalRecordsSaved} RECORDS ===`);
      } else {
        toast.info('No attendance changes to save');
        console.log('=== NO RECORDS TO SAVE ===');
      }
    } catch (error) {
      toast.error('Failed to save attendance');
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadDoc = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    
    let html = `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          h1 { text-align: center; color: #000000; }
          h2 { text-align: center; color: #333333; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: center; font-size: 12px; }
          th { background-color: #f0f4fa; font-weight: bold; }
          .roll { width: 50px; }
          .name { text-align: left; min-width: 150px; }
          .present { color: green; font-weight: bold; }
          .absent { color: red; font-weight: bold; }
          .legend { margin-top: 20px; font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>ATTENDANCE BOOK</h1>
        <h2>${selectedClass} - ${monthName} ${year}</h2>
        <p><strong>Teacher:</strong> ${currentUser?.name || 'N/A'}</p>
        <table>
          <thead>
            <tr>
              <th class="roll" rowspan="2">ROLL</th>
              <th class="name" rowspan="2">NAME OF PUPIL</th>
              ${Array.from({length: daysInMonth}, (_, i) => {
                const dayNum = i + 1;
                const dayInitial = (() => {
                  const date = new Date(year, parseInt(month) - 1, dayNum);
                  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
                  return dayNames[date.getDay()];
                })();
                return `<th style="text-align:center;"><div>${dayInitial}</div></th>`;
              }).join('')}
            </tr>
            <tr>
              ${Array.from({length: daysInMonth}, (_, i) => `<th style="text-align:center;">${i + 1}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;
    
    students.forEach((student, index) => {
      html += `<tr>
        <td class="roll">${index + 1}</td>
        <td class="name">${student.first_name} ${student.last_name || ''}</td>
      `;
      
      for (let day = 1; day <= daysInMonth; day++) {
        const symbol = getAttendanceSymbol(student.id, day);
        const className = getAttendanceClass(student.id, day);
        html += `<td class="${className}">${symbol}</td>`;
      }
      
      html += `</tr>`;
    });
    
    html += `
          </tbody>
        </table>
        <div class="legend">
          <p><strong>Legend:</strong> / or \\ = PRESENT &nbsp;&nbsp; . = ABSENT</p>
        </div>
      </body>
      </html>
    `;
    
    // Create blob and download
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_${selectedClass}_${monthName}_${year}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Document downloaded!');
  };

  const getMonthYearDisplay = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    return `${monthName} ${year}`;
  };

  return (
    <div className="attendance-book-page">
      <ChainToggle selectedChain={selectedChain} onChainChange={(chain) => {
        setSelectedChain(chain);
        setSelectedClass('');
        loadClasses(chain);
      }} />
      <style>{`
        .attendance-book-page {
          padding: 1.5rem;
          background: #e6e9f0;
          min-height: 100vh;
        }
        
        .attendance-book {
          max-width: 100%;
          width: 100%;
          background: white;
          border-radius: 28px;
          box-shadow: 0 20px 40px -12px rgba(0, 10, 30, 0.35);
          padding: 1.8rem;
          border: 1px solid rgba(255, 255, 255, 0.5);
        }
        
        .header-panel {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.8rem;
          background: #f0f4fa;
          padding: 1rem 1.5rem;
          border-radius: 60px;
          border: 1px solid #cdd9ed;
        }
        
        .filter-block {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        
        .filter-block label {
          font-weight: 600;
          font-size: 0.9rem;
          color: #000000;
          letter-spacing: 0.02em;
          background: #ffffffc7;
          padding: 0.25rem 0.75rem;
          border-radius: 40px;
          border: 1px solid #b7c6e0;
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }
        
        .filter-block select,
        .filter-block input {
          border: none;
          background: white;
          padding: 0.6rem 1rem;
          border-radius: 40px;
          font-size: 0.95rem;
          font-weight: 500;
          color: #000000;
          border: 1px solid transparent;
          box-shadow: inset 0 2px 5px rgba(0,0,0,0.02);
          transition: 0.15s;
          cursor: pointer;
        }
        
        .filter-block select:focus,
        .filter-block input:focus {
          outline: none;
          border-color: #4f7ec9;
          box-shadow: 0 0 0 4px rgba(79, 126, 201, 0.15);
        }
        
        .legend-tip {
          display: flex;
          gap: 1.2rem;
          background: #ffffffdb;
          padding: 0.5rem 1.5rem;
          border-radius: 40px;
          font-weight: 500;
          font-size: 0.9rem;
          border: 1px dashed #2f4f7e;
          color: #000000;
        }
        
        .legend-tip span {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }
        
        .present-slash {
          background: #d3e2ff;
          padding: 0.2rem 0.6rem;
          border-radius: 30px;
          font-family: 'Courier New', monospace;
          font-weight: 700;
        }
        
        .absent-dot {
          background: #ffe1e1;
          padding: 0.2rem 0.6rem;
          border-radius: 30px;
          font-family: 'Courier New', monospace;
          font-weight: 700;
        }
        
        .action-buttons {
          display: flex;
          gap: 0.5rem;
        }
        
        .action-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: white;
          border: 1.5px solid #b7c9e3;
          padding: 0.5rem 1rem;
          border-radius: 40px;
          font-weight: 500;
          color: #000000;
          cursor: pointer;
          transition: 0.15s;
          font-size: 0.85rem;
        }
        
        .action-btn:hover {
          background: #deeaff;
          border-color: #5d7fb9;
        }
        
        .action-btn.save {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          border-color: transparent;
        }
        
        .action-btn.save:hover {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
        }
        
        .action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .table-wrapper {
          overflow-x: auto;
          border-radius: 24px;
          border: 1px solid #cfddee;
          background: white;
          margin: 1.5rem 0;
          box-shadow: inset 0 2px 3px #00000008, 0 8px 12px -10px #1e3f6e;
        }
        
        .attendance-table {
          border-collapse: collapse;
          min-width: 100%;
          font-size: 0.85rem;
          white-space: nowrap;
        }
        
        .attendance-table th {
          background: #f1f7ff;
          color: #102a44;
          font-weight: 600;
          padding: 0.4rem 0.15rem;
          border-bottom: 1px solid #adc3e2;
          border-right: 1px solid #d2e0f0;
          text-align: center;
          font-size: 0.75rem;
          position: sticky;
          top: 0;
        }
        
        .day-initials-row th {
          background: #0369a1;
          color: white;
          padding: 0.25rem 0.1rem;
          font-size: 0.7rem;
          font-weight: 700;
          border-bottom: none;
        }
        
        .dates-row th {
          background: #e0f2fe;
          color: #0369a1;
          padding: 0.25rem 0.1rem;
          font-size: 0.7rem;
          font-weight: 600;
          border-top: none;
        }
        
        .day-col {
          width: 28px !important;
          min-width: 28px !important;
          max-width: 28px !important;
        }
        
        .roll-header {
          width: 50px !important;
          min-width: 50px !important;
        }
        
        .name-header {
          min-width: 150px !important;
          text-align: left !important;
          padding-left: 0.5rem !important;
        }
        
        .day-initials-row .roll-header,
        .day-initials-row .name-header {
          background: #0369a1;
          color: white;
        }
        
        .dates-row .roll-header,
        .dates-row .name-header {
          background: #e0f2fe;
          color: transparent;
        }
        
        .attendance-table th:first-child {
          width: 50px;
        }
        
        .attendance-table th:nth-child(2) {
          min-width: 180px;
          text-align: left;
          padding-left: 1rem;
        }
        
        .attendance-table td {
          padding: 0.5rem 0.2rem;
          border: 1px solid #dbe5f1;
          text-align: center;
          background-color: white;
          transition: background 0.1s;
        }
        
        .roll-cell {
          font-weight: 600;
          color: #000000;
          background: #fafcff !important;
        }
        
        .pupil-name {
          font-weight: 500;
          text-align: left !important;
          padding-left: 1rem !important;
          background: #fefefe !important;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 180px;
          color: #000000;
        }
        
        .day-cell {
          font-family: 'Courier New', monospace;
          font-size: 1.1rem;
          font-weight: 700;
          min-width: 32px;
          cursor: pointer;
          user-select: none;
          transition: all 0.15s;
        }
        
        .day-cell:hover {
          background: #f0f7ff;
        }
        
        .day-cell.present {
          background: #e1f5e8;
          color: #1b7a34;
        }
        
        .day-cell.absent {
          background: #ffe9e9;
          color: #b13e3e;
        }
        
        .footer-note {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 1rem;
          font-size: 0.9rem;
          color: #000000;
          padding: 0 0.4rem;
        }
        
        .footer-note p {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .month-hint {
          display: inline-block;
          background: #e3ebf8;
          font-size: 0.75rem;
          font-weight: 400;
          padding: 0.15rem 0.6rem;
          border-radius: 30px;
          margin-left: 0.3rem;
          color: #1a4c7a;
        }
        
        .loading-state {
          text-align: center;
          padding: 3rem;
          color: #64748b;
          font-size: 1rem;
        }
        
        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #64748b;
        }
        
        @media print {
          .attendance-book-page {
            padding: 0;
            background: white;
          }
          .header-panel {
            background: none;
            border: none;
          }
          .action-buttons {
            display: none;
          }
          .attendance-book {
            box-shadow: none;
            border: none;
          }
        }
        
        @media (max-width: 768px) {
          .header-panel {
            flex-direction: column;
            align-items: stretch;
            gap: 0.7rem;
            border-radius: 20px;
            padding: 1rem;
          }
          .legend-tip {
            flex-wrap: wrap;
            justify-content: center;
          }
          .action-buttons {
            justify-content: center;
          }
        }
      `}</style>
      
      <div className="attendance-book">
        {/* Header Panel */}
        <div className="header-panel">
          <div className="filter-block">
            <label><BookOpen size={14} /> CLASS</label>
            {canFilterChains && (
              <select
                value={selectedChain}
                onChange={(e) => {
                  setSelectedChain(e.target.value);
                  setSelectedClass('');
                }}
                data-testid="chain-filter"
              >
                <option value="">All Chains</option>
                {SCHOOL_PREFIXES.map(prefix => (
                  <option key={prefix} value={prefix}>{prefix}</option>
                ))}
              </select>
            )}
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              data-testid="class-select"
            >
              <option value="">Select Class</option>
              {getFilteredClasses().map(cls => (
                <option key={cls.id} value={cls.name}>{cls.name}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-block">
            <label>MONTH</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              data-testid="month-select"
            />
          </div>
          
          <div className="legend-tip">
            <span><span className="present-slash">/</span> or <span className="present-slash">\</span> = PRESENT</span>
            <span><span className="absent-dot">.</span> = ABSENT</span>
          </div>
          
          <div className="action-buttons">
            <button className="action-btn" onClick={handlePrint} title="Print">
              <Printer size={16} /> Print
            </button>
            <button className="action-btn" onClick={handleDownloadDoc} title="Download as DOC">
              <FileText size={16} /> Download
            </button>
            <button 
              className="action-btn save" 
              onClick={saveAllAttendance}
              disabled={saving || !selectedClass}
              data-testid="save-attendance-btn"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        
        {/* Attendance Table */}
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-state">Loading attendance book...</div>
          ) : !selectedClass ? (
            <div className="empty-state">Please select a class to view the attendance book</div>
          ) : students.length === 0 ? (
            <div className="empty-state">No students found in this class</div>
          ) : (
            <table className="attendance-table" data-testid="attendance-book-table">
              <thead>
                <tr className="day-initials-row">
                  <th className="roll-header">ROLL</th>
                  <th className="name-header">NAME OF PUPIL</th>
                  {Array.from({length: daysInMonth}, (_, i) => (
                    <th key={`day-${i + 1}`} className="day-col">{getDayInitial(i + 1)}</th>
                  ))}
                </tr>
                <tr className="dates-row">
                  <th className="roll-header"></th>
                  <th className="name-header"></th>
                  {Array.from({length: daysInMonth}, (_, i) => (
                    <th key={i + 1} className="day-col">{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => (
                  <tr key={student.id}>
                    <td className="roll-cell">{index + 1}</td>
                    <td className="pupil-name">
                      {student.first_name || student.name?.split(' ')[0] || 'Unknown'} {student.last_name || ''}
                    </td>
                    {Array.from({length: daysInMonth}, (_, i) => {
                      const day = i + 1;
                      const symbol = getAttendanceSymbol(student.id, day);
                      const statusClass = getAttendanceClass(student.id, day);
                      return (
                        <td 
                          key={day}
                          className={`day-cell ${statusClass}`}
                          onClick={() => cycleAttendance(student.id, day)}
                          data-testid={`cell-${student.id}-${day}`}
                        >
                          {symbol}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Footer */}
        <div className="footer-note">
          <p>
            Days 1–{daysInMonth} 
            <span className="month-hint">{getMonthYearDisplay()}</span>
            <span style={{ marginLeft: '1rem', color: '#94a3b8' }}>
              (tap cell to cycle: / → \ → . → empty)
            </span>
          </p>
          {students.length > 0 && (
            <p style={{ color: '#64748b' }}>
              {students.length} students
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Attendance;
