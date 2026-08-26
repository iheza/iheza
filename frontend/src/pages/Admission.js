import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { API_URL } from '../config/api';
import { 
  UserPlus, Save, Trash2, Eye, Pencil, X, CheckCircle2, 
  AlertCircle, FileText, MapPin, Users, 
  GraduationCap, Camera, Search, RefreshCw, Download
} from 'lucide-react';
import './Admission.css';


const EMPTY_FORM = {
  // Admission Details (collaborates with Students component)
  chain: '',
  student_number: '',
  admission_year: new Date().getFullYear(),
  admission_no: '',
  // Personal Information
  student_name: '',
  first_name: '',
  last_name: '',
  gender: '',
  date_of_birth: '',
  class_name: '',
  place_of_birth: '',
  height_cm: '',
  weight_kg: '',
  nationality: '',
  mkoa: '',
  wilaya: '',
  shehia: '',
  correspondence_address: '',
  phone_1: '',
  phone_2: '',
  tribe: '',
  religion: '',
  last_school: '',
  last_school_year: '',
  final_exam_result: '',
  medical_info: '',
  // Parent/Guardian
  parent_name: '',
  parent_phone: '',
  father_name: '',
  father_profession: '',
  mother_name: '',
  mother_profession: '',
  emergency_contact_1: '',
  emergency_contact_2: '',
  guardian_1_name: '',
  guardian_1_signature: '',
  guardian_2_name: '',
  guardian_2_signature: '',
  admission_date: '',
  passport_photo: '',
  status: 'pending',
  password: '',
};


function Admission() {
  const currentUser = useSelector(selectCurrentUser);
  const userRole = (currentUser?.role || '').toLowerCase();
  
  // Director is view-only; Secretary and Principal can edit
  const canEdit = ['secretary', 'principal', 'coordinator'].includes(userRole);
  // Only the Principal has the power to delete students
  const canDelete = userRole === 'principal';
  const isDirector = userRole === 'director';

  
  const [admissions, setAdmissions] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [zoomPhoto, setZoomPhoto] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;


  const getToken = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('sessionToken');
    return token;
  };

  const fetchAdmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/admissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load admissions');
      const data = await res.json();
      setAdmissions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmissions();
  }, [fetchAdmissions]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    
    // When the School (chain) is selected for a NEW admission (not editing),
    // auto-generate the next student number for that chain.
    if (name === 'chain' && value && !editingId) {
      const nextNumber = getNextStudentNumber(value);
      setForm(prev => ({
        ...prev,
        chain: value,
        student_number: nextNumber,
      }));
    }
  };

  // Compute the next available student number for a given chain
  const getNextStudentNumber = (chain) => {
    const prefix = `${chain}/STU`;
    let maxNum = 0;
    admissions.forEach(a => {
      const an = (a.admission_no || '').toUpperCase();
      if (an.startsWith(prefix)) {
        const match = an.match(/STU(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
    });
    return String(maxNum + 1).padStart(4, '0');
  };


  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm(prev => ({ ...prev, passport_photo: ev.target.result }));
      setPhotoPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setPhotoPreview(null);
  };

  const closeForm = () => {
    resetForm();
    setShowForm(false);
  };

  const handleSave = async () => {
    // Build first_name / last_name from student_name if not provided
    let first_name = form.first_name || '';
    let last_name = form.last_name || '';
    if (!first_name && !last_name && form.student_name) {
      const parts = form.student_name.trim().split(' ');
      first_name = parts[0] || '';
      last_name = parts.slice(1).join(' ') || '';
    }
    // Build student_name from first/last name if not provided
    const student_name = form.student_name || `${first_name} ${last_name}`.trim();
    
    if (!student_name) {
      setError('Student name is required');
      return;
    }
    
    // Build admission_no from chain + student_number + year if not provided
    let admission_no = form.admission_no || '';
    if (!admission_no && form.chain && form.student_number) {
      admission_no = `${form.chain}/STU${String(form.student_number).padStart(4, '0')}/${form.admission_year || new Date().getFullYear()}`;
    }
    
    // Build the payload to send to the backend
    const payload = {
      ...form,
      student_name,
      first_name,
      last_name,
      admission_no,
    };
    
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const token = getToken();
      const url = editingId 
        ? `${API_URL}/api/admissions/${editingId}`
        : `${API_URL}/api/admissions`;
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to save admission');
      }
      
      setMessage(editingId ? 'Admission updated successfully' : 'Admission created successfully');
      closeForm();
      fetchAdmissions();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };


  const handleEdit = (admission) => {
    if (!canEdit) return;
    setEditingId(admission.id);
    
    // Parse admission_no into chain / student_number / year (e.g. DUP/STU0084/2016)
    let chain = admission.chain || '';
    let student_number = admission.student_number || '';
    let admission_year = admission.admission_year || '';
    const admission_no = admission.admission_no || '';
    const match = admission_no.match(/^([A-Z]+)\/STU(\d{4})\/(\d{4})$/);
    if (match) {
      chain = chain || match[1];
      student_number = student_number || match[2];
      admission_year = admission_year || match[3];
    }
    
    setForm({
      ...EMPTY_FORM,
      ...admission,
      chain,
      student_number,
      admission_year,
      admission_no,
      passport_photo: admission.passport_photo || '',
    });
    setPhotoPreview(admission.passport_photo || null);
    setShowForm(true);
    setViewingId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const handleView = (admission) => {
    setViewingId(viewingId === admission.id ? null : admission.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this admission record?')) return;
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/admissions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete admission');
      setMessage('Admission record deleted');
      fetchAdmissions();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDownload = (admission) => {
    const safe = (val) => val || '';
    const photoHtml = admission.passport_photo 
      ? `<img src="${admission.passport_photo}" class="photo" alt="Passport Photo" width="20" height="20" style="width:20px;height:20px;object-fit:cover;" />`
      : '<div class="photo-placeholder">No Photo</div>';
    const htmlContent = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <title>Admission Form - ${safe(admission.student_name)}</title>
  <style>
    body { font-family: "Times New Roman", Times, serif; font-size: 10pt; margin: 0.5in; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
    h1 { font-size: 16pt; margin: 0 0 5px 0; }
    h2 { font-size: 11pt; margin: 12px 0 6px 0; border-bottom: 1px solid #000; padding-bottom: 3px; background-color: #e8e8e8; padding: 4px 8px; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 9.5pt; }
    td { padding: 4px 6px; border: 1px solid #999; vertical-align: middle; }
    .label { font-weight: bold; width: 22%; background-color: #f0f0f0; }
    .value { width: 28%; }
    .photo { width: 20px; height: 20px; object-fit: cover; border: 1px solid #000; }
    .photo-placeholder { width: 20px; height: 20px; border: 1px dashed #999; display: flex; align-items: center; justify-content: center; color: #999; font-size: 6pt; }
    .status { font-weight: bold; text-transform: uppercase; }
    .footer { margin-top: 30px; text-align: center; font-size: 9pt; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>STUDENT ADMISSION FORM</h1>
    <div>IHEZA School Management System</div>
  </div>

  <h2>APPLICANT INFORMATION</h2>
  <table>
    <tr>
      <td class="label">Full Name</td><td class="value">${safe(admission.student_name)}</td>
      <td class="label">Gender</td><td class="value">${safe(admission.gender)}</td>
    </tr>
    <tr>
      <td class="label">Date of Birth</td><td class="value">${safe(admission.date_of_birth)}</td>
      <td class="label">Place of Birth</td><td class="value">${safe(admission.place_of_birth)}</td>
    </tr>
    <tr>
      <td class="label">Nationality</td><td class="value">${safe(admission.nationality)}</td>
      <td class="label">Height (cm)</td><td class="value">${safe(admission.height_cm)}</td>
    </tr>
    <tr>
      <td class="label">Weight (kg)</td><td class="value">${safe(admission.weight_kg)}</td>
      <td class="label">Admission Date</td><td class="value">${safe(admission.admission_date)}</td>
    </tr>
    <tr>
      <td class="label">Status</td><td class="value status">${safe(admission.status || 'pending').toUpperCase()}</td>
      <td class="label">Passport Photo</td>
      <td class="value">${photoHtml}</td>
    </tr>
  </table>

  <h2>ADDRESS & CONTACT</h2>
  <table>
    <tr>
      <td class="label">Mkoa (Region)</td><td class="value">${safe(admission.mkoa)}</td>
      <td class="label">Wilaya (District)</td><td class="value">${safe(admission.wilaya)}</td>
    </tr>
    <tr>
      <td class="label">Shehia</td><td class="value">${safe(admission.shehia)}</td>
      <td class="label">Correspondence Address</td><td class="value">${safe(admission.correspondence_address)}</td>
    </tr>
    <tr>
      <td class="label">Phone 1</td><td class="value">${safe(admission.phone_1)}</td>
      <td class="label">Phone 2</td><td class="value">${safe(admission.phone_2)}</td>
    </tr>
    <tr>
      <td class="label">Tribe</td><td class="value">${safe(admission.tribe)}</td>
      <td class="label">Religion</td><td class="value">${safe(admission.religion)}</td>
    </tr>
  </table>

  <h2>LAST SCHOOL & MEDICAL INFORMATION</h2>
  <table>
    <tr>
      <td class="label">Last School</td><td class="value">${safe(admission.last_school)}</td>
      <td class="label">Last School Year</td><td class="value">${safe(admission.last_school_year)}</td>
    </tr>
    <tr>
      <td class="label">Final Exam Result</td><td class="value">${safe(admission.final_exam_result)}</td>
      <td class="label">Medical Information</td><td class="value">${safe(admission.medical_info)}</td>
    </tr>
  </table>

  <h2>PARENTS / GUARDIANS</h2>
  <table>
    <tr>
      <td class="label">Father's Name</td><td class="value">${safe(admission.father_name)}</td>
      <td class="label">Father's Profession</td><td class="value">${safe(admission.father_profession)}</td>
    </tr>
    <tr>
      <td class="label">Mother's Name</td><td class="value">${safe(admission.mother_name)}</td>
      <td class="label">Mother's Profession</td><td class="value">${safe(admission.mother_profession)}</td>
    </tr>
    <tr>
      <td class="label">Emergency Contact 1</td><td class="value">${safe(admission.emergency_contact_1)}</td>
      <td class="label">Emergency Contact 2</td><td class="value">${safe(admission.emergency_contact_2)}</td>
    </tr>
  </table>

  <h2>CONSENT & SIGNATURE</h2>
  <table>
    <tr>
      <td class="label">Guardian 1 Name</td><td class="value">${safe(admission.guardian_1_name)}</td>
      <td class="label">Guardian 1 Signature</td><td class="value">${safe(admission.guardian_1_signature)}</td>
    </tr>
    <tr>
      <td class="label">Guardian 2 Name</td><td class="value">${safe(admission.guardian_2_name)}</td>
      <td class="label">Guardian 2 Signature</td><td class="value">${safe(admission.guardian_2_signature)}</td>
    </tr>
  </table>

  <div class="footer">
    <p>Generated by IHEZA School Management System | ${new Date().toLocaleDateString()}</p>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Admission_Form_${safe(admission.student_name).replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Get unique years from admissions for the year filter dropdown
  const availableYears = [...new Set(
    admissions
      .map(a => {
        // Extract year from admission_date or created_at
        const dateStr = a.admission_date || a.created_at || '';
        const year = dateStr ? String(dateStr).slice(0, 4) : '';
        return year;
      })
      .filter(y => y && /^\d{4}$/.test(y))
  )].sort().reverse();

  const filteredAdmissions = admissions.filter(a => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = (
      (a.student_name || '').toLowerCase().includes(term) ||
      (a.phone_1 || '').toLowerCase().includes(term) ||
      (a.last_school || '').toLowerCase().includes(term) ||
      (a.status || '').toLowerCase().includes(term)
    );
    
    // Year filter: match admission_date or created_at year
    let matchesYear = true;
    if (yearFilter) {
      const dateStr = a.admission_date || a.created_at || '';
      const year = dateStr ? String(dateStr).slice(0, 4) : '';
      matchesYear = year === yearFilter;
    }
    
    return matchesSearch && matchesYear;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAdmissions.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedAdmissions = filteredAdmissions.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const goToPage = (page) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };


  return (

    <div className="admission-wrapper">
      {/* Header */}
      <div className="admission-header">
        <div className="title">
          <UserPlus className="text-blue-600" size={28} />
          <h1>Student Admission</h1>
          <span className="badge">
            {isDirector ? 'Read Only' : 'Manage'}
          </span>
        </div>
        <div className="tools">
          {canEdit && (
            <button 
              className={showForm ? 'danger' : 'primary'}
              onClick={() => {
                if (showForm) {
                  closeForm();
                } else {
                  resetForm();
                  setShowForm(true);
                }
              }}
            >
              {showForm ? <X size={16} /> : <UserPlus size={16} />}
              {showForm ? 'Close Form' : 'New Admission'}
            </button>
          )}
          <button 
            onClick={fetchAdmissions}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className="admission-toast success">
          <CheckCircle2 size={18} />
          {message}
        </div>
      )}
      {error && (
        <div className="admission-toast error">
          <AlertCircle size={18} />
          {error}
        </div>
      )}


      {/* Admission Form */}
      {showForm && canEdit && (
        <div className="admission-card p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {editingId ? 'Edit Admission Application' : 'New Admission Application'}
          </h2>
          
          {/* Passport Photo */}
          <div className="mb-6 flex items-center gap-4">
            <div className="flex-shrink-0">
              {photoPreview ? (
                <img src={photoPreview} alt="Passport" className="admission-photo" />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <Camera className="text-gray-400" size={24} />
                </div>
              )}
            </div>
            <div>
              <label className="admission-label">Passport Photo</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={handlePhotoChange}
                className="text-sm text-gray-600"
              />
            </div>
          </div>

          {/* Section 0: Admission Details (collaborates with Students component) */}
          <div className="admission-section-title">
            <GraduationCap size={18} />
            Admission Details
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="admission-label">School *</label>
              <select 
                className="admission-input" 
                name="chain" 
                value={form.chain || ''} 
                onChange={handleInputChange}
              >
                <option value="">Select School</option>
                <option value="DUP">DUP</option>
                <option value="DLP">DLP</option>
                <option value="LALE">LALE</option>
                <option value="OLGUN">OLGUN</option>
              </select>
            </div>
            <div>
              <label className="admission-label">Student No. *</label>
              <input 
                className="admission-input" 
                name="student_number" 
                value={form.student_number || ''} 
                onChange={handleInputChange}
                placeholder="e.g. 0084"
              />
            </div>
            <div>
              <label className="admission-label">Year *</label>
              <input 
                className="admission-input" 
                type="number"
                name="admission_year" 
                value={form.admission_year || ''} 
                onChange={handleInputChange}
                placeholder="e.g. 2016"
              />
            </div>
            <div className="md:col-span-3">
              <label className="admission-label">Admission Number (cannot be changed)</label>
              <input 
                className="admission-input" 
                name="admission_no" 
                value={form.admission_no || (form.chain && form.student_number ? `${form.chain}/STU${String(form.student_number).padStart(4, '0')}/${form.admission_year || new Date().getFullYear()}` : '')} 
                onChange={handleInputChange}
                disabled
                placeholder="Auto-generated from School, Student No. and Year"
              />
            </div>
          </div>

          {/* Section 1: Personal Information */}
          <div className="admission-section-title">
            <GraduationCap size={18} />
            Personal Information
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="admission-label">First Name *</label>
              <input 
                className="admission-input" 
                name="first_name" 
                value={form.first_name || ''} 
                onChange={handleInputChange}
                placeholder="Student first name"
              />
            </div>
            <div>
              <label className="admission-label">Last Name *</label>
              <input 
                className="admission-input" 
                name="last_name" 
                value={form.last_name || ''} 
                onChange={handleInputChange}
                placeholder="Student last name"
              />
            </div>
            <div>
              <label className="admission-label">Gender *</label>
              <select 
                className="admission-input" 
                name="gender" 
                value={form.gender || ''} 
                onChange={handleInputChange}
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <label className="admission-label">Date of Birth</label>
              <input 
                className="admission-input" 
                type="date"
                name="date_of_birth" 
                value={form.date_of_birth || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Class *</label>
              <input 
                className="admission-input" 
                name="class_name" 
                value={form.class_name || ''} 
                onChange={handleInputChange}
                placeholder="e.g. GRADE 4A"
              />
            </div>
            <div>
              <label className="admission-label">Place of Birth</label>
              <input 
                className="admission-input" 
                name="place_of_birth" 
                value={form.place_of_birth || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Height (cm)</label>
              <input 
                className="admission-input" 
                name="height_cm" 
                value={form.height_cm || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Weight (kg)</label>
              <input 
                className="admission-input" 
                name="weight_kg" 
                value={form.weight_kg || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Nationality</label>
              <input 
                className="admission-input" 
                name="nationality" 
                value={form.nationality || ''} 
                onChange={handleInputChange}
              />
            </div>
          </div>


          {/* Section 2: Address & Contact */}
          <div className="admission-section-title">
            <MapPin size={18} />
            Address & Contact
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="admission-label">Mkoa (Region)</label>
              <input 
                className="admission-input" 
                name="mkoa" 
                value={form.mkoa || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Wilaya (District)</label>
              <input 
                className="admission-input" 
                name="wilaya" 
                value={form.wilaya || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Shehia</label>
              <input 
                className="admission-input" 
                name="shehia" 
                value={form.shehia || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Correspondence Address</label>
              <input 
                className="admission-input" 
                name="correspondence_address" 
                value={form.correspondence_address || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Phone 1</label>
              <input 
                className="admission-input" 
                name="phone_1" 
                value={form.phone_1 || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Phone 2</label>
              <input 
                className="admission-input" 
                name="phone_2" 
                value={form.phone_2 || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Tribe</label>
              <input 
                className="admission-input" 
                name="tribe" 
                value={form.tribe || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Religion</label>
              <input 
                className="admission-input" 
                name="religion" 
                value={form.religion || ''} 
                onChange={handleInputChange}
              />
            </div>
          </div>

          {/* Section 3: Last School & Medical */}
          <div className="admission-section-title">
            <FileText size={18} />
            Last School & Medical Information
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="admission-label">Last School</label>
              <input 
                className="admission-input" 
                name="last_school" 
                value={form.last_school || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Last School Year</label>
              <input 
                className="admission-input" 
                name="last_school_year" 
                value={form.last_school_year || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Final Exam Result</label>
              <input 
                className="admission-input" 
                name="final_exam_result" 
                value={form.final_exam_result || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div className="md:col-span-3">
              <label className="admission-label">Medical Information</label>
              <textarea 
                className="admission-input" 
                rows="3"
                name="medical_info" 
                value={form.medical_info || ''} 
                onChange={handleInputChange}
                placeholder="Any medical conditions, allergies, or special needs"
              />
            </div>
          </div>

          {/* Section 4: Parents / Guardians */}
          <div className="admission-section-title">
            <Users size={18} />
            Parent / Guardian
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="admission-label">Parent Name</label>
              <input 
                className="admission-input" 
                name="parent_name" 
                value={form.parent_name || ''} 
                onChange={handleInputChange}
                placeholder="Parent or guardian name"
              />
            </div>
            <div>
              <label className="admission-label">Parent Phone</label>
              <input 
                className="admission-input" 
                name="parent_phone" 
                value={form.parent_phone || ''} 
                onChange={handleInputChange}
                placeholder="Parent phone number"
              />
            </div>
            <div>
              <label className="admission-label">Father's Name</label>
              <input 
                className="admission-input" 
                name="father_name" 
                value={form.father_name || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Father's Profession</label>
              <input 
                className="admission-input" 
                name="father_profession" 
                value={form.father_profession || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Mother's Name</label>
              <input 
                className="admission-input" 
                name="mother_name" 
                value={form.mother_name || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Mother's Profession</label>
              <input 
                className="admission-input" 
                name="mother_profession" 
                value={form.mother_profession || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Emergency Contact 1</label>
              <input 
                className="admission-input" 
                name="emergency_contact_1" 
                value={form.emergency_contact_1 || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Emergency Contact 2</label>
              <input 
                className="admission-input" 
                name="emergency_contact_2" 
                value={form.emergency_contact_2 || ''} 
                onChange={handleInputChange}
              />
            </div>
          </div>


          {/* Section 5: Consent & Signature */}
          <div className="admission-section-title">
            <CheckCircle2 size={18} />
            Consent & Signature
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="admission-label">Guardian 1 Name</label>
              <input 
                className="admission-input" 
                name="guardian_1_name" 
                value={form.guardian_1_name || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Guardian 1 Signature</label>
              <input 
                className="admission-input" 
                name="guardian_1_signature" 
                value={form.guardian_1_signature || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Guardian 2 Name</label>
              <input 
                className="admission-input" 
                name="guardian_2_name" 
                value={form.guardian_2_name || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Guardian 2 Signature</label>
              <input 
                className="admission-input" 
                name="guardian_2_signature" 
                value={form.guardian_2_signature || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Admission Date</label>
              <input 
                className="admission-input" 
                type="date"
                name="admission_date" 
                value={form.admission_date || ''} 
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="admission-label">Status</label>
              <select 
                className="admission-input" 
                name="status" 
                value={form.status || 'pending'} 
                onChange={handleInputChange}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="left">Left School</option>
                <option value="graduated">Graduated</option>

              </select>

            </div>
          </div>

          {/* New Password */}
          <div className="mb-6">
            <label className="admission-label">New Password (leave blank to keep current)</label>
            <input 
              className="admission-input" 
              type="password"
              name="password" 
              value={form.password || ''} 
              onChange={handleInputChange}
              placeholder="Enter a new password for the student account"
            />
          </div>

          {/* Save / Cancel */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <button 
              className="admission-btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              <Save size={18} />
              {saving ? 'Saving...' : (editingId ? 'Update Admission' : 'Save Admission')}
            </button>
            <button 
              className="admission-btn-secondary"
              onClick={closeForm}
            >
              Cancel
            </button>
          </div>

        </div>
      )}

      {/* Search & Filter (Excel style) */}
      <div className="filter-row">
        <div className="search-box">
          <Search size={16} />
          <input 
            placeholder="Search by name, phone, school, or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={yearFilter}
          onChange={(e) => {
            setYearFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="">All Years</option>
          {availableYears.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        {yearFilter && (
          <button
            className="clear-btn"
            onClick={() => setYearFilter('')}
          >
            Clear
          </button>
        )}
        <span className="filter-stats">
          {filteredAdmissions.length} record{filteredAdmissions.length !== 1 ? 's' : ''}
        </span>
      </div>


      {/* Analytics */}
      {!loading && filteredAdmissions.length > 0 && (
        <div className="grid grid-cols-5 gap-2 mb-3">
          <div className="admission-card p-2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Users className="text-blue-600" size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 leading-tight">
                {filteredAdmissions.filter(a => !['left', 'graduated'].includes((a.status || '').toLowerCase())).length}
              </div>
              <div className="text-[10px] text-gray-500 leading-tight truncate">Total</div>
            </div>
          </div>
          <div className="admission-card p-2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
              <Users className="text-sky-600" size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 leading-tight">
                {filteredAdmissions.filter(a => (a.gender || '').toLowerCase() === 'male' && !['left', 'graduated'].includes((a.status || '').toLowerCase())).length}
              </div>
              <div className="text-[10px] text-gray-500 leading-tight truncate">Male</div>
            </div>
          </div>
          <div className="admission-card p-2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
              <Users className="text-pink-600" size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 leading-tight">
                {filteredAdmissions.filter(a => (a.gender || '').toLowerCase() === 'female' && !['left', 'graduated'].includes((a.status || '').toLowerCase())).length}
              </div>
              <div className="text-[10px] text-gray-500 leading-tight truncate">Female</div>
            </div>
          </div>
          <div className="admission-card p-2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
              <Users className="text-gray-600" size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 leading-tight">
                {filteredAdmissions.filter(a => (a.status || '').toLowerCase() === 'left').length}
              </div>
              <div className="text-[10px] text-gray-500 leading-tight truncate">Left</div>
            </div>
          </div>
          <div className="admission-card p-2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="text-emerald-600" size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 leading-tight">
                {filteredAdmissions.filter(a => (a.status || '').toLowerCase() === 'graduated').length}
              </div>
              <div className="text-[10px] text-gray-500 leading-tight truncate">Graduated</div>
            </div>
          </div>
        </div>
      )}




      {/* Admissions List (Excel style) */}
      <div className="excel-container">
        {loading ? (
          <div className="admission-loading">
            <div className="spinner"></div>
            <p>Loading admissions...</p>
          </div>
        ) : filteredAdmissions.length === 0 ? (
          <div className="admission-empty">
            <i className="fas fa-inbox"></i>
            <h3>{searchTerm ? 'No admissions match your search' : 'No admission records yet'}</h3>
          </div>
        ) : (
          <table className="excel-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Gender</th>
                <th>Contact</th>
                <th>Last School</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAdmissions.map((admission) => (
                <React.Fragment key={admission.id}>
                  <tr>
                    <td>
                      <div className="student-cell">
                        {admission.passport_photo ? (
                          <span 
                            className="photo-thumb"
                            onClick={() => setZoomPhoto(admission.passport_photo)}
                            title="Click to zoom"
                          >
                            <img src={admission.passport_photo} alt="" />
                          </span>
                        ) : (
                          <span className="photo-thumb">
                            <UserPlus className="placeholder-icon" size={18} />
                          </span>
                        )}
                        <div>
                          <div className="name">{admission.student_name || 'Unnamed'}</div>
                          <div className="dob">{admission.date_of_birth || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`gender-badge ${(admission.gender || '').toLowerCase()}`}>
                        {admission.gender || '-'}
                      </span>
                    </td>
                    <td>
                      <div className="contact-cell">
                        <div className="phone">{admission.phone_1 || '-'}</div>
                        <div className="location">{admission.shehia || admission.wilaya || ''}</div>
                      </div>
                    </td>
                    <td>{admission.last_school || '-'}</td>
                    <td>
                      <span className={`status-badge ${(admission.status || 'pending').toLowerCase()}`}>
                        {admission.status === 'left' ? 'LEFT SCHOOL' : admission.status === 'graduated' ? 'GRADUATED' : (admission.status || 'pending').toUpperCase()}
                      </span>

                    </td>
                    <td>
                      {admission.created_at ? new Date(admission.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td>
                      <div className="action-group">
                        <button 
                          onClick={() => handleView(admission)}
                          title="View details"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          className="success"
                          onClick={() => handleDownload(admission)}
                          title="Download Word document"
                        >
                          <Download size={16} />
                        </button>
                        {canEdit && (
                          <button 
                            className="warning"
                            onClick={() => handleEdit(admission)}
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            className="danger"
                            onClick={() => handleDelete(admission.id)}
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {viewingId === admission.id && (
                    <tr>
                      <td colSpan="7">
                        <div className="p-4">
                          <h4 className="font-semibold text-gray-900 mb-3">Admission Details</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500 font-medium mb-1">Applicant Info</p>
                              <p><span className="text-gray-500">DOB:</span> {admission.date_of_birth || '-'}</p>
                              <p><span className="text-gray-500">Place of Birth:</span> {admission.place_of_birth || '-'}</p>
                              <p><span className="text-gray-500">Nationality:</span> {admission.nationality || '-'}</p>
                              <p><span className="text-gray-500">Height:</span> {admission.height_cm || '-'} cm</p>
                              <p><span className="text-gray-500">Weight:</span> {admission.weight_kg || '-'} kg</p>
                            </div>
                            <div>
                              <p className="text-gray-500 font-medium mb-1">Address</p>
                              <p><span className="text-gray-500">Mkoa:</span> {admission.mkoa || '-'}</p>
                              <p><span className="text-gray-500">Wilaya:</span> {admission.wilaya || '-'}</p>
                              <p><span className="text-gray-500">Shehia:</span> {admission.shehia || '-'}</p>
                              <p><span className="text-gray-500">Address:</span> {admission.correspondence_address || '-'}</p>
                              <p><span className="text-gray-500">Phone 2:</span> {admission.phone_2 || '-'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 font-medium mb-1">Parents</p>
                              <p><span className="text-gray-500">Father:</span> {admission.father_name || '-'}</p>
                              <p><span className="text-gray-500">Mother:</span> {admission.mother_name || '-'}</p>
                              <p><span className="text-gray-500">Emergency 1:</span> {admission.emergency_contact_1 || '-'}</p>
                              <p><span className="text-gray-500">Emergency 2:</span> {admission.emergency_contact_2 || '-'}</p>
                              <p><span className="text-gray-500">Medical:</span> {admission.medical_info || '-'}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
        
        {/* Pagination (Excel style) */}
        {!loading && filteredAdmissions.length > 0 && totalPages > 1 && (
          <div className="pagination-bar">
            <div className="info">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredAdmissions.length)} of {filteredAdmissions.length} students
            </div>
            <div className="pages">
              <button
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage <= 1}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={page === safePage ? 'active' : ''}
                  onClick={() => goToPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>


      {/* Photo Zoom Lightbox */}
      {zoomPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomPhoto(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
            onClick={() => setZoomPhoto(null)}
            title="Close"
          >
            <X size={28} />
          </button>
          <img 
            src={zoomPhoto} 
            alt="Zoomed passport photo" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default Admission;

