import { apiClient } from './authService';

class DataService {
  // Classes
  static async getClasses(chain = '') {
    const params = chain ? { chain } : {};
    const response = await apiClient.get('/classes', { params });
    return response.data;
  }

  static async createClass(classData) {
    const response = await apiClient.post('/classes', classData);
    return response.data;
  }

  static async updateClass(id, updates) {
    const response = await apiClient.put(`/classes/${id}`, updates);
    return response.data;
  }

  static async deleteClass(id) {
    const response = await apiClient.delete(`/classes/${id}`);
    return response.data;
  }

  // Subjects
  static async getSubjects(classId = null) {
    const params = classId ? { class_id: classId } : {};
    const response = await apiClient.get('/subjects', { params });
    return response.data;
  }

  static async createSubject(subjectData) {
    const response = await apiClient.post('/subjects', subjectData);
    return response.data;
  }

  static async updateSubject(id, updates) {
    const response = await apiClient.put(`/subjects/${id}`, updates);
    return response.data;
  }

  static async deleteSubject(id) {
    const response = await apiClient.delete(`/subjects/${id}`);
    return response.data;
  }

  // Attendance
  static async getAttendance(filters = {}) {
    const response = await apiClient.get('/attendance', { params: filters });
    return response.data;
  }

  static async recordAttendance(record) {
    const response = await apiClient.post('/attendance', record);
    return response.data;
  }

  static async bulkRecordAttendance(records) {
    const response = await apiClient.post('/attendance/bulk', records);
    return response.data;
  }

  // Grades
  static async getGrades(filters = {}) {
    const response = await apiClient.get('/grades', { params: filters });
    return response.data;
  }

  static async recordGrade(grade) {
    const response = await apiClient.post('/grades', grade);
    return response.data;
  }

  static async updateGrade(id, updates) {
    const response = await apiClient.put(`/grades/${id}`, updates);
    return response.data;
  }

  // Fees
  static async getFees(filters = {}) {
    const response = await apiClient.get('/fees', { params: filters });
    return response.data;
  }

  static async createFee(feeData) {
    const response = await apiClient.post('/fees', feeData);
    return response.data;
  }

  static async updateFee(id, updates) {
    const response = await apiClient.put(`/fees/${id}`, updates);
    return response.data;
  }

  // Tasks
  static async getTasks(filters = {}) {
    const response = await apiClient.get('/tasks', { params: filters });
    return response.data;
  }

  static async createTask(taskData) {
    const response = await apiClient.post('/tasks', taskData);
    return response.data;
  }

  static async updateTask(id, updates) {
    const response = await apiClient.put(`/tasks/${id}`, updates);
    return response.data;
  }

  static async deleteTask(id) {
    const response = await apiClient.delete(`/tasks/${id}`);
    return response.data;
  }

  // Communications
  static async getCommunications(type = null) {
    const params = type ? { type } : {};
    const response = await apiClient.get('/communications', { params });
    return response.data;
  }

  static async createCommunication(commData) {
    const response = await apiClient.post('/communications', commData);
    return response.data;
  }

  // Complaints
  static async getComplaints(status = null) {
    const params = status ? { status } : {};
    const response = await apiClient.get('/complaints', { params });
    return response.data;
  }

  static async createComplaint(complaintData) {
    const response = await apiClient.post('/complaints', complaintData);
    return response.data;
  }

  static async updateComplaint(id, updates) {
    const response = await apiClient.put(`/complaints/${id}`, updates);
    return response.data;
  }

  // Reports
  static async getAttendanceReport(filters = {}) {
    const response = await apiClient.get('/reports/attendance', { params: filters });
    return response.data;
  }

  static async getAcademicReport(filters = {}) {
    const response = await apiClient.get('/reports/academic', { params: filters });
    return response.data;
  }

  static async getFeesReport(filters = {}) {
    const response = await apiClient.get('/reports/fees', { params: filters });
    return response.data;
  }

  // Sync
  // Uses counts_only=true so the Dashboard only downloads document COUNTS
  // instead of the full 1000-student + 1000-user + 100-class + 200-subject
  // arrays (which it only ever used to call .length on). This dramatically
  // cuts memory/bandwidth on every dashboard load.
  static async syncData(chainFilter = '') {
    const params = chainFilter ? { chain: chainFilter, counts_only: true } : { counts_only: true };
    const response = await apiClient.get('/sync', { params });
    return response.data;
  }


  // Seed
  static async seedDatabase() {
    const response = await apiClient.post('/seed');
    return response.data;
  }

  // Users
  static async getUsers() {
    const response = await apiClient.get('/users');
    return response.data;
  }

  static async createUser(userData) {
    const response = await apiClient.post('/users', userData);
    return response.data;
  }

  static async updateUser(id, updates) {
    const response = await apiClient.put(`/users/${id}`, updates);
    return response.data;
  }

  static async deleteUser(id) {
    const response = await apiClient.delete(`/users/${id}`);
    return response.data;
  }
}

export const dataService = DataService;
export default DataService;
