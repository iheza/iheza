import React, { useState, useEffect } from 'react';
import { API_URL } from '../config/api';
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

  const [subject, setSubject] = useState("MATHEMATICS");
  const [teacherRemarks, setTeacherRemarks] = useState("");
  const [teacherSignature, setTeacherSignature] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [teacherName, setTeacherName] = useState("");

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

  const handleMarksChange = (studentId, type, index, value) => {
    setStudents(prevStudents => {
      return prevStudents.map(student => {
        if (student.id === studentId) {
          const updatedStudent = { ...student };
          
          if (type === 'classwork') {
            const updatedClasswork = [...student.classwork];
            updatedClasswork[index] = value === "" ? "" : parseInt(value) || 0;
            updatedStudent.classwork = updatedClasswork;
          } else if (type === 'homework') {
            const updatedHomework = [...student.homework];
            updatedHomework[index] = value === "" ? "" : parseInt(value) || 0;
            updatedStudent.homework = updatedHomework;
          } else if (type === 'topicTests') {
            const updatedTopicTests = [...student.topicTests];
            updatedTopicTests[index] = value === "" ? "" : parseInt(value) || 0;
            updatedStudent.topicTests = updatedTopicTests;
          } else if (type === 'term40') {
            updatedStudent.term40 = value === "" ? "" : parseInt(value) || 0;
          } else if (type === 'term60') {
            updatedStudent.term60 = value === "" ? "" : parseInt(value) || 0;
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
        source: 'assessment'
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
      </div>

      <div className="assessment-form" style={{ overflowX: 'auto' }}>
        <table className="assessment-table" style={{ fontSize: '8px', minWidth: '1400px' }}>
          <thead>
            <tr>
              <th rowSpan="2" style={{ width: '120px' }}>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', fontWeight: 'bold', textAlign: 'center' }}
                />
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
                      const value = e.target.value === "" ? "" : parseInt(e.target.value) || 0;
                      setStudents(prevStudents => prevStudents.map(s => s.id === student.id ? { ...s, total: value, grade: getGrade(value) } : s));
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
            onChange={(e) => {
              const selectedId = e.target.value;
              setTeacherId(selectedId);
              const selectedTeacher = teachers.find(t => t.id === selectedId);
              if (selectedTeacher) {
                const name = selectedTeacher.name || `${selectedTeacher.first_name} ${selectedTeacher.last_name}`;
                setTeacherName(name);
                setTeacherSignature(name);
              } else {
                setTeacherName("");
                setTeacherSignature("");
              }
            }}
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
