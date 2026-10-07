import React, { useState, useEffect } from 'react';
import { API_URL } from '../config/api';
import { apiClient } from '../services/authService';
import './Forms.css';
import { useToast } from '../components/Common/Toast';
import { staffService } from '../services/staffService';

const AssessmentForm = () => {
  const [students, setStudents] = useState([
    {
      id: 1,
      name: "",
      classwork: Array(10).fill(""),
      homework: Array(5).fill(""),
      topicTests: Array(3).fill(""),
      term40: "",
      term60: "",
      total: 0,
      grade: "",
      position: 0,
      teacherRemarks: ""
    }
  ]);

  const [subject, setSubject] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [customSubject, setCustomSubject] = useState("");
  const [showCustomSubject, setShowCustomSubject] = useState(false);
  const [teacherRemarks, setTeacherRemarks] = useState("");
  const [teacherSignature, setTeacherSignature] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saving, setSaving] = useState(false);

  
  // Class selection state
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Generate a storage key based on class + teacher + subject.
  // Falls back to class/subject so auto-save works even before a teacher is picked.
  const getStorageKey = () => {
    const classKey = selectedClass ? selectedClass.replace(/\s+/g, '_') : 'noclass';
    const teacherKey = teacherName ? teacherName.replace(/\s+/g, '_') : 'default';
    const subjectKey = subject ? subject.replace(/\s+/g, '_') : 'default';
    return `assessmentData_${classKey}_${teacherKey}_${subjectKey}`;
  };

  // Load saved data from localStorage when class/teacher/subject changes
  useEffect(() => {
    if (!dataLoaded && subject) {
      try {
        const storageKey = getStorageKey();
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.students && parsed.students.length > 0) {
            setStudents(parsed.students);
          }
          if (parsed.teacherRemarks !== undefined) setTeacherRemarks(parsed.teacherRemarks);
          if (parsed.teacherSignature !== undefined) setTeacherSignature(parsed.teacherSignature);
          if (parsed.savedAt) setLastSaved(parsed.savedAt);
        }
      } catch (error) {
        console.error('Error loading saved assessment data:', error);
      }
      setDataLoaded(true);
    }
  }, [teacherName, subject, selectedClass, dataLoaded]);

  // Auto-save to localStorage whenever data changes (with debounce).
  // Works as soon as a subject is chosen, even without a teacher selected.
  useEffect(() => {
    if (subject && dataLoaded) {
      setSaving(true);
      const timer = setTimeout(() => {
        try {
          const storageKey = getStorageKey();
          const saveData = {
            students,
            subject,
            selectedClass,
            teacherRemarks,
            teacherSignature,
            teacherName,
            teacherId,
            savedAt: new Date().toISOString()
          };
          localStorage.setItem(storageKey, JSON.stringify(saveData));
          setLastSaved(new Date().toISOString());
        } catch (error) {
          console.error('Error auto-saving assessment data:', error);
        } finally {
          setSaving(false);
        }
      }, 500); // 500ms debounce to avoid excessive writes
      return () => clearTimeout(timer);
    }
  }, [students, subject, selectedClass, teacherRemarks, teacherSignature, teacherName, teacherId, dataLoaded]);


  // Reset dataLoaded when teacher changes so we load the new teacher's data
  const handleTeacherChange = (selectedId) => {
    setTeacherId(selectedId);
    const selectedTeacher = teachers.find(t => t.id === selectedId);
    if (selectedTeacher) {
      const name = selectedTeacher.name || `${selectedTeacher.first_name} ${selectedTeacher.last_name}`;
      // If teacher changed, reset dataLoaded to trigger loading their saved data
      if (name !== teacherName) {
        setDataLoaded(false);
        setTeacherName(name);
        setTeacherSignature(name);
      } else {
        setTeacherName(name);
        setTeacherSignature(name);
      }
    } else {
      setTeacherName("");
      setTeacherSignature("");
    }
  };

  // Clear saved data for current teacher+subject
  const clearSavedData = () => {
    if (window.confirm('Clear all saved assessment data for this teacher and subject?')) {
      try {
        const storageKey = getStorageKey();
        localStorage.removeItem(storageKey);
        setStudents([{
          id: 1,
          name: "",
          classwork: Array(10).fill(""),
          homework: Array(5).fill(""),
          topicTests: Array(3).fill(""),
          term40: "",
          term60: "",
          total: 0,
          grade: "",
          position: 0,
          teacherRemarks: ""
        }]);
        setTeacherRemarks("");
        setTeacherSignature("");
        setLastSaved(null);
        if (addToast) addToast('Saved data cleared.', 'info');
      } catch (error) {
        console.error('Error clearing saved data:', error);
      }
    }
  };

  const gradingScale = [
    { min: 81, max: 100, grade: 'A' },
    { min: 61, max: 80, grade: 'B' },
    { min: 41, max: 60, grade: 'C' },
    { min: 21, max: 40, grade: 'D' },
    { min: 0, max: 20, grade: 'F' }
  ];

  const calculateAverage = (marks, maxPerItem) => {
    const validMarks = marks.filter(mark => mark !== "" && !isNaN(mark));
    if (validMarks.length === 0) return 0;
    const sum = validMarks.reduce((total, mark) => total + parseFloat(mark || 0), 0);
    const average = sum / validMarks.length;
    if (maxPerItem === 20) {
      return average.toFixed(1);
    }
    return average.toFixed(1);
  };

  const calculateAverageFromTermMarks = (term40, term60, total) => {
    const term40Num = parseFloat(term40) || 0;
    const term60Num = parseFloat(term60) || 0;
    const totalNum = parseFloat(total) || 0;
    
    if (totalNum > 0) {
      return totalNum.toFixed(1);
    }
    
    const sum = term40Num + term60Num;
    const average = sum / 3;
    return average.toFixed(1);
  };

  const getGrade = (total) => {
    for (const scale of gradingScale) {
      if (total >= scale.min && total <= scale.max) {
        return scale.grade;
      }
    }
    return 'F';
  };

  const updateStudentCalculations = (studentId) => {
    setStudents(prevStudents => {
      return prevStudents.map(student => {
        if (student.id === studentId) {
          const classworkAvg = calculateAverage(student.classwork, 10);
          const homeworkAvg = calculateAverage(student.homework, 10);
          const topicTestAvg = calculateAverage(student.topicTests, 20);
          
          const term40Num = parseFloat(student.term40) || 0;
          const term60Num = parseFloat(student.term60) || 0;
          const total = term40Num + term60Num;
          
          // Grade is based on the total (term40 + term60) which is out of 100
          const grade = getGrade(total);
          
          return {
            ...student,
            classworkAvg,
            homeworkAvg,
            topicTestAvg,
            total,
            grade
          };
        }
        return student;
      });
    });
  };

  // Parse a marks value allowing decimals (e.g. 9.5 for half marks).
  // Returns "" for empty input, otherwise a number (or the raw string if not yet valid).
  const parseMarkValue = (value) => {
    if (value === "" || value === null || value === undefined) return "";
    // Allow partial input like "9." or "9.5" while typing
    if (value === "." || value.endsWith(".")) return value;
    const num = parseFloat(value);
    return isNaN(num) ? "" : num;
  };

  const handleMarksChange = (studentId, type, index, value) => {
    setStudents(prevStudents => {
      return prevStudents.map(student => {
        if (student.id === studentId) {
          const updatedStudent = { ...student };
          
          if (type === 'classwork') {
            const updatedClasswork = [...student.classwork];
            updatedClasswork[index] = parseMarkValue(value);
            updatedStudent.classwork = updatedClasswork;
          } else if (type === 'homework') {
            const updatedHomework = [...student.homework];
            updatedHomework[index] = parseMarkValue(value);
            updatedStudent.homework = updatedHomework;
          } else if (type === 'topicTests') {
            const updatedTopicTests = [...student.topicTests];
            updatedTopicTests[index] = parseMarkValue(value);
            updatedStudent.topicTests = updatedTopicTests;
          } else if (type === 'term40') {
            updatedStudent.term40 = parseMarkValue(value);
          } else if (type === 'term60') {
            updatedStudent.term60 = parseMarkValue(value);
          }

          
          // Recalculate total and grade whenever term40 or term60 changes
          if (type === 'term40' || type === 'term60') {
            const term40Num = parseFloat(updatedStudent.term40) || 0;
            const term60Num = parseFloat(updatedStudent.term60) || 0;
            const total = term40Num + term60Num;
            updatedStudent.total = total;
            updatedStudent.grade = getGrade(total);
          }
          
          return updatedStudent;
        }
        return student;
      });
    });
  };

  const addStudentRow = () => {
    const newStudent = {
      id: students.length + 1,
      name: "",
      classwork: Array(10).fill(""),
      homework: Array(5).fill(""),
      topicTests: Array(3).fill(""),
      term40: "",
      term60: "",
      total: 0,
      grade: "",
      position: students.length + 1,
      teacherRemarks: ""
    };
    
    setStudents(prev => [...prev, newStudent]);
  };
  
  // Auto-recalculate positions whenever student totals change
  useEffect(() => {
    const hasData = students.some(s => s.total > 0 || s.name);
    if (hasData) {
      const sorted = [...students].sort((a, b) => b.total - a.total);
      setStudents(prev => prev.map(student => ({
        ...student,
        position: sorted.findIndex(s => s.id === student.id) + 1
      })));
    }
  }, [students.map(s => s.total).join(',')]);

  const clearAllData = () => {
    if (window.confirm('Are you sure you want to clear all student data?')) {
      setStudents(prevStudents => {
        return prevStudents.map(student => ({
          ...student,
          name: "",
          classwork: Array(10).fill(""),
          homework: Array(5).fill(""),
          topicTests: Array(3).fill(""),
          term40: "",
          term60: "",
          total: 0,
          grade: "",
          teacherRemarks: ""
        }));
      });
      setTeacherRemarks("");
    }
  };

  const { addToast } = useToast();

  const calculateAll = () => {
    // Calculate totals and grades for all students synchronously
    const updatedStudents = students.map(student => {
      const term40Num = parseFloat(student.term40) || 0;
      const term60Num = parseFloat(student.term60) || 0;
      const total = term40Num + term60Num;
      const grade = getGrade(total);
      return { ...student, total, grade };
    });
    
    // Sort by total (highest first) and assign positions
    const sorted = [...updatedStudents].sort((a, b) => b.total - a.total);
    const withPositions = updatedStudents.map(student => ({
      ...student,
      position: sorted.findIndex(s => s.id === student.id) + 1
    }));
    
    setStudents(withPositions);
  };

  // Load classes and subjects on mount
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const response = await apiClient.get('/classes');
        setClasses(response.data || []);
      } catch (error) {
        console.error('Failed to load classes:', error);
      }
    };
    const loadSubjects = async () => {
      try {
        const response = await apiClient.get('/subjects');
        const subjectList = response.data || [];
        setSubjects(subjectList);
        // Auto-select first subject if none selected
        if (!subject && subjectList.length > 0) {
          setSubject(subjectList[0].name);
        }
      } catch (error) {
        console.error('Failed to load subjects:', error);
      }
    };
    loadClasses();
    loadSubjects();
  }, []);

  // Load students from selected class
  const loadStudentsFromClass = async () => {
    if (!selectedClass) {
      if (addToast) addToast('Please select a class first.', 'warning');
      return;
    }
    
    setLoadingStudents(true);
    try {
      const response = await apiClient.get('/students', {
        params: { class_name: selectedClass }
      });
      
      const studentData = response.data;
      
      if (!studentData || studentData.length === 0) {
        if (addToast) addToast(`No students found in class "${selectedClass}".`, 'warning');
        setLoadingStudents(false);
        return;
      }
      
      // Map students to assessment format
      const mappedStudents = studentData.map((s, index) => ({
        id: index + 1,
        name: `${s.first_name} ${s.last_name}`,
        classwork: Array(10).fill(""),
        homework: Array(5).fill(""),
        topicTests: Array(3).fill(""),
        term40: "",
        term60: "",
        total: 0,
        grade: "",
        position: index + 1,
        teacherRemarks: ""
      }));
      
      setStudents(mappedStudents);
      if (addToast) addToast(`Loaded ${mappedStudents.length} students from "${selectedClass}".`, 'success');
    } catch (error) {
      console.error('Error loading students:', error);
      if (addToast) addToast('Failed to load students. Check console for details.', 'error');
    } finally {
      setLoadingStudents(false);
    }
  };

  const saveForm = async () => {
    const saveButton = document.querySelector('.btn-primary');
    const originalButtonText = saveButton.textContent;
    saveButton.textContent = 'Generating Word Document...';
    saveButton.disabled = true;

    try {
      const htmlContent = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
  <meta charset="UTF-8">
  <title>Continuous Assessment - ${subject}</title>
  <style>
    body { font-family: "Times New Roman", serif; font-size: 9pt; margin: 0.3in; }
    .header { text-align: center; margin-bottom: 15px; }
    h1 { font-size: 14pt; margin: 0 0 5px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 7pt; }
    th { background: #2c3e50; color: white; padding: 3px; border: 1px solid #000; }
    td { padding: 2px; border: 1px solid #ccc; text-align: center; }
    .summary-value { font-weight: bold; background: #f8f9fa; }
    .remarks-section { margin-top: 15px; padding: 10px; border: 1px solid #ccc; }
  </style>
</head>
<body>
  <div class="header">
    <h1>ASSESSMENT FORM</h1>
    <div>Continuous Assessment - Academic Year 2026</div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th rowspan="2">Student Name</th>
        <th colspan="10">Class Work (10)</th>
        <th rowspan="2">AV</th>
        <th colspan="5">Homework (10)</th>
        <th rowspan="2">AV</th>
        <th colspan="3">Topic Test (20)</th>
        <th rowspan="2">AV</th>
        <th colspan="6">Term</th>
      </tr>
      <tr>
        <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th>
        <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th>
        <th>1</th><th>2</th><th>3</th>
        <th>40</th><th>60</th><th>100</th><th>AVG</th><th>GR</th><th>POS</th>
      </tr>
    </thead>
    <tbody>
      ${students.map(student => `
        <tr>
          <td style="text-align:left">${student.name}</td>
          ${student.classwork.map(m => `<td>${m}</td>`).join('')}
          <td class="summary-value">${calculateAverage(student.classwork, 10)}</td>
          ${student.homework.map(m => `<td>${m}</td>`).join('')}
          <td class="summary-value">${calculateAverage(student.homework, 10)}</td>
          ${student.topicTests.map(m => `<td>${m}</td>`).join('')}
          <td class="summary-value">${calculateAverage(student.topicTests, 20)}</td>
          <td>${student.term40}</td>
          <td>${student.term60}</td>
          <td>${student.total}</td>
          <td class="summary-value">${calculateAverageFromTermMarks(student.term40, student.term60, student.total)}</td>
          <td class="summary-value">${student.grade}</td>
          <td class="summary-value">${student.position}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div class="remarks-section">
    <h3>SUBJECT TEACHER REMARKS</h3>
    <p>${teacherRemarks}</p>
    <div style="margin-top:30px">
      <h3>NAME & SIGNATURE OF THE SUBJECT TEACHER</h3>
      <p>${teacherSignature}</p>
    </div>
  </div>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'application/msword' });
      const fileName = `assessment-${subject}-${new Date().toISOString().split('T')[0]}.doc`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();

      // Save to backend database and localStorage
      const token = localStorage.getItem('sessionToken');
      
      // Convert to base64 using btoa (more reliable than FileReader)
      const base64Data = 'data:application/msword;base64,' + btoa(unescape(encodeURIComponent(htmlContent)));
      
      const docPayload = {
        name: fileName,
        type: 'application/msword',
        size: blob.size,
        data: base64Data,
        source: 'assessment',
        metadata: {
          type: 'assessment',
          subject: subject,
          teacher: teacherName || teacherSignature || 'Unknown'
        }
      };

      // Always save to localStorage first (for Documents component)
      const saved = localStorage.getItem('iheza_documents');
      const existingDocs = saved ? JSON.parse(saved) : [];
      existingDocs.push({
        id: Date.now().toString(),
        name: fileName,
        type: 'application/msword',
        size: blob.size,
        data: base64Data,
        source: 'assessment',
        uploadedAt: new Date().toISOString(),
        metadata: {
          type: 'assessment',
          subject: subject,
          teacher: teacherName || teacherSignature || 'Unknown'
        }
      });
      localStorage.setItem('iheza_documents', JSON.stringify(existingDocs));

      // Then try to save to backend
      try {
        const response = await fetch(`${API_URL}/api/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(docPayload)
        });

        if (response.ok) {
          addToast('Assessment saved successfully! ✓', 'success');
        } else {
          addToast('Assessment saved to Documents page.', 'success');
        }
      } catch (err) {
        console.log('Backend save failed, but document is saved locally:', err.message);
        addToast('Assessment saved to Documents page.', 'success');
      }
      
      saveButton.textContent = originalButtonText;
      saveButton.disabled = false;
    } catch (error) {
      console.error('Error:', error);
      addToast('Error generating document.', 'error');
      saveButton.textContent = originalButtonText;
      saveButton.disabled = false;
    }
  };

  const handleKeyDown = (e, nextElementId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextElementId) {
        const nextInput = document.getElementById(nextElementId);
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
    }
  };

  const getNextInputId = (studentId, section, index) => {
    // Classwork: cw-0 to cw-9, then hw-0 to hw-4, then tt-0 to tt-2, then term40, term60, total
    if (section === 'classwork') {
      if (index < 9) return `cw-${studentId}-${index + 1}`;
      return `hw-${studentId}-0`;
    }
    if (section === 'homework') {
      if (index < 4) return `hw-${studentId}-${index + 1}`;
      return `tt-${studentId}-0`;
    }
    if (section === 'topicTests') {
      if (index < 2) return `tt-${studentId}-${index + 1}`;
      return `term40-${studentId}`;
    }
    if (section === 'term40') return `term60-${studentId}`;
    if (section === 'term60') return `total-${studentId}`;
    if (section === 'total') return null; // Last field in the row
    return null;
  };

  const printAssessment = () => {
    window.print();
  };

  // Load teachers for dropdown on mount
  useEffect(() => {
    const loadTeachers = async () => {
      try {
        const staffData = await staffService.getStaff();
        const teacherList = staffData.filter(s =>
          ['teacher', 'academic', 'section_leader'].includes(s.role?.toLowerCase())
        );
        setTeachers(teacherList || []);
      } catch (error) {
        console.error('Failed to load teachers:', error);
      }
    };
    loadTeachers();
  }, []);

  useEffect(() => {
    calculateAll();
  }, []);

  return (
    <div className="forms-container">
      <div className="forms-header">
        <h1>ASSESSMENT FORM</h1>
        <p className="forms-subtitle">Continuous Assessment - Academic Year 2026</p>
      </div>

      <div className="forms-controls no-print">
        <button className="btn btn-primary" onClick={addStudentRow}>Add Student Row</button>
        <button className="btn btn-secondary" onClick={clearAllData}>Clear All Data</button>
        <button className="btn btn-success" onClick={calculateAll}>Recalculate All</button>
        <button className="btn btn-primary" onClick={saveForm}>Save as Word Document</button>
        <button className="btn btn-secondary" onClick={printAssessment}>Print</button>
        <button className="btn btn-warning" onClick={clearSavedData} style={{ background: '#dc3545', color: 'white', border: 'none' }}>Clear Saved Data</button>
        {saving ? (
          <span style={{ fontSize: '10px', color: '#f59e0b', marginLeft: '10px', alignSelf: 'center', fontWeight: 'bold' }}>
            ● Saving...
          </span>
        ) : lastSaved ? (
          <span style={{ fontSize: '10px', color: '#16a34a', marginLeft: '10px', alignSelf: 'center' }}>
            ✓ Auto-saved: {new Date(lastSaved).toLocaleTimeString()}
          </span>
        ) : null}

      </div>

      {/* Class Selection Section */}
      <div className="class-selector no-print" style={{ 
        background: '#f0f4ff', 
        border: '1px solid #c7d2fe', 
        borderRadius: '8px', 
        padding: '12px 16px', 
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <label style={{ fontWeight: 'bold', fontSize: '12px', color: '#4338ca' }}>
          📋 Select Class:
        </label>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #c7d2fe',
            borderRadius: '6px',
            fontSize: '12px',
            minWidth: '200px',
            background: 'white'
          }}
        >
          <option value="">-- Choose a class --</option>
          {classes.map(c => (
            <option key={c.id || c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          onClick={loadStudentsFromClass}
          disabled={loadingStudents || !selectedClass}
          style={{
            padding: '8px 16px',
            background: loadingStudents ? '#9ca3af' : '#4338ca',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: loadingStudents ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {loadingStudents ? '⏳ Loading...' : '👥 Load Students'}
        </button>
        {students.length > 0 && (
          <span style={{ fontSize: '11px', color: '#6b7280' }}>
            {students.length} student{students.length !== 1 ? 's' : ''} loaded
          </span>
        )}
      </div>

      <div className="assessment-form" style={{ overflowX: 'auto' }}>
        <table className="assessment-table" style={{ fontSize: '8px', minWidth: '1400px' }}>
          <thead>
            <tr>
              <th rowSpan="2" style={{ width: '160px', padding: '4px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <select
                    value={showCustomSubject ? '__custom__' : subject}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setShowCustomSubject(true);
                        setSubject(customSubject || '');
                      } else {
                        setShowCustomSubject(false);
                        setSubject(e.target.value);
                      }
                    }}
                    style={{ width: '100%', background: '#fff', border: '1px solid #ccc', borderRadius: '3px', color: '#333', fontWeight: 'bold', fontSize: '9px', padding: '2px 4px', cursor: 'pointer' }}
                  >
                    <option value="">-- Select Subject --</option>
                    {subjects.map(s => (
                      <option key={s.id || s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                    <option value="__custom__">✏️ Custom Subject...</option>
                  </select>
                  {showCustomSubject && (
                    <input
                      type="text"
                      placeholder="Type custom subject..."
                      value={subject}
                      onChange={(e) => {
                        setSubject(e.target.value);
                        setCustomSubject(e.target.value);
                      }}
                      style={{ width: '100%', background: '#fff', border: '1px solid #aaa', borderRadius: '3px', color: '#333', fontWeight: 'bold', fontSize: '9px', padding: '2px 4px' }}
                    />
                  )}
                </div>
              </th>
              <th colSpan="10">Kazi za darasa (Class Work) = 10</th>
              <th rowSpan="2">AV<br/>10</th>
              <th colSpan="5">Kazi za Nyumbani (Homework) = 10</th>
              <th rowSpan="2">AV<br/>10</th>
              <th colSpan="3">Jaribio La Mada (Topic Test)</th>
              <th rowSpan="2">AV<br/>20</th>
              <th colSpan="6">Jaribio La Muhula (TERM)</th>
            </tr>
            <tr>
              {[1,2,3,4,5,6,7,8,9,10].map(n => <th key={`cw-${n}`}>{n}</th>)}
              {[1,2,3,4,5].map(n => <th key={`hw-${n}`}>{n}</th>)}
              {[1,2,3].map(n => <th key={`tt-${n}`}>{n}</th>)}
              <th>40</th>
              <th>60</th>
              <th>100</th>
              <th>AVG</th>
              <th>GR</th>
              <th>POS</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, studentIndex) => (
              <tr key={student.id}>
                <td style={{ textAlign: 'left', padding: '3px' }}>
                  <input
                    type="text"
                    placeholder="Student Name"
                    value={student.name}
                    onChange={(e) => {
                      const updatedStudents = [...students];
                      updatedStudents[studentIndex].name = e.target.value;
                      setStudents(updatedStudents);
                    }}
                    style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '9px' }}
                  />
                </td>
                
                {student.classwork.map((mark, index) => (
                  <td key={`cw-${index}`}>
                    <input
                      id={`cw-${student.id}-${index}`}
                      type="text"
                      inputMode="numeric"
                      value={mark}
                      onChange={(e) => handleMarksChange(student.id, 'classwork', index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, getNextInputId(student.id, 'classwork', index))}
                      style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center' }}
                    />
                  </td>
                ))}
                
                <td className="summary-value">{calculateAverage(student.classwork, 10)}</td>
                
                {student.homework.map((mark, index) => (
                  <td key={`hw-${index}`}>
                    <input
                      id={`hw-${student.id}-${index}`}
                      type="text"
                      inputMode="numeric"
                      value={mark}
                      onChange={(e) => handleMarksChange(student.id, 'homework', index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, getNextInputId(student.id, 'homework', index))}
                      style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center' }}
                    />
                  </td>
                ))}
                
                <td className="summary-value">{calculateAverage(student.homework, 10)}</td>
                
                {student.topicTests.map((mark, index) => (
                  <td key={`tt-${index}`}>
                    <input
                      id={`tt-${student.id}-${index}`}
                      type="text"
                      inputMode="numeric"
                      value={mark}
                      onChange={(e) => handleMarksChange(student.id, 'topicTests', index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, getNextInputId(student.id, 'topicTests', index))}
                      style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center' }}
                    />
                  </td>
                ))}
                
                <td className="summary-value">{calculateAverage(student.topicTests, 20)}</td>
                
                <td>
                  <input
                    id={`term40-${student.id}`}
                    type="text"
                    inputMode="numeric"
                    value={student.term40}
                    onChange={(e) => handleMarksChange(student.id, 'term40', 0, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, getNextInputId(student.id, 'term40', 0))}
                    style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center' }}
                  />
                </td>
                <td>
                  <input
                    id={`term60-${student.id}`}
                    type="text"
                    inputMode="numeric"
                    value={student.term60}
                    onChange={(e) => handleMarksChange(student.id, 'term60', 0, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, getNextInputId(student.id, 'term60', 0))}
                    style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center' }}
                  />
                </td>
                <td>
                  <input
                    id={`total-${student.id}`}
                    type="text"
                    inputMode="numeric"
                    value={student.total}
                    onChange={(e) => {
                      const value = parseMarkValue(e.target.value);
                      setStudents(prevStudents => prevStudents.map(s => s.id === student.id ? { ...s, total: value, grade: getGrade(parseFloat(value) || 0) } : s));
                    }}

                    onKeyDown={(e) => handleKeyDown(e, getNextInputId(student.id, 'total', 0))}
                    style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center' }}
                  />
                </td>
                <td className="summary-value">{calculateAverageFromTermMarks(student.term40, student.term60, student.total)}</td>
                <td className="summary-value">{student.grade}</td>
                <td className="summary-value">{student.position}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="remarks-section">
        <div className="section-title">SUBJECT TEACHER</div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Select Teacher:</label>
          <select
            value={teacherId}
            onChange={(e) => handleTeacherChange(e.target.value)}
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '10px' }}
          >
            <option value="">-- Select Teacher --</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>
                {t.name || `${t.first_name} ${t.last_name}`}
              </option>
            ))}
          </select>
        </div>

        <div className="section-title">SUBJECT TEACHER REMARKS</div>
        <textarea
          style={{ width: '100%', height: '100px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical' }}
          value={teacherRemarks}
          onChange={(e) => setTeacherRemarks(e.target.value)}
          placeholder="Enter teacher remarks here..."
        />
        
        <div className="signature-area" style={{ marginTop: '20px' }}>
          <div className="section-title">NAME & SIGNATURE OF THE SUBJECT TEACHER</div>
          <textarea
            style={{ width: '100%', height: '60px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical', fontFamily: '"Times New Roman", serif', fontSize: '12pt' }}
            value={teacherSignature}
            onChange={(e) => setTeacherSignature(e.target.value)}
            placeholder="Type your name and signature here..."
          />
        </div>
      </div>
    </div>
  );
};

export default AssessmentForm;
