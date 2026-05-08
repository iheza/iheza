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
}

export const studentService = StudentService;
export default StudentService;
