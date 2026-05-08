// Centralized API URL configuration
// Handles both production (iheza.online) and preview environments

export const getApiBaseUrl = () => {
  // Check if we're in a browser
  if (typeof window !== 'undefined') {
    const currentHost = window.location.hostname;
    
    // If we're on iheza.online (production), use same origin
    if (currentHost === 'iheza.online' || currentHost === 'www.iheza.online') {
      return window.location.origin;
    }
  }
  
  // Otherwise use environment variable (for preview/development)
  return process.env.REACT_APP_BACKEND_URL || '';
};

export const API_URL = getApiBaseUrl();
export const API = `${API_URL}/api`;

export default API_URL;
