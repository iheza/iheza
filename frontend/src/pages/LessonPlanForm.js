import React, { useState, useEffect } from 'react';
import { API_URL } from '../config/api';
import './Forms.css';
import { staffService } from '../services/staffService';
import { useToast } from '../components/Common/Toast';

const LessonPlanForm = () => {
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const { addToast } = useToast();

  const [lessonPlan, setLessonPlan] = useState({
    teacherName: "",
    subject: "MATHEMATICS",
    dayDate: new Date().toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }),
    session: "Morning",
    class: "Standard 5",
    periods: "2",
    time: "10:00-11:30",
    enrolled: {
      girls: 15,
      boys: 20,
      total: 35
    },
    present: {
      girls: 14,
      boys: 18,
      total: 32
    },
    generalOutcome: "By the end of the lesson, pupils should be able to understand basic fractions and their applications in daily life.",
    mainTopic: "Introduction to Fractions: Understanding halves, quarters, and thirds. Practical applications of fractions in measurement and division.",
    subTopic: "Identifying and representing fractions using visual aids. Solving simple fraction problems involving halves and quarters.",
    specificOutcome: `1. Pupils will be able to identify fractions in everyday objects.
2. Pupils will be able to represent fractions using diagrams.
3. Pupils will solve simple fraction problems involving addition of like fractions.
4. Pupils will apply fraction knowledge to divide objects equally among peers.`,
    resources: `1. Fraction charts and posters
2. Fraction circles and bars (manipulatives)
3. Whiteboard and markers
4. Worksheets with fraction problems
5. Real objects (apples, chocolate bars, papers) for demonstration
6. Projector for multimedia presentation`,
    references: `1. Primary Mathematics Standard 5 textbook, pages 45-60
2. TIE Mathematics Curriculum for Standard 5
3. Teacher's guide for primary mathematics
4. Online resources: Khan Academy Fractions Module`,
    lessonSteps: [
      {
        step: "Introduction",
        time: "10 min",
        teaching: "- Greet pupils and review previous lesson on division\n- Show real objects (apple, chocolate) and ask how to share equally\n- Introduce the concept of fractions using visual aids\n- Write lesson objectives on the board",
        learning: "- Respond to greetings and review questions\n- Participate in sharing activity with peers\n- Observe fraction charts and manipulatives\n- Copy lesson objectives in their notebooks",
        assessment: "- Oral questions about sharing\n- Observation of participation\n- Quick check of understanding through thumbs up/down"
      }
    ],
    teacherEvaluation: "The lesson went well overall. Most pupils grasped the concept of halves and quarters. Visual aids were effective in helping pupils understand fractions.",
    pupilWork: `1. Worksheet on identifying and shading fractions
2. Fraction circle manipulation activities
3. Real-life problem solving in groups
4. Measurement activities using fractions of a ruler
5. Homework: Practice problems on adding like fractions`,
    remarks: `- Need to provide more manipulatives for hands-on learning
- Consider pairing stronger students with those who need more support
- The lesson was engaging and age-appropriate`
  });

  useEffect(() => {
    const loadTeachers = async () => {
      try {
        const data = await staffService.getStaff();
        setTeachers(data);
      } catch (error) {
        console.error('Error loading teachers:', error);
      }
    };
    const loadSubjects = async () => {
      try {
        const token = localStorage.getItem('sessionToken');
        const response = await fetch(`${API_URL}/api/subjects`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setSubjects(data);
        }
      } catch (error) {
        console.error('Error loading subjects:', error);
      }
    };
    const loadClasses = async () => {
      try {
        const token = localStorage.getItem('sessionToken');
        const response = await fetch(`${API_URL}/api/classes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setClasses(data);
        }
      } catch (error) {
        console.error('Error loading classes:', error);
      }
    };
    loadTeachers();
    loadSubjects();
    loadClasses();
  }, []);

  const calculateTotals = () => {
    const enrolledTotal = (parseInt(lessonPlan.enrolled.girls) || 0) + (parseInt(lessonPlan.enrolled.boys) || 0);
    const presentTotal = (parseInt(lessonPlan.present.girls) || 0) + (parseInt(lessonPlan.present.boys) || 0);

    setLessonPlan(prev => ({
      ...prev,
      enrolled: { ...prev.enrolled, total: enrolledTotal },
      present: { ...prev.present, total: presentTotal }
    }));
  };

  const addLessonStep = () => {
    const newStep = {
      step: `Building New Knowledge ${lessonPlan.lessonSteps.length}`,
      time: "10 min",
      teaching: "Enter teaching activity here...",
      learning: "Enter learning activity here...",
      assessment: "Enter assessment method here..."
    };

    setLessonPlan(prev => ({
      ...prev,
      lessonSteps: [...prev.lessonSteps, newStep]
    }));
  };

  const removeLessonStep = () => {
    if (lessonPlan.lessonSteps.length > 1) {
      setLessonPlan(prev => ({
        ...prev,
        lessonSteps: prev.lessonSteps.slice(0, -1)
      }));
    }
  };

  const updateLessonStep = (index, field, value) => {
    const updatedSteps = [...lessonPlan.lessonSteps];
    updatedSteps[index] = {
      ...updatedSteps[index],
      [field]: value
    };

    setLessonPlan(prev => ({
      ...prev,
      lessonSteps: updatedSteps
    }));
  };

  const saveLessonPlan = async () => {
    const saveButton = document.querySelector('.btn-success');
    const originalButtonText = saveButton.textContent;
    saveButton.textContent = 'Generating Document...';
    saveButton.disabled = true;

    try {
      const htmlContent = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <title>Lesson Plan - ${lessonPlan.subject} - ${lessonPlan.class}</title>
  <style>
    body { font-family: "Times New Roman", Times, serif; font-size: 10pt; margin: 0.5in; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
    h1 { font-size: 14pt; margin: 0 0 5px 0; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9pt; }
    th { background-color: #2c3e50; color: #fff; padding: 4px; border: 1px solid #000; }
    td { padding: 4px; border: 1px solid #ccc; }
    .section-title { font-size: 11pt; font-weight: bold; margin: 15px 0 8px 0; border-bottom: 1px solid #000; }
    .signature-area { margin-top: 30px; display: flex; justify-content: space-between; }
    .signature-field { text-align: center; }
    .signature-line { border-bottom: 1px solid #000; margin: 5px 0; height: 15px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>LESSON PLAN (ANDALIO LA SOMO)</h1>
    <div>NEW FORM 2026</div>
  </div>
  <p><strong>TEACHER NAME:</strong> ${lessonPlan.teacherName}</p>
  <p><strong>SUBJECT:</strong> ${lessonPlan.subject}</p>

  <table>
    <tr>
      <th>Day & Date</th><th>Session</th><th>Class</th><th>Periods</th><th>Time</th>
      <th>Enrolled (G/B/T)</th><th>Present (G/B/T)</th>
    </tr>
    <tr>
      <td>${lessonPlan.dayDate}</td>
      <td>${lessonPlan.session}</td>
      <td>${lessonPlan.class}</td>
      <td>${lessonPlan.periods}</td>
      <td>${lessonPlan.time}</td>
      <td>${lessonPlan.enrolled.girls}/${lessonPlan.enrolled.boys}/${lessonPlan.enrolled.total}</td>
      <td>${lessonPlan.present.girls}/${lessonPlan.present.boys}/${lessonPlan.present.total}</td>
    </tr>
  </table>

  <div class="section-title">GENERAL LEARNING OUTCOME</div>
  <p>${lessonPlan.generalOutcome}</p>

  <div class="section-title">MAIN TOPIC</div>
  <p>${lessonPlan.mainTopic}</p>

  <div class="section-title">SUB TOPIC</div>
  <p>${lessonPlan.subTopic}</p>

  <div class="section-title">SPECIFIC LEARNING OUTCOME</div>
  <p>${lessonPlan.specificOutcome.replace(/\n/g, '<br>')}</p>

  <div class="section-title">TEACHING AND LEARNING RESOURCES</div>
  <p>${lessonPlan.resources.replace(/\n/g, '<br>')}</p>

  <div class="section-title">REFERENCES</div>
  <p>${lessonPlan.references.replace(/\n/g, '<br>')}</p>

  <div class="section-title">LESSON STEPS</div>
  <table>
    <tr><th>Step</th><th>Time</th><th>Teaching Activities</th><th>Learning Activities</th><th>Assessment</th></tr>
    ${lessonPlan.lessonSteps.map((step, i) => `
      <tr>
        <td>Step ${i + 1}: ${step.step}</td>
        <td>${step.time}</td>
        <td>${step.teaching.replace(/\n/g, '<br>')}</td>
        <td>${step.learning.replace(/\n/g, '<br>')}</td>
        <td>${step.assessment.replace(/\n/g, '<br>')}</td>
      </tr>
    `).join('')}
  </table>

  <div class="section-title">PUPIL WORK</div>
  <p>${lessonPlan.pupilWork.replace(/\n/g, '<br>')}</p>

  <div class="section-title">TEACHER'S EVALUATION</div>
  <p>${lessonPlan.teacherEvaluation}</p>

  <div class="section-title">REMARKS</div>
  <p>${lessonPlan.remarks}</p>

  <div class="signature-area">
    <div class="signature-field"><div class="signature-line"></div>Subject Teacher</div>
    <div class="signature-field"><div class="signature-line"></div>Head of Department</div>
    <div class="signature-field"><div class="signature-line"></div>Academic Coordinator</div>
  </div>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'application/msword' });
      const fileName = `Lesson_Plan_${lessonPlan.subject}_${lessonPlan.class}_${new Date().toISOString().split('T')[0]}.doc`;

      // Convert blob to base64 for storage
      const base64Data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });

      const docPayload = {
        name: fileName,
        type: 'application/msword',
        size: blob.size,
        data: base64Data,
        source: 'lesson_plan'
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
        source: 'lesson_plan',
        uploadedAt: new Date().toISOString(),
        metadata: {
          type: 'lesson_plan',
          teacher: lessonPlan.teacherName,
          subject: lessonPlan.subject,
          class: lessonPlan.class
        }
      });
      localStorage.setItem('iheza_documents', JSON.stringify(existingDocs));

      // Then try to save to backend
      try {
        const token = localStorage.getItem('sessionToken');
        const response = await fetch(`${API_URL}/api/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(docPayload)
        });

        if (response.ok) {
          addToast('Lesson plan saved successfully! ✓', 'success');
        } else {
          addToast('Lesson plan saved to Documents page.', 'success');
        }
      } catch (err) {
        console.log('Backend save failed, but document is saved locally:', err.message);
        addToast('Lesson plan saved to Documents page.', 'success');
      }

      saveButton.textContent = originalButtonText;
      saveButton.disabled = false;
    } catch (error) {
      console.error('Error generating document:', error);
      addToast('Error generating document. Please try again.', 'error');
      saveButton.textContent = originalButtonText;
      saveButton.disabled = false;
    }
  };

  const printLessonPlan = () => {
    window.print();
  };

  return (
    <div className="forms-container">
      <div className="forms-header">
        <div className="watermark">LESSON PLAN 2026</div>
        <h1>LESSON PLAN (ANDALIO LA SOMO)</h1>
        <p className="forms-subtitle">NEW FORM 2026</p>

        <div style={{ margin: '10px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontWeight: 'bold', color: '#2c3e50' }}>TEACHER NAME:</label>
          <select
            value={teacherId}
            onChange={(e) => {
              const selectedId = e.target.value;
              setTeacherId(selectedId);
              const selectedTeacher = teachers.find(t => t.id === selectedId || t._id === selectedId);
              const teacherName = selectedTeacher
                ? `${selectedTeacher.first_name || selectedTeacher.firstName || ''} ${selectedTeacher.last_name || selectedTeacher.lastName || ''}`.trim()
                : '';
              setLessonPlan(prev => ({ ...prev, teacherName }));
            }}
            style={{ flex: 1, maxWidth: '300px', padding: '6px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '12px' }}
          >
            <option value="">Select teacher...</option>
            {teachers.map(teacher => (
              <option key={teacher.id || teacher._id} value={teacher.id || teacher._id}>
                {teacher.first_name || teacher.firstName || ''} {teacher.last_name || teacher.lastName || ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="forms-controls no-print">
        <button className="btn btn-primary" onClick={calculateTotals}>Calculate Totals</button>
        <button className="btn btn-secondary" onClick={printLessonPlan}>Print</button>
        <button className="btn btn-success" onClick={saveLessonPlan}>Save as Word Document</button>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label className="form-label">SUBJECT (SOMO):</label>
        <select
          className="form-input"
          value={lessonPlan.subject}
          onChange={(e) => setLessonPlan(prev => ({ ...prev, subject: e.target.value }))}
        >
          <option value="">Select subject...</option>
          {subjects.length > 0 ? (
            subjects.map(subj => (
              <option key={subj.id || subj._id || subj.name} value={subj.name}>
                {subj.name}
              </option>
            ))
          ) : (
            ['MATHEMATICS', 'ENGLISH', 'KISWAHILI', 'SCIENCE', 'SOCIAL STUDIES', 'CIVICS', 'VOCATIONAL SKILLS', 'RELIGIOUS STUDIES', 'PHYSICAL EDUCATION', 'ART AND CRAFT', 'MUSIC', 'FRENCH', 'ARABIC'].map(subj => (
              <option key={subj} value={subj}>{subj}</option>
            ))
          )}
        </select>
      </div>

      <div className="bordered-section">
        <div className="bordered-section-title">LESSON PLAN DETAILS</div>
        <table className="lesson-table">
          <thead>
            <tr>
              <th>Day & Date</th>
              <th>Session</th>
              <th>Class</th>
              <th>Periods</th>
              <th>Time</th>
              <th>Enrolled (G/B/T)</th>
              <th>Present (G/B/T)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <input type="text" value={lessonPlan.dayDate} onChange={(e) => setLessonPlan(prev => ({ ...prev, dayDate: e.target.value }))} />
              </td>
              <td>
                <select value={lessonPlan.session} onChange={(e) => setLessonPlan(prev => ({ ...prev, session: e.target.value }))}>
                  <option value="Morning">Morning</option>
                  <option value="Afternoon">Afternoon</option>
                  <option value="Evening">Evening</option>
                </select>
              </td>
              <td>
                <select value={lessonPlan.class} onChange={(e) => setLessonPlan(prev => ({ ...prev, class: e.target.value }))}>
                  <option value="">Select class...</option>
                  {classes.length > 0 ? (
                    classes.map(cls => (
                      <option key={cls.id || cls._id || cls.name} value={cls.name}>
                        {cls.name}
                      </option>
                    ))
                  ) : (
                    ['Standard 1', 'Standard 2', 'Standard 3', 'Standard 4', 'Standard 5', 'Standard 6', 'Standard 7',
                      'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6'].map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))
                  )}
                </select>
              </td>
              <td>
                <input type="text" value={lessonPlan.periods} onChange={(e) => setLessonPlan(prev => ({ ...prev, periods: e.target.value }))} />
              </td>
              <td>
                <input type="text" value={lessonPlan.time} onChange={(e) => setLessonPlan(prev => ({ ...prev, time: e.target.value }))} />
              </td>
              <td>
                <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', alignItems: 'center' }}>
                  <input type="number" value={lessonPlan.enrolled.girls} onChange={(e) => setLessonPlan(prev => ({ ...prev, enrolled: { ...prev.enrolled, girls: parseInt(e.target.value) || 0 } }))} style={{ width: '40px' }} />
                  <span>/</span>
                  <input type="number" value={lessonPlan.enrolled.boys} onChange={(e) => setLessonPlan(prev => ({ ...prev, enrolled: { ...prev.enrolled, boys: parseInt(e.target.value) || 0 } }))} style={{ width: '40px' }} />
                  <span>/</span>
                  <input type="number" value={lessonPlan.enrolled.total} readOnly style={{ width: '40px', background: '#f8f9fa' }} />
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', alignItems: 'center' }}>
                  <input type="number" value={lessonPlan.present.girls} onChange={(e) => setLessonPlan(prev => ({ ...prev, present: { ...prev.present, girls: parseInt(e.target.value) || 0 } }))} style={{ width: '40px' }} />
                  <span>/</span>
                  <input type="number" value={lessonPlan.present.boys} onChange={(e) => setLessonPlan(prev => ({ ...prev, present: { ...prev.present, boys: parseInt(e.target.value) || 0 } }))} style={{ width: '40px' }} />
                  <span>/</span>
                  <input type="number" value={lessonPlan.present.total} readOnly style={{ width: '40px', background: '#f8f9fa' }} />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label className="form-label">GENERAL LEARNING OUTCOME:</label>
        <textarea className="form-textarea" value={lessonPlan.generalOutcome} onChange={(e) => setLessonPlan(prev => ({ ...prev, generalOutcome: e.target.value }))} />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label className="form-label">MAIN TOPIC:</label>
        <textarea className="form-textarea" value={lessonPlan.mainTopic} onChange={(e) => setLessonPlan(prev => ({ ...prev, mainTopic: e.target.value }))} />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label className="form-label">SUB TOPIC:</label>
        <textarea className="form-textarea" value={lessonPlan.subTopic} onChange={(e) => setLessonPlan(prev => ({ ...prev, subTopic: e.target.value }))} />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label className="form-label">SPECIFIC LEARNING OUTCOME:</label>
        <textarea className="form-textarea" style={{ minHeight: '100px' }} value={lessonPlan.specificOutcome} onChange={(e) => setLessonPlan(prev => ({ ...prev, specificOutcome: e.target.value }))} />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label className="form-label">TEACHING AND LEARNING RESOURCES:</label>
        <textarea className="form-textarea" style={{ minHeight: '80px' }} value={lessonPlan.resources} onChange={(e) => setLessonPlan(prev => ({ ...prev, resources: e.target.value }))} />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label className="form-label">REFERENCES:</label>
        <textarea className="form-textarea" style={{ minHeight: '80px' }} value={lessonPlan.references} onChange={(e) => setLessonPlan(prev => ({ ...prev, references: e.target.value }))} />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label className="form-label">LESSON STEPS:</label>
        <table className="steps-table">
          <thead>
            <tr>
              <th style={{ width: '10%' }}>Step</th>
              <th style={{ width: '8%' }}>Time</th>
              <th style={{ width: '27%' }}>Teaching Activities</th>
              <th style={{ width: '27%' }}>Learning Activities</th>
              <th style={{ width: '28%' }}>Assessment</th>
            </tr>
          </thead>
          <tbody>
            {lessonPlan.lessonSteps.map((step, index) => (
              <tr key={index}>
                <td>
                  <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>Step {index + 1}</div>
                  <input type="text" value={step.step} onChange={(e) => updateLessonStep(index, 'step', e.target.value)} style={{ width: '100%', padding: '4px', border: '1px solid #ccc' }} />
                </td>
                <td>
                  <input type="text" value={step.time} onChange={(e) => updateLessonStep(index, 'time', e.target.value)} style={{ width: '100%', padding: '4px', border: '1px solid #ccc' }} />
                </td>
                <td>
                  <textarea value={step.teaching} onChange={(e) => updateLessonStep(index, 'teaching', e.target.value)} />
                </td>
                <td>
                  <textarea value={step.learning} onChange={(e) => updateLessonStep(index, 'learning', e.target.value)} />
                </td>
                <td>
                  <textarea value={step.assessment} onChange={(e) => updateLessonStep(index, 'assessment', e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="no-print" style={{ marginTop: '10px' }}>
          <button className="btn btn-primary" onClick={addLessonStep} style={{ marginRight: '10px' }}>Add Step</button>
          <button className="btn btn-secondary" onClick={removeLessonStep}>Remove Step</button>
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label className="form-label">PUPIL WORK:</label>
        <textarea className="form-textarea" style={{ minHeight: '80px' }} value={lessonPlan.pupilWork} onChange={(e) => setLessonPlan(prev => ({ ...prev, pupilWork: e.target.value }))} />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label className="form-label">TEACHER'S EVALUATION:</label>
        <textarea className="form-textarea" style={{ minHeight: '80px' }} value={lessonPlan.teacherEvaluation} onChange={(e) => setLessonPlan(prev => ({ ...prev, teacherEvaluation: e.target.value }))} />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label className="form-label">REMARKS:</label>
        <textarea className="form-textarea" style={{ minHeight: '80px' }} value={lessonPlan.remarks} onChange={(e) => setLessonPlan(prev => ({ ...prev, remarks: e.target.value }))} />
      </div>
    </div>
  );
};

export default LessonPlanForm;
