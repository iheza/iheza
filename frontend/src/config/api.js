// Centralized API URL configuration
// Handles both production (iheza.online) and preview environments

export const getApiBaseUrl = () => {
  // Prefer same-origin whenever the app is served through the reverse proxy
  // (nginx routes /api/* to the backend). This avoids hard-coding a preview
  // URL that goes stale when the environment is re-created.
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }

  // Fallback for non-browser contexts (SSR/tests)
  return process.env.REACT_APP_BACKEND_URL || '';
};


export const API_URL = getApiBaseUrl();
export const API = `${API_URL}/api`;

export default API_URL;
