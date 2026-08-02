import React, { useState, useEffect } from 'react';
import { API_URL } from '../config/api';
import './Forms.css';
import { dataService } from '../services/dataService';
import { staffService } from '../services/staffService';
import { useToast } from '../components/Common/Toast';

const SubjectEvaluation = () => {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingSubjectsForClass, setLoadingSubjectsForClass] = useState(false);

  // Load saved data from localStorage or use defaults
  const loadSavedData = (subjectKey, classKey) => {
    try {
      const storageKey = `subjectEvaluationData_${(classKey || 'default').replace(/\s+/g, '_')}_${(subjectKey || 'default').replace(/\s+/g, '_')}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
    return null;
  };

  const [subject, setSubject] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [academicYear, setAcademicYear] = useState("2026");
  const [teacherName, setTeacherName] = useState("");
  const [strengths, setStrengths] = useState("");
  const [challenges, setChallenges] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [topics, setTopics] = useState([]);

  const months = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
  ];

  // Load classes and teachers from backend on mount
  useEffect(() => {
    const loadClasses = async () => {
      try {
        setLoadingClasses(true);
        const classesData = await dataService.getClasses();
        setClasses(classesData || []);
      } catch (error) {
        console.error('Failed to load classes:', error);
      } finally {
        setLoadingClasses(false);
      }
    };
    loadClasses();
    
    // Load teachers for dropdown
    const loadTeachers = async () => {
      try {
        const staffData = await staffService.getStaff();
        // Filter to only teachers and academic staff
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

  // When class changes, load subjects for that class
  useEffect(() => {
    const loadSubjectsForClass = async () => {
      if (!classLevel) {
        setSubjects([]);
        setLoadingSubjects(false);
        return;
      }
      try {
        setLoadingSubjectsForClass(true);
        setLoadingSubjects(true);
        // Find the class ID from the selected class name
        const selectedClass = classes.find(c => c.name === classLevel || c === classLevel);
        const classId = selectedClass?.id || null;
        const subjectsData = await dataService.getSubjects(classId);
        setSubjects(subjectsData || []);
        // Reset subject selection when class changes
        setSubject("");
        setTopics([]);
        setStrengths("");
        setChallenges("");
        setRecommendations("");
        setTeacherName("");
      } catch (error) {
        console.error('Failed to load subjects for class:', error);
        setSubjects([]);
      } finally {
        setLoadingSubjects(false);
        setLoadingSubjectsForClass(false);
      }
    };
    loadSubjectsForClass();
  }, [classLevel, classes]);

  // Load saved data when both subject and class are selected
  useEffect(() => {
    if (subject && classLevel) {
      const savedData = loadSavedData(subject, classLevel);
      if (savedData) {
        setAcademicYear(savedData.academicYear || "2026");
        setTeacherName(savedData.teacherName || "");
        setStrengths(savedData.strengths || "");
        setChallenges(savedData.challenges || "");
        setRecommendations(savedData.recommendations || "");
        setTopics(savedData.topics || []);
      } else {
        // Reset to defaults for new subject+class combination
        setAcademicYear("2026");
        setTeacherName("");
        setStrengths("");
        setChallenges("");
        setRecommendations("");
        setTopics([]);
      }
    }
  }, [subject, classLevel]);

  // Save data to localStorage whenever it changes (per-subject + per-class)
  useEffect(() => {
    if (subject && classLevel) {
      const saveData = {
        subject,
        classLevel,
        academicYear,
        teacherName,
        strengths,
        challenges,
        recommendations,
        topics
      };
      try {
        const storageKey = `subjectEvaluationData_${classLevel.replace(/\s+/g, '_')}_${subject.replace(/\s+/g, '_')}`;
        localStorage.setItem(storageKey, JSON.stringify(saveData));
      } catch (error) {
        console.error('Error saving data:', error);
      }
    }
  }, [subject, classLevel, academicYear, teacherName, strengths, challenges, recommendations, topics]);

  const addTopic = () => {
    const newTopic = {
      id: topics.length + 1,
      topic: `New Topic ${topics.length + 1}`,
      months: Array(12).fill(false),
      comment: ""
    };
    setTopics([...topics, newTopic]);
  };

  const removeTopic = (id) => {
    if (topics.length > 1) {
      setTopics(topics.filter(topic => topic.id !== id));
    }
  };

  const updateTopic = (id, field, value) => {
    setTopics(topics.map(topic => {
      if (topic.id === id) {
        return { ...topic, [field]: value };
      }
      return topic;
    }));
  };

  const toggleMonth = (topicId, monthIndex) => {
    setTopics(topics.map(topic => {
      if (topic.id === topicId) {
        const updatedMonths = [...topic.months];
        updatedMonths[monthIndex] = !updatedMonths[monthIndex];
        return { ...topic, months: updatedMonths };
      }
      return topic;
    }));
  };

  const { addToast } = useToast();

  const clearAllMonths = () => {
    if (window.confirm('Are you sure you want to clear all month selections?')) {
      setTopics(topics.map(topic => ({
        ...topic,
        months: Array(12).fill(false)
      })));
    }
  };

  const saveForm = async () => {
    // Show loading message
    const saveButton = document.querySelector('.btn-success');
    const originalButtonText = saveButton.textContent;
    saveButton.textContent = 'Generating Document...';
    saveButton.disabled = true;

    try {
      // Generate Word document content
      const generateWordDocument = () => {
        // Create HTML content for Word document
        const htmlContent = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <meta name="ProgId" content="Word.Document">
  <meta name="Generator" content="Microsoft Word">
  <meta name="Originator" content="Microsoft Word">
  <title>Subject Evaluation - ${subject} - ${classLevel}</title>
  <style>
    @page {
      size: 8.5in 11in;
      margin: 0.5in;
    }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 10pt;
      line-height: 1.2;
      color: #000000;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    .document-header {
      text-align: center;
      border-bottom: 2px solid #000000;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .document-header h1 {
      font-size: 14pt;
      font-weight: bold;
      color: #000000;
      margin: 0 0 5px 0;
    }
    .document-subtitle {
      font-size: 10pt;
      color: #333333;
      font-style: italic;
    }
    .section-title {
      font-size: 11pt;
      font-weight: bold;
      color: #000000;
      margin: 15px 0 8px 0;
      padding-bottom: 3px;
      border-bottom: 1px solid #000000;
    }
    .info-label {
      font-weight: bold;
      font-size: 9pt;
      margin-bottom: 2px;
    }
    .input-line {
      border: none;
      border-bottom: 1px solid #000000;
      width: 100%;
      font-size: 9pt;
      padding: 2px 0;
      margin-bottom: 8px;
    }
    .evaluation-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 8pt;
    }
    .evaluation-table th {
      background-color: #2c3e50;
      color: #ffffff;
      font-weight: bold;
      padding: 4px;
      text-align: center;
      border: 1px solid #000000;
    }
    .evaluation-table td {
      padding: 3px;
      border: 1px solid #cccccc;
      vertical-align: top;
    }
    .topic-cell {
      width: 25%;
      text-align: left;
    }
    .month-cell {
      width: 2.5%;
      text-align: center;
    }
    .comment-cell {
      width: 35%;
      text-align: left;
    }
    .action-cell {
      width: 10%;
      text-align: center;
    }
    .checkbox-cell {
      text-align: center;
      font-size: 12pt;
      font-weight: bold;
      color: #000000;
    }
    .tick-mark {
      font-size: 14pt;
      font-weight: bold;
      color: #000000;
    }
    .topic-textarea, .comment-textarea {
      width: 100%;
      min-height: 60px;
      border: 1px solid #cccccc;
      padding: 3px;
      font-size: 8pt;
      font-family: "Times New Roman", Times, serif;
      resize: none;
    }
    .summary-section {
      margin: 15px 0;
      padding: 8px;
      border: 1px solid #cccccc;
      background-color: #f9f9f9;
    }
    .summary-value {
      font-weight: bold;
      color: #2c3e50;
    }
    .signature-area {
      display: flex;
      justify-content: space-between;
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #000000;
    }
    .signature-field {
      text-align: center;
      flex: 1;
    }
    .signature-line {
      border-bottom: 1px solid #000000;
      margin: 5px 0;
      height: 15px;
    }
    .large-textarea {
      width: 100%;
      min-height: 50px;
      border: 1px solid #cccccc;
      padding: 4px;
      font-size: 9pt;
      font-family: "Times New Roman", Times, serif;
      resize: none;
    }
  </style>
</head>
<body>
  <div class="document-header">
    <h1>SUBJECT EVALUATION FORM</h1>
    <div class="document-subtitle">Topic Coverage and Assessment - Academic Year ${academicYear}</div>
  </div>

  <div class="section-title">SUBJECT INFORMATION</div>
  <table style="width: 100%; margin-bottom: 15px; font-size: 9pt;">
    <tr>
      <td style="width: 25%;">
        <div class="info-label">Subject:</div>
        <div class="input-line">${subject}</div>
      </td>
      <td style="width: 25%;">
        <div class="info-label">Class Level:</div>
        <div class="input-line">${classLevel}</div>
      </td>
      <td style="width: 25%;">
        <div class="info-label">Academic Year:</div>
        <div class="input-line">${academicYear}</div>
      </td>
      <td style="width: 25%;">
        <div class="info-label">Teacher's Name:</div>
        <div class="input-line">${teacherName}</div>
      </td>
    </tr>
  </table>

  <table class="evaluation-table">
    <thead>
      <tr>
        <th rowspan="2" class="topic-cell">TOPIC</th>
        <th colspan="12">MONTHS COVERED</th>
        <th rowspan="2" class="comment-cell">ACADEMIC COMMENTS</th>
      </tr>
      <tr>
        ${months.map(month => `<th class="month-cell">${month}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${topics.map(topic => `
        <tr>
          <td class="topic-cell">
            <div class="topic-textarea">${topic.topic}</div>
          </td>
          ${topic.months.map(covered => `
            <td class="month-cell checkbox-cell">
              ${covered ? '<span class="tick-mark" style="color: #22c55e; font-size: 14pt; font-weight: bold;">&#10003;</span>' : ''}
            </td>
          `).join('')}
          <td class="comment-cell">
            <div class="comment-textarea">${topic.comment}</div>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="summary-section">
    <div class="section-title">TOPIC COVERAGE SUMMARY</div>
    <table style="width: 100%; font-size: 9pt;">
      <tr>
        <td style="width: 33%; text-align: center;">
          <div class="info-label">Total Topics:</div>
          <div class="summary-value">${topics.length}</div>
        </td>
        <td style="width: 33%; text-align: center;">
          <div class="info-label">Topics Covered:</div>
          <div class="summary-value">${topics.filter(topic => topic.months.some(covered => covered)).length}</div>
        </td>
        <td style="width: 33%; text-align: center;">
          <div class="info-label">Coverage Percentage:</div>
          <div class="summary-value">
            ${topics.length > 0 
              ? `${Math.round((topics.filter(topic => topic.months.some(covered => covered)).length / topics.length) * 100)}%`
              : '0%'
            }
          </div>
        </td>
      </tr>
    </table>
  </div>

  <div class="section-title">OVERALL EVALUATION</div>
  
  <div style="margin-bottom: 10px;">
    <div class="info-label">Strengths:</div>
    <div class="large-textarea">${strengths}</div>
  </div>
  
  <div style="margin-bottom: 10px;">
    <div class="info-label">Challenges:</div>
    <div class="large-textarea">${challenges}</div>
  </div>
  
  <div style="margin-bottom: 10px;">
    <div class="info-label">Recommendations for Improvement:</div>
    <div class="large-textarea">${recommendations}</div>
  </div>

  <div class="signature-area">
    <div class="signature-field">
      <div>Prepared by:</div>
      <div class="signature-line"></div>
      <div style="font-size: 9pt;">${teacherName}</div>
      <div style="font-size: 9pt;">Subject Teacher</div>
    </div>
    <div class="signature-field">
      <div>Reviewed by:</div>
      <div class="signature-line"></div>
      <div style="font-size: 9pt;">Head of Department</div>
    </div>
    <div class="signature-field">
      <div>Approved by:</div>
      <div class="signature-line"></div>
      <div style="font-size: 9pt;">Academic Coordinator</div>
    </div>
  </div>
</body>
</html>`;

        return htmlContent;
      };

      // Generate the Word document
      const wordContent = generateWordDocument();
      
      // Create blob and download
      const blob = new Blob([wordContent], { type: 'application/msword' });
      const fileName = `subject-evaluation-${subject}-${classLevel}-${academicYear}-${new Date().toISOString().split('T')[0]}.doc`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();

      // Save to backend database and localStorage
      const token = localStorage.getItem('sessionToken');
      
      // Convert blob to base64 data URL using a simpler approach
      const base64Data = 'data:application/msword;base64,' + btoa(unescape(encodeURIComponent(wordContent)));
      
      const docPayload = {
        name: fileName,
        type: 'application/msword',
        size: blob.size,
        data: base64Data,
        source: 'subject_evaluation',
        metadata: {
          type: 'subject_evaluation',
          subject: subject,
          class: classLevel,
          teacher: teacherName || 'Unknown'
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
        source: 'subject_evaluation',
        uploadedAt: new Date().toISOString(),
        metadata: {
          type: 'subject_evaluation',
          subject: subject,
          class: classLevel,
          teacher: teacherName || 'Unknown'
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
          addToast('Subject evaluation saved successfully! ✓', 'success');
        } else {
          addToast('Subject evaluation saved to Documents page.', 'success');
        }
      } catch (err) {
        console.log('Backend save failed, but document is saved locally:', err.message);
        addToast('Subject evaluation saved to Documents page.', 'success');
      }
      
      // Restore button state
      saveButton.textContent = originalButtonText;
      saveButton.disabled = false;
      
    } catch (error) {
      console.error('Error generating document:', error);
      addToast('Error generating document. Please try again.', 'error');
      
      // Restore button state
      const saveButton = document.querySelector('.btn-success');
      if (saveButton) {
        saveButton.textContent = originalButtonText;
        saveButton.disabled = false;
      }
    }
  };

  const printEvaluation = () => {
    window.print();
  };

  // Loading spinner component
  const Spinner = ({ size = 16 }) => (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      border: '2px solid #ccc',
      borderTopColor: '#8b5cf6',
      borderRadius: '50%',
      animation: 'spin 0.6s linear infinite',
      marginRight: '6px',
      verticalAlign: 'middle'
    }} />
  );

  return (
    <div className="forms-container subject-evaluation-container">
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .loading-pulse {
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      <div className="forms-header" style={{ fontSize: '10px' }}>
        <h1 style={{ fontSize: '14px', marginBottom: '5px' }}>SUBJECT EVALUATION FORM</h1>
        <p className="forms-subtitle" style={{ fontSize: '10px' }}>Topic Coverage and Assessment - Academic Year {academicYear}</p>
      </div>

      <div className="forms-controls no-print">
        <button className="btn btn-primary" onClick={addTopic} disabled={!subject || !classLevel}>
          Add Topic
        </button>
        <button className="btn btn-secondary" onClick={clearAllMonths} disabled={!subject || !classLevel}>
          Clear All Months
        </button>
        <button className="btn btn-success" onClick={saveForm} disabled={!subject || !classLevel || topics.length === 0}>
          Save as Word Document
        </button>
        <button className="btn btn-primary" onClick={printEvaluation} disabled={!subject || !classLevel}>
          Print
        </button>
      </div>

      <div className="subject-evaluation-form">
        <div className="form-section">
          <div className="section-title">SUBJECT INFORMATION</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px', lineHeight: '1' }}>
            <div style={{ flex: '1 1 200px' }}>
              <div className="info-label" style={{ fontSize: '9px', marginBottom: '2px' }}>Class Level:</div>
              {loadingClasses ? (
                <div style={{ fontSize: '9px', color: '#888', padding: '4px 0' }}>
                  <Spinner size={12} /> Loading classes...
                </div>
              ) : classes.length > 0 ? (
                <select
                  className="input-line"
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value)}
                  style={{ fontSize: '9px', height: '24px', lineHeight: '1', padding: '2px 4px', width: '100%' }}
                >
                  <option value="">-- Select Class --</option>
                  {classes.map((c, idx) => (
                    <option key={c.id || idx} value={c.name || c}>
                      {c.name || c}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="input-line"
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value)}
                  placeholder="Enter class level..."
                  style={{ fontSize: '9px', height: '24px', lineHeight: '1', padding: '2px 4px' }}
                />
              )}
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <div className="info-label" style={{ fontSize: '9px', marginBottom: '2px' }}>Subject:</div>
              {!classLevel ? (
                <div style={{ fontSize: '9px', color: '#888', padding: '4px 0' }}>
                  <Spinner size={12} /> Select a class first
                </div>
              ) : loadingSubjects ? (
                <div style={{ fontSize: '9px', color: '#888', padding: '4px 0' }}>
                  <Spinner size={12} /> Loading subjects...
                </div>
              ) : subjects.length > 0 ? (
                <select
                  className="input-line"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{ fontSize: '9px', height: '24px', lineHeight: '1', padding: '2px 4px', width: '100%' }}
                >
                  <option value="">-- Select Subject --</option>
                  {subjects.map((s, idx) => (
                    <option key={s.id || idx} value={s.name || s.subject_name || s}>
                      {s.name || s.subject_name || s}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="input-line"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter subject name..."
                  style={{ fontSize: '9px', height: '24px', lineHeight: '1', padding: '2px 4px' }}
                />
              )}
              {subjects.length > 0 && classLevel && (
                <div style={{ fontSize: '8px', color: '#888', marginTop: '2px' }}>
                  {subjects.length} subject{subjects.length !== 1 ? 's' : ''} for {classLevel}
                </div>
              )}
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <div className="info-label" style={{ fontSize: '9px', marginBottom: '2px' }}>Academic Year:</div>
              <input
                type="text"
                className="input-line"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                style={{ fontSize: '9px', height: '24px', lineHeight: '1', padding: '2px 4px' }}
              />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <div className="info-label" style={{ fontSize: '9px', marginBottom: '2px' }}>Teacher's Name:</div>
              <select
                className="input-line"
                value={teacherId}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  setTeacherId(selectedId);
                  const selectedTeacher = teachers.find(t => t.id === selectedId);
                  if (selectedTeacher) {
                    setTeacherName(selectedTeacher.name || `${selectedTeacher.first_name} ${selectedTeacher.last_name}`);
                  } else {
                    setTeacherName("");
                  }
                }}
                style={{ fontSize: '9px', height: '24px', lineHeight: '1', padding: '2px 4px', width: '100%' }}
              >
                <option value="">-- Select Teacher --</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name || `${t.first_name} ${t.last_name}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {!classLevel || !subject ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem 2rem',
            color: '#64748b',
            background: 'rgba(51,65,85,0.3)',
            borderRadius: '0.5rem',
            margin: '1rem 0'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
              {loadingClasses || loadingSubjects ? '⏳' : '📋'}
            </div>
            <p style={{ fontSize: '0.875rem' }}>
              {loadingClasses 
                ? 'Loading classes...' 
                : loadingSubjects 
                  ? 'Loading subjects...' 
                  : !classLevel 
                    ? 'Please select a class to begin' 
                    : 'Please select a subject to evaluate'}
            </p>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="evaluation-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                <thead>
                  <tr style={{ fontSize: '8px' }}>
                    <th rowSpan="2" style={{ width: '20%' }}>TOPIC</th>
                    <th colSpan="12" style={{ width: '48%' }}>MONTHS COVERED</th>
                    <th rowSpan="2" style={{ width: '24%' }}>ACADEMIC COMMENTS</th>
                    <th rowSpan="2" style={{ width: '8%' }}>ACTIONS</th>
                  </tr>
                  <tr style={{ fontSize: '7px' }}>
                    {months.map((month, index) => (
                      <th key={index} style={{ width: '4%', padding: '2px', fontSize: '7px' }}>{month}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topics.length === 0 ? (
                    <tr>
                      <td colSpan="15" style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '9px' }}>
                        No topics yet. Click "Add Topic" to start building your evaluation.
                      </td>
                    </tr>
                  ) : (
                    topics.map((topic) => (
                      <tr key={topic.id}>
                        <td className="topic-cell" style={{ padding: '2px' }}>
                          <textarea
                            className="topic-textarea"
                            value={topic.topic}
                            onChange={(e) => updateTopic(topic.id, 'topic', e.target.value)}
                            placeholder="Enter topic description..."
                            style={{ fontSize: '9px', width: '100%', minHeight: '50px', resize: 'vertical', lineHeight: '1.2' }}
                          />
                        </td>
                        {topic.months.map((covered, monthIndex) => (
                          <td key={monthIndex} className="month-cell" style={{ padding: '1px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              className="month-checkbox"
                              checked={covered}
                              onChange={() => toggleMonth(topic.id, monthIndex)}
                              style={{ margin: '0', width: '14px', height: '14px' }}
                            />
                          </td>
                        ))}
                        <td className="comment-cell" style={{ padding: '2px' }}>
                          <textarea
                            className="comment-textarea"
                            value={topic.comment}
                            onChange={(e) => updateTopic(topic.id, 'comment', e.target.value)}
                            placeholder="Enter academic comments..."
                            style={{ fontSize: '9px', width: '100%', minHeight: '50px', resize: 'vertical', lineHeight: '1.2' }}
                          />
                        </td>
                        <td style={{ padding: '2px', textAlign: 'center' }}>
                          <button
                            className="btn btn-danger"
                            onClick={() => removeTopic(topic.id)}
                            disabled={topics.length <= 1}
                            style={{ padding: '3px 6px', fontSize: '8px' }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="summary-section">
              <div className="section-title">TOPIC COVERAGE SUMMARY</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '9px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>Total Topics:</span>
                  <span className="summary-value" style={{ fontWeight: 'bold' }}>{topics.length}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>Topics Covered:</span>
                  <span className="summary-value" style={{ fontWeight: 'bold' }}>
                    {topics.filter(topic => topic.months.some(covered => covered)).length}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>Coverage Percentage:</span>
                  <span className="summary-value" style={{ fontWeight: 'bold' }}>
                    {topics.length > 0 
                      ? `${Math.round((topics.filter(topic => topic.months.some(covered => covered)).length / topics.length) * 100)}%`
                      : '0%'
                    }
                  </span>
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="section-title">OVERALL EVALUATION</div>
              <div style={{ marginBottom: '15px' }}>
                <div className="info-label">Strengths:</div>
                <textarea
                  className="input-line large"
                  placeholder="List the strengths of the subject implementation..."
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  style={{ fontSize: '9px', width: '100%', minHeight: '80px', resize: 'vertical' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <div className="info-label">Challenges:</div>
                <textarea
                  className="input-line large"
                  placeholder="List the challenges faced in teaching this subject..."
                  value={challenges}
                  onChange={(e) => setChallenges(e.target.value)}
                  style={{ fontSize: '9px', width: '100%', minHeight: '80px', resize: 'vertical' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <div className="info-label">Recommendations for Improvement:</div>
                <textarea
                  className="input-line large"
                  placeholder="Suggest improvements for next academic year..."
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  style={{ fontSize: '9px', width: '100%', minHeight: '80px', resize: 'vertical' }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SubjectEvaluation;
