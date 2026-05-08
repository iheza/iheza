/**
 * Word Document Export Utility for IHEZA School Management System
 * Uses html-docx-js to create proper .docx files with CSS styling
 */

import { saveAs } from 'file-saver';
import htmlDocx from 'html-docx-js/dist/html-docx';

// Common styles for all documents
const baseStyles = `
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #000;
    margin: 0;
    padding: 20px;
  }
  
  h1 {
    font-size: 18pt;
    font-weight: bold;
    text-align: center;
    margin-bottom: 10px;
    color: #0f4c81;
  }
  
  h2 {
    font-size: 14pt;
    font-weight: bold;
    margin-top: 15px;
    margin-bottom: 10px;
    color: #1e3a5f;
    border-bottom: 1px solid #ccc;
    padding-bottom: 5px;
  }
  
  h3 {
    font-size: 12pt;
    font-weight: bold;
    margin-top: 10px;
    margin-bottom: 5px;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 15px 0;
  }
  
  th, td {
    border: 1px solid #333;
    padding: 8px;
    text-align: left;
  }
  
  th {
    background-color: #0f4c81;
    color: white;
    font-weight: bold;
  }
  
  tr:nth-child(even) {
    background-color: #f5f5f5;
  }
  
  .header {
    text-align: center;
    margin-bottom: 20px;
    border-bottom: 2px solid #0f4c81;
    padding-bottom: 15px;
  }
  
  .logo-text {
    font-size: 24pt;
    font-weight: bold;
    color: #0f4c81;
  }
  
  .subtitle {
    font-size: 10pt;
    color: #666;
  }
  
  .info-row {
    display: flex;
    margin: 5px 0;
  }
  
  .info-label {
    font-weight: bold;
    min-width: 150px;
  }
  
  .section {
    margin: 15px 0;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 5px;
  }
  
  .grade-excellent { color: #059669; font-weight: bold; }
  .grade-good { color: #2563eb; }
  .grade-average { color: #d97706; }
  .grade-poor { color: #dc2626; }
  
  .footer {
    margin-top: 30px;
    padding-top: 15px;
    border-top: 1px solid #ccc;
    text-align: center;
    font-size: 10pt;
    color: #666;
  }
  
  .signature-section {
    margin-top: 40px;
    display: flex;
    justify-content: space-between;
  }
  
  .signature-box {
    width: 200px;
    text-align: center;
  }
  
  .signature-line {
    border-top: 1px solid #333;
    margin-top: 40px;
    padding-top: 5px;
  }
  
  .summary-box {
    background-color: #f0f9ff;
    border: 1px solid #0f4c81;
    padding: 15px;
    margin: 15px 0;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin: 15px 0;
  }
  
  .stat-item {
    text-align: center;
    padding: 10px;
    background: #f5f5f5;
    border-radius: 5px;
  }
  
  .stat-value {
    font-size: 16pt;
    font-weight: bold;
    color: #0f4c81;
  }
  
  .stat-label {
    font-size: 9pt;
    color: #666;
  }
`;

/**
 * Generate document HTML wrapper
 */
const wrapDocument = (content, title) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>${baseStyles}</style>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `;
};

/**
 * Export Report Card to Word Document
 */
export const exportReportCard = (reportData, student) => {
  const getGradeClass = (grade) => {
    if (grade >= 80) return 'grade-excellent';
    if (grade >= 60) return 'grade-good';
    if (grade >= 40) return 'grade-average';
    return 'grade-poor';
  };

  const getGradeLetter = (grade) => {
    if (grade >= 80) return 'A';
    if (grade >= 70) return 'B';
    if (grade >= 60) return 'C';
    if (grade >= 40) return 'D';
    return 'F';
  };

  // Convert behavior_marks object to array if needed
  const behaviorMarksArray = Array.isArray(reportData.behavior_marks) 
    ? reportData.behavior_marks 
    : Object.entries(reportData.behavior_marks || {}).map(([key, value]) => ({
        category: key.charAt(0).toUpperCase() + key.slice(1),
        rating: value
      }));

  const content = `
    <div class="header">
      <div class="logo-text">IHEZA</div>
      <div class="subtitle">Institute of Holistic Education of Zanzibar</div>
      <h1>STUDENT REPORT CARD</h1>
    </div>
    
    <div class="section">
      <h2>Student Information</h2>
      <table>
        <tr>
          <td><strong>Name:</strong></td>
          <td>${student?.name || reportData.student_name || 'N/A'}</td>
          <td><strong>Admission No:</strong></td>
          <td>${student?.admission_no || reportData.admission_no || 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Class:</strong></td>
          <td>${student?.class_name || reportData.class_name || 'N/A'}</td>
          <td><strong>Academic Year:</strong></td>
          <td>${reportData.academic_year || new Date().getFullYear()}</td>
        </tr>
        <tr>
          <td><strong>Term:</strong></td>
          <td>${reportData.term || 'Term 1'}</td>
          <td><strong>Position:</strong></td>
          <td>${reportData.position || 'N/A'} / ${reportData.total_students || 'N/A'}</td>
        </tr>
      </table>
    </div>
    
    <div class="section">
      <h2>Academic Performance</h2>
      <table>
        <tr>
          <th>Subject</th>
          <th>Score</th>
          <th>Grade</th>
          <th>Remarks</th>
        </tr>
        ${(Array.isArray(reportData.grades) ? reportData.grades : []).map(g => `
          <tr>
            <td>${g.subject_name || g.subject || 'N/A'}</td>
            <td class="${getGradeClass(g.score || 0)}">${g.score || 0}</td>
            <td>${getGradeLetter(g.score || 0)}</td>
            <td>${(g.score || 0) >= 80 ? 'Excellent' : (g.score || 0) >= 60 ? 'Good' : (g.score || 0) >= 40 ? 'Fair' : 'Needs Improvement'}</td>
          </tr>
        `).join('')}
        <tr style="background: #e0f2fe;">
          <td><strong>Average</strong></td>
          <td colspan="3"><strong class="${getGradeClass(reportData.average || 0)}">${(reportData.average || 0).toFixed(1)}% (${getGradeLetter(reportData.average || 0)})</strong></td>
        </tr>
      </table>
    </div>
    
    <div class="section">
      <h2>Behavior & Conduct</h2>
      <table>
        <tr>
          <th>Category</th>
          <th>Rating (1-5)</th>
          <th>Comment</th>
        </tr>
        ${behaviorMarksArray.map(b => `
          <tr>
            <td>${b.category || 'N/A'}</td>
            <td>${'★'.repeat(b.rating || 0)}${'☆'.repeat(5 - (b.rating || 0))}</td>
            <td>${(b.rating || 0) >= 4 ? 'Excellent' : (b.rating || 0) >= 3 ? 'Good' : 'Needs Improvement'}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    
    <div class="section">
      <h2>Teacher's Comments</h2>
      <p>${reportData.teacher_comment || 'The student has shown consistent effort throughout the term. Keep up the good work!'}</p>
    </div>
    
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line">Class Teacher</div>
      </div>
      <div class="signature-box">
        <div class="signature-line">Principal</div>
      </div>
      <div class="signature-box">
        <div class="signature-line">Parent/Guardian</div>
      </div>
    </div>
    
    <div class="footer">
      <p>Generated on: ${new Date().toLocaleDateString()}</p>
      <p>IHEZA School Management System</p>
    </div>
  `;

  const html = wrapDocument(content, `Report Card - ${student?.name || 'Student'}`);
  const blob = htmlDocx.asBlob(html);
  saveAs(blob, `Report_Card_${(student?.name || 'Student').replace(/\s+/g, '_')}_${reportData.term || 'Term1'}.docx`);
};

/**
 * Export Lesson Plan to Word Document
 */
export const exportLessonPlan = (lessonPlan) => {
  const content = `
    <div class="header">
      <div class="logo-text">IHEZA</div>
      <div class="subtitle">Institute of Holistic Education of Zanzibar</div>
      <h1>LESSON PLAN</h1>
    </div>
    
    <div class="section">
      <h2>Lesson Information</h2>
      <table>
        <tr>
          <td><strong>Subject:</strong></td>
          <td>${lessonPlan.subject || 'N/A'}</td>
          <td><strong>Class:</strong></td>
          <td>${lessonPlan.class_name || 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Topic:</strong></td>
          <td colspan="3">${lessonPlan.topic || lessonPlan.title || 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Duration:</strong></td>
          <td>${lessonPlan.duration || '40 minutes'}</td>
          <td><strong>Date:</strong></td>
          <td>${lessonPlan.date || new Date().toLocaleDateString()}</td>
        </tr>
      </table>
    </div>
    
    <div class="section">
      <h2>Learning Objectives</h2>
      <p>${lessonPlan.objectives || 'By the end of this lesson, students will be able to understand and apply the concepts taught.'}</p>
    </div>
    
    <div class="section">
      <h2>Materials Required</h2>
      <p>${lessonPlan.materials || 'Textbook, whiteboard, markers, worksheets'}</p>
    </div>
    
    <div class="section">
      <h2>Introduction (${lessonPlan.intro_duration || '5 min'})</h2>
      <p>${lessonPlan.introduction || 'Brief introduction to engage students and introduce the topic.'}</p>
    </div>
    
    <div class="section">
      <h2>Development / Main Content (${lessonPlan.dev_duration || '25 min'})</h2>
      <p>${lessonPlan.development || lessonPlan.content || 'Main lesson content and activities.'}</p>
    </div>
    
    <div class="section">
      <h2>Conclusion (${lessonPlan.conclusion_duration || '5 min'})</h2>
      <p>${lessonPlan.conclusion || 'Summary of key points and Q&A session.'}</p>
    </div>
    
    <div class="section">
      <h2>Assessment</h2>
      <p>${lessonPlan.assessment || 'Oral questions, class participation, and short quiz.'}</p>
    </div>
    
    <div class="section">
      <h2>Homework / Assignment</h2>
      <p>${lessonPlan.homework || 'Complete exercises 1-5 on page 45.'}</p>
    </div>
    
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line">Teacher's Signature</div>
      </div>
      <div class="signature-box">
        <div class="signature-line">HOD Signature</div>
      </div>
    </div>
    
    <div class="footer">
      <p>Prepared by: ${lessonPlan.created_by_name || 'Teacher'}</p>
      <p>Generated on: ${new Date().toLocaleDateString()}</p>
    </div>
  `;

  const html = wrapDocument(content, `Lesson Plan - ${lessonPlan.title || 'Untitled'}`);
  const blob = htmlDocx.asBlob(html);
  saveAs(blob, `Lesson_Plan_${(lessonPlan.title || 'Untitled').replace(/\s+/g, '_')}.docx`);
};

/**
 * Export Scheme of Work to Word Document
 */
export const exportSchemeOfWork = (schemeData) => {
  const content = `
    <div class="header">
      <div class="logo-text">IHEZA</div>
      <div class="subtitle">Institute of Holistic Education of Zanzibar</div>
      <h1>SCHEME OF WORK</h1>
    </div>
    
    <div class="section">
      <h2>Details</h2>
      <table>
        <tr>
          <td><strong>Subject:</strong></td>
          <td>${schemeData.subject || 'N/A'}</td>
          <td><strong>Class:</strong></td>
          <td>${schemeData.class_name || 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Term:</strong></td>
          <td>${schemeData.term || 'Term 1'}</td>
          <td><strong>Year:</strong></td>
          <td>${schemeData.year || new Date().getFullYear()}</td>
        </tr>
      </table>
    </div>
    
    <div class="section">
      <h2>Weekly Plan</h2>
      <table>
        <tr>
          <th>Week</th>
          <th>Topic</th>
          <th>Objectives</th>
          <th>Activities</th>
          <th>Resources</th>
        </tr>
        ${(schemeData.weeks || []).map(w => `
          <tr>
            <td>Week ${w.week_number}</td>
            <td>${w.topic}</td>
            <td>${w.objectives || 'N/A'}</td>
            <td>${w.activities || 'N/A'}</td>
            <td>${w.resources || 'N/A'}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    
    <div class="footer">
      <p>Prepared by: ${schemeData.created_by_name || 'Teacher'}</p>
      <p>Generated on: ${new Date().toLocaleDateString()}</p>
    </div>
  `;

  const html = wrapDocument(content, `Scheme of Work - ${schemeData.subject || 'Subject'}`);
  const blob = htmlDocx.asBlob(html);
  saveAs(blob, `Scheme_of_Work_${(schemeData.subject || 'Subject').replace(/\s+/g, '_')}_${schemeData.term || 'Term1'}.docx`);
};

/**
 * Export Assessment to Word Document
 */
export const exportAssessment = (assessmentData) => {
  const content = `
    <div class="header">
      <div class="logo-text">IHEZA</div>
      <div class="subtitle">Institute of Holistic Education of Zanzibar</div>
      <h1>${(assessmentData.assessment_type || 'ASSESSMENT').toUpperCase()}</h1>
    </div>
    
    <div class="section">
      <table>
        <tr>
          <td><strong>Subject:</strong></td>
          <td>${assessmentData.subject || 'N/A'}</td>
          <td><strong>Class:</strong></td>
          <td>${assessmentData.class_name || 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Title:</strong></td>
          <td colspan="3">${assessmentData.title || 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Total Marks:</strong></td>
          <td>${assessmentData.total_marks || 100}</td>
          <td><strong>Duration:</strong></td>
          <td>${assessmentData.duration || '60 minutes'}</td>
        </tr>
      </table>
    </div>
    
    <div class="section">
      <h2>Instructions</h2>
      <ol>
        <li>Answer all questions</li>
        <li>Write clearly and legibly</li>
        <li>Show all working where applicable</li>
      </ol>
    </div>
    
    <div class="section">
      <h2>Questions</h2>
      ${(assessmentData.questions || []).map((q, i) => `
        <div style="margin: 15px 0;">
          <p><strong>Q${i + 1}. ${q.question}</strong> (${q.marks || 10} marks)</p>
          ${q.options ? `
            <ol type="a">
              ${q.options.map(opt => `<li>${opt}</li>`).join('')}
            </ol>
          ` : ''}
          <p style="color: #999; margin-top: 30px;">_____________________________________________</p>
        </div>
      `).join('')}
    </div>
    
    <div class="footer">
      <p>Prepared by: ${assessmentData.created_by_name || 'Teacher'}</p>
      <p>Generated on: ${new Date().toLocaleDateString()}</p>
    </div>
  `;

  const html = wrapDocument(content, `${assessmentData.assessment_type || 'Assessment'} - ${assessmentData.title || 'Untitled'}`);
  const blob = htmlDocx.asBlob(html);
  saveAs(blob, `${(assessmentData.assessment_type || 'Assessment')}_${(assessmentData.title || 'Untitled').replace(/\s+/g, '_')}.docx`);
};

/**
 * Export Financial Report to Word Document
 */
export const exportFinancialReport = (reportData) => {
  const content = `
    <div class="header">
      <div class="logo-text">IHEZA</div>
      <div class="subtitle">Institute of Holistic Education of Zanzibar</div>
      <h1>FINANCIAL REPORT</h1>
    </div>
    
    <div class="summary-box">
      <h2>Summary</h2>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">${reportData.total_students || 0}</div>
          <div class="stat-label">Total Students</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">TZS ${(reportData.total_expected || 0).toLocaleString()}</div>
          <div class="stat-label">Expected Revenue</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">TZS ${(reportData.total_collected || 0).toLocaleString()}</div>
          <div class="stat-label">Collected</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${reportData.collection_rate || 0}%</div>
          <div class="stat-label">Collection Rate</div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>Outstanding Balance</h2>
      <p style="font-size: 18pt; font-weight: bold; color: #dc2626;">
        TZS ${(reportData.outstanding_balance || 0).toLocaleString()}
      </p>
    </div>
    
    <div class="section">
      <h2>Payment Status Breakdown</h2>
      <table>
        <tr>
          <th>Status</th>
          <th>Count</th>
        </tr>
        <tr>
          <td>Fully Paid</td>
          <td>${reportData.paid_count || 0}</td>
        </tr>
        <tr>
          <td>Partial Payment</td>
          <td>${reportData.partial_count || 0}</td>
        </tr>
        <tr>
          <td>Unpaid</td>
          <td>${reportData.unpaid_count || 0}</td>
        </tr>
      </table>
    </div>
    
    <div class="footer">
      <p>Report Period: ${reportData.period || 'Current Term'}</p>
      <p>Generated on: ${new Date().toLocaleDateString()}</p>
      <p>IHEZA School Management System</p>
    </div>
  `;

  const html = wrapDocument(content, 'Financial Report');
  const blob = htmlDocx.asBlob(html);
  saveAs(blob, `Financial_Report_${new Date().toISOString().split('T')[0]}.docx`);
};

/**
 * Export Task Report to Word Document
 */
export const exportTaskReport = (tasks, title = 'Task Report') => {
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const pendingCount = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  
  const content = `
    <div class="header">
      <div class="logo-text">IHEZA</div>
      <div class="subtitle">Institute of Holistic Education of Zanzibar</div>
      <h1>${title.toUpperCase()}</h1>
    </div>
    
    <div class="summary-box">
      <h2>Summary</h2>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">${tasks.length}</div>
          <div class="stat-label">Total Tasks</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" style="color: #22c55e;">${completedCount}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" style="color: #d97706;">${pendingCount}</div>
          <div class="stat-label">Pending</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0}%</div>
          <div class="stat-label">Completion Rate</div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>Task Details</h2>
      <table>
        <tr>
          <th>#</th>
          <th>Task</th>
          <th>Assigned To</th>
          <th>Due Date</th>
          <th>Status</th>
          <th>Priority</th>
        </tr>
        ${tasks.map((t, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${t.title || t.description || 'N/A'}</td>
            <td>${t.assigned_to_name || 'N/A'}</td>
            <td>${t.due_date ? new Date(t.due_date).toLocaleDateString() : 'N/A'}</td>
            <td>${t.status || 'pending'}</td>
            <td>${t.priority || 'normal'}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    
    <div class="footer">
      <p>Generated on: ${new Date().toLocaleDateString()}</p>
      <p>IHEZA School Management System</p>
    </div>
  `;

  const html = wrapDocument(content, title);
  const blob = htmlDocx.asBlob(html);
  saveAs(blob, `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`);
};

/**
 * Export Attendance Report to Word Document
 */
export const exportAttendanceReport = (reportData, filters = {}) => {
  const records = reportData.records || [];
  const summary = reportData.summary || {};
  const byRole = reportData.by_role || {};

  const filterInfo = [];
  if (filters.start_date) filterInfo.push(`From: ${filters.start_date}`);
  if (filters.end_date) filterInfo.push(`To: ${filters.end_date}`);
  if (filters.month) filterInfo.push(`Month: ${filters.month}`);
  if (filters.role) filterInfo.push(`Position: ${filters.role.replace('_', ' ')}`);

  const content = `
    <div class="header">
      <div class="logo-text">IHEZA</div>
      <div class="subtitle">Institute of Holistic Education of Zanzibar</div>
      <h1>STAFF ATTENDANCE REPORT</h1>
      ${filterInfo.length > 0 ? `<p style="text-align:center; color:#666;">${filterInfo.join(' | ')}</p>` : ''}
    </div>
    
    <div class="summary-box">
      <h2>Attendance Summary</h2>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">${summary.total || 0}</div>
          <div class="stat-label">Total Records</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" style="color: #059669;">${summary.present || 0}</div>
          <div class="stat-label">Present</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" style="color: #dc2626;">${summary.absent || 0}</div>
          <div class="stat-label">Absent</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" style="color: #2563eb;">${summary.attendance_rate || 0}%</div>
          <div class="stat-label">Attendance Rate</div>
        </div>
      </div>
    </div>
    
    ${Object.keys(byRole).length > 0 ? `
    <div class="section">
      <h2>Attendance by Position</h2>
      <table>
        <tr>
          <th>Position</th>
          <th>Present</th>
          <th>Total</th>
          <th>Rate</th>
        </tr>
        ${Object.entries(byRole).map(([role, data]) => `
          <tr>
            <td>${role.replace(/_/g, ' ')}</td>
            <td>${data.present || 0}</td>
            <td>${data.total || 0}</td>
            <td>${data.total > 0 ? Math.round((data.present / data.total) * 100) : 0}%</td>
          </tr>
        `).join('')}
      </table>
    </div>
    ` : ''}
    
    <div class="section">
      <h2>Detailed Attendance Records</h2>
      <table>
        <tr>
          <th>#</th>
          <th>Date</th>
          <th>Staff Name</th>
          <th>Position</th>
          <th>Status</th>
          <th>Check-in</th>
          <th>Check-out</th>
        </tr>
        ${records.length > 0 ? records.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${r.date || 'N/A'}</td>
            <td>${r.staff_name || 'N/A'}</td>
            <td>${(r.staff_role || 'N/A').replace(/_/g, ' ')}</td>
            <td style="color: ${r.status === 'present' ? '#059669' : r.status === 'absent' ? '#dc2626' : '#d97706'}; font-weight: bold;">${(r.status || 'absent').toUpperCase()}</td>
            <td>${r.check_in_time || '-'}</td>
            <td>${r.check_out_time || '-'}</td>
          </tr>
        `).join('') : `
        <tr>
          <td colspan="7" style="text-align:center; color:#999;">No attendance records found</td>
        </tr>
        `}
      </table>
    </div>
    
    <div class="footer">
      <p>Report Period: ${filterInfo.length > 0 ? filterInfo.join(' | ') : 'All Time'}</p>
      <p>Generated on: ${new Date().toLocaleDateString()}</p>
      <p>IHEZA School Management System</p>
    </div>
  `;

  const html = wrapDocument(content, 'Staff Attendance Report');
  const blob = htmlDocx.asBlob(html);
  saveAs(blob, `Attendance_Report_${new Date().toISOString().split('T')[0]}.docx`);
};

export default {
  exportReportCard,
  exportLessonPlan,
  exportSchemeOfWork,
  exportAssessment,
  exportFinancialReport,
  exportTaskReport,
  exportAttendanceReport
};
