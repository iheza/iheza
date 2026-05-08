import React, { useState } from 'react';
import './Forms.css';

const LessonPlanForm = () => {
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

  const saveLessonPlan = () => {
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
  
  <div class="section-title">SPECIFIC LEARNING OUTCOME</div>
  <p>${lessonPlan.specificOutcome.replace(/\n/g, '<br>')}</p>
  
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
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `lesson-plan-${lessonPlan.subject}-${lessonPlan.class}-${new Date().toISOString().split('T')[0]}.doc`;
      link.click();
      
      saveButton.textContent = originalButtonText;
      saveButton.disabled = false;
    } catch (error) {
      console.error('Error generating document:', error);
      alert('Error generating document. Please try again.');
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
          <input
            type="text"
            value={lessonPlan.teacherName}
            onChange={(e) => setLessonPlan(prev => ({ ...prev, teacherName: e.target.value }))}
            style={{ flex: 1, maxWidth: '300px', padding: '6px', border: '1px solid #ccc', borderRadius: '3px' }}
            placeholder="Enter teacher name..."
          />
        </div>
      </div>

      <div className="forms-controls no-print">
        <button className="btn btn-primary" onClick={calculateTotals}>Calculate Totals</button>
        <button className="btn btn-secondary" onClick={printLessonPlan}>Print</button>
        <button className="btn btn-success" onClick={saveLessonPlan}>Save as Word Document</button>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label className="form-label">SUBJECT (SOMO):</label>
        <input
          type="text"
          className="form-input"
          value={lessonPlan.subject}
          onChange={(e) => setLessonPlan(prev => ({ ...prev, subject: e.target.value }))}
        />
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
                <input type="text" value={lessonPlan.class} onChange={(e) => setLessonPlan(prev => ({ ...prev, class: e.target.value }))} />
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
        <label className="form-label">SPECIFIC LEARNING OUTCOME:</label>
        <textarea className="form-textarea" style={{ minHeight: '100px' }} value={lessonPlan.specificOutcome} onChange={(e) => setLessonPlan(prev => ({ ...prev, specificOutcome: e.target.value }))} />
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
