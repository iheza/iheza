import React, { useState } from 'react';
import './Forms.css';

const SchemeOfWork = ({ onSave }) => {
  // Create row structure based on format
  const createEmptyRow = (format) => {
    if (format === 'zanzibar') {
      return {
        weekAndDate: '',
        competence: '',
        mainTopicAndSubTopic: '',
        specificLearningOutcomes: '',
        teachingActivities: '',
        learningActivities: '',
        learningResources: '',
        assessment: '',
        periods: '',
        references: '',
        remarks: ''
      };
    } else {
      // Tanzania format
      return {
        mainCompetence: '',
        specificCompetences: '',
        learningActivities: '',
        specificActivities: '',
        month: '',
        week: '',
        periods: '',
        teachingMethods: '',
        resources: '',
        assessmentTools: '',
        references: '',
        remarks: ''
      };
    }
  };

  const [formData, setFormData] = useState({
    school: '',
    teacher: '',
    subject: '',
    year: 2026,
    term: '',
    class: '',
    format: 'tanzania', // 'tanzania' or 'zanzibar'
    rows: Array(10).fill().map(() => createEmptyRow('tanzania'))
  });

  const autoResize = (textarea) => {
    if (textarea && textarea.tagName === 'TEXTAREA' && textarea.style) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(textarea.scrollHeight, 60) + 'px';
    }
  };

  // Render table headers based on format
  const renderTableHeaders = (format) => {
    if (format === 'zanzibar') {
      return (
        <tr>
          <th className="col-week horizontal-header">WEEK & DATE<br/><span className="swahili-text">[WIKI NA TAREHE]</span></th>
          <th className="col-competence horizontal-header">COMPETENCE<br/><span className="swahili-text">(UJUZI)</span></th>
          <th className="col-topic horizontal-header">MAIN TOPIC & SUB TOPIC<br/><span className="swahili-text">(MADA KUU NA MADA NDOGO)</span></th>
          <th className="col-outcomes horizontal-header">SPECIFIC LEARNING OUTCOMES<br/><span className="swahili-text">(MATOKEO MAHSUSI YA KUJIFUNZA)</span></th>
          <th className="col-teaching horizontal-header">TEACHING ACTIVITIES<br/><span className="swahili-text">(VITENDO VYA KUFUNDISHIA)</span></th>
          <th className="col-learning horizontal-header">LEARNING ACTIVITIES<br/><span className="swahili-text">(VITENDO VYA KUJIFUNZIA)</span></th>
          <th className="col-resources horizontal-header">LEARNING RESOURCES<br/><span className="swahili-text">(RASILIMALI ZA KUJIFUNZA)</span></th>
          <th className="col-assessment horizontal-header">ASSESSMENT<br/><span className="swahili-text">(TATHMINI)</span></th>
          <th className="col-periods horizontal-header">PERIODS<br/><span className="swahili-text">(VIPINDI)</span></th>
          <th className="col-references horizontal-header">REFERENCES<br/><span className="swahili-text">(REJEA)</span></th>
          <th className="col-remarks horizontal-header">REMARKS<br/><span className="swahili-text">(MAELEZO)</span></th>
        </tr>
      );
    } else {
      // Tanzania format
      return (
        <tr>
          <th className="col-main horizontal-header">Main Competence</th>
          <th className="col-specific horizontal-header">Specific Competences</th>
          <th className="col-activities horizontal-header">Learning Activities</th>
          <th className="col-specific-activities horizontal-header">Specific Activities</th>
          <th className="col-month horizontal-header">Month</th>
          <th className="col-week horizontal-header">Week</th>
          <th className="col-periods horizontal-header">Periods</th>
          <th className="col-methods horizontal-header">Teaching Methods</th>
          <th className="col-resources horizontal-header">Resources</th>
          <th className="col-assessment horizontal-header">Assessment Tools</th>
          <th className="col-references horizontal-header">References</th>
          <th className="col-remarks horizontal-header">Remarks</th>
        </tr>
      );
    }
  };

  // Render table rows based on format
  const renderTableRows = (format) => {
    return formData.rows.map((row, index) => (
      <tr key={index} className={`data-row ${index > 0 && index % 8 === 0 ? 'page-break' : ''}`}>
        {format === 'zanzibar' ? (
          <>
            <td>
              <textarea
                value={row.weekAndDate || ''}
                onChange={(e) => handleInputChange(e, index, 'weekAndDate')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="Week & Date"
              />
            </td>
            <td>
              <textarea
                value={row.competence || ''}
                onChange={(e) => handleInputChange(e, index, 'competence')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="Competence"
              />
            </td>
            <td>
              <textarea
                value={row.mainTopicAndSubTopic || ''}
                onChange={(e) => handleInputChange(e, index, 'mainTopicAndSubTopic')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="Main Topic & Sub Topic"
              />
            </td>
            <td>
              <textarea
                value={row.specificLearningOutcomes || ''}
                onChange={(e) => handleInputChange(e, index, 'specificLearningOutcomes')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="Specific Learning Outcomes"
              />
            </td>
            <td>
              <textarea
                value={row.teachingActivities || ''}
                onChange={(e) => handleInputChange(e, index, 'teachingActivities')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="Teaching Activities"
              />
            </td>
            <td>
              <textarea
                value={row.learningActivities || ''}
                onChange={(e) => handleInputChange(e, index, 'learningActivities')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="Learning Activities"
              />
            </td>
            <td>
              <textarea
                value={row.learningResources || ''}
                onChange={(e) => handleInputChange(e, index, 'learningResources')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="Learning Resources"
              />
            </td>
            <td>
              <textarea
                value={row.assessment || ''}
                onChange={(e) => handleInputChange(e, index, 'assessment')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="Assessment"
              />
            </td>
            <td>
              <input
                type="text"
                value={row.periods || ''}
                onChange={(e) => handleInputChange(e, index, 'periods')}
                className="editable-cell"
                placeholder="Periods"
              />
            </td>
            <td>
              <textarea
                value={row.references || ''}
                onChange={(e) => handleInputChange(e, index, 'references')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="References"
              />
            </td>
            <td>
              <textarea
                value={row.remarks || ''}
                onChange={(e) => handleInputChange(e, index, 'remarks')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="Remarks"
              />
            </td>
          </>
        ) : (
          // Tanzania format
          <>
            <td>
              <textarea
                value={row.mainCompetence || ''}
                onChange={(e) => handleInputChange(e, index, 'mainCompetence')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="Enter main competence"
              />
            </td>
            <td>
              <textarea
                value={row.specificCompetences || ''}
                onChange={(e) => handleInputChange(e, index, 'specificCompetences')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="Enter specific competences"
              />
            </td>
            <td>
              <textarea
                value={row.learningActivities || ''}
                onChange={(e) => handleInputChange(e, index, 'learningActivities')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="Enter learning activities"
              />
            </td>
            <td>
              <textarea
                value={row.specificActivities || ''}
                onChange={(e) => handleInputChange(e, index, 'specificActivities')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="Enter specific activities"
              />
            </td>
            <td>
              <input
                type="text"
                value={row.month || ''}
                onChange={(e) => handleInputChange(e, index, 'month')}
                className="editable-cell"
                placeholder="Month"
              />
            </td>
            <td>
              <input
                type="text"
                value={row.week || ''}
                onChange={(e) => handleInputChange(e, index, 'week')}
                className="editable-cell"
                placeholder="Week"
              />
            </td>
            <td>
              <input
                type="text"
                value={row.periods || ''}
                onChange={(e) => handleInputChange(e, index, 'periods')}
                className="editable-cell"
                placeholder="Periods"
              />
            </td>
            <td>
              <textarea
                value={row.teachingMethods || ''}
                onChange={(e) => handleInputChange(e, index, 'teachingMethods')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="Teaching methods"
              />
            </td>
            <td>
              <textarea
                value={row.resources || ''}
                onChange={(e) => handleInputChange(e, index, 'resources')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="Resources needed"
              />
            </td>
            <td>
              <textarea
                value={row.assessmentTools || ''}
                onChange={(e) => handleInputChange(e, index, 'assessmentTools')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="Assessment tools"
              />
            </td>
            <td>
              <textarea
                value={row.references || ''}
                onChange={(e) => handleInputChange(e, index, 'references')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="References"
              />
            </td>
            <td>
              <textarea
                value={row.remarks || ''}
                onChange={(e) => handleInputChange(e, index, 'remarks')}
                onInput={(e) => autoResize(e.target)}
                className="editable-cell"
                placeholder="Remarks"
              />
            </td>
          </>
        )}
      </tr>
    ));
  };

  const handleInputChange = (e, rowIndex, field) => {
    const { value, name } = e.target;
    
    // Auto-resize textarea only for textarea elements
    if (e.target.tagName === 'TEXTAREA') {
      autoResize(e.target);
    }
    
    if (rowIndex !== undefined) {
      const updatedRows = [...formData.rows];
      updatedRows[rowIndex][field] = value;
      setFormData({...formData, rows: updatedRows});
    } else if (name === 'format') {
      // When format changes, update all rows to use the new format structure
      const newRows = formData.rows.map(row => createEmptyRow(value));
      setFormData({...formData, [name]: value, rows: newRows});
    } else {
      setFormData({...formData, [name]: value});
    }
  };

  const addRow = () => {
    setFormData({
      ...formData,
      rows: [
        ...formData.rows,
        createEmptyRow(formData.format)
      ]
    });
  };

  const handleSave = () => {
    // Show loading message
    const saveButton = document.querySelector('.save-btn');
    const originalButtonText = saveButton.textContent;
    saveButton.textContent = 'Generating Word Document...';
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
  <title>Scheme of Work - ${formData.subject} - ${formData.class} - ${formData.year}</title>
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
    .header-section {
      margin-bottom: 20px;
    }
    .header-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 15px;
    }
    .header-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .header-item {
      margin-bottom: 8px;
    }
    .header-label {
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
    .scheme-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 8pt;
      table-layout: fixed;
    }
    .scheme-table th {
      background-color: #2c3e50;
      color: #ffffff;
      font-weight: bold;
      padding: 4px;
      text-align: center;
      border: 1px solid #000000;
      font-size: 8pt;
    }
    .scheme-table td {
      padding: 3px;
      border: 1px solid #cccccc;
      text-align: center;
      vertical-align: top;
      font-size: 8pt;
    }
    .editable-cell {
      width: 100%;
      min-height: 60px;
      border: 1px solid #cccccc;
      padding: 3px;
      font-size: 8pt;
      font-family: "Times New Roman", Times, serif;
      resize: none;
    }
    .horizontal-header {
      font-weight: bold;
      text-align: center;
      vertical-align: middle;
    }
    .swahili-text {
      font-size: 7pt;
      font-style: italic;
    }
    .col-week { width: 8%; }
    .col-competence { width: 10%; }
    .col-topic { width: 12%; }
    .col-outcomes { width: 12%; }
    .col-teaching { width: 10%; }
    .col-learning { width: 10%; }
    .col-resources { width: 8%; }
    .col-assessment { width: 8%; }
    .col-periods { width: 5%; }
    .col-references { width: 8%; }
    .col-remarks { width: 9%; }
  </style>
</head>
<body>
  <div class="document-header">
    <h1>SCHEME OF WORK</h1>
    <div class="document-subtitle">Academic Planning Template - ${formData.year}</div>
  </div>

  <div class="header-section">
    <div class="header-grid">
      <div class="header-group">
        <div class="header-item">
          <div class="header-label">Name of School</div>
          <div class="input-line">${formData.school || ''}</div>
        </div>
        <div class="header-item">
          <div class="header-label">Teacher's Name</div>
          <div class="input-line">${formData.teacher || ''}</div>
        </div>
      </div>
      
      <div class="header-group">
        <div class="header-item">
          <div class="header-label">Subject</div>
          <div class="input-line">${formData.subject || ''}</div>
        </div>
      </div>
      
      <div class="header-group">
        <div class="header-item">
          <div class="header-label">Year</div>
          <div class="input-line">${formData.year || ''}</div>
        </div>
        <div class="header-item">
          <div class="header-label">Term</div>
          <div class="input-line">${formData.term || ''}</div>
        </div>
        <div class="header-item">
          <div class="header-label">Class</div>
          <div class="input-line">${formData.class || ''}</div>
        </div>
        <div class="header-item">
          <div class="header-label">Scheme Format</div>
          <div class="input-line">${formData.format === 'tanzania' ? 'Tanzania Format' : 'Zanzibar Format'}</div>
        </div>
      </div>
    </div>
  </div>

  <table class="scheme-table">
    <thead>
      ${formData.format === 'zanzibar' ? `
        <tr>
          <th class="col-week horizontal-header">WEEK & DATE<br/><span class="swahili-text">[WIKI NA TAREHE]</span></th>
          <th class="col-competence horizontal-header">COMPETENCE<br/><span class="swahili-text">(UJUZI)</span></th>
          <th class="col-topic horizontal-header">MAIN TOPIC & SUB TOPIC<br/><span class="swahili-text">(MADA KUU NA MADA NDOGO)</span></th>
          <th class="col-outcomes horizontal-header">SPECIFIC LEARNING OUTCOMES<br/><span class="swahili-text">(MATOKEO MAHSUSI YA KUJIFUNZA)</span></th>
          <th class="col-teaching horizontal-header">TEACHING ACTIVITIES<br/><span class="swahili-text">(VITENDO VYA KUFUNDISHIA)</span></th>
          <th class="col-learning horizontal-header">LEARNING ACTIVITIES<br/><span class="swahili-text">(VITENDO VYA KUJIFUNZIA)</span></th>
          <th class="col-resources horizontal-header">LEARNING RESOURCES<br/><span class="swahili-text">(RASILIMALI ZA KUJIFUNZA)</span></th>
          <th class="col-assessment horizontal-header">ASSESSMENT<br/><span class="swahili-text">(TATHMINI)</span></th>
          <th class="col-periods horizontal-header">PERIODS<br/><span class="swahili-text">(VIPINDI)</span></th>
          <th class="col-references horizontal-header">REFERENCES<br/><span class="swahili-text">(REJEA)</span></th>
          <th class="col-remarks horizontal-header">REMARKS<br/><span class="swahili-text">(MAELEZO)</span></th>
        </tr>
      ` : `
        <tr>
          <th class="col-main horizontal-header">Main Competence</th>
          <th class="col-specific horizontal-header">Specific Competences</th>
          <th class="col-activities horizontal-header">Learning Activities</th>
          <th class="col-specific-activities horizontal-header">Specific Activities</th>
          <th class="col-month horizontal-header">Month</th>
          <th class="col-week horizontal-header">Week</th>
          <th class="col-periods horizontal-header">Periods</th>
          <th class="col-methods horizontal-header">Teaching Methods</th>
          <th class="col-resources horizontal-header">Resources</th>
          <th class="col-assessment horizontal-header">Assessment Tools</th>
          <th class="col-references horizontal-header">References</th>
          <th class="col-remarks horizontal-header">Remarks</th>
        </tr>
      `}
    </thead>
    <tbody>
      ${formData.rows.map((row, index) => {
        if (formData.format === 'zanzibar') {
          return `
            <tr key="${index}" class="data-row">
              <td>
                <div class="editable-cell">${row.weekAndDate || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.competence || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.mainTopicAndSubTopic || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.specificLearningOutcomes || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.teachingActivities || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.learningActivities || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.learningResources || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.assessment || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.periods || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.references || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.remarks || ''}</div>
              </td>
            </tr>
          `;
        } else {
          return `
            <tr key="${index}" class="data-row">
              <td>
                <div class="editable-cell">${row.mainCompetence || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.specificCompetences || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.learningActivities || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.specificActivities || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.month || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.week || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.periods || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.teachingMethods || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.resources || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.assessmentTools || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.references || ''}</div>
              </td>
              <td>
                <div class="editable-cell">${row.remarks || ''}</div>
              </td>
            </tr>
          `;
        }
      }).join('')}
    </tbody>
  </table>
</body>
</html>`;

        return htmlContent;
      };

      // Generate the Word document
      const wordContent = generateWordDocument();
      
      // Create blob and download
      const blob = new Blob([wordContent], { type: 'application/msword' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `scheme-of-work-${formData.subject}-${formData.class}-${formData.year}-${new Date().toISOString().split('T')[0]}.doc`;
      link.click();
      
      // Restore button state
      saveButton.textContent = originalButtonText;
      saveButton.disabled = false;
      
      // Also call the onSave callback if provided
      if (onSave) {
        onSave(formData);
      }
      
    } catch (error) {
      console.error('Error generating document:', error);
      alert('Error generating document. Please try again.');
      
      // Restore button state
      const saveButton = document.querySelector('.save-btn');
      if (saveButton) {
        saveButton.textContent = originalButtonText;
        saveButton.disabled = false;
      }
    }
  };

  const printScheme = () => {
    window.print();
  };

  return (
    <div className="scheme-container">
      <div className="scheme-header">
        <h1 className="scheme-title">SCHEME OF WORK</h1>
        <div className="scheme-subtitle">Academic Planning Template</div>
      </div>

      <div className="header-section">
        <div className="header-grid">
          <div className="header-group">
            <div className="header-item">
              <label className="header-label">Name of School</label>
              <input
                type="text"
                name="school"
                value={formData.school}
                onChange={handleInputChange}
                className="header-input"
                placeholder="Enter school name"
              />
            </div>
            <div className="header-item">
              <label className="header-label">Teacher's Name</label>
              <input
                type="text"
                name="teacher"
                value={formData.teacher}
                onChange={handleInputChange}
                className="header-input"
                placeholder="Enter teacher's name"
              />
            </div>
          </div>
          
          <div className="header-group">
            <div className="header-item full-width">
              <label className="header-label">Subject</label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
                className="header-input"
                placeholder="Enter subject name"
              />
            </div>
          </div>
          
          <div className="header-group">
            <div className="header-item">
              <label className="header-label">Year</label>
              <input
                type="number"
                name="year"
                value={formData.year}
                onChange={handleInputChange}
                className="header-input"
                placeholder="2024"
              />
            </div>
            <div className="header-item">
              <label className="header-label">Term</label>
              <select
                name="term"
                value={formData.term}
                onChange={handleInputChange}
                className="header-input"
              >
                <option value="">Select Term</option>
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
                <option value="Final">Final</option>
              </select>
            </div>
            <div className="header-item">
              <label className="header-label">Class</label>
              <input
                type="text"
                name="class"
                value={formData.class}
                onChange={handleInputChange}
                className="header-input"
                placeholder="Enter class/grade"
              />
            </div>
            <div className="header-item">
              <label className="header-label">Scheme Format</label>
              <div className="format-toggle-container">
                <div className="format-toggle">
                  <button
                    type="button"
                    className={`format-option ${formData.format === 'tanzania' ? 'active' : ''}`}
                    onClick={() => handleInputChange({ target: { name: 'format', value: 'tanzania' } })}
                  >
                    Tanzania
                  </button>
                  <button
                    type="button"
                    className={`format-option ${formData.format === 'zanzibar' ? 'active' : ''}`}
                    onClick={() => handleInputChange({ target: { name: 'format', value: 'zanzibar' } })}
                  >
                    Zanzibar
                  </button>
                </div>
                <div className="format-description">
                  {formData.format === 'tanzania' ? 'Standard Tanzanian format' : 'Bilingual Zanzibar format with Swahili headers'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="scheme-table">
          <thead>
            {renderTableHeaders(formData.format)}
          </thead>
          <tbody>
            {renderTableRows(formData.format)}
          </tbody>
        </table>
      </div>

      <div className="action-section no-print">
        <div className="action-group">
          <button onClick={addRow} className="action-btn add-btn">
            + Add New Row
          </button>
          <button onClick={handleSave} className="action-btn save-btn">
            Save Scheme
          </button>
          <button onClick={printScheme} className="action-btn print-btn">
            Print
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchemeOfWork;
