import { apiClient } from './authService';

class StudentService {
  static async getStudents(classFilter = null, chainFilter = null) {
    const params = {};
    if (classFilter) params.class_name = classFilter;
    if (chainFilter) params.chain = chainFilter;
    const response = await apiClient.get('/students', { params });
    return response.data;
  }

  static async getStudent(id) {
    const response = await apiClient.get(`/students/${id}`);
    return response.data;
  }

  static async createStudent(studentData) {
    // Map frontend fields to backend fields
    const payload = {
      admission_no: studentData.admission_no,
      first_name: studentData.first_name,
      last_name: studentData.last_name,
      gender: studentData.gender,
      date_of_birth: studentData.date_of_birth,
      class_name: studentData.class_name,
      chain: studentData.chain,
      parent_name: studentData.parent_name,
      parent_phone: studentData.parent_phone,
      password: studentData.password,
    };
    const response = await apiClient.post('/students', payload);
    return response.data;
  }

  static async updateStudent(id, updates) {
    const response = await apiClient.put(`/students/${id}`, updates);
    return response.data;
  }

  static async deleteStudent(id) {
    const response = await apiClient.delete(`/students/${id}`);
    return response.data;
  }

  static async bulkUploadStudents(studentsData) {
    const response = await apiClient.post('/students/bulk-upload', studentsData);
    return response.data;
  }

  /**
   * Export all students as a Word-compatible .doc file
   * Generates an HTML document with clean, professional styling
   * that Microsoft Word can open natively.
   */
  static exportStudentsToDoc(students, filename = 'students_report.doc') {
    // Sort students by chain, then class, then name
    const sorted = [...students].sort((a, b) => {
      if (a.chain !== b.chain) return (a.chain || '').localeCompare(b.chain || '');
      if (a.class_name !== b.class_name) return (a.class_name || '').localeCompare(b.class_name || '');
      return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
    });

    // Calculate stats
    const totalStudents = sorted.length;
    const boys = sorted.filter(s => ['m', 'male'].includes(s.gender?.toLowerCase())).length;
    const girls = sorted.filter(s => ['f', 'female'].includes(s.gender?.toLowerCase())).length;
    const chains = [...new Set(sorted.map(s => s.chain).filter(Boolean))];
    const classes = [...new Set(sorted.map(s => s.class_name).filter(Boolean))];

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    const tableRows = sorted.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${s.first_name || ''} ${s.last_name || ''}</td>
        <td>${s.admission_no || ''}</td>
        <td>${s.chain || ''}</td>
        <td>${s.class_name || 'N/A'}</td>
        <td>${s.gender || 'N/A'}</td>
        <td>${s.parent_name || 'N/A'}</td>
        <td>${s.parent_phone || ''}</td>
      </tr>
    `).join('\n');

    const htmlContent = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' 
      xmlns:w='urn:schemas-microsoft-com:office:word' 
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  /* ── Page Setup ── */
  @page {
    size: A4 landscape;
    margin: 0.75in 0.5in;
  }
  
  body {
    font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    color: #1e293b;
    line-height: 1.5;
    background: #ffffff;
    padding: 0;
    margin: 0;
  }

  /* ── Header Section ── */
  .report-header {
    text-align: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 3px solid #0f766e;
  }
  
  .report-header h1 {
    font-size: 22pt;
    font-weight: 700;
    color: #0f766e;
    margin: 0 0 4px 0;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  
  .report-header .subtitle {
    font-size: 12pt;
    color: #475569;
    margin: 0;
  }
  
  .report-header .date {
    font-size: 10pt;
    color: #64748b;
    margin: 4px 0 0 0;
  }

  /* ── Summary Cards ── */
  .summary-row {
    display: flex;
    gap: 12px;
    margin-bottom: 18px;
    flex-wrap: wrap;
  }
  
  .summary-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 16px;
    text-align: center;
    min-width: 100px;
    flex: 1;
  }
  
  .summary-card .label {
    font-size: 8pt;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }
  
  .summary-card .value {
    font-size: 16pt;
    font-weight: 700;
    color: #0f766e;
    margin-top: 2px;
  }
  
  .summary-card .value.boys { color: #2563eb; }
  .summary-card .value.girls { color: #db2777; }

  /* ── Table ── */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5pt;
  }
  
  thead th {
    background: #0f766e;
    color: #ffffff;
    font-weight: 600;
    padding: 8px 6px;
    text-align: left;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border: 1px solid #0d6b63;
  }
  
  tbody td {
    padding: 6px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
  }
  
  tbody tr:nth-child(even) {
    background: #f8fafc;
  }
  
  tbody tr:hover {
    background: #e2e8f0;
  }
  
  /* ── Footer ── */
  .report-footer {
    margin-top: 20px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
    font-size: 9pt;
    color: #94a3b8;
    text-align: center;
  }
  
  .report-footer strong {
    color: #475569;
  }
</style>
</head>
<body>

<div class="report-header">
  <h1>Student Report</h1>
  <p class="subtitle">IHEZA School Management System — Comprehensive Student Directory</p>
  <p class="date">Generated: ${currentDate}</p>
</div>

<div class="summary-row">
  <div class="summary-card">
    <div class="label">Total Students</div>
    <div class="value">${totalStudents}</div>
  </div>
  <div class="summary-card">
    <div class="label">Boys</div>
    <div class="value boys">${boys}</div>
  </div>
  <div class="summary-card">
    <div class="label">Girls</div>
    <div class="value girls">${girls}</div>
  </div>
  <div class="summary-card">
    <div class="label">Schools</div>
    <div class="value">${chains.length}</div>
  </div>
  <div class="summary-card">
    <div class="label">Classes</div>
    <div class="value">${classes.length}</div>
  </div>
</div>

<table cellspacing="0" cellpadding="0">
  <thead>
    <tr>
      <th>#</th>
      <th>Student Name</th>
      <th>Admission No.</th>
      <th>School</th>
      <th>Class</th>
      <th>Gender</th>
      <th>Parent/Guardian</th>
      <th>Parent Phone</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
  </tbody>
</table>

<div class="report-footer">
  <strong>IHEZA School Management System</strong> &mdash; This report contains <strong>${totalStudents}</strong> student records &mdash; Generated on ${currentDate}
</div>

</body>
</html>`;

    // Create a Blob with the HTML content (Word will render it natively)
    const blob = new Blob([htmlContent], { 
      type: 'application/msword;charset=utf-8' 
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const studentService = StudentService;
export default StudentService;
