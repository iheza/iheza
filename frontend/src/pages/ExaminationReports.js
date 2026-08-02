import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { toast } from '../hooks/useSoundEnabledToast';
import { API_URL } from '../config/api';
import { FileText, Save, Download, Upload, School, Calendar, User, BookOpen, Plus, List, RefreshCw, Sparkles } from 'lucide-react';

function ExaminationReports() {
  const currentUser = useSelector(selectCurrentUser);
  const fileInputRef = useRef(null);
  
  // Get school name from user's chain or localStorage
  // Try multiple sources for chain: currentUser, localStorage, or default
  const userChain = currentUser?.chain || localStorage.getItem('userChain') || 'IHEZA';
  // Map chain codes to school names
  const chainSchoolNames = {
    'DUP': 'DENIZ PRIMARY SCHOOL',
    'DLP': 'DENIZ LUNGANGA PRIMARY SCHOOL',
    'OLGUN': 'OLGUN PRIMARY SCHOOL',
    'LALE': 'LALE PRIMARY SCHOOL',
    'IHEZA': 'IHEZA SCHOOL',
  };
  const schoolName = chainSchoolNames[userChain] || currentUser?.school_name || currentUser?.school || userChain || 'DENIZ PRIMARY SCHOOL';
  const preparedBy = currentUser?.name || (currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() : '') || 'MR. AHMED ALLY MOHAMED';
  const userRole = currentUser?.role || 'ACADEMIC TEACHER';
  
  const [formData, setFormData] = useState({
    year: new Date().getFullYear().toString(),
    term: '2',
    termMonth: 'NOVEMBER',
    examDate: '4TH NOVEMBER, 2025.',
    examDateRaw: '',
    preparedBy: preparedBy,
    preparedByRole: userRole,
    schoolLogo: null,
    logoPreview: null,
    coverPageNote: 'This report consists of 15 printed pages',
    contents: `COVER PAGE \t\t\t\t\t\t\t\t01\nCONTENTS \t\t\t\t\t\t\t\t02\nINTRODUCTION \t\t\t\t\t\t\t03\nSUMMARY \t\t\t\t\t\t\t\t04\nFINDINGS \t\t\t\t\t\t\t\t05 – 12\nCONCLUSION \t\t\t\t\t\t\t13\nRECOMMENDATIONS \t\t\t\t\t\t14`,
    introduction: `This report is designed to outline general Academic pupils' performance in second - Term Examination that was done from 4th – 11th NOVEMBER 2025.`,
    gradeScale: `A –   81 – 100\nB -    61 – 80\nC -    41 – 60\nD -    21 – 40\nF -     0 – 20`,
    summaryNote: `The report will focus on subjects, classes and school performance in general according to the number of pupils who sat for this exam.`,
    summaryClasses: `CLASSES\tBOYS\tGIRLS\tTOTAL\nGRADE 5-A\t6\t8\t14\nGRADE 5-B\t5\t9\t14\nGRADE 6\t6\t8\t14\nTOTAL = 03 CLASSES\t17\t25\t42`,
    findingsANote: `This shows the performance of each subject in Average, Grade and Position in every class.`,
    subjectAveragesGrade5A: `NO.\tSUBJECTS\tGRADE 5-A\n1.\tMATHEMATICS\t62 – B – 8\n2.\tENGLISH\t78 – B – 1\n3.\tSCIENCE & TECHNOLOGY\t75 – B – 5\n4.\tKISWAHILI\t77 – B – 3\n5.\tCREATIVE ART & SPORTS\t74.5 – B – 6\n6.\tRELIGION\t75.3 – B – 4\n7.\tARABIC\t69.5 – B – 7\n8.\tSOCIAL SCIENCE\t77.2 – B – 2`,
    subjectAveragesGrade5B: `NO.\tSUBJECTS\tGRADE 5-B\n1.\tMATHEMATICS\t59.5 – C – 8\n2.\tENGLISH\t81 – A – 1\n3.\tSCIENCE & TECHNOLOGY\t75.7 – B – 3\n4.\tKISWAHILI\t74 – B – 4\n5.\tCREATIVE ART & SPORTS\t73 – B – 6\n6.\tRELIGION\t76 – B – 2\n7.\tARABIC\t72 – B – 7\n8.\tSOCIAL SCIENCE\t73.7 – B – 5`,
    subjectAveragesGrade6: `NO.\tSUBJECTS\tGRADE 6\n1.\tMATHEMATICS\t58 – C – 8\n2.\tENGLISH\t87– A – 1\n3.\tSCIENCE & TECHNOLOGY\t68.5 – B – 6\n4.\tKISWAHILI\t73.2 – B – 4\n5.\tSOCIAL SCIENCE\t74.1 – B – 3\n6.\tARABIC\t72.2 – B – 5\n7.\tRELIGION\t80 – B – 2\n8.\tCREATIVE ART & SPORTS\t67 – B – 7`,
    findingsBNote: `This shows the comparison, In terms of performance of class AVERAGE, GRADE and POSITION among six classes.`,
    classAverages: `NO.\tCLASSES\tAV - GR - POS\n1.\t5-A\t74 – B – 1\n2.\t5-B\t73 – B – 2\n3.\t6\t64 – B – 3`,
    schoolPerformanceSubjectWise: `NO.\tSUBJECTS\tAVERAGE\tGRADE\tPOSITION\n1.\tMATHEMATICS\t60\tC\t8\n2.\tENGLISH\t82\tA\t1\n3.\tSCIENCE & TECHNOLOGY\t73\tB\t5\n4.\tKISWAHILI\t74.7\tB\t4\n5.\tSOCIAL SCIENCE\t75\tB\t3\n6.\tARABIC\t71.2\tB\t7\n7.\tRELIGION\t77.1\tB\t2\n8.\tCREATIVE ART & SPORTS\t71.5\tB\t6`,
    mostPassedSubject: 'ENGLISH',
    mostFailedSubject: 'MATHEMATICS',
    overallSchoolPerformance: '73.06/B',
    failedQuestionsGrade5AB: `SUBJECTS\tQUESTION(S) NUMBER\tPART OF TOPICS\tREASON(S)\nENGLISH\t6\tCOMPOSITION\tFailed to construct well the sentences due to the poor visibility of the picture.\nMATHEMATICS\t5\tAREA & PERIMETERS\tFailed to do proper revision at home. Failed to identify the correct types of triangles.\nSCIENCE & TECHNOLOGY\t8, & 11\tDISEASE & HEALTH AND NUTRITIONS.\tFailed to know answers. Failed to follow instructions.\nKISWAHILI\t2 & 7\tTARATIBU ZA UANDISHI. SARUFI.\tBaadhi ya wanafunzi wameshindwa kutoa maana za maneno mbalimbali. Wanafunzi wameshindwa kueleza maneno yaliyotumika katika mashairi.\nSOCIAL SCIENCE\t5 & 7\tPHISICAL GEOGRAPHY. MAJOR MEANS OF PRODUCTION.\tFailed to understand the questions. Failed to explain the answers. Poor revisions.\nCREATIVE ART & SPORTS\t7 & 10\tTRADITIONAL DANCES.\tFailed due to poor understanding of the questions. Failed due to not following the steps.\nRELIGION\t2 & 5\tQUR AN TAFSIRI\tFailed to translate the verses of the Qur-an. Failed due to poor revision.\nARABIC\t1,5 & 8\tCOMPOSITION & TELLING TIME\tFailed to select correct words. Failed to arrange the sentences. Poor revision.`,
    failedQuestionsGrade6: `SUBJECTS\tQUESTION(S) NUMBER\tPART OF TOPICS\tREASON(S)\nENGLISH\t6\tCOMPOSITION\tFailed to construct well the sentences due to the poor visibility of the picture.\nMATHEMATICS\t11, 12, 13 & 14\tFRACTIONS, INTERGERS.\tFailed to do proper revision at home. Failed to understand the questions. Failed to identify the word problems.\nSCIENCE & TECHNOLOGY\t8, 9, 10, 11 & 12\tSECONDARY SEXUAL CHARACTERISTICS, NUTRITION DISORDERS, NUTRITION\tFailed to know answers. Failed to arrange well their essays.\nKISWAHILI\t12\tSARUFI (SENTENSI & VIHISISHI) UTUNGAJI\tFailed to construct sentences. (they define the given words) Failed to identify preposition and its types. They confuse concept of letter writing and composition.\nSOCIAL SCIENCE\t6\tMULTIPARTY SYSTEM IN TANZANIA.\tFailed to elaborate the questions widely - they use less points.\nRELIGION\t2 & 6\tQUR-AN TAFSIRI & HISTORIA – MATESO YA MASWAHABA\tFailed to translate the verses of the Qur-an. Failed to elaborate on tortures of the Prophet Muhammad (p.b.u.h) companions.\nARABIC\t5 & 6\tAL-IIRAB & AL-DHWAMAIR\tFailed to analyze sentences. Failed to use subject correctly. Poor revision.\nCREATIVE ART & SPORTS\t10\tFIRST AID\tFailed due to poor understanding of the questions.`,
    examErrors: `Most of the exam's errors happened during the typing and re-typing. And it's on the following categories.\ni.\tCover pages (pages number, confusing the question number and instructions)\nii.\tSpaces in the exams.\niii.\tFailed to correct the exams once they are returned to Academic office.\niv.\tSome papers miss pages like (Religion – 5) miss page #4.`,
    markingSchemeErrors: `CLASSES\tSUBJECTS\tQUESTIONS\tERRORS\n5\tSOCIAL SCIENCE\t\tNO SCHOOL NAME\n6\tSCIENCE & TECHNOLOGY\t\tNO SCHOOL NAME\n6\tSOCIAL SCIENCE\t\tNO SCHOOL NAME\n6\tKISWAHILI\t\tNO SCHOOL NAME`,
    generalError: `MOST MARKING SCHEMES LACK SCHOOL'S NAME, EXAM TERM, MONTH AND YEAR WHICH ARE IMPORTANT INFORMATION, TEACHERS FOUND THEM AS A WORKLOAD AND NEGLECT THEM, THIS MUST NEVER REPEAT IN THE UPCOMING TERMS NEXT YEAR.`,
    conclusion: `●\tThe overall School Performance is 73/B; teachers must work really hard because most of them lack potential in performing almost all of their duties. They must teach from the heart, only if we all do so the work of teaching and learning will be really easy on both sides.\n\n●\tPupils need extra counseling when it comes to learning and know their position in education because they are not paying attention to what they have learnt recently and in previous years. So, teachers must play their part as parents to supervise, guide and lead them to their future.\n\n●\tClass teachers together with subject teachers must establish a close connection with parents and guardians on making sure all pupils do and finish their tasks (Home-work, Class-work and holiday package) on appropriate given time so as to perform best on the Exams Terms.`,
    recommendations: `After the sum up of this report, the Academic office would like to recommend on the following things:\n\n●\tSome responsible teachers for the most failed subject (Mathematics) must write a letter explaining in details the major actions (strategies) that they will take to improve the subjects' performance. (Submission on 21ST January, 2026)\n\n●\tAll teachers must upgrade and update their teaching in terms of resources and methodologies as the New Curriculum suggested (Learner centered and Competence Based Curriculum) so as to improve the school performance.\n\n●\tAll teachers must follow up the rules and regulations during exam time.\n\n●\tAll teachers must follow up on pupils' progress on all sectors that play parts in their learning process, if any teacher notice any inappropriate changes they must arose to other teachers /Section leader or Academic teacher for actions so as to ensure their wellbeing throughout the year.\n\n●\tSome teachers are not responsible enough in performing their duties during Examination period, like exams checking after typed by secretaries and marking schemes preparation. Also, they owe an Academic Office both oral and written explanations.\n\n●\tAll teachers must follow the provided manual for Exam formats and marking schemes to avoid any errors.\n\n●\tAll teachers must work hand on hand together, act professional and maintaining the strong attitude towards the students because the students imitate mostly form their teachers.`,
  });

  const [generating, setGenerating] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedReports, setSavedReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [showSavedList, setShowSavedList] = useState(false);
  const [availableYears, setAvailableYears] = useState([]);
  const [availableTermMonths, setAvailableTermMonths] = useState([]);
  const [availableExamDates, setAvailableExamDates] = useState([]);
  const [availablePreparedBy, setAvailablePreparedBy] = useState([]);
  const [availablePreparedByRoles, setAvailablePreparedByRoles] = useState([]);
  const [generatingSection, setGeneratingSection] = useState(null);
  const [dynamicClassNames, setDynamicClassNames] = useState([]);

  const termOptions = [
    { value: '1', label: 'First Term' },
    { value: '2', label: 'Second Term' },
    { value: '3', label: 'Third Term' },
    { value: 'final', label: 'Final' },
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({ ...prev, schoolLogo: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logoPreview: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('sessionToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        ...formData,
        schoolLogo: formData.logoPreview,
        schoolName,
        createdBy: currentUser?.id,
        chain: currentUser?.chain || 'IHEZA',
      };
      delete payload.logoPreview;

      const method = selectedReportId ? 'PUT' : 'POST';
      const url = selectedReportId 
        ? `${API_URL}/api/examination-reports/${selectedReportId}`
        : `${API_URL}/api/examination-reports`;

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        const reportId = data.id || data._id;
        setSelectedReportId(reportId);
        
        // Also save to Documents (localStorage) so it appears in the Documents component
        // Store only metadata (no full HTML content) to avoid localStorage quota issues
        const termLabel = termOptions.find(t => t.value === formData.term)?.label || `Term ${formData.term}`;
        const docName = `Examination_Report_${schoolName}_${termLabel.replace(' ', '_')}_${formData.year}.doc`;
        
        const docEntry = {
          id: 'exam_report_' + reportId + '_' + Date.now(),
          name: docName,
          type: 'application/msword',
          size: 0, // Will be computed on-demand
          data: null, // No full HTML content stored - will be regenerated on preview
          source: 'examination_report',
          chain: currentUser?.chain || 'IHEZA',
          metadata: {
            year: formData.year,
            term: formData.term,
            termLabel: termLabel,
            termMonth: formData.termMonth,
            examDate: formData.examDate,
            preparedBy: formData.preparedBy,
            reportId: reportId,
            schoolName: schoolName,
            // Store all form data needed to regenerate the HTML
            formData: (() => {
              // Build formData with dynamic class name fields
              const fd = {
                year: formData.year,
                term: formData.term,
                termMonth: formData.termMonth,
                examDate: formData.examDate,
                preparedBy: formData.preparedBy,
                preparedByRole: formData.preparedByRole,
                coverPageNote: formData.coverPageNote,
                contents: formData.contents,
                introduction: formData.introduction,
                gradeScale: formData.gradeScale,
                summaryNote: formData.summaryNote,
                summaryClasses: formData.summaryClasses,
                findingsANote: formData.findingsANote,
                findingsBNote: formData.findingsBNote,
                classAverages: formData.classAverages,
                schoolPerformanceSubjectWise: formData.schoolPerformanceSubjectWise,
                mostPassedSubject: formData.mostPassedSubject,
                mostFailedSubject: formData.mostFailedSubject,
                overallSchoolPerformance: formData.overallSchoolPerformance,
                failedQuestionsGrade5AB: formData.failedQuestionsGrade5AB,
                failedQuestionsGrade6: formData.failedQuestionsGrade6,
                examErrors: formData.examErrors,
                markingSchemeErrors: formData.markingSchemeErrors,
                generalError: formData.generalError,
                conclusion: formData.conclusion,
                recommendations: formData.recommendations,
                logoPreview: formData.logoPreview,
                // Store dynamic class names
                dynamicClassNames: dynamicClassNames,
              };
              // Add dynamic subject average fields
              if (dynamicClassNames.length > 0) {
                dynamicClassNames.forEach((clsName, idx) => {
                  const fieldKey = `subjectAverages_${idx}`;
                  fd[fieldKey] = formData[fieldKey] || '';
                });
              } else {
                // Fallback to hardcoded fields
                fd.subjectAveragesGrade5A = formData.subjectAveragesGrade5A;
                fd.subjectAveragesGrade5B = formData.subjectAveragesGrade5B;
                fd.subjectAveragesGrade6 = formData.subjectAveragesGrade6;
              }
              return fd;
            })()
          },
          uploaded_by: currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.email || 'Unknown' : localStorage.getItem('userName') || 'Unknown',
          uploadedAt: new Date().toISOString()
        };
        
        // Save to localStorage documents
        const existingDocs = JSON.parse(localStorage.getItem('iheza_documents') || '[]');
        // Remove old version if updating
        const filteredDocs = existingDocs.filter(d => !(d.metadata?.reportId === reportId && d.source === 'examination_report'));
        filteredDocs.push(docEntry);
        localStorage.setItem('iheza_documents', JSON.stringify(filteredDocs));
        
        toast.success('Examination report saved successfully');
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Failed to save examination report:', error);
      toast.error('Failed to save examination report');
    } finally {
      setSaving(false);
    }
  };
  
  // Helper: convert tab-separated text into an HTML table
  const tabDataToTable = (text, headers = []) => {
    if (!text || !text.trim()) return '';
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length === 0) return '';
    
    // Determine column count from first line
    const firstLineCols = lines[0].split('\t').length;
    
    let html = '<table>\n';
    
    // If headers provided, add header row
    if (headers.length > 0) {
      html += '  <tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>\n';
    }
    
    // Data rows
    lines.forEach((line, idx) => {
      const cols = line.split('\t');
      // If first line looks like a header (no numbers at start), treat as header
      const isHeader = idx === 0 && headers.length === 0 && !/^\d+/.test(cols[0]) && cols.length > 1;
      if (isHeader) {
        html += '  <tr>' + cols.map(c => `<th>${c.trim()}</th>`).join('') + '</tr>\n';
      } else {
        html += '  <tr>' + cols.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>\n';
      }
    });
    
    html += '</table>\n';
    return html;
  };
  
  // Helper: convert bullet-point text into numbered list items
  const bulletToNumberedList = (text) => {
    if (!text || !text.trim()) return '';
    // Split by ● or • or \n\n to get items
    const items = text.split(/[●•]\s*/).filter(i => i.trim());
    if (items.length <= 1) {
      // Try splitting by double newline
      const altItems = text.split('\n\n').filter(i => i.trim());
      if (altItems.length > 1) {
        let html = '<ol>\n';
        altItems.forEach(item => {
          const clean = item.replace(/^[●•]\s*/, '').trim();
          if (clean) html += `  <li>${clean}</li>\n`;
        });
        html += '</ol>\n';
        return html;
      }
      return `<p>${text.replace(/\n/g, '<br/>')}</p>`;
    }
    let html = '<ol>\n';
    items.forEach(item => {
      const clean = item.replace(/^[●•]\s*/, '').trim();
      if (clean) html += `  <li>${clean}</li>\n`;
    });
    html += '</ol>\n';
    return html;
  };

  // Helper to generate the document HTML content (used by both save and export)
  const generateDocContent = () => {
    const termLabel = termOptions.find(t => t.value === formData.term)?.label || `Term ${formData.term}`;
    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Examination Report</title>
<style>
  @page { size: A4; margin: 2cm 2.5cm; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.6; color: #1a1a1a; background: white; }
  .logo-container { text-align: center; margin-bottom: 20px; }
  .logo-img { max-width: 120px; max-height: 120px; }
  .school-header { text-align: center; margin-bottom: 30px; }
  .school-name { font-size: 26pt; font-weight: bold; text-transform: uppercase; color: #1a1a1a; letter-spacing: 1px; }
  .school-motto { font-size: 14pt; font-style: italic; color: #555; margin: 8px 0; }
  .school-contact { font-size: 10pt; color: #666; line-height: 1.8; }
  .report-title { text-align: center; font-size: 18pt; font-weight: bold; margin: 50px 0 15px 0; text-transform: uppercase; color: #1a1a1a; letter-spacing: 0.5px; }
  .report-date { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 40px; color: #1a1a1a; }
  .prepared-by { text-align: center; font-size: 12pt; margin-bottom: 50px; color: #1a1a1a; line-height: 2; }
  .prepared-by .role { font-weight: bold; }
  .prepared-by .name { font-weight: bold; text-decoration: underline; }
  .cover-note { text-align: center; font-size: 11pt; margin-bottom: 40px; color: #444; font-style: italic; }
  .section-title { font-size: 16pt; font-weight: bold; text-transform: uppercase; margin: 35px 0 15px 0; border-bottom: 3px solid #1a1a1a; padding-bottom: 8px; color: #1a1a1a; letter-spacing: 0.5px; }
  .section-content { margin-bottom: 20px; white-space: pre-wrap; color: #1a1a1a; text-align: justify; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 11pt; }
  th, td { border: 1.5px solid #333; padding: 10px 12px; text-align: left; color: #1a1a1a; }
  th { background: #d4d4d4; font-weight: bold; text-align: center; font-size: 11pt; }
  tr:nth-child(even) { background: #f5f5f5; }
  tr:nth-child(odd) { background: #ffffff; }
  .grade-scale { margin: 15px 0; padding: 15px; background: #f9f9f9; border-left: 4px solid #333; }
  .findings-subsection { font-weight: bold; font-size: 13pt; margin: 20px 0 10px 0; color: #1a1a1a; }
  .page-break { page-break-before: always; }
  .most-passed-failed { margin: 20px 0; }
  .most-passed-failed th { background: #2c3e50; color: white; font-size: 11pt; }
  .most-passed-failed td { text-align: center; font-weight: bold; font-size: 12pt; padding: 12px; }
  .general-error { background: #fff8e1; border: 2px solid #f9a825; padding: 18px; margin: 20px 0; font-weight: bold; color: #1a1a1a; border-radius: 4px; }
  ol { margin: 15px 0; padding-left: 30px; }
  ol li { margin-bottom: 10px; text-align: justify; line-height: 1.6; }
  .numbered-list { margin: 15px 0; }
  .numbered-list .list-item { margin-bottom: 12px; text-align: justify; line-height: 1.6; padding-left: 5px; }
</style></head>
<body>
${formData.logoPreview ? `<div class="logo-container"><img src="${formData.logoPreview}" class="logo-img" /></div>` : ''}
<div class="school-header">
  <div class="school-name">${schoolName}</div>
  <div class="school-motto">Everyone is an achiever</div>
  <div class="school-contact">Tel: +255 678 436 080 Email: denizprimary@gmail.com P.O.BOX 2254, Magogoni – Zanzibar.</div>
</div>
<div class="report-title">${termLabel.toUpperCase()} - EXAMINATION REPORT - ${formData.termMonth}</div>
<div class="report-date">${formData.examDate}</div>
<div class="prepared-by">
  PREPARED BY:<br/>
  <span class="role">${formData.preparedByRole.toUpperCase()},</span><br/>
  <span class="name">${formData.preparedBy.toUpperCase()}</span>
</div>
<div class="cover-note">${formData.coverPageNote}</div>
<div class="page-break"></div>
<div class="section-title">CONTENTS</div>
<div class="section-content">${formData.contents.replace(/\\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;').replace(/\\n/g, '<br/>')}</div>
<div class="page-break"></div>
<div class="section-title">INTRODUCTION</div>
<div class="section-content">${formData.introduction.replace(/\\n/g, '<br/>')}</div>
<div class="grade-scale"><strong>Grades that were used:</strong><br/>${formData.gradeScale.replace(/\\n/g, '<br/>')}</div>
<div class="page-break"></div>
<div class="section-title">SUMMARY</div>
<div class="section-content">${formData.summaryNote.replace(/\\n/g, '<br/>')}</div>
${tabDataToTable(formData.summaryClasses, ['CLASSES', 'BOYS', 'GIRLS', 'TOTAL'])}
<div class="page-break"></div>
<div class="section-title">FINDINGS</div>
<div class="findings-subsection">A) SUBJECT AVERAGES, GRADES AND POSITION:</div>
<div class="section-content">${formData.findingsANote.replace(/\\n/g, '<br/>')}</div>
${dynamicClassNames.length > 0 
  ? dynamicClassNames.map((clsName, idx) => {
      const fieldKey = `subjectAverages_${idx}`;
      const tableData = formData[fieldKey] || '';
      return tabDataToTable(tableData, ['NO.', 'SUBJECTS', clsName]);
    }).join('\n')
  : `
${tabDataToTable(formData.subjectAveragesGrade5A, ['NO.', 'SUBJECTS', 'GRADE 5-A'])}
${tabDataToTable(formData.subjectAveragesGrade5B, ['NO.', 'SUBJECTS', 'GRADE 5-B'])}
${tabDataToTable(formData.subjectAveragesGrade6, ['NO.', 'SUBJECTS', 'GRADE 6'])}
`}
<div class="findings-subsection">B) CLASS AVERAGE, GRADE AND POSITION:</div>
<div class="section-content">${formData.findingsBNote.replace(/\\n/g, '<br/>')}</div>
${tabDataToTable(formData.classAverages, ['NO.', 'CLASSES', 'AV - GR - POS'])}
<div class="findings-subsection">C) SCHOOL PERFORMANCE: SUBJECT WISE</div>
${tabDataToTable(formData.schoolPerformanceSubjectWise, ['NO.', 'SUBJECTS', 'AVERAGE', 'GRADE', 'POSITION'])}
<div class="most-passed-failed"><table><tr><th>MOST PASSED SUBJECT</th><th>MOST FAILED SUBJECT</th><th>OVERALL SCHOOL PERFORMANCE</th></tr><tr><td>${formData.mostPassedSubject}</td><td>${formData.mostFailedSubject}</td><td>${formData.overallSchoolPerformance}</td></tr></table></div>
<div class="findings-subsection">D) MOST FAILED QUESTIONS AND REASONS:</div>
<div class="findings-subsection">GRADE 5 A&B</div>
${tabDataToTable(formData.failedQuestionsGrade5AB, ['SUBJECTS', 'QUESTION(S) NUMBER', 'PART OF TOPICS', 'REASON(S)'])}
<div class="findings-subsection">GRADE 6</div>
${tabDataToTable(formData.failedQuestionsGrade6, ['SUBJECTS', 'QUESTION(S) NUMBER', 'PART OF TOPICS', 'REASON(S)'])}
<div class="findings-subsection">E) EXAMS AND MARKING SCHEMES ERRORS:</div>
<div class="findings-subsection">PART 1: EXAMS ERRORS</div>
<div class="section-content">${formData.examErrors.replace(/\\n/g, '<br/>')}</div>
<div class="findings-subsection">PART 2: MARKING SCHEMES ERRORS</div>
${tabDataToTable(formData.markingSchemeErrors, ['CLASSES', 'SUBJECTS', 'QUESTIONS', 'ERRORS'])}
<div class="general-error">${formData.generalError.replace(/\\n/g, '<br/>')}</div>
<div class="page-break"></div>
<div class="section-title">CONCLUSION</div>
<div class="numbered-list">${bulletToNumberedList(formData.conclusion)}</div>
<div class="page-break"></div>
<div class="section-title">RECOMMENDATIONS</div>
<div class="numbered-list">${bulletToNumberedList(formData.recommendations)}</div>
</body></html>`;
  };

  // Load available filter options from saved reports
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const response = await fetch(`${API_URL}/api/examination-reports?chain=${currentUser?.chain || 'IHEZA'}`, {
          headers: getAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            const years = [...new Set(data.map(r => r.year).filter(Boolean))].sort().reverse();
            const months = [...new Set(data.map(r => r.termMonth).filter(Boolean))];
            const dates = [...new Set(data.map(r => r.examDate).filter(Boolean))];
            const names = [...new Set(data.map(r => r.preparedBy).filter(Boolean))];
            const roles = [...new Set(data.map(r => r.preparedByRole).filter(Boolean))];
            setAvailableYears(years);
            setAvailableTermMonths(months);
            setAvailableExamDates(dates);
            setAvailablePreparedBy(names);
            setAvailablePreparedByRoles(roles);
          }
        }
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    };
    loadFilterOptions();
  }, []);

  const loadSavedReports = async () => {
    try {
      const response = await fetch(`${API_URL}/api/examination-reports?chain=${currentUser?.chain || 'IHEZA'}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setSavedReports(data);
        setShowSavedList(true);
      }
    } catch (error) {
      console.error('Failed to load saved reports:', error);
      toast.error('Failed to load saved reports');
    }
  };

  const loadReport = async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/examination-reports/${id}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({
          ...prev,
          ...data,
          logoPreview: data.schoolLogo || null,
        }));
        setSelectedReportId(id);
        setShowSavedList(false);
        toast.success('Report loaded');
      }
    } catch (error) {
      console.error('Failed to load report:', error);
      toast.error('Failed to load report');
    }
  };

  const handleExportDoc = () => {
    const docContent = generateDocContent();
    const blob = new Blob([docContent], { type: 'application/msword' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const termLabelShort = termOptions.find(t => t.value === formData.term)?.label.replace(' ', '_') || `Term_${formData.term}`;
    a.download = `Examination_Report_${schoolName}_${termLabelShort}_${formData.year}.doc`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Report exported as Word document');
  };

  const handleNewReport = () => {
    setFormData(prev => ({
      ...prev,
      year: new Date().getFullYear().toString(),
      term: '2',
      termMonth: 'NOVEMBER',
      examDate: '4TH NOVEMBER, 2025.',
      preparedBy: preparedBy,
      preparedByRole: userRole,
      schoolLogo: null,
      logoPreview: null,
    }));
    setSelectedReportId(null);
    toast.success('New report form ready');
  };

  // Generate ALL data from the system (grades, classes, students) for the selected term/year
  const handleGenerateAllData = async () => {
    try {
      setGeneratingAll(true);
      toast.info('Fetching examination data from system...');
      
      const response = await fetch(`${API_URL}/api/examination-reports/generate-data?chain=${currentUser?.chain || 'IHEZA'}&term=${formData.term}&year=${formData.year}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const d = result.data;
          const updates = {};
          
          // Update summary classes if data exists
          if (d.summaryClasses) updates.summaryClasses = d.summaryClasses;
          
          // Update subject averages per class - dynamically handle ALL classes
          if (d.subjectTableFields) {
            // Store the dynamic class names for rendering
            setDynamicClassNames(d.classNames || []);
            // Apply each subject table field to the form data
            Object.keys(d.subjectTableFields).forEach(key => {
              updates[key] = d.subjectTableFields[key];
            });
          } else if (d.subjectTables) {
            // Fallback: use classNames array
            const classNames = d.classNames || [];
            setDynamicClassNames(classNames);
            classNames.forEach((clsName, idx) => {
              const fieldKey = `subjectAverages_${idx}`;
              updates[fieldKey] = d.subjectTables[clsName] || '';
            });
          }
          
          // Update class averages
          if (d.classAverages) updates.classAverages = d.classAverages;
          
          // Update school performance
          if (d.schoolPerformanceSubjectWise) updates.schoolPerformanceSubjectWise = d.schoolPerformanceSubjectWise;
          
          // Update most passed/failed/overall
          if (d.mostPassedSubject) updates.mostPassedSubject = d.mostPassedSubject;
          if (d.mostFailedSubject) updates.mostFailedSubject = d.mostFailedSubject;
          if (d.overallSchoolPerformance) updates.overallSchoolPerformance = d.overallSchoolPerformance;
          
          setFormData(prev => ({ ...prev, ...updates }));
          toast.success('All data generated from system successfully!');
        } else {
          toast.error(result.error || 'No data returned from system');
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || 'Generation failed');
      }
    } catch (error) {
      console.error('Failed to generate all data:', error);
      toast.error(`Failed to generate data: ${error.message}`);
    } finally {
      setGeneratingAll(false);
    }
  };

  // Generate data for a specific section by calling the backend AI endpoint
  const handleGenerateData = async (section) => {
    try {
      setGeneratingSection(section);
      toast.info(`Generating ${section} data...`);
      
      const response = await fetch(`${API_URL}/api/examination-reports/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          section,
          year: formData.year,
          term: formData.term,
          termMonth: formData.termMonth,
          schoolName: schoolName,
          chain: currentUser?.chain || 'IHEZA',
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.content) {
          handleInputChange(section, data.content);
          toast.success(`${section} data generated successfully`);
        } else {
          toast.error('No data returned from generation');
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || 'Generation failed');
      }
    } catch (error) {
      console.error(`Failed to generate ${section}:`, error);
      toast.error(`Failed to generate ${section}: ${error.message}`);
    } finally {
      setGeneratingSection(null);
    }
  };

  const renderTextarea = (field, label, rows = 6, className = '', showGenerate = false) => (
    <div className="form-group">
      <div className="form-label-row">
        <label className="form-label">{label}</label>
        {showGenerate && (
          <button
            className="btn btn-generate btn-xs"
            onClick={() => handleGenerateData(field)}
            disabled={generatingSection !== null}
            title={`Generate ${label} content`}
          >
            <Sparkles size={12} /> {generatingSection === field ? '...' : 'Generate'}
          </button>
        )}
      </div>
      <textarea
        className={`form-textarea ${className}`}
        rows={rows}
        value={formData[field] || ''}
        onChange={(e) => handleInputChange(field, e.target.value)}
      />
    </div>
  );

  const SavedReportsModal = () => {
    if (!showSavedList) return null;
    return (
      <div className="modal-overlay" onClick={() => setShowSavedList(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title">Saved Examination Reports</h3>
            <button className="modal-close" onClick={() => setShowSavedList(false)}>&times;</button>
          </div>
          <div className="modal-body">
            {savedReports.length === 0 ? (
              <div className="empty-state">No saved reports found</div>
            ) : (
              <div className="saved-list">
                {savedReports.map((report) => (
                  <div key={report._id || report.id} className="saved-item" onClick={() => loadReport(report._id || report.id)}>
                    <div className="saved-item-icon"><FileText size={24} /></div>
                    <div className="saved-item-info">
                      <div className="saved-item-title">{schoolName} - {termOptions.find(t => t.value === report.term)?.label || `Term ${report.term}`} {report.year}</div>
                      <div className="saved-item-meta">{report.termMonth} {report.year} | Prepared by: {report.preparedBy}</div>
                    </div>
                    <button className="btn btn-sm btn-primary">Load</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="examination-reports-page">
      <style>{`
        .examination-reports-page { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
        .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
        .page-title { font-size: 1.5rem; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 0.75rem; }
        .page-title-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .header-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.625rem 1rem; border-radius: 0.5rem; font-weight: 500; cursor: pointer; transition: all 0.2s; border: none; font-size: 0.875rem; }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-sm { padding: 0.375rem 0.75rem; font-size: 0.8rem; }
        .btn-primary { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; }
        .btn-primary:hover:not(:disabled) { background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); }
        .btn-success { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; }
        .btn-success:hover:not(:disabled) { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); }
        .btn-secondary { background: rgba(51, 65, 85, 0.5); color: #f8fafc; border: 1px solid rgba(71, 85, 105, 0.5); }
        .btn-secondary:hover:not(:disabled) { background: rgba(51, 65, 85, 0.8); }
        .btn-warning { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; }
        .btn-warning:hover:not(:disabled) { background: linear-gradient(135deg, #d97706 0%, #b45309 100%); }
        .btn-info { background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; }
        .btn-info:hover:not(:disabled) { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); }
        .form-container { background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 1rem; padding: 2rem; }
        .form-section { margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 1px solid rgba(51, 65, 85, 0.5); }
        .form-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .form-section-title { font-size: 1.1rem; font-weight: 700; color: #a78bfa; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
        .form-group { margin-bottom: 1rem; }
        .form-label { display: block; font-size: 0.75rem; font-weight: 600; color: #94a3b8; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .form-input, .form-select { width: 100%; padding: 0.75rem; background: rgba(51, 65, 85, 0.5); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.5rem; color: #f8fafc; font-size: 0.875rem; transition: border-color 0.2s; }
        .form-input:focus, .form-select:focus { outline: none; border-color: #8b5cf6; }
        .form-select option { background: #1e293b; color: #f8fafc; }
        .form-textarea { width: 100%; padding: 0.75rem; background: rgba(51, 65, 85, 0.5); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.5rem; color: #f8fafc; font-size: 0.875rem; min-height: 100px; resize: vertical; font-family: 'Courier New', monospace; line-height: 1.6; transition: border-color 0.2s; }
        .form-textarea:focus { outline: none; border-color: #8b5cf6; }
        .logo-upload-area { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: rgba(51, 65, 85, 0.3); border: 2px dashed rgba(71, 85, 105, 0.5); border-radius: 0.75rem; cursor: pointer; transition: all 0.2s; }
        .logo-upload-area:hover { border-color: #8b5cf6; background: rgba(51, 65, 85, 0.5); }
        .logo-preview { width: 80px; height: 80px; border-radius: 0.5rem; overflow: hidden; background: rgba(51, 65, 85, 0.5); display: flex; align-items: center; justify-content: center; }
        .logo-preview img { width: 100%; height: 100%; object-fit: contain; }
        .logo-placeholder { color: #64748b; font-size: 0.8rem; text-align: center; }
        .school-info-card { background: rgba(51, 65, 85, 0.3); border-radius: 0.75rem; padding: 1.25rem; margin-bottom: 1rem; }
        .school-info-card .school-name-display { font-size: 1.25rem; font-weight: 700; color: #f8fafc; }
        .school-info-card .school-motto-display { font-size: 0.9rem; font-style: italic; color: #94a3b8; }
        .school-info-card .school-contact-display { font-size: 0.8rem; color: #64748b; margin-top: 0.25rem; }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: #1e293b; border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 1rem; width: 90%; max-width: 600px; max-height: 80vh; overflow-y: auto; padding: 1.5rem; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
        .modal-title { font-size: 1.1rem; font-weight: 700; color: #f8fafc; }
        .modal-close { background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer; padding: 0.25rem; line-height: 1; }
        .modal-close:hover { color: #f8fafc; }
        .modal-body { }
        .empty-state { text-align: center; padding: 2rem; color: #64748b; }
        .saved-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .saved-item { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: rgba(51, 65, 85, 0.3); border-radius: 0.75rem; cursor: pointer; transition: all 0.2s; }
        .saved-item:hover { background: rgba(51, 65, 85, 0.6); }
        .saved-item-icon { width: 48px; height: 48px; background: rgba(139, 92, 246, 0.2); border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; color: #a78bfa; flex-shrink: 0; }
        .saved-item-info { flex: 1; min-width: 0; }
        .saved-item-title { font-weight: 600; color: #f8fafc; font-size: 0.9rem; }
        .saved-item-meta { font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; }
        .report-status { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
        .report-status.saved { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
        .report-status.new { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
        .form-help-text { font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; font-style: italic; }
        .findings-subsection-label { font-size: 0.85rem; font-weight: 600; color: #c4b5fd; margin: 0.75rem 0 0.5rem 0; }
        .form-label-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; }
        .form-label-row .form-label { margin-bottom: 0; }
        .btn-xs { padding: 0.25rem 0.5rem; font-size: 0.7rem; border-radius: 0.375rem; }
        .btn-generate { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; }
        .btn-generate:hover:not(:disabled) { background: linear-gradient(135deg, #d97706 0%, #b45309 100%); }
        .btn-generate:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-generate-all { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; display: flex; align-items: center; gap: 0.5rem; padding: 0.625rem 1rem; border-radius: 0.5rem; font-weight: 500; cursor: pointer; transition: all 0.2s; border: none; font-size: 0.875rem; }
        .btn-generate-all:hover:not(:disabled) { background: linear-gradient(135deg, #059669 0%, #047857 100%); }
        .btn-generate-all:disabled { opacity: 0.6; cursor: not-allowed; }
        .inline-fields-row { display: flex; gap: 1rem; flex-wrap: wrap; }
        .inline-field { flex: 1; min-width: 150px; }
        .inline-field .form-input { }
      `}</style>

      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon"><FileText size={20} /></div>
          Examination Reports
        </div>
        <div className="header-actions">
          <button className="btn btn-info" onClick={loadSavedReports}>
            <List size={16} /> Load Saved
          </button>
          <button className="btn btn-warning" onClick={handleNewReport}>
            <RefreshCw size={16} /> New Report
          </button>
          <button className="btn btn-generate-all" onClick={handleGenerateAllData} disabled={generatingAll}>
            <Sparkles size={16} /> {generatingAll ? 'Generating...' : 'Generate All from System'}
          </button>
          <button className="btn btn-success" onClick={handleSave} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : selectedReportId ? 'Update' : 'Save'}
          </button>
          <button className="btn btn-primary" onClick={handleExportDoc}>
            <Download size={16} /> Export .doc
          </button>
        </div>
      </div>

      <div className="form-container">
        {/* School Info & Logo Section */}
        <div className="form-section">
          <div className="form-section-title">
            <School size={18} /> School Information
          </div>
          <div className="school-info-card">
            <div className="school-name-display">{schoolName}</div>
            <div className="school-motto-display">Everyone is an achiever</div>
            <div className="school-contact-display">Tel: +255 678 436 080 Email: denizprimary@gmail.com P.O.BOX 2254, Magogoni - Zanzibar.</div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">School Logo</label>
              <div className="logo-upload-area" onClick={() => fileInputRef.current?.click()}>
                <div className="logo-preview">
                  {formData.logoPreview ? (
                    <img src={formData.logoPreview} alt="School Logo" />
                  ) : (
                    <div className="logo-placeholder"><Upload size={24} /><br/>Upload Logo</div>
                  )}
                </div>
                <div>
                  <div style={{fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem'}}>Click to upload school logo</div>
                  <div style={{fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem'}}>PNG, JPG or SVG recommended</div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{display: 'none'}} onChange={handleLogoUpload} />
              </div>
            </div>
          </div>
        </div>

        {/* Report Meta Section */}
        <div className="form-section">
          <div className="form-section-title">
            <Calendar size={18} /> Report Details
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Year</label>
              <select
                className="form-select"
                value={formData.year}
                onChange={(e) => handleInputChange('year', e.target.value)}
              >
                {availableYears.length > 0 ? availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                )) : (
                  <>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </>
                )}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Term</label>
              <select
                className="form-select"
                value={formData.term}
                onChange={(e) => handleInputChange('term', e.target.value)}
              >
                {termOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Term Month</label>
              <select
                className="form-select"
                value={formData.termMonth}
                onChange={(e) => handleInputChange('termMonth', e.target.value)}
              >
                <option value="JANUARY">JANUARY</option>
                <option value="FEBRUARY">FEBRUARY</option>
                <option value="MARCH">MARCH</option>
                <option value="APRIL">APRIL</option>
                <option value="MAY">MAY</option>
                <option value="JUNE">JUNE</option>
                <option value="JULY">JULY</option>
                <option value="AUGUST">AUGUST</option>
                <option value="SEPTEMBER">SEPTEMBER</option>
                <option value="OCTOBER">OCTOBER</option>
                <option value="NOVEMBER">NOVEMBER</option>
                <option value="DECEMBER">DECEMBER</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Exam Date</label>
              <input
                type="date"
                className="form-input"
                value={formData.examDateRaw || ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw) {
                    const d = new Date(raw + 'T00:00:00');
                    const day = d.getDate();
                    const monthNames = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
                    const month = monthNames[d.getMonth()];
                    const year = d.getFullYear();
                    const suffix = day === 1 ? 'ST' : day === 2 ? 'ND' : day === 3 ? 'RD' : 'TH';
                    const formatted = `${day}${suffix} ${month}, ${year}.`;
                    handleInputChange('examDateRaw', raw);
                    handleInputChange('examDate', formatted);
                    handleInputChange('termMonth', month);
                  } else {
                    handleInputChange('examDateRaw', '');
                    handleInputChange('examDate', '');
                  }
                }}
              />
              {formData.examDate && (
                <div className="form-help-text">Formatted: {formData.examDate}</div>
              )}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Prepared By (Name)</label>
              <select
                className="form-select"
                value={formData.preparedBy}
                onChange={(e) => handleInputChange('preparedBy', e.target.value)}
              >
                {availablePreparedBy.length > 0 ? availablePreparedBy.map(n => (
                  <option key={n} value={n}>{n}</option>
                )) : (
                  <>
                    <option value="Ahmed Ally">Ahmed Ally</option>
                    <option value="MR. AHMED ALLY MOHAMED">MR. AHMED ALLY MOHAMED</option>
                  </>
                )}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Prepared By (Role)</label>
              <select
                className="form-select"
                value={formData.preparedByRole}
                onChange={(e) => handleInputChange('preparedByRole', e.target.value)}
              >
                {availablePreparedByRoles.length > 0 ? availablePreparedByRoles.map(r => (
                  <option key={r} value={r}>{r}</option>
                )) : (
                  <>
                    <option value="academic">Academic</option>
                    <option value="ACADEMIC TEACHER">ACADEMIC TEACHER</option>
                    <option value="principal">Principal</option>
                    <option value="teacher">Teacher</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Cover Page & Contents Section */}
        <div className="form-section">
          <div className="form-section-title">
            <BookOpen size={18} /> Cover Page & Contents
          </div>
          {renderTextarea('coverPageNote', 'Cover Page Note', 2)}
          {renderTextarea('contents', 'Contents (use tabs for alignment)', 8)}
        </div>

        {/* Introduction Section */}
        <div className="form-section">
          <div className="form-section-title">
            <BookOpen size={18} /> Introduction
          </div>
          {renderTextarea('introduction', 'Introduction Text', 6, '', true)}
          {renderTextarea('gradeScale', 'Grade Scale', 6, '', true)}
        </div>

        {/* Summary Section */}
        <div className="form-section">
          <div className="form-section-title">
            <BookOpen size={18} /> Summary
          </div>
          {renderTextarea('summaryNote', 'Summary Note', 4)}
          {renderTextarea('summaryClasses', 'Summary Classes Table (use tabs)', 8, '', true)}
        </div>

        {/* Findings Section */}
        <div className="form-section">
          <div className="form-section-title">
            <BookOpen size={18} /> Findings
          </div>

          <div className="findings-subsection-label">A) SUBJECT AVERAGES, GRADES AND POSITION:</div>
          {renderTextarea('findingsANote', 'Findings A Note', 3)}
          {/* Dynamically render subject average sections for ALL classes */}
          {dynamicClassNames.length > 0 ? (
            dynamicClassNames.map((clsName, idx) => {
              const fieldKey = `subjectAverages_${idx}`;
              return renderTextarea(fieldKey, `Subject Averages - ${clsName}`, 10, '', true);
            })
          ) : (
            <>
              {renderTextarea('subjectAveragesGrade5A', 'Subject Averages - Grade 5-A', 10, '', true)}
              {renderTextarea('subjectAveragesGrade5B', 'Subject Averages - Grade 5-B', 10, '', true)}
              {renderTextarea('subjectAveragesGrade6', 'Subject Averages - Grade 6', 10, '', true)}
            </>
          )}

          <div className="findings-subsection-label">B) CLASS AVERAGE, GRADE AND POSITION:</div>
          {renderTextarea('findingsBNote', 'Findings B Note', 3)}
          {renderTextarea('classAverages', 'Class Averages Table', 6, '', true)}

          <div className="findings-subsection-label">C) SCHOOL PERFORMANCE: SUBJECT WISE</div>
          {renderTextarea('schoolPerformanceSubjectWise', 'School Performance Subject Wise', 10, '', true)}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Most Passed Subject</label>
              <input
                type="text"
                className="form-input"
                value={formData.mostPassedSubject}
                onChange={(e) => handleInputChange('mostPassedSubject', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Most Failed Subject</label>
              <input
                type="text"
                className="form-input"
                value={formData.mostFailedSubject}
                onChange={(e) => handleInputChange('mostFailedSubject', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Overall School Performance</label>
              <input
                type="text"
                className="form-input"
                value={formData.overallSchoolPerformance}
                onChange={(e) => handleInputChange('overallSchoolPerformance', e.target.value)}
              />
            </div>
          </div>

          <div className="findings-subsection-label">D) MOST FAILED QUESTIONS AND REASONS:</div>
          {renderTextarea('failedQuestionsGrade5AB', 'Failed Questions - Grade 5 A&B', 12)}
          {renderTextarea('failedQuestionsGrade6', 'Failed Questions - Grade 6', 12)}

          <div className="findings-subsection-label">E) EXAMS AND MARKING SCHEMES ERRORS:</div>
          {renderTextarea('examErrors', 'Part 1: Exams Errors', 8)}
          {renderTextarea('markingSchemeErrors', 'Part 2: Marking Schemes Errors', 6)}
          {renderTextarea('generalError', 'General Error', 4)}
        </div>

        {/* Conclusion Section */}
        <div className="form-section">
          <div className="form-section-title">
            <BookOpen size={18} /> Conclusion
          </div>
          {renderTextarea('conclusion', 'Conclusion', 12)}
        </div>

        {/* Recommendations Section */}
        <div className="form-section">
          <div className="form-section-title">
            <BookOpen size={18} /> Recommendations
          </div>
          {renderTextarea('recommendations', 'Recommendations', 14)}
        </div>
      </div>

      <SavedReportsModal />
    </div>
  );
}

export default ExaminationReports;
