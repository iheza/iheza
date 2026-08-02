import axios from 'axios';
import { getApiBaseUrl } from '../config/api';

const API_BASE_URL = getApiBaseUrl();
const API = `${API_BASE_URL}/api`;

class AuthService {
  static async login(accessCode, password, portal, chain = null) {
    try {
      const requestBody = {
        accessCode: accessCode.trim().toUpperCase(),
        password,
        portal
      };
      
      // Add chain parameter if provided
      if (chain) {
        requestBody.chain = chain;
      }
      
      if (portal && portal.toLowerCase() === 'student') {
        requestBody.admissionNumber = accessCode;
      }
      
      const response = await axios.post(`${API}/auth`, requestBody);
      const data = response.data;

      if (!data.success) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('sessionToken', data.sessionToken);
      localStorage.setItem('currentPortal', data.portal);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('sessionExpiresAt', data.expiresAt);

      return {
        success: true,
        user: data.user,
        portal: data.portal,
        sessionToken: data.sessionToken,
        expiresAt: data.expiresAt
      };

    } catch (error) {
      console.error('Login error:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Login failed');
    }
  }

  static async logout() {
    try {
      await axios.post(`${API}/auth/logout`);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('currentPortal');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('sessionExpiresAt');
    }
  }

  static isAuthenticated() {
    return localStorage.getItem('isLoggedIn') === 'true';
  }

  static getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
  }

  static getCurrentPortal() {
    return localStorage.getItem('currentPortal');
  }

  static getToken() {
    return localStorage.getItem('sessionToken');
  }
}

// Create axios instance with auth header
export const apiClient = axios.create({
  baseURL: API,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = AuthService.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle 401 errors (expired tokens)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid - log out
      console.warn('Session expired or invalid. Logging out...');
      AuthService.logout();
      // Redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authService = AuthService;
export default AuthService;
