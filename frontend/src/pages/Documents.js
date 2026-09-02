import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { Upload, File, Image, FileText, Trash2, Download, Eye, X, BarChart3, TrendingUp, Users, FolderOpen, Calendar, Award, Search, RefreshCw, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { API_URL } from '../config/api';
import ChainToggle from '../components/ChainToggle';

const Documents = () => {
  const currentUser = useSelector(selectCurrentUser);
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewType, setPreviewType] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'projects', 'report_cards', 'analytics', 'examination_reports'
  const [examReportFilter, setExamReportFilter] = useState({ year: '', term: '' });
  const [projectCaption, setProjectCaption] = useState(''); // Caption for project pic uploads
  const [selectedChain, setSelectedChain] = useState('');

  const [filterSource, setFilterSource] = useState(null); // Clickable filter from analytics
  const [filterTeacher, setFilterTeacher] = useState(null); // Clickable filter from analytics
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const fileInputRef = useRef(null);
  
  // Only principals can upload, delete, or clear documents
  const canManageDocuments = currentUser?.role?.toLowerCase() === 'principal';

  // Load documents from backend API and localStorage on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    // Always load from localStorage first (this has all docs including report cards, lesson plans, etc.)
    const saved = localStorage.getItem('iheza_documents');
    let localDocs = [];
    if (saved) {
      try {
        localDocs = JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing local documents:', e);
      }
    }

    // Also try to load from backend API and merge
    const token = localStorage.getItem('sessionToken');
    if (token) {
      try {
        const response = await fetch(`${API_URL}/api/documents`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const backendDocs = await response.json();
          
          // Merge: start with local docs, add backend docs that don't exist locally
          const mergedDocs = [...localDocs];
          for (const backendDoc of backendDocs) {
            const exists = mergedDocs.find(d => 
              d.id === backendDoc.id || 
              (d.name === backendDoc.name && d.size === backendDoc.size)
            );
            if (!exists) {
              mergedDocs.push(backendDoc);
            }
          }
          setDocuments(mergedDocs);
          return;
        }
      } catch (err) {
        console.error('Error loading from backend:', err);
      }
    }

    // Fallback to localStorage only
    if (localDocs.length > 0) {
      setDocuments(localDocs);
    }
  };

  // Save documents to localStorage
  const saveDocuments = (docs) => {
    localStorage.setItem('iheza_documents', JSON.stringify(docs));
    setDocuments(docs);
  };

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return <Image size={24} className="text-blue-500" />;
    if (type.includes('pdf')) return <FileText size={24} className="text-red-500" />;
    if (type.includes('word') || type.includes('document')) return <FileText size={24} className="text-blue-700" />;
    return <File size={24} className="text-gray-500" />;
  };

  const getFileTypeLabel = (type) => {
    if (type.startsWith('image/jpeg')) return 'JPEG';
    if (type.startsWith('image/png')) return 'PNG';
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('word') || type.includes('document')) return 'Word';
    return type;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newDocs = [...documents];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Determine if this is a project pic upload (from the Projects tab)
      const isProjectUpload = activeTab === 'projects';
      
      // Validate file type
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/jpg',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        alert(`File type ${file.type} is not supported. Please upload JPEG, PNG, PDF, or Word documents only.`);
        continue;
      }

      // Validate file size
      // Project pics are limited to 1MB; other files max 10MB
      const maxSize = isProjectUpload ? 1 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(`File ${file.name} is too large. Maximum size is ${isProjectUpload ? '1MB' : '10MB'}.`);
        continue;
      }

      try {
        // For project pics, resize the image to 100x100 px before saving
        let base64;
        if (isProjectUpload && file.type.startsWith('image/')) {
          base64 = await resizeImageTo100px(file);
        } else {
          base64 = await fileToBase64(file);
        }
        // Determine document category based on the active tab.
        // When uploading from the "Examination Reports" tab, categorize the file
        // as an examination report so it appears in the Examination Reports
        // component/tab instead of the Projects (uploaded files) tab.
        const isExamReportUpload = activeTab === 'examination_reports';
        const docData = {
          id: Date.now() + '_' + i,
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64,
          source: isExamReportUpload ? 'examination_report' : 'upload',
          uploaded_by: currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.email || 'Unknown' : localStorage.getItem('userName') || 'Unknown',
          uploadedAt: new Date().toISOString(),
          ...(isProjectUpload && {
            isProjectPic: true,
            caption: projectCaption.trim() || '',
            metadata: {
              caption: projectCaption.trim() || '',
              teacher: currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.email || 'Unknown' : 'Unknown',
              uploadedFrom: 'projects'
            }
          }),
          ...(isExamReportUpload && {
            chain: currentUser?.chain || localStorage.getItem('userChain') || 'IHEZA',
            metadata: {
              year: new Date().getFullYear().toString(),
              term: examReportFilter.term || '',
              termLabel: examReportFilter.term ? (examReportFilter.term === '1' ? 'First Term' : examReportFilter.term === '2' ? 'Second Term' : examReportFilter.term === '3' ? 'Third Term' : 'Final') : '',
              schoolName: currentUser?.school_name || currentUser?.school || currentUser?.chain || 'IHEZA',
              preparedBy: currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.email || 'Unknown' : 'Unknown',
              uploadedFrom: 'documents'
            }
          })
        };
        newDocs.push(docData);



        // Also upload to backend API for persistence
        try {
          const token = localStorage.getItem('sessionToken');
          if (token) {
            await fetch(`${API_URL}/api/documents`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(docData)
            });
          }
        } catch (backendErr) {
          console.warn('Backend upload failed, saved locally only:', backendErr);
        }
      } catch (err) {
        console.error('Error reading file:', err);
        alert(`Error reading file ${file.name}`);
      }
    }

    saveDocuments(newDocs);
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Resize an image file to 100x100 px (used for project pics)
  const resizeImageTo100px = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        // Use window.Image explicitly because `Image` is imported from lucide-react (icon)
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 100;
          canvas.height = 100;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 100, 100);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };


  const deleteDocument = (id) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      // Find the document to move to bin
      const docToBin = documents.find(doc => doc.id === id);
      if (docToBin) {
        // Add to bin with metadata
        const binItem = {
          id: 'bin_' + docToBin.id,
          original_id: docToBin.id,
          item_type: 'documents',
          item_summary: docToBin.name,
          item_data: docToBin,
          deleted_by: { name: localStorage.getItem('userName') || 'Unknown' },
          deleted_at: new Date().toISOString()
        };
        
        // Save to bin in localStorage
        const existingBin = JSON.parse(localStorage.getItem('iheza_bin') || '[]');
        existingBin.push(binItem);
        localStorage.setItem('iheza_bin', JSON.stringify(existingBin));
      }
      
      // Remove from documents
      const filtered = documents.filter(doc => doc.id !== id);
      saveDocuments(filtered);
      if (previewUrl) {
        setPreviewUrl(null);
        setPreviewType(null);
      }
    }
  };

  const downloadDocument = (doc) => {
    const link = document.createElement('a');
    link.href = doc.data;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const previewDocument = (doc) => {
    // For examination reports stored with metadata only (no full HTML content),
    // regenerate the HTML from the stored form data
    if (doc.source === 'examination_report' && (!doc.data || doc.data === null) && doc.metadata?.formData) {
      const fd = doc.metadata.formData;
      const termOptions = [
        { value: '1', label: 'First Term' },
        { value: '2', label: 'Second Term' },
        { value: '3', label: 'Third Term' },
        { value: 'final', label: 'Final' },
      ];
      const termLabel = termOptions.find(t => t.value === fd.term)?.label || `Term ${fd.term}`;
      
      // Helper: convert tab-separated text into an HTML table
      const tabDataToTable = (text, headers = []) => {
        if (!text || !text.trim()) return '';
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length === 0) return '';
        let html = '<table>\n';
        if (headers.length > 0) {
          html += '  <tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>\n';
        }
        lines.forEach((line, idx) => {
          const cols = line.split('\t');
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
        const items = text.split(/[●•]\s*/).filter(i => i.trim());
        if (items.length <= 1) {
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
      
      // Determine dynamic class names from stored formData
      const dynamicClassNames = [];
      if (fd) {
        // First check if dynamicClassNames was stored directly
        if (fd.dynamicClassNames && Array.isArray(fd.dynamicClassNames) && fd.dynamicClassNames.length > 0) {
          dynamicClassNames.push(...fd.dynamicClassNames);
        } else {
          // Fallback: check for dynamic class name fields (subjectAverages_0, subjectAverages_1, etc.)
          for (let i = 0; i < 50; i++) {
            if (fd[`subjectAverages_${i}`] !== undefined) {
              dynamicClassNames.push(`Class ${i + 1}`);
            } else {
              break;
            }
          }
        }
      }
      
      const schoolName = doc.metadata.schoolName || 'DENIZ PRIMARY SCHOOL';
      const htmlContent = `<!DOCTYPE html>
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
${fd.logoPreview ? `<div class="logo-container"><img src="${fd.logoPreview}" class="logo-img" /></div>` : ''}
<div class="school-header">
  <div class="school-name">${schoolName}</div>
  <div class="school-motto">Everyone is an achiever</div>
  <div class="school-contact">Tel: +255 678 436 080 Email: denizprimary@gmail.com P.O.BOX 2254, Magogoni – Zanzibar.</div>
</div>
<div class="report-title">${termLabel.toUpperCase()} - EXAMINATION REPORT - ${fd.termMonth}</div>
<div class="report-date">${fd.examDate}</div>
<div class="prepared-by">
  PREPARED BY:<br/>
  <span class="role">${(fd.preparedByRole || '').toUpperCase()},</span><br/>
  <span class="name">${(fd.preparedBy || '').toUpperCase()}</span>
</div>
<div class="cover-note">${fd.coverPageNote || ''}</div>
<div class="page-break"></div>
<div class="section-title">CONTENTS</div>
<div class="section-content">${(fd.contents || '').replace(/\\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;').replace(/\\n/g, '<br/>')}</div>
<div class="page-break"></div>
<div class="section-title">INTRODUCTION</div>
<div class="section-content">${(fd.introduction || '').replace(/\\n/g, '<br/>')}</div>
<div class="grade-scale"><strong>Grades that were used:</strong><br/>${(fd.gradeScale || '').replace(/\\n/g, '<br/>')}</div>
<div class="page-break"></div>
<div class="section-title">SUMMARY</div>
<div class="section-content">${(fd.summaryNote || '').replace(/\\n/g, '<br/>')}</div>
${tabDataToTable(fd.summaryClasses, ['CLASSES', 'BOYS', 'GIRLS', 'TOTAL'])}
<div class="page-break"></div>
<div class="section-title">FINDINGS</div>
<div class="findings-subsection">A) SUBJECT AVERAGES, GRADES AND POSITION:</div>
<div class="section-content">${(fd.findingsANote || '').replace(/\\n/g, '<br/>')}</div>
${dynamicClassNames.length > 0 
  ? dynamicClassNames.map((clsName, idx) => {
      const fieldKey = `subjectAverages_${idx}`;
      const tableData = fd[fieldKey] || '';
      return tabDataToTable(tableData, ['NO.', 'SUBJECTS', clsName]);
    }).join('\n')
  : `
${tabDataToTable(fd.subjectAveragesGrade5A, ['NO.', 'SUBJECTS', 'GRADE 5-A'])}
${tabDataToTable(fd.subjectAveragesGrade5B, ['NO.', 'SUBJECTS', 'GRADE 5-B'])}
${tabDataToTable(fd.subjectAveragesGrade6, ['NO.', 'SUBJECTS', 'GRADE 6'])}
`}
<div class="findings-subsection">B) CLASS AVERAGE, GRADE AND POSITION:</div>
<div class="section-content">${(fd.findingsBNote || '').replace(/\\n/g, '<br/>')}</div>
${tabDataToTable(fd.classAverages, ['NO.', 'CLASSES', 'AV - GR - POS'])}
<div class="findings-subsection">C) SCHOOL PERFORMANCE: SUBJECT WISE</div>
${tabDataToTable(fd.schoolPerformanceSubjectWise, ['NO.', 'SUBJECTS', 'AVERAGE', 'GRADE', 'POSITION'])}
<div class="most-passed-failed"><table><tr><th>MOST PASSED SUBJECT</th><th>MOST FAILED SUBJECT</th><th>OVERALL SCHOOL PERFORMANCE</th></tr><tr><td>${fd.mostPassedSubject || ''}</td><td>${fd.mostFailedSubject || ''}</td><td>${fd.overallSchoolPerformance || ''}</td></tr></table></div>
<div class="findings-subsection">D) MOST FAILED QUESTIONS AND REASONS:</div>
<div class="findings-subsection">GRADE 5 A&B</div>
${tabDataToTable(fd.failedQuestionsGrade5AB, ['SUBJECTS', 'QUESTION(S) NUMBER', 'PART OF TOPICS', 'REASON(S)'])}
<div class="findings-subsection">GRADE 6</div>
${tabDataToTable(fd.failedQuestionsGrade6, ['SUBJECTS', 'QUESTION(S) NUMBER', 'PART OF TOPICS', 'REASON(S)'])}
<div class="findings-subsection">E) EXAMS AND MARKING SCHEMES ERRORS:</div>
<div class="findings-subsection">PART 1: EXAMS ERRORS</div>
<div class="section-content">${(fd.examErrors || '').replace(/\\n/g, '<br/>')}</div>
<div class="findings-subsection">PART 2: MARKING SCHEMES ERRORS</div>
${tabDataToTable(fd.markingSchemeErrors, ['CLASSES', 'SUBJECTS', 'QUESTIONS', 'ERRORS'])}
<div class="general-error">${(fd.generalError || '').replace(/\\n/g, '<br/>')}</div>
<div class="page-break"></div>
<div class="section-title">CONCLUSION</div>
<div class="numbered-list">${bulletToNumberedList(fd.conclusion)}</div>
<div class="page-break"></div>
<div class="section-title">RECOMMENDATIONS</div>
<div class="numbered-list">${bulletToNumberedList(fd.recommendations)}</div>
</body></html>`;
      
      const dataUri = 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(htmlContent)));
      setPreviewUrl(dataUri);
      setPreviewType('word');
      return;
    }
    
    if (doc.type.startsWith('image/')) {
      setPreviewUrl(doc.data);
      setPreviewType('image');
    } else if (doc.type.includes('pdf')) {
      setPreviewUrl(doc.data);
      setPreviewType('pdf');
    } else if (doc.type.includes('word') || doc.type.includes('document') || doc.type.includes('msword')) {
      let isRealDocx = false;
      try {
        if (doc.data && typeof doc.data === 'string' && doc.data.startsWith('data:') && doc.data.includes('base64,')) {
          const decoded = atob(doc.data.split('base64,')[1] || '');
          isRealDocx = decoded.startsWith('PK');
        }
      } catch(e) {
        isRealDocx = false;
      }
      
      if (isRealDocx) {
        setPreviewUrl(doc.data);
        setPreviewType('docx');
      } else {
        setPreviewUrl(doc.data);
        setPreviewType('word');
      }
    } else {
      try {
        const base64 = doc.data?.split('base64,')[1];
        const decoded = base64 ? atob(base64) : '';
        if (decoded.startsWith('<!DOCTYPE') || decoded.startsWith('<html') || decoded.startsWith('<')) {
          setPreviewUrl(doc.data);
          setPreviewType('word');
        } else {
          setPreviewUrl(null);
          setPreviewType('binary');
        }
      } catch(e) {
        setPreviewUrl(null);
        setPreviewType('binary');
      }
    }
  };



  const clearAllDocuments = () => {
    if (documents.length === 0) return;
    if (window.confirm('Delete all documents? This cannot be undone.')) {
      saveDocuments([]);
      setPreviewUrl(null);
      setPreviewType(null);
    }
  };

  // ============ ANALYTICS FUNCTIONS ============

  const getAnalytics = (docs) => {
    // Use provided docs (chain-filtered) or fall back to all documents
    const targetDocs = docs || documents;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Get current term (approximate: Jan-Apr=T1, May-Aug=T2, Sep-Dec=T3)
    const getTerm = (date) => {
      const m = date.getMonth();
      if (m >= 0 && m <= 3) return 1;
      if (m >= 4 && m <= 7) return 2;
      return 3;
    };
    const currentTerm = getTerm(now);

    // Get start of current week (Monday)
    const getWeekStart = (date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const weekStart = getWeekStart(now);

    // Separate projects (uploaded files) from auto-saved documents
    const projects = targetDocs.filter(d => d.source === 'upload');
    const autoDocs = targetDocs.filter(d => d.source !== 'upload');

    // Counts
    const totalDocs = targetDocs.length;
    const totalProjects = projects.length;
    const totalAutoDocs = autoDocs.length;

    // This week
    const thisWeek = targetDocs.filter(d => {
      const dDate = new Date(d.uploadedAt);
      return dDate >= weekStart;
    }).length;

    // This month
    const thisMonth = targetDocs.filter(d => {
      const dDate = new Date(d.uploadedAt);
      return dDate.getMonth() === currentMonth && dDate.getFullYear() === currentYear;
    }).length;

    // This term
    const thisTerm = targetDocs.filter(d => {
      const dDate = new Date(d.uploadedAt);
      return getTerm(dDate) === currentTerm && dDate.getFullYear() === currentYear;
    }).length;

    // This year
    const thisYear = targetDocs.filter(d => {
      const dDate = new Date(d.uploadedAt);
      return dDate.getFullYear() === currentYear;
    }).length;

    // Monthly breakdown for chart
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyCounts = months.map((_, idx) => 
      targetDocs.filter(d => {
        const dDate = new Date(d.uploadedAt);
        return dDate.getMonth() === idx && dDate.getFullYear() === currentYear;
      }).length
    );

    // Source breakdown
    const sourceCounts = {};
    targetDocs.forEach(d => {
      const src = d.source || 'upload';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });

    // Teacher breakdown (from metadata or uploaded_by)
    const teacherCounts = {};
    targetDocs.forEach(d => {
      const teacher = d.metadata?.teacher || d.uploaded_by || 'Unknown';
      teacherCounts[teacher] = (teacherCounts[teacher] || 0) + 1;
    });

    // Sort teachers by count (descending)
    const sortedTeachers = Object.entries(teacherCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    // Project teacher breakdown
    const projectTeacherCounts = {};
    projects.forEach(d => {
      const teacher = d.metadata?.teacher || d.uploaded_by || 'Unknown';
      projectTeacherCounts[teacher] = (projectTeacherCounts[teacher] || 0) + 1;
    });

    const sortedProjectTeachers = Object.entries(projectTeacherCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    // Chain/School breakdown
    const chainCounts = {};
    targetDocs.forEach(d => {
      const chain = d.chain || 'Unassigned';
      chainCounts[chain] = (chainCounts[chain] || 0) + 1;
    });

    const sortedChains = Object.entries(chainCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    // Per-chain source breakdown
    const chainSourceBreakdown = {};
    targetDocs.forEach(d => {
      const chain = d.chain || 'Unassigned';
      const src = d.source || 'upload';
      if (!chainSourceBreakdown[chain]) {
        chainSourceBreakdown[chain] = {};
      }
      chainSourceBreakdown[chain][src] = (chainSourceBreakdown[chain][src] || 0) + 1;
    });

    return {
      totalDocs,
      totalProjects,
      totalAutoDocs,
      thisWeek,
      thisMonth,
      thisTerm,
      thisYear,
      monthlyCounts,
      months,
      sourceCounts,
      sortedTeachers,
      sortedProjectTeachers,
      projects,
      autoDocs,
      sortedChains,
      chainSourceBreakdown
    };
  };

  // ============ RENDER ANALYTICS ============

  const renderAnalytics = () => (
    <div style={{ padding: '20px 0' }}>
      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {[
          { label: 'Total Documents', value: analytics.totalDocs, icon: <FolderOpen size={20} />, gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
          { label: 'This Week', value: analytics.thisWeek, icon: <Calendar size={20} />, gradient: 'linear-gradient(135deg, #22c55e, #16a34a)' },
          { label: 'This Month', value: analytics.thisMonth, icon: <TrendingUp size={20} />, gradient: 'linear-gradient(135deg, #a855f7, #7c3aed)' },
          { label: 'This Term', value: analytics.thisTerm, icon: <BarChart3 size={20} />, gradient: 'linear-gradient(135deg, #f97316, #ea580c)' },
          { label: 'This Year', value: analytics.thisYear, icon: <Award size={20} />, gradient: 'linear-gradient(135deg, #ef4444, #dc2626)' },
        ].map((card, idx) => (
          <div key={idx} style={{
            background: card.gradient,
            borderRadius: '12px',
            padding: '20px',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 15px rgba(0,0,0,0.15)'
          }}>
            <div style={{ position: 'absolute', top: '12px', right: '12px', opacity: 0.3 }}>
              {card.icon}
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>
              {card.value}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Trends Chart */}
      <div style={{
        background: 'rgba(30,41,59,0.8)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        border: '1px solid rgba(148,163,184,0.1)'
      }}>
        <h3 style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '600', margin: '0 0 16px 0' }}>
          <TrendingUp size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Monthly Submission Trends ({new Date().getFullYear()})
        </h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '160px', padding: '0 4px' }}>
          {analytics.months.map((month, idx) => {
            const maxVal = Math.max(...analytics.monthlyCounts, 1);
            const height = (analytics.monthlyCounts[idx] / maxVal) * 140;
            return (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{
                  fontSize: '10px',
                  color: '#94a3b8',
                  marginBottom: '4px',
                  fontWeight: analytics.monthlyCounts[idx] > 0 ? '600' : '400'
                }}>
                  {analytics.monthlyCounts[idx] || ''}
                </div>
                <div style={{
                  width: '100%',
                  height: `${Math.max(height, 4)}px`,
                  background: analytics.monthlyCounts[idx] > 0 
                    ? 'linear-gradient(180deg, #3b82f6, #1d4ed8)' 
                    : 'rgba(148,163,184,0.15)',
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.3s ease',
                  minHeight: analytics.monthlyCounts[idx] > 0 ? '4px' : '2px'
                }} />
                <div style={{ fontSize: '9px', color: '#64748b', marginTop: '4px' }}>{month}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Source Breakdown + Teacher Ranking */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Source Breakdown */}
        <div style={{
          background: 'rgba(30,41,59,0.8)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid rgba(148,163,184,0.1)'
        }}>
          <h3 style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0' }}>
            <FileText size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Document Sources
          </h3>
          {Object.entries(analytics.sourceCounts).length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No data yet</p>
          ) : (
            Object.entries(analytics.sourceCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([source, count]) => {
                const total = analytics.totalDocs || 1;
                const pct = Math.round((count / total) * 100);
                const colors = {
                  'upload': '#3b82f6',
                  'lesson_plan': '#22c55e',
                  'scheme_of_work': '#a855f7',
                  'subject_evaluation': '#f97316',
                  'assessment': '#ef4444',
                  'report_card': '#06b6d4'
                };
                const labels = {
                  'upload': 'Uploaded Files',
                  'lesson_plan': 'Lesson Plans',
                  'scheme_of_work': 'Scheme of Work',
                  'subject_evaluation': 'Subject Evaluations',
                  'assessment': 'Assessments',
                  'report_card': 'Report Cards'
                };
                const color = colors[source] || '#64748b';
                const label = labels[source] || source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return (
                  <div 
                    key={source} 
                    style={{ marginBottom: '10px', cursor: 'pointer' }}
                    onClick={() => { setFilterSource(source); setFilterTeacher(null); setActiveTab('all'); }}
                    title={`Click to view ${label.toLowerCase()}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: '#cbd5e1' }}>{label}</span>
                      <span style={{ color: '#94a3b8' }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ background: 'rgba(148,163,184,0.15)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                );
              })
          )}
        </div>

        {/* Teacher Ranking */}
        <div style={{
          background: 'rgba(30,41,59,0.8)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid rgba(148,163,184,0.1)'
        }}>
          <h3 style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0' }}>
            <Users size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Teacher Submission Ranking
          </h3>
          {analytics.sortedTeachers.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No teacher data yet</p>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', padding: '0 4px 8px 4px', borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
                <span>#</span>
                <span style={{ flex: 1, marginLeft: '8px' }}>Teacher</span>
                <span>Count</span>
                <span style={{ width: '50px', textAlign: 'right' }}>%</span>
              </div>
              {analytics.sortedTeachers.map((t, idx) => {
                const pct = Math.round((t.count / analytics.totalDocs) * 100);
                const isTop = idx === 0;
                const isBottom = idx === analytics.sortedTeachers.length - 1 && analytics.sortedTeachers.length > 1;
                return (
                  <div key={t.name} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 4px',
                    borderBottom: '1px solid rgba(148,163,184,0.08)',
                    fontSize: '12px',
                    background: isTop ? 'rgba(34,197,94,0.08)' : isBottom ? 'rgba(239,68,68,0.08)' : 'transparent',
                    borderRadius: '4px',
                    marginTop: '2px',
                    cursor: 'pointer'
                  }}
                    onClick={() => { setFilterTeacher(t.name); setFilterSource(null); setActiveTab('all'); }}
                    title={`Click to view ${t.name === 'Unknown' ? 'Not Assigned' : t.name}'s documents`}
                  >
                    <span style={{ color: '#64748b', width: '24px', fontWeight: isTop ? '700' : '400' }}>
                      {isTop ? '🥇' : isBottom ? '📉' : idx + 1}
                    </span>
                    <span style={{ flex: 1, color: '#e2e8f0', marginLeft: '4px', fontWeight: isTop ? '600' : '400' }}>
                      {t.name === 'Unknown' ? 'Not Assigned' : t.name}
                    </span>
                    <span style={{ color: '#94a3b8', fontWeight: '600' }}>{t.count}</span>
                    <span style={{ width: '50px', textAlign: 'right', color: '#64748b', fontSize: '11px' }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Projects Analytics Section */}
      <div style={{
        background: 'rgba(30,41,59,0.8)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid rgba(148,163,184,0.1)'
      }}>
        <h3 style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '600', margin: '0 0 16px 0' }}>
          <FolderOpen size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Projects Analytics (Uploaded Files)
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: 'rgba(59,130,246,0.15)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#60a5fa' }}>{analytics.totalProjects}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Total Projects</div>
          </div>
          <div style={{ background: 'rgba(34,197,94,0.15)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#4ade80' }}>{analytics.totalAutoDocs}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Auto-Saved Docs</div>
          </div>
          <div style={{ background: 'rgba(168,85,247,0.15)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#c084fc' }}>{analytics.totalDocs}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Grand Total</div>
          </div>
        </div>

        {analytics.sortedProjectTeachers.length > 0 ? (
          <div>
            <h4 style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', margin: '0 0 10px 0' }}>
              Teacher Ranking (Projects)
            </h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', padding: '0 4px 8px 4px', borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
              <span>#</span>
              <span style={{ flex: 1, marginLeft: '8px' }}>Teacher</span>
              <span>Projects</span>
              <span style={{ width: '50px', textAlign: 'right' }}>%</span>
            </div>
            {analytics.sortedProjectTeachers.map((t, idx) => {
              const pct = Math.round((t.count / analytics.totalProjects) * 100);
              const isTop = idx === 0;
              const isBottom = idx === analytics.sortedProjectTeachers.length - 1 && analytics.sortedProjectTeachers.length > 1;
              return (
                <div key={t.name} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 4px',
                  borderBottom: '1px solid rgba(148,163,184,0.08)',
                  fontSize: '12px',
                  background: isTop ? 'rgba(34,197,94,0.08)' : isBottom ? 'rgba(239,68,68,0.08)' : 'transparent',
                  borderRadius: '4px',
                  marginTop: '2px'
                }}>
                  <span style={{ color: '#64748b', width: '24px', fontWeight: isTop ? '700' : '400' }}>
                    {isTop ? '🥇' : isBottom ? '📉' : idx + 1}
                  </span>
                  <span style={{ flex: 1, color: '#e2e8f0', marginLeft: '4px', fontWeight: isTop ? '600' : '400' }}>
                    {t.name === 'Unknown' ? 'Not Assigned' : t.name}
                  </span>
                  <span style={{ color: '#94a3b8', fontWeight: '600' }}>{t.count}</span>
                  <span style={{ width: '50px', textAlign: 'right', color: '#64748b', fontSize: '11px' }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
            No uploaded projects yet. Upload files to see project analytics.
          </p>
        )}
      </div>

      {/* Chain/School Comparison - visible for Director/Coordinator roles */}
      {['director', 'coordinator'].includes(currentUser?.role?.toLowerCase()) && analytics.sortedChains.length > 0 && (
        <div style={{
          background: 'rgba(30,41,59,0.8)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid rgba(148,163,184,0.1)',
          marginTop: '20px'
        }}>
          <h3 style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '600', margin: '0 0 16px 0' }}>
            <Award size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Chain/School Comparison
          </h3>
          
          {/* Chain summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {analytics.sortedChains.map((chain, idx) => {
              const chainColors = {
                'DUP': '#3b82f6',
                'DLP': '#22c55e',
                'LALE': '#a855f7',
                'OLGUN': '#f97316',
                'Unassigned': '#64748b'
              };
              const color = chainColors[chain.name] || '#64748b';
              const pct = Math.round((chain.count / analytics.totalDocs) * 100);
              return (
                <div key={chain.name} style={{
                  background: `${color}15`,
                  borderRadius: '10px',
                  padding: '16px',
                  border: `1px solid ${color}30`,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {chain.name === 'Unassigned' ? 'Unassigned' : chain.name}
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: color }}>{chain.count}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{pct}% of total</div>
                </div>
              );
            })}
          </div>

          {/* Per-chain source breakdown table */}
          {Object.keys(analytics.chainSourceBreakdown).length > 0 && (
            <div>
              <h4 style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', margin: '0 0 10px 0' }}>
                Document Type Breakdown by Chain
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '11px'
                }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', fontWeight: '600' }}>Chain</th>
                      {Object.keys(analytics.sourceCounts).sort().map(src => {
                        const labels = {
                          'upload': 'Uploaded',
                          'lesson_plan': 'Lesson Plans',
                          'scheme_of_work': 'Scheme of Work',
                          'subject_evaluation': 'Subject Eval',
                          'assessment': 'Assessments',
                          'report_card': 'Report Cards'
                        };
                        return (
                          <th key={src} style={{ textAlign: 'center', padding: '8px 8px', borderBottom: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', fontWeight: '500', fontSize: '10px' }}>
                            {labels[src] || src}
                          </th>
                        );
                      })}
                      <th style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', fontWeight: '600' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.sortedChains.map((chain, idx) => {
                      const chainColors = {
                        'DUP': '#3b82f6',
                        'DLP': '#22c55e',
                        'LALE': '#a855f7',
                        'OLGUN': '#f97316',
                        'Unassigned': '#64748b'
                      };
                      const color = chainColors[chain.name] || '#64748b';
                      const breakdown = analytics.chainSourceBreakdown[chain.name] || {};
                      return (
                        <tr key={chain.name} style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '600', color: color }}>{chain.name}</td>
                          {Object.keys(analytics.sourceCounts).sort().map(src => (
                            <td key={src} style={{ textAlign: 'center', padding: '10px 8px', color: '#e2e8f0' }}>
                              {breakdown[src] || 0}
                            </td>
                          ))}
                          <td style={{ textAlign: 'center', padding: '10px 12px', fontWeight: '600', color: '#e2e8f0' }}>
                            {chain.count}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ============ GENERATE REPORT (Principal only) ============

  const generateReport = () => {
    const now = new Date();
    const reportDate = now.toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    
    // Build teacher ranking table rows
    const teacherRows = analytics.sortedTeachers.map((t, idx) => {
      const pct = Math.round((t.count / analytics.totalDocs) * 100);
      const rank = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
      return `
        <tr${idx === 0 ? ' style="background: #f0fdf4;"' : idx === analytics.sortedTeachers.length - 1 && analytics.sortedTeachers.length > 1 ? ' style="background: #fef2f2;"' : ''}>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${rank}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: ${idx === 0 ? '700' : '400'}">${t.name === 'Unknown' ? 'Not Assigned' : t.name}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600;">${t.count}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${pct}%</td>
        </tr>`;
    }).join('');

    // Build source breakdown rows
    const sourceRows = Object.entries(analytics.sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => {
        const pct = Math.round((count / analytics.totalDocs) * 100);
        const labels = {
          'upload': 'Uploaded Files',
          'lesson_plan': 'Lesson Plans',
          'scheme_of_work': 'Scheme of Work',
          'subject_evaluation': 'Subject Evaluations',
          'assessment': 'Assessments',
          'report_card': 'Report Cards'
        };
        return `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${labels[source] || source}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600;">${count}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${pct}%</td>
          </tr>`;
      }).join('');

    // Build chain comparison rows
    const chainRows = analytics.sortedChains.map(chain => {
      const pct = Math.round((chain.count / analytics.totalDocs) * 100);
      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${chain.name}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600;">${chain.count}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${pct}%</td>
        </tr>`;
    }).join('');

    // Build report card summary (use chain-filtered docs)
    const reportCards = filteredDocs.filter(d => d.source === 'report_card');
    const reportCardByClass = {};
    reportCards.forEach(rc => {
      const cls = rc.metadata?.class || 'Unknown';
      reportCardByClass[cls] = (reportCardByClass[cls] || 0) + 1;
    });
    const reportCardRows = Object.entries(reportCardByClass)
      .sort((a, b) => b[1] - a[1])
      .map(([cls, count]) => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${cls}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600;">${count}</td>
        </tr>`).join('');

    // Find low submission teachers (bottom 3 or those with 0-1 submissions)
    const lowSubmissionTeachers = analytics.sortedTeachers
      .filter(t => t.count <= 1)
      .map(t => t.name === 'Unknown' ? 'Not Assigned' : t.name);

    // Detailed breakdown by document type per teacher
    const docTypeLabels = {
      'lesson_plan': 'Lesson Plans',
      'scheme_of_work': 'Schemes of Work',
      'assessment': 'Assessments',
      'subject_evaluation': 'Subject Evaluations',
      'report_card': 'Report Cards',
      'upload': 'Uploaded Files'
    };
    const docTypeKeys = ['lesson_plan', 'scheme_of_work', 'assessment', 'subject_evaluation', 'report_card', 'upload'];
    
    // Per-teacher per-document-type breakdown (use chain-filtered docs)
    const teacherDocBreakdown = {};
    filteredDocs.forEach(d => {
      const teacher = d.metadata?.teacher || d.uploaded_by || 'Unknown';
      const src = d.source || 'upload';
      if (!teacherDocBreakdown[teacher]) {
        teacherDocBreakdown[teacher] = {};
        docTypeKeys.forEach(k => { teacherDocBreakdown[teacher][k] = 0; });
      }
      teacherDocBreakdown[teacher][src] = (teacherDocBreakdown[teacher][src] || 0) + 1;
    });

    const teacherDetailRows = analytics.sortedTeachers.map((t, idx) => {
      const breakdown = teacherDocBreakdown[t.name] || {};
      const rank = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
      return `
        <tr${idx === 0 ? ' style="background: #f0fdf4;"' : idx === analytics.sortedTeachers.length - 1 && analytics.sortedTeachers.length > 1 ? ' style="background: #fef2f2;"' : ''}>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${rank}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: ${idx === 0 ? '700' : '400'}">${t.name === 'Unknown' ? 'Not Assigned' : t.name}</td>
          ${docTypeKeys.map(k => `<td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${breakdown[k] || 0}</td>`).join('')}
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 700;">${t.count}</td>
        </tr>`;
    }).join('');

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Documents Report - ${new Date().toLocaleDateString()}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; margin: 0; padding: 30px; }
    h1 { font-size: 22pt; font-weight: 700; color: #0f4c81; text-align: center; margin-bottom: 4px; }
    h2 { font-size: 14pt; font-weight: 600; color: #1e3a5f; border-bottom: 2px solid #0f4c81; padding-bottom: 6px; margin-top: 24px; }
    h3 { font-size: 12pt; font-weight: 600; color: #334155; margin-top: 16px; }
    .subtitle { text-align: center; color: #64748b; font-size: 10pt; margin-bottom: 24px; }
    .summary-grid { display: flex; gap: 12px; margin: 16px 0; flex-wrap: wrap; }
    .summary-card { flex: 1; min-width: 120px; padding: 16px; border-radius: 8px; text-align: center; color: white; }
    .summary-card .value { font-size: 24pt; font-weight: 700; }
    .summary-card .label { font-size: 9pt; opacity: 0.9; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th { background: #0f4c81; color: white; padding: 10px 12px; text-align: left; font-size: 10pt; }
    td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 2px solid #0f4c81; text-align: center; font-size: 9pt; color: #64748b; }
    .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 12px 0; }
    .alert-box h3 { color: #dc2626; margin: 0 0 8px 0; }
    .alert-box p { color: #7f1d1d; margin: 0; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9pt; font-weight: 600; }
    .badge-green { background: #22c55e; color: white; }
    .badge-yellow { background: #f59e0b; color: white; }
    .badge-red { background: #ef4444; color: white; }
  </style>
</head>
<body>
  <h1>📊 Documents Report</h1>
  <div class="subtitle">Generated on ${reportDate} | ${analytics.totalDocs} total documents</div>

  <h2>1. Executive Summary</h2>
  <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
    <tr>
      <td style="width: 20%; background: #3b82f6; padding: 16px; text-align: center; color: white; border-radius: 0;">
        <div style="font-size: 24pt; font-weight: 700;">${analytics.totalDocs}</div>
        <div style="font-size: 9pt; opacity: 0.9;">Total Documents</div>
      </td>
      <td style="width: 20%; background: #22c55e; padding: 16px; text-align: center; color: white;">
        <div style="font-size: 24pt; font-weight: 700;">${analytics.thisWeek}</div>
        <div style="font-size: 9pt; opacity: 0.9;">This Week</div>
      </td>
      <td style="width: 20%; background: #a855f7; padding: 16px; text-align: center; color: white;">
        <div style="font-size: 24pt; font-weight: 700;">${analytics.thisMonth}</div>
        <div style="font-size: 9pt; opacity: 0.9;">This Month</div>
      </td>
      <td style="width: 20%; background: #f97316; padding: 16px; text-align: center; color: white;">
        <div style="font-size: 24pt; font-weight: 700;">${analytics.thisTerm}</div>
        <div style="font-size: 9pt; opacity: 0.9;">This Term</div>
      </td>
      <td style="width: 20%; background: #ef4444; padding: 16px; text-align: center; color: white;">
        <div style="font-size: 24pt; font-weight: 700;">${analytics.thisYear}</div>
        <div style="font-size: 9pt; opacity: 0.9;">This Year</div>
      </td>
    </tr>
  </table>

  <h2>2. Document Type Distribution</h2>
  <table>
    <thead>
      <tr>
        <th>Document Type</th>
        <th style="text-align: center;">Count</th>
        <th style="text-align: center;">Percentage</th>
      </tr>
    </thead>
    <tbody>
      ${sourceRows}
      <tr style="background: #f1f5f9; font-weight: 700;">
        <td style="padding: 10px 12px;"><strong>Total</strong></td>
        <td style="padding: 10px 12px; text-align: center;">${analytics.totalDocs}</td>
        <td style="padding: 10px 12px; text-align: center;">100%</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Teacher Submission Ranking</h2>
  <table>
    <thead>
      <tr>
        <th style="text-align: center;">Rank</th>
        <th>Teacher</th>
        <th style="text-align: center;">Lesson Plans</th>
        <th style="text-align: center;">Schemes of Work</th>
        <th style="text-align: center;">Assessments</th>
        <th style="text-align: center;">Subject Eval</th>
        <th style="text-align: center;">Report Cards</th>
        <th style="text-align: center;">Uploaded Files</th>
        <th style="text-align: center;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${teacherDetailRows}
    </tbody>
  </table>

  ${analytics.sortedChains.length > 0 ? `
  <h2>4. Chain/School Comparison</h2>
  <table>
    <thead>
      <tr>
        <th>Chain</th>
        <th style="text-align: center;">Documents</th>
        <th style="text-align: center;">% of Total</th>
      </tr>
    </thead>
    <tbody>
      ${chainRows}
    </tbody>
  </table>
  ` : ''}

  ${reportCards.length > 0 ? `
  <h2>5. Report Card Summary</h2>
  <p>Total report cards generated: <strong>${reportCards.length}</strong></p>
  <table>
    <thead>
      <tr>
        <th>Class</th>
        <th style="text-align: center;">Report Cards</th>
      </tr>
    </thead>
    <tbody>
      ${reportCardRows}
    </tbody>
  </table>
  ` : ''}

  ${lowSubmissionTeachers.length > 0 ? `
  <h2>6. Low Submission Alerts</h2>
  <div class="alert-box">
    <h3>⚠️ Teachers with 0-1 Submissions</h3>
    <p>The following teachers have very few or no document submissions: <strong>${lowSubmissionTeachers.join(', ')}</strong></p>
  </div>
  ` : ''}

  <div class="footer">
    <p>Generated by IHEZA School Management System | ${reportDate}</p>
  </div>
</body>
</html>`;

    // Create downloadable blob
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Documents_Report_${now.toISOString().split('T')[0]}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ============ RENDER DOCUMENTS LIST (Excel-style table) ============

  const getDocTypeBadge = (type) => {
    if (type.startsWith('image/')) return { label: 'Image', cls: 'image' };
    if (type.includes('pdf')) return { label: 'PDF', cls: 'pdf' };
    if (type.includes('word') || type.includes('document')) return { label: 'Word', cls: 'word' };
    return { label: 'Other', cls: 'other' };
  };

  const getSourceBadge = (source) => {
    const labels = {
      'upload': 'Uploaded',
      'lesson_plan': 'Lesson Plan',
      'scheme_of_work': 'Scheme of Work',
      'subject_evaluation': 'Subject Eval',
      'assessment': 'Assessment',
      'report_card': 'Report Card',
      'examination_report': 'Exam Report'
    };
    const cls = source || 'other';
    return { label: labels[source] || (source || 'Other').replace(/_/g, ' '), cls };
  };

  const getDocIconClass = (type) => {
    if (type.startsWith('image/')) return 'image';
    if (type.includes('pdf')) return 'pdf';
    if (type.includes('word') || type.includes('document')) return 'word';
    return 'file';
  };

  const renderDocumentsList = (docs) => (
    docs.length === 0 ? (
      <div className="empty-state">
        <Upload size={48} />
        <h3>No documents yet</h3>
        <p>Click "Upload Documents" to add JPEG, PNG, PDF, or Word files</p>
      </div>
    ) : (
      <div className="excel-container">
        <table className="excel-table">
          <thead>
            <tr>
              <th className="col-id">#</th>
              <th className="col-name">Document</th>
              <th className="col-type">Type</th>
              <th className="col-source">Source</th>
              <th className="col-size">Size</th>
              <th className="col-uploaded">Uploaded By</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc, idx) => {
              const typeBadge = getDocTypeBadge(doc.type);
              const sourceBadge = getSourceBadge(doc.source);
              const iconCls = getDocIconClass(doc.type);
              const uploadedBy = doc.uploaded_by || doc.metadata?.teacher || 'Unknown';
              return (
                <tr key={doc.id}>
                  <td className="col-id">{(currentPage - 1) * pageSize + idx + 1}</td>
                  <td className="col-name">
                    <div className="doc-cell">
                      {doc.isProjectPic && doc.data ? (
                        <img
                          src={doc.data}
                          alt={doc.name}
                          style={{
                            width: '100px',
                            height: '100px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            flexShrink: 0
                          }}
                        />
                      ) : (
                        <div className={`icon ${iconCls}`}>
                          {iconCls === 'image' ? <Image size={16} /> : iconCls === 'pdf' ? <FileText size={16} /> : iconCls === 'word' ? <FileText size={16} /> : <File size={16} />}
                        </div>
                      )}
                      <div className="info">
                        <div className="name">{doc.name}</div>
                        {doc.caption && (
                          <div className="meta" style={{ color: '#7c3aed', fontWeight: '500' }}>
                            📝 {doc.caption}
                          </div>
                        )}
                        <div className="meta">
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                          {doc.chain && ` · ${doc.chain}`}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td><span className={`type-badge ${typeBadge.cls}`}>{typeBadge.label}</span></td>
                  <td><span className={`source-badge ${sourceBadge.cls}`}>{sourceBadge.label}</span></td>
                  <td>{formatFileSize(doc.size)}</td>
                  <td style={{ fontSize: '0.8rem' }}>{uploadedBy}</td>
                  <td className="col-actions">
                    <div className="action-group">
                      <button className="act-btn preview" onClick={() => previewDocument(doc)} title="Preview">
                        <Eye size={12} /> Preview
                      </button>
                      <button className="act-btn download" onClick={() => downloadDocument(doc)} title="Download">
                        <Download size={12} />
                      </button>
                      {canManageDocuments && (
                        <button className="act-btn delete" onClick={() => deleteDocument(doc.id)} title="Delete">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* Pagination */}
        <div className="pagination-bar">
          <span className="info">
            {docs.length} record(s) · page {currentPage} of {Math.max(1, Math.ceil(docs.length / pageSize))}
          </span>
          <div className="pages">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.max(1, Math.ceil(docs.length / pageSize)) }, (_, i) => i + 1).map(pg => (
              <button 
                key={pg}
                className={pg === currentPage ? 'active' : ''}
                onClick={() => setCurrentPage(pg)}
              >
                {pg}
              </button>
            ))}
            <button 
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(docs.length / pageSize), p + 1))}
              disabled={currentPage >= Math.ceil(docs.length / pageSize)}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  );

  // Filter documents based on active tab, chain, analytics filters, search, type, and source
  const filteredDocs = (() => {
    // First apply chain filter
    const chainFiltered = selectedChain
      ? documents.filter(d => d.chain === selectedChain)
      : documents;
    
    // Apply analytics source filter (when clicking from analytics tab)
    let sourceFiltered = chainFiltered;
    if (filterSource) {
      sourceFiltered = chainFiltered.filter(d => d.source === filterSource);
    }
    
    // Apply analytics teacher filter (when clicking from analytics tab)
    let teacherFiltered = sourceFiltered;
    if (filterTeacher) {
      teacherFiltered = sourceFiltered.filter(d => {
        const teacher = d.metadata?.teacher || d.uploaded_by || 'Unknown';
        return teacher === filterTeacher;
      });
    }
    
    // Apply search query filter
    let searchFiltered = teacherFiltered;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      searchFiltered = teacherFiltered.filter(d => 
        (d.name || '').toLowerCase().includes(q) ||
        (d.uploaded_by || '').toLowerCase().includes(q) ||
        (d.metadata?.teacher || '').toLowerCase().includes(q)
      );
    }
    
    // Apply type filter
    let typeFiltered = searchFiltered;
    if (typeFilter) {
      typeFiltered = searchFiltered.filter(d => {
        if (typeFilter === 'image') return d.type.startsWith('image/');
        if (typeFilter === 'pdf') return d.type.includes('pdf');
        if (typeFilter === 'word') return d.type.includes('word') || d.type.includes('document');
        return true;
      });
    }
    
    // Apply source filter
    let sourceFiltered2 = typeFiltered;
    if (sourceFilter) {
      sourceFiltered2 = typeFiltered.filter(d => d.source === sourceFilter);
    }
    
    // Then apply tab filter
    if (activeTab === 'projects') {
      return sourceFiltered2.filter(d => d.source === 'upload');
    } else if (activeTab === 'report_cards') {
      return sourceFiltered2.filter(d => d.source === 'report_card');
    } else if (activeTab === 'examination_reports') {
      let examDocs = sourceFiltered2.filter(d => d.source === 'examination_report');
      // Apply year filter
      if (examReportFilter.year) {
        examDocs = examDocs.filter(d => d.metadata?.year === examReportFilter.year);
      }
      // Apply term filter
      if (examReportFilter.term) {
        examDocs = examDocs.filter(d => d.metadata?.term === examReportFilter.term);
      }
      return examDocs;
    }
    return sourceFiltered2;
  })();
  
  // Apply pagination to filtered docs
  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDocs.slice(start, start + pageSize);
  }, [filteredDocs, currentPage, pageSize]);
  
  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, sourceFilter, activeTab, selectedChain, filterSource, filterTeacher]);
  // Show filter indicator when analytics filters are active
  const hasAnalyticsFilter = filterSource || filterTeacher;
  const getFilterLabel = () => {
    if (filterSource && filterTeacher) {
      const labels = {
        'upload': 'Uploaded Files',
        'lesson_plan': 'Lesson Plans',
        'scheme_of_work': 'Scheme of Work',
        'subject_evaluation': 'Subject Evaluations',
        'assessment': 'Assessments',
        'report_card': 'Report Cards'
      };
      return `${labels[filterSource] || filterSource} by ${filterTeacher === 'Unknown' ? 'Not Assigned' : filterTeacher}`;
    }
    if (filterSource) {
      const labels = {
        'upload': 'Uploaded Files',
        'lesson_plan': 'Lesson Plans',
        'scheme_of_work': 'Scheme of Work',
        'subject_evaluation': 'Subject Evaluations',
        'assessment': 'Assessments',
        'report_card': 'Report Cards'
      };
      return labels[filterSource] || filterSource;
    }
    if (filterTeacher) {
      return filterTeacher === 'Unknown' ? 'Not Assigned' : filterTeacher;
    }
    return '';
  };
  
  // Computed variable for examination reports count display
  const examReportsFiltered = (() => {
    const chainFiltered = selectedChain
      ? documents.filter(d => d.chain === selectedChain)
      : documents;
    let examDocs = chainFiltered.filter(d => d.source === 'examination_report');
    if (examReportFilter.year) {
      examDocs = examDocs.filter(d => d.metadata?.year === examReportFilter.year);
    }
    if (examReportFilter.term) {
      examDocs = examDocs.filter(d => d.metadata?.term === examReportFilter.term);
    }
    return examDocs;
  })();

  // Compute analytics from chain-filtered documents
  const analytics = getAnalytics(filteredDocs);

  return (
    <div className="documents-container">
      <style>{`
        .documents-container {
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .documents-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .documents-header h1 {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }
        .documents-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .upload-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #0284c7;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .upload-btn:hover {
          background: #0369a1;
        }
        .upload-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .clear-btn {
          padding: 10px 20px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .clear-btn:hover {
          background: #dc2626;
        }
        .report-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #059669;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .report-btn:hover {
          background: #047857;
        }
        .accepted-formats {
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
        }
        .documents-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .document-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          transition: all 0.2s;
          position: relative;
        }
        .document-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          border-color: #cbd5e1;
        }
        .document-icon {
          width: 48px;
          height: 48px;
          background: #f8fafc;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }
        .document-name {
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 4px;
          word-break: break-word;
          line-height: 1.3;
        }
        .document-meta {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 12px;
        }
        .document-actions {
          display: flex;
          gap: 8px;
        }
        .doc-action-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
          color: #475569;
        }
        .doc-action-btn:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }
        .doc-action-btn.delete:hover {
          background: #fef2f2;
          border-color: #fecaca;
          color: #dc2626;
        }
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border: 2px dashed #e2e8f0;
          border-radius: 16px;
        }
        .empty-state svg {
          margin: 0 auto 16px;
          color: #94a3b8;
        }
        .empty-state h3 {
          font-size: 18px;
          color: #475569;
          margin: 0 0 8px 0;
        }
        .empty-state p {
          font-size: 14px;
          color: #94a3b8;
          margin: 0;
        }
        .preview-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.8);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }
        .preview-content {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
        }
        .preview-content img {
          max-width: 100%;
          max-height: 85vh;
          border-radius: 8px;
          object-fit: contain;
        }
        .preview-content iframe {
          width: 80vw;
          height: 80vh;
          border: none;
          border-radius: 8px;
          background: white;
        }
        .preview-close {
          position: absolute;
          top: -40px;
          right: 0;
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .preview-close:hover {
          background: rgba(255,255,255,0.3);
        }
        .word-preview {
          width: 80vw;
          height: 80vh;
          background: white;
          border-radius: 8px;
          overflow: auto;
          padding: 20px;
        }
        .word-preview iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
        .tabs-container {
          display: flex;
          gap: 4px;
          margin-bottom: 20px;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 10px;
          width: fit-content;
        }
        .tab-btn {
          padding: 8px 20px;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          background: transparent;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .tab-btn:hover {
          color: #334155;
        }
        .tab-btn.active {
          background: white;
          color: #0284c7;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .tab-btn.active.analytics-tab {
          color: #7c3aed;
        }
        .tab-btn.active.projects-tab {
          color: #059669;
        }
        .analytics-section {
          background: #0f172a;
          border-radius: 16px;
          padding: 24px;
          margin-top: 8px;
        }
        .analytics-section h2 {
          color: #e2e8f0;
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 20px 0;
        }
        /* ---------- STATS COMPACT (ONE LINE) ---------- */
        .stats-compact {
          display: flex;
          align-items: center;
          gap: 0.3rem 1.2rem;
          flex-wrap: wrap;
          background: white;
          padding: 0.25rem 1rem;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          margin-bottom: 0.8rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .stats-compact .stat-item {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.1rem 0.2rem;
        }
        .stats-compact .stat-item .icon {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
        }
        .stats-compact .stat-item .icon.blue { background: #dbeafe; color: #2563eb; }
        .stats-compact .stat-item .icon.green { background: #d1fae5; color: #059669; }
        .stats-compact .stat-item .icon.purple { background: #ede9fe; color: #7c3aed; }
        .stats-compact .stat-item .icon.orange { background: #fef3c7; color: #d97706; }
        .stats-compact .stat-item .icon.red { background: #fee2e2; color: #dc2626; }
        .stats-compact .stat-item .num {
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.2;
        }
        .stats-compact .stat-item .label {
          font-size: 0.6rem;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-weight: 500;
        }
        .stats-compact .divider {
          color: #e2e8f0;
          font-size: 0.8rem;
        }
        /* ---------- FILTERS BAR ---------- */
        .filters-bar {
          display: flex;
          align-items: center;
          gap: 0.4rem 0.8rem;
          flex-wrap: nowrap;
          background: white;
          padding: 0.2rem 0.8rem;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          margin-bottom: 0.8rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          overflow-x: auto;
        }
        .filters-bar .search-wrap {
          flex: 1;
          min-width: 140px;
          max-width: 220px;
          position: relative;
          flex-shrink: 1;
        }
        .filters-bar .search-wrap input {
          width: 100%;
          padding: 0.25rem 0.4rem 0.25rem 1.8rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          color: #0f172a;
          font-size: 0.75rem;
          font-family: inherit;
          transition: all 0.2s ease;
        }
        .filters-bar .search-wrap input:focus {
          outline: none;
          border-color: #0284c7;
          box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.1);
        }
        .filters-bar .search-wrap .search-icon {
          position: absolute;
          left: 0.5rem;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          font-size: 0.65rem;
        }
        .filters-bar .filter-group {
          display: flex;
          align-items: center;
          gap: 0.2rem;
          flex-shrink: 0;
        }
        .filters-bar .filter-group .filter-label {
          font-size: 0.6rem;
          color: #64748b;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .filters-bar .filter-group select {
          padding: 0.2rem 0.5rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          color: #0f172a;
          font-size: 0.75rem;
          font-family: inherit;
          cursor: pointer;
          min-width: 70px;
          max-width: 110px;
        }
        .filters-bar .filter-group select:focus {
          outline: none;
          border-color: #0284c7;
        }
        .filters-bar .result-count {
          font-size: 0.7rem;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 0.3rem;
          flex-shrink: 0;
          margin-left: auto;
          white-space: nowrap;
        }
        /* ---------- EXCEL TABLE ---------- */
        .excel-container {
          overflow-x: auto;
          border-radius: 12px;
          border: 1px solid #d0d7e2;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .excel-table {
          width: 100%;
          border-collapse: collapse;
          font-family: inherit;
          font-size: 0.82rem;
          min-width: 1000px;
        }
        .excel-table thead th {
          background: #e8edf4;
          color: #1f3b5c;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.65rem;
          letter-spacing: 0.4px;
          padding: 0.5rem 0.7rem;
          border-right: 1px solid #d0d7e2;
          border-bottom: 2px solid #b8c6d8;
          text-align: left;
          white-space: nowrap;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .excel-table thead th:last-child {
          border-right: none;
        }
        .excel-table tbody td {
          padding: 0.4rem 0.7rem;
          border-right: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
          color: #1e2f3f;
          background: white;
        }
        .excel-table tbody td:last-child {
          border-right: none;
        }
        .excel-table tbody tr:nth-child(even) td {
          background: #f8faff;
        }
        .excel-table tbody tr:hover td {
          background: #e8f0fe;
        }
        .excel-table .col-id { width: 35px; text-align: center; }
        .excel-table .col-name { min-width: 180px; }
        .excel-table .col-type { width: 100px; }
        .excel-table .col-source { width: 120px; }
        .excel-table .col-size { width: 80px; }
        .excel-table .col-uploaded { width: 140px; }
        .excel-table .col-actions { width: 160px; }
        .doc-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .doc-cell .icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          flex-shrink: 0;
        }
        .doc-cell .icon.image { background: #dbeafe; color: #2563eb; }
        .doc-cell .icon.pdf { background: #fee2e2; color: #dc2626; }
        .doc-cell .icon.word { background: #dbeafe; color: #1d4ed8; }
        .doc-cell .icon.file { background: #f1f5f9; color: #64748b; }
        .doc-cell .info .name {
          font-weight: 600;
          color: #0f172a;
          font-size: 0.85rem;
        }
        .doc-cell .info .meta {
          font-size: 0.6rem;
          color: #94a3b8;
        }
        .type-badge {
          display: inline-block;
          padding: 0.05rem 0.4rem;
          border-radius: 20px;
          font-size: 0.6rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .type-badge.image { background: #dbeafe; color: #2563eb; }
        .type-badge.pdf { background: #fee2e2; color: #dc2626; }
        .type-badge.word { background: #dbeafe; color: #1d4ed8; }
        .type-badge.other { background: #f1f5f9; color: #64748b; }
        .source-badge {
          display: inline-block;
          padding: 0.05rem 0.4rem;
          border-radius: 20px;
          font-size: 0.6rem;
          font-weight: 600;
        }
        .source-badge.upload { background: #d1fae5; color: #059669; }
        .source-badge.lesson_plan { background: #ede9fe; color: #7c3aed; }
        .source-badge.scheme_of_work { background: #fef3c7; color: #d97706; }
        .source-badge.report_card { background: #dbeafe; color: #2563eb; }
        .source-badge.examination_report { background: #fce7f3; color: #db2777; }
        .source-badge.other { background: #f1f5f9; color: #64748b; }
        .action-group {
          display: flex;
          gap: 0.2rem;
          flex-wrap: wrap;
        }
        .action-group .act-btn {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          padding: 0.1rem 0.35rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          color: #64748b;
          font-size: 0.6rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
        }
        .action-group .act-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .action-group .act-btn.preview:hover {
          background: #dbeafe;
          color: #2563eb;
          border-color: #bfdbfe;
        }
        .action-group .act-btn.download:hover {
          background: #d1fae5;
          color: #059669;
          border-color: #a7f3d0;
        }
        .action-group .act-btn.delete:hover {
          background: #fee2e2;
          color: #dc2626;
          border-color: #fca5a5;
        }
        /* ---------- PAGINATION ---------- */
        .pagination-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          padding: 0.3rem 0.8rem;
          background: #f8faff;
          border-top: 1px solid #d0d7e2;
          border-radius: 0 0 12px 12px;
          font-size: 0.75rem;
          color: #1f3b5c;
        }
        .pagination-bar .info {
          color: #3f6490;
          font-size: 0.7rem;
        }
        .pagination-bar .pages {
          display: flex;
          gap: 0.15rem;
        }
        .pagination-bar .pages button {
          background: white;
          border: 1px solid #d0d7e2;
          padding: 0.1rem 0.5rem;
          border-radius: 4px;
          font-weight: 500;
          font-size: 0.65rem;
          color: #1f3b5c;
          cursor: pointer;
          transition: 0.1s;
          display: flex;
          align-items: center;
        }
        .pagination-bar .pages button:hover {
          background: #eef3fa;
        }
        .pagination-bar .pages button.active {
          background: #0284c7;
          color: white;
          border-color: #0284c7;
        }
        .pagination-bar .pages button:disabled {
          opacity: 0.4;
          cursor: default;
          background: #f0f3f8;
        }
        @media (max-width: 900px) {
          .filters-bar {
            flex-wrap: wrap;
            gap: 0.3rem 0.6rem;
          }
          .filters-bar .search-wrap {
            min-width: 120px;
            max-width: unset;
            flex: 1 1 100%;
          }
          .filters-bar .filter-group select {
            min-width: 60px;
            max-width: unset;
          }
        }
        @media (max-width: 768px) {
          .stats-compact { gap: 0.2rem 0.6rem; padding: 0.2rem 0.6rem; }
          .stats-compact .stat-item .num { font-size: 0.9rem; }
          .stats-compact .stat-item .label { font-size: 0.5rem; }
          .stats-compact .stat-item .icon { width: 22px; height: 22px; font-size: 0.6rem; }
          .filters-bar { padding: 0.3rem 0.6rem; }
          .excel-table { min-width: 850px; font-size: 0.75rem; }
          .excel-table thead th,
          .excel-table tbody td { padding: 0.3rem 0.4rem; }
          .action-group .act-btn { font-size: 0.5rem; padding: 0.1rem 0.25rem; }
        }
      `}</style>

      {/* Header */}
      <div className="documents-header">
        <h1>Documents</h1>
        <div className="documents-actions">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
            multiple
            style={{ display: 'none' }}
          />
          {canManageDocuments && (
            <>
              <button 
                className="upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload size={18} />
                {uploading ? 'Uploading...' : 'Upload Documents'}
              </button>
              {documents.length > 0 && (
                <button className="clear-btn" onClick={clearAllDocuments}>
                  <Trash2 size={16} /> Clear All
                </button>
              )}
            </>
          )}
          {canManageDocuments && documents.length > 0 && (
            <button 
              className="report-btn"
              onClick={generateReport}
              title="Generate a downloadable report of all documents"
            >
              <FileText size={18} /> Generate Report
            </button>
          )}
        </div>
      </div>
      <div className="accepted-formats">Accepted formats: JPEG, PNG, PDF, Word (.doc, .docx) — Max 10MB per file</div>

      {/* Chain Filter - visible for Director/Coordinator roles */}
      <ChainToggle selectedChain={selectedChain} onChainChange={(chain) => {
        setSelectedChain(chain);
      }} />

      {/* Stats Compact Bar */}
      <div className="stats-compact">
        <span className="stat-item">
          <span className="icon blue"><File size={14} /></span>
          <span className="num">{documents.length}</span>
          <span className="label">Total</span>
        </span>
        <span className="divider">|</span>
        <span className="stat-item">
          <span className="icon green"><Upload size={14} /></span>
          <span className="num">{documents.filter(d => d.source === 'upload').length}</span>
          <span className="label">Uploaded</span>
        </span>
        <span className="divider">|</span>
        <span className="stat-item">
          <span className="icon purple"><FileText size={14} /></span>
          <span className="num">{documents.filter(d => d.source !== 'upload').length}</span>
          <span className="label">Auto-Saved</span>
        </span>
        <span className="divider">|</span>
        <span className="stat-item">
          <span className="icon orange"><Calendar size={14} /></span>
          <span className="num">{analytics.thisWeek}</span>
          <span className="label">This Week</span>
        </span>
        <span className="divider">|</span>
        <span className="stat-item">
          <span className="icon red"><TrendingUp size={14} /></span>
          <span className="num">{analytics.thisMonth}</span>
          <span className="label">This Month</span>
        </span>
      </div>

      {/* Filters Bar */}
      <div className="filters-bar">
        <div className="search-wrap">
          <Search size={12} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search documents..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <span className="filter-label">Type</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All</option>
            <option value="image">Image</option>
            <option value="pdf">PDF</option>
            <option value="word">Word</option>
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">Source</span>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="">All</option>
            <option value="upload">Uploaded</option>
            <option value="lesson_plan">Lesson Plan</option>
            <option value="scheme_of_work">Scheme of Work</option>
            <option value="report_card">Report Card</option>
            <option value="examination_report">Exam Report</option>
          </select>
        </div>
        <span className="result-count">
          <Search size={12} /> {filteredDocs.length} result(s)
        </span>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button 
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <FileText size={16} />
          All Documents
        </button>
        <button 
          className={`tab-btn projects-tab ${activeTab === 'examination_reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('examination_reports')}
        >
          <FolderOpen size={16} />
          Examination Report
        </button>


        <button 
          className={`tab-btn ${activeTab === 'report_cards' ? 'active' : ''}`}
          onClick={() => setActiveTab('report_cards')}
          style={activeTab === 'report_cards' ? { color: '#06b6d4' } : {}}
        >
          <Award size={16} />
          Report Cards
        </button>
        <button 
          className={`tab-btn analytics-tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 size={16} />
          Analytics
        </button>
        <button 
          className={`tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
          style={activeTab === 'projects' ? { color: '#8b5cf6' } : {}}
        >
          <FileText size={16} />
          Projects
        </button>


      </div>

      {/* Project Pic Upload Panel - shown when Projects tab is active */}
      {activeTab === 'projects' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginBottom: '16px',
          padding: '16px',
          background: 'white',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Image size={18} style={{ color: '#8b5cf6' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
              Upload Project Picture
            </span>
            <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>
              Max 1MB · Saved as 100px
            </span>
          </div>
          <textarea
            value={projectCaption}
            onChange={(e) => setProjectCaption(e.target.value)}
            placeholder="Write a caption/description for this picture..."
            rows={2}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#1e293b',
              fontFamily: 'inherit',
              resize: 'vertical',
              background: '#f8fafc'
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ background: '#8b5cf6' }}
            >
              <Upload size={16} />
              {uploading ? 'Uploading...' : 'Upload Picture'}
            </button>
            {projectCaption && (
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Caption will be attached to the uploaded picture
              </span>
            )}
          </div>
        </div>
      )}

      {/* Examination Reports Filter */}
      {activeTab === 'examination_reports' && (

        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '16px',
          padding: '12px 16px',
          background: 'white',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Filter:</span>
          <select
            value={examReportFilter.year}
            onChange={(e) => setExamReportFilter(prev => ({ ...prev, year: e.target.value }))}
            style={{
              padding: '6px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#1e293b',
              background: 'white'
            }}
          >
            <option value="">All Years</option>
            {[...new Set(
              documents
                .filter(d => d.source === 'examination_report' && d.metadata?.year)
                .map(d => d.metadata.year)
            )].sort().reverse().map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <select
            value={examReportFilter.term}
            onChange={(e) => setExamReportFilter(prev => ({ ...prev, term: e.target.value }))}
            style={{
              padding: '6px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#1e293b',
              background: 'white'
            }}
          >
            <option value="">All Terms</option>
            <option value="1">First Term</option>
            <option value="2">Second Term</option>
            <option value="3">Third Term</option>
            <option value="final">Final</option>
          </select>
          {(examReportFilter.year || examReportFilter.term) && (
            <button
              onClick={() => setExamReportFilter({ year: '', term: '' })}
              style={{
                padding: '6px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#64748b',
                background: '#f8fafc',
                cursor: 'pointer'
              }}
            >
              Clear Filters
            </button>
          )}
          <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: 'auto' }}>
            {examReportsFiltered.length} report(s)
          </span>
        </div>
      )}

      {/* Analytics Filter Indicator */}
      {hasAnalyticsFilter && activeTab !== 'analytics' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
          padding: '10px 16px',
          background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
          borderRadius: '10px',
          color: 'white',
          fontSize: '13px',
          fontWeight: '500'
        }}>
          <BarChart3 size={16} />
          <span>Filtered by: <strong>{getFilterLabel()}</strong></span>
          <button
            onClick={() => { setFilterSource(null); setFilterTeacher(null); }}
            style={{
              marginLeft: 'auto',
              padding: '4px 12px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            <X size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Clear Filter
          </button>
        </div>
      )}

      {/* Content */}
      {activeTab === 'analytics' ? (
        <div className="analytics-section">
          <h2>📊 Documents Analytics Dashboard</h2>
          {renderAnalytics()}
        </div>
      ) : (
        renderDocumentsList(paginatedDocs)
      )}

      {/* Preview Overlay */}
      {(previewUrl || previewType === 'docx' || previewType === 'binary') && (
        <div className="preview-overlay" onClick={() => { setPreviewUrl(null); setPreviewType(null); }}>
          <div className="preview-content" onClick={e => e.stopPropagation()}>
            <button className="preview-close" onClick={() => { setPreviewUrl(null); setPreviewType(null); }}>
              <X size={18} /> Close
            </button>
            {previewType === 'image' && (
              <img src={previewUrl} alt="Preview" />
            )}
            {previewType === 'pdf' && (
              <PdfPreview base64Data={previewUrl} onDownload={() => {
                const doc = documents.find(d => d.type.includes('pdf'));
                if (doc) downloadDocument(doc);
              }} />
            )}
            {previewType === 'word' && (
              <div className="word-preview">
                <iframe 
                  srcDoc={(() => {
                    try {
                      // Extract base64 data and decode to HTML with proper UTF-8 handling
                      const base64 = previewUrl.split(',')[1];
                      // Use decodeURIComponent + escape to properly handle UTF-8 characters (e.g., en-dash –)
                      const decoded = decodeURIComponent(escape(atob(base64)));
                      return decoded;
                    } catch(e) {
                      // Fallback to simple atob if the UTF-8 decode fails
                      try {
                        const base64 = previewUrl.split(',')[1];
                        return atob(base64);
                      } catch(e2) {
                        return '<p>Unable to preview this document. Please download to view.</p>';
                      }
                    }
                  })()}
                  title="Word Document Preview"
                />
              </div>
            )}
            {previewType === 'docx' && (
              <DocxPreview base64Data={previewUrl} onDownload={() => {
                const doc = documents.find(d => d.name?.endsWith('.docx') || d.type.includes('word'));
                if (doc) downloadDocument(doc);
              }} />
            )}
            {previewType === 'binary' && (
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '40px',
                textAlign: 'center',
                maxWidth: '400px'
              }}>
                <FileText size={48} style={{ color: '#94a3b8', marginBottom: '16px' }} />
                <h3 style={{ color: '#1e293b', margin: '0 0 8px 0', fontSize: '16px' }}>
                  Binary File Preview Unavailable
                </h3>
                <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px 0' }}>
                  This file type cannot be previewed in the browser. Please download to view.
                </p>
                <button
                  onClick={() => {
                    const doc = documents.find(d => d.name?.endsWith('.docx') || d.type.includes('word'));
                    if (doc) downloadDocument(doc);
                    setPreviewUrl(null);
                    setPreviewType(null);
                  }}
                  style={{
                    padding: '10px 24px',
                    background: '#0284c7',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  Download to View
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

// ============ PDF PREVIEW COMPONENT ============
// Uses pdfjs-dist to render PDF pages as canvas elements
const PdfPreview = ({ base64Data, onDownload }) => {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const pdfDocRef = useRef(null);

  useEffect(() => {
    const loadPdf = async () => {
      try {
        // Dynamically import pdfjs-dist
        const pdfjsLib = await import('pdfjs-dist');
        
        // Use CDN worker - avoids webpack bundling issues with .mjs files
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs';
        
        // Extract base64 data
        const base64 = base64Data.split('base64,')[1];
        
        // Convert base64 to Uint8Array
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        
        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdfDoc = await loadingTask.promise;
        
        pdfDocRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages);
        setLoading(false);
        
        // Render first page
        renderPage(pdfDoc, 1);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('Failed to load PDF: ' + err.message);
        setLoading(false);
      }
    };

    loadPdf();
  }, [base64Data]);

  const renderPage = async (pdfDoc, pageNum) => {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const ctx = canvas.getContext('2d');
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
    } catch (err) {
      console.error('Error rendering PDF page:', err);
    }
  };

  const changePage = (delta) => {
    const newPage = pageNumber + delta;
    if (newPage >= 1 && newPage <= numPages) {
      setPageNumber(newPage);
      if (pdfDocRef.current) {
        renderPage(pdfDocRef.current, newPage);
      }
    }
  };

  if (loading) {
    return (
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '80vw',
        height: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} style={{ color: '#dc2626' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>PDF Preview</span>
          </div>
          <button onClick={onDownload} style={{
            padding: '6px 14px',
            background: '#0284c7',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Download size={14} /> Download
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid #e2e8f0',
              borderTopColor: '#dc2626',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px'
            }} />
            <p style={{ color: '#64748b', fontSize: '14px' }}>Loading PDF...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '80vw',
        height: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} style={{ color: '#dc2626' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>PDF Preview</span>
          </div>
          <button onClick={onDownload} style={{
            padding: '6px 14px',
            background: '#0284c7',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Download size={14} /> Download
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#ef4444', fontSize: '14px', marginBottom: '8px' }}>{error}</p>
            <p style={{ color: '#64748b', fontSize: '12px' }}>Please download the file to view it.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      width: '80vw',
      height: '80vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={20} style={{ color: '#dc2626' }} />
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>PDF Preview</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Page navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569' }}>
            <button
              onClick={() => changePage(-1)}
              disabled={pageNumber <= 1}
              style={{
                padding: '4px 10px',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                background: pageNumber <= 1 ? '#f1f5f9' : 'white',
                color: pageNumber <= 1 ? '#94a3b8' : '#475569',
                cursor: pageNumber <= 1 ? 'not-allowed' : 'pointer',
                fontSize: '13px'
              }}
            >
              ◀ Prev
            </button>
            <span>
              Page {pageNumber} of {numPages}
            </span>
            <button
              onClick={() => changePage(1)}
              disabled={pageNumber >= numPages}
              style={{
                padding: '4px 10px',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                background: pageNumber >= numPages ? '#f1f5f9' : 'white',
                color: pageNumber >= numPages ? '#94a3b8' : '#475569',
                cursor: pageNumber >= numPages ? 'not-allowed' : 'pointer',
                fontSize: '13px'
              }}
            >
              Next ▶
            </button>
          </div>
          <button onClick={onDownload} style={{
            padding: '6px 14px',
            background: '#0284c7',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Download size={14} /> Download
          </button>
        </div>
      </div>
      {/* PDF Canvas */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        justifyContent: 'center',
        padding: '20px',
        background: '#e2e8f0'
      }}>
        <canvas ref={canvasRef} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />
      </div>
    </div>
  );
};

// ============ DOCX PREVIEW COMPONENT ============
// Uses mammoth.js to convert .docx to HTML with full formatting support
const DocxPreview = ({ base64Data, onDownload }) => {
  const [htmlContent, setHtmlContent] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const parseDocx = async () => {
      try {
        // Dynamically import mammoth
        const mammoth = await import('mammoth');
        
        // Extract the base64 data (remove data:...;base64, prefix)
        const base64 = base64Data.split('base64,')[1];
        
        // Convert base64 to ArrayBuffer
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        
        // Convert to ArrayBuffer for mammoth
        const arrayBuffer = bytes.buffer;
        
        // Use mammoth to convert to HTML
        const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
        
        if (result.value) {
          setHtmlContent(result.value);
        } else {
          setHtmlContent('<p>No content found in document.</p>');
        }
        
        if (result.messages && result.messages.length > 0) {
          console.log('Mammoth messages:', result.messages);
        }
      } catch (err) {
        console.error('Error parsing docx with mammoth:', err);
        setError('Failed to parse document: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    parseDocx();
  }, [base64Data]);

  if (loading) {
    return (
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '80vw',
        height: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} style={{ color: '#2563eb' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Word Document Preview</span>
          </div>
          <button onClick={onDownload} style={{
            padding: '6px 14px',
            background: '#0284c7',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Download size={14} /> Download
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid #e2e8f0',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px'
            }} />
            <p style={{ color: '#64748b', fontSize: '14px' }}>Converting document to preview...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '80vw',
        height: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} style={{ color: '#2563eb' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Word Document Preview</span>
          </div>
          <button onClick={onDownload} style={{
            padding: '6px 14px',
            background: '#0284c7',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Download size={14} /> Download
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#ef4444', fontSize: '14px', marginBottom: '8px' }}>{error}</p>
            <p style={{ color: '#64748b', fontSize: '12px' }}>Please download the file to view it in Microsoft Word or Google Docs.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      width: '80vw',
      height: '80vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={20} style={{ color: '#2563eb' }} />
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Word Document Preview</span>
        </div>
        <button onClick={onDownload} style={{
          padding: '6px 14px',
          background: '#0284c7',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <Download size={14} /> Download
        </button>
      </div>
      {/* Content - rendered HTML from mammoth */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '32px 48px',
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: '12pt',
        lineHeight: '1.6',
        color: '#1e293b'
      }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
      {/* Table styling injected via style tag */}
      <style>{`
        .docx-preview-table,
        .docx-preview-content table,
        div[style*="overflow: auto"] table {
          border-collapse: collapse !important;
          width: 100% !important;
          margin: 12px 0 !important;
          font-size: 10pt !important;
        }
        .docx-preview-table td,
        .docx-preview-table th,
        div[style*="overflow: auto"] table td,
        div[style*="overflow: auto"] table th {
          border: 1px solid #000 !important;
          padding: 6px 8px !important;
          text-align: left !important;
          vertical-align: top !important;
        }
        .docx-preview-table th,
        div[style*="overflow: auto"] table th {
          background-color: #f0f0f0 !important;
          font-weight: bold !important;
        }
        .docx-preview-table tr:nth-child(even),
        div[style*="overflow: auto"] table tr:nth-child(even) {
          background-color: #fafafa !important;
        }
      `}</style>
    </div>
  );
};

export default Documents;

