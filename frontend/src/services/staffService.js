import { apiClient } from './authService';

class StaffService {
  static async getStaff(roleFilter = null, chainFilter = null) {
    const params = {};
    if (roleFilter) params.role = roleFilter;
    if (chainFilter) params.chain = chainFilter;
    const response = await apiClient.get('/staff', { params });
    return response.data;
  }

  static async getStaffMember(id) {
    const response = await apiClient.get(`/staff/${id}`);
    return response.data;
  }

  static async createStaff(staffData) {
    const response = await apiClient.post('/staff', staffData);
    return response.data;
  }

  static async updateStaff(id, updates) {
    const response = await apiClient.put(`/staff/${id}`, updates);
    return response.data;
  }

  static async deleteStaff(id) {
    const response = await apiClient.delete(`/staff/${id}`);
    return response.data;
  }
}

export const staffService = StaffService;
export default StaffService;
