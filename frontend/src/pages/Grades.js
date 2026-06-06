import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { dataService } from '../services/dataService';
import { studentService } from '../services/studentService';
import { toast } from '../hooks/useSoundEnabledToast';
import { BookOpen, Save, Search, Award, Users } from 'lucide-react';

function Grades() {
  const currentUser = useSelector(selectCurrentUser);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [grades, setGrades] = useState({});
  const [existingGrades, setExistingGrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const terms = ['Term 1', 'Term 2', 'Term 3', 'Final'];
  
  // Filter subjects based on selected class and deduplicate by name
  // Grade 4: Show "Religion and Arabic" combined, hide separate Religion and Arabic
  // Other grades: Show separate Religion and Arabic, hide combined
  const getFilteredSubjects = () => {
    if (!selectedClass) return [];
    
    const isGrade4 = selectedClass.toLowerCase().includes('grade 4') || 
                     selectedClass.toLowerCase().includes('grade4') ||
                     selectedClass.toLowerCase() === '4';
    
    // First filter by Grade 4 rules
    const filtered = subjects.filter(subj => {
      const name = subj.name || '';
      
      if (isGrade4) {
        // For Grade 4: Show "Religion and Arabic", hide separate "Religion" and "Arabic"
        if (name === 'Religion' || name === 'Arabic') return false;
        return true;
      } else {
        // For other grades: Hide "Religion and Arabic" combined, show separate ones
        if (name === 'Religion and Arabic') return false;
        return true;
      }
    });
    
    // Deduplicate by subject name (keep first occurrence)
    const seen = new Set();
    return filtered.filter(subj => {
      const name = subj.name || '';
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  };
  
  const filteredSubjects = getFilteredSubjects();
  
  // Updated grading scale per user specification
  // A: 81-100, B: 61-80, C: 41-60, D: 21-40, F: 0-20
  const gradeScale = [
    { min: 81, max: 100, grade: 'A', description: 'Excellent', color: '#22c55e' },
    { min: 61, max: 80, grade: 'B', description: 'Very Good', color: '#3b82f6' },
    { min: 41, max: 60, grade: 'C', description: 'Good', color: '#8b5cf6' },
    { min: 21, max: 40, grade: 'D', description: 'Satisfactory', color: '#f59e0b' },
    { min: 0, max: 20, grade: 'F', description: 'Fail', color: '#ef4444' },
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadStudents();
      // Clear selected subject when class changes (subject list may differ)
      setSelectedSubject('');
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClass && selectedSubject && selectedTerm) {
      loadExistingGrades();
    }
  }, [selectedClass, selectedSubject, selectedTerm]);

  const loadInitialData = async () => {
    try {
      const [classesData, subjectsData] = await Promise.all([
        dataService.getClasses(),
        dataService.getSubjects()
      ]);
      setClasses(classesData);
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const loadStudents = async () => {
    try {
      const data = await studentService.getStudents(selectedClass);
      setStudents(data);
    } catch (error) {
      console.error('Failed to load students:', error);
    }
  };

  const loadExistingGrades = async () => {
    try {
      setLoading(true);
      const data = await dataService.getGrades({ 
        subject_id: selectedSubject, 
        term: selectedTerm 
      });
      setExistingGrades(data);
      
      // Pre-fill grades form with auto-remarks for grades without remarks
      const gradesMap = {};
      data.forEach(g => {
        if (students.find(s => s.id === g.student_id)) {
          const grade = getGradeFromScore(g.score);
          gradesMap[g.student_id] = {
            score: g.score,
            // Auto-fill remarks if not already set
            remarks: g.remarks || getRemarksForGrade(grade)
          };
        }
      });
      setGrades(gradesMap);
    } catch (error) {
      console.error('Failed to load grades:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGradeFromScore = (score) => {
    if (score >= 81) return 'A';
    if (score >= 61) return 'B';
    if (score >= 41) return 'C';
    if (score >= 21) return 'D';
    return 'F';
  };

  // Auto-fill remarks based on grade
  const getRemarksForGrade = (grade) => {
    const remarksMap = {
      'A': 'Excellent performance! Keep up the outstanding work.',
      'B': 'Very good work. Shows strong understanding of the subject.',
      'C': 'Good effort. Continue working to improve further.',
      'D': 'Satisfactory. More practice and attention needed.',
      'F': 'Needs significant improvement. Extra support recommended.'
    };
    return remarksMap[grade] || '';
  };

  const getGradeColor = (grade) => {
    const gradeInfo = gradeScale.find(g => g.grade === grade);
    return gradeInfo?.color || '#64748b';
  };

  const handleScoreChange = (studentId, score) => {
    const numScore = parseFloat(score) || 0;
    const clampedScore = Math.min(100, Math.max(0, numScore));
    const grade = getGradeFromScore(clampedScore);
    const autoRemarks = getRemarksForGrade(grade);
    
    setGrades(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        score: clampedScore,
        remarks: autoRemarks  // Auto-fill remarks based on grade
      }
    }));
  };

  const handleRemarksChange = (studentId, remarks) => {
    setGrades(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remarks
      }
    }));
  };

  const handleSaveGrades = async () => {
    if (!selectedSubject) {
      toast.error('Please select a subject');
      return;
    }

    try {
      setSaving(true);
      let savedCount = 0;
      
      for (const [studentId, gradeData] of Object.entries(grades)) {
        if (gradeData.score !== undefined && gradeData.score !== '') {
          const existingGrade = existingGrades.find(
            g => g.student_id === studentId && g.subject_id === selectedSubject && g.term === selectedTerm
          );

          const gradeRecord = {
            student_id: studentId,
            subject_id: selectedSubject,
            chain: currentUser?.chain || 'DUP',
            term: selectedTerm,
            score: gradeData.score,
            grade: getGradeFromScore(gradeData.score),
            remarks: gradeData.remarks || '',
            recorded_by: currentUser?.id || 'teacher',
            class_name: selectedClass,
            academic_year: new Date().getFullYear().toString()
          };

          if (existingGrade) {
            await dataService.updateGrade(existingGrade.id, gradeRecord);
          } else {
            await dataService.recordGrade(gradeRecord);
          }
          savedCount++;
        }
      }

      toast.success(`${savedCount} grade(s) saved successfully`);
      loadExistingGrades();
    } catch (error) {
      toast.error('Failed to save grades');
    } finally {
      setSaving(false);
    }
  };

  // Get subject name for display
  const getSubjectName = (subjectId) => {
    const subject = subjects.find(s => s.id === subjectId);
    return subject?.name || 'Unknown Subject';
  };

  // Calculate class statistics
  const getClassStats = () => {
    const enteredGrades = Object.values(grades).filter(g => g.score !== undefined && g.score !== '');
    if (enteredGrades.length === 0) return null;
    
    const scores = enteredGrades.map(g => parseFloat(g.score));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const passing = scores.filter(s => s >= 21).length;
    
    return {
      average: avg.toFixed(1),
      highest: max,
      lowest: min,
      passing,
      total: enteredGrades.length,
      passRate: ((passing / enteredGrades.length) * 100).toFixed(0)
    };
  };

  const stats = getClassStats();

  return (
    <div className="grades-page">
      <style>{`
        .grades-page {
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
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .page-title-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .grading-scale-hint {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          padding: 0.75rem 1rem;
          background: rgba(51, 65, 85, 0.3);
          border-radius: 0.5rem;
          font-size: 0.75rem;
        }
        
        .scale-item {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }
        
        .scale-badge {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.65rem;
          color: white;
        }
        
        .scale-range {
          color: #94a3b8;
        }
        
        .filters-row {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }
        
        .filter-select {
          flex: 1;
          min-width: 180px;
          padding: 0.75rem 1rem;
          background: rgba(51, 65, 85, 0.5);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 0.75rem;
          color: #f8fafc;
        }
        
        .filter-select:focus {
          outline: none;
          border-color: #f59e0b;
        }
        
        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .stat-card {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 0.75rem;
          padding: 1rem;
          text-align: center;
        }
        
        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #f8fafc;
        }
        
        .stat-value.success { color: #22c55e; }
        .stat-value.info { color: #3b82f6; }
        .stat-value.warning { color: #f59e0b; }
        
        .stat-label {
          font-size: 0.75rem;
          color: #64748b;
          margin-top: 0.25rem;
        }
        
        .grades-table-container {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 1rem;
          overflow: hidden;
        }
        
        .table-header {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid rgba(51, 65, 85, 0.5);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .table-title {
          font-weight: 600;
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .grades-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .grades-table th {
          background: rgba(51, 65, 85, 0.5);
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #94a3b8;
        }
        
        .grades-table td {
          padding: 1rem;
          border-bottom: 1px solid rgba(51, 65, 85, 0.5);
          color: #f8fafc;
        }
        
        .grades-table tr:hover td {
          background: rgba(51, 65, 85, 0.3);
        }
        
        .grades-table tr:last-child td {
          border-bottom: none;
        }
        
        .student-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .student-avatar {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: white;
          font-size: 0.875rem;
        }
        
        .score-input {
          width: 80px;
          padding: 0.5rem;
          background: rgba(51, 65, 85, 0.5);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 0.5rem;
          color: #f8fafc;
          text-align: center;
          font-weight: 600;
        }
        
        .score-input:focus {
          outline: none;
          border-color: #f59e0b;
        }
        
        .remarks-input {
          width: 100%;
          padding: 0.5rem;
          background: rgba(51, 65, 85, 0.5);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 0.5rem;
          color: #f8fafc;
          font-size: 0.875rem;
        }
        
        .grade-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.875rem;
          color: white;
        }
        
        .save-bar {
          position: sticky;
          bottom: 1rem;
          background: rgba(30, 41, 59, 0.95);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 0.75rem;
          padding: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 1.5rem;
        }
        
        .save-info {
          color: #94a3b8;
          font-size: 0.875rem;
        }
        
        .btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          border-radius: 0.5rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        
        .btn-success {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          color: white;
        }
        
        .btn-success:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
        }
        
        .btn-success:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        
        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #64748b;
        }
        
        .empty-icon {
          width: 64px;
          height: 64px;
          background: rgba(51, 65, 85, 0.3);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem;
        }
      `}</style>
      
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <BookOpen size={20} color="white" />
          </span>
          Grade Entry
        </h1>
        
        <div className="grading-scale-hint">
          {gradeScale.map(scale => (
            <div key={scale.grade} className="scale-item">
              <span className="scale-badge" style={{ background: scale.color }}>{scale.grade}</span>
              <span className="scale-range">{scale.min}-{scale.max}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="filters-row">
        <select
          className="filter-select"
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          data-testid="class-select"
        >
          <option value="">Select Class</option>
          {classes.map(cls => (
            <option key={cls.id} value={cls.name}>{cls.name}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          data-testid="subject-select"
        >
          <option value="">Select Subject</option>
          {filteredSubjects.map(subj => (
            <option key={subj.id} value={subj.id}>{subj.name}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={selectedTerm}
          onChange={(e) => setSelectedTerm(e.target.value)}
          data-testid="term-select"
        >
          {terms.map(term => (
            <option key={term} value={term}>{term}</option>
          ))}
        </select>
      </div>
      
      {/* Class Statistics */}
      {stats && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-value info">{stats.average}</div>
            <div className="stat-label">Class Average</div>
          </div>
          <div className="stat-card">
            <div className="stat-value success">{stats.highest}</div>
            <div className="stat-label">Highest Score</div>
          </div>
          <div className="stat-card">
            <div className="stat-value warning">{stats.lowest}</div>
            <div className="stat-label">Lowest Score</div>
          </div>
          <div className="stat-card">
            <div className="stat-value success">{stats.passRate}%</div>
            <div className="stat-label">Pass Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Students Graded</div>
          </div>
        </div>
      )}
      
      <div className="grades-table-container">
        <div className="table-header">
          <div className="table-title">
            <Users size={18} />
            {selectedSubject ? getSubjectName(selectedSubject) : 'Select a Subject'} - {selectedTerm}
          </div>
        </div>
        
        {!selectedClass || !selectedSubject ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Award size={32} color="#64748b" />
            </div>
            <h3 style={{ color: '#f8fafc', marginBottom: '0.5rem' }}>Select Class & Subject</h3>
            <p>Choose a class and subject above to enter grades for students</p>
          </div>
        ) : loading ? (
          <div className="empty-state">Loading students...</div>
        ) : students.length === 0 ? (
          <div className="empty-state">No students found in this class</div>
        ) : (
          <table className="grades-table" data-testid="grades-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Student</th>
                <th style={{ width: '15%' }}>Score (0-100)</th>
                <th style={{ width: '10%' }}>Grade</th>
                <th style={{ width: '45%' }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => {
                const score = grades[student.id]?.score ?? '';
                const grade = score !== '' ? getGradeFromScore(parseFloat(score)) : '-';
                const gradeColor = getGradeColor(grade);
                return (
                  <tr key={student.id}>
                    <td>
                      <div className="student-info">
                        <div className="student-avatar">
                          {student.first_name?.charAt(0) || student.name?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            {student.first_name ? `${student.first_name} ${student.last_name}` : student.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {student.admission_no || student.admission_number}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <input
                        type="number"
                        className="score-input"
                        value={score}
                        onChange={(e) => handleScoreChange(student.id, e.target.value)}
                        min="0"
                        max="100"
                        placeholder="--"
                        data-testid={`score-${student.id}`}
                      />
                    </td>
                    <td>
                      {score !== '' && (
                        <span 
                          className="grade-badge"
                          style={{ background: gradeColor }}
                        >
                          {grade}
                        </span>
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        className="remarks-input"
                        value={grades[student.id]?.remarks || ''}
                        onChange={(e) => handleRemarksChange(student.id, e.target.value)}
                        placeholder="Add remarks..."
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      
      {selectedClass && selectedSubject && students.length > 0 && (
        <div className="save-bar">
          <div className="save-info">
            Entering grades for <strong>{getSubjectName(selectedSubject)}</strong> - {selectedClass} - {selectedTerm}
          </div>
          <button 
            className="btn btn-success"
            onClick={handleSaveGrades}
            disabled={saving}
            data-testid="save-grades-btn"
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Grades'}
          </button>
        </div>
      )}
    </div>
  );
}

export default Grades;
