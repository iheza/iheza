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
  // Give requests a reasonable timeout so a hung origin connection
  // (which Cloudflare reports as ERR_HTTP2_PROTOCOL_ERROR / 520) fails
  // fast and can be retried instead of hanging the UI.
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  const token = AuthService.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Retry transient failures caused by the origin server briefly dropping the
// connection mid-response (Cloudflare ERR_HTTP2_PROTOCOL_ERROR / 520 spam).
//
// IMPORTANT: 502/503/504 are deliberately NOT retried. Those statuses mean
// the origin is OVERLOADED — retrying immediately only adds more load and
// turns a transient blip into a sustained outage (retry-storm feedback loop).
// We only retry true origin-connection drops (520/521/522/524) and network
// errors (no response), which are safe to retry a couple of times.
const RETRYABLE_STATUS = [520, 521, 522, 524];
const MAX_RETRIES = 1;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- Circuit breaker -----------------------------------------------------
// After N consecutive retryable failures, open the circuit for a cooldown
// window. While open, no further retries are attempted (requests fail fast)
// so the origin gets a chance to recover instead of being hammered.
const CIRCUIT_BREAKER = {
  consecutiveFailures: 0,
  MAX_CONSECUTIVE_FAILURES: 3,
  openUntil: 0,
  COOLDOWN_MS: 30000,
  isOpen() {
    if (Date.now() > this.openUntil) {
      // Cooldown expired — close the circuit and reset.
      this.consecutiveFailures = 0;
      return false;
    }
    return true;
  },
  recordFailure() {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      this.openUntil = Date.now() + this.COOLDOWN_MS;
      console.warn(
        `Circuit breaker opened: ${this.consecutiveFailures} consecutive ` +
        `failures. Pausing retries for ${this.COOLDOWN_MS / 1000}s.`
      );
    }
  },
  recordSuccess() {
    this.consecutiveFailures = 0;
  },
};

// Response interceptor to handle 401 errors (expired tokens) and retry
// transient origin/network failures.
apiClient.interceptors.response.use(
  (response) => {
    // Any successful response closes the circuit.
    CIRCUIT_BREAKER.recordSuccess();
    return response;
  },
  async (error) => {
    const { config, response } = error;

    // 401 = token expired/invalid -> log out (never retry)
    if (response && response.status === 401) {
      console.warn('Session expired or invalid. Logging out...');
      AuthService.logout();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Determine if this is a retryable failure:
    //  - A 520/521/522/524 (Cloudflare origin-connection drop)
    //  - A network error (no response) which is what surfaces as
    //    ERR_HTTP2_PROTOCOL_ERROR in the browser
    const isRetryable =
      (response && RETRYABLE_STATUS.includes(response.status)) ||
      (!response && error.code !== 'ECONNABORTED');

    // Respect per-request opt-out (e.g. config.retry === 0)
    const retriesLeft = config.__retryCount ?? MAX_RETRIES;

    // Circuit breaker: if open, fail fast — do NOT retry.
    if (isRetryable && retriesLeft > 0 && !CIRCUIT_BREAKER.isOpen()) {
      config.__retryCount = retriesLeft - 1;
      CIRCUIT_BREAKER.recordFailure();
      // Longer backoff so the origin has time to recover: 2s, then 4s.
      const delay = 2000 * (MAX_RETRIES - retriesLeft + 1);
      await sleep(delay);
      return apiClient(config);
    }

    return Promise.reject(error);
  }
);

// NOTE: A previous "request coalescing" interceptor here was REMOVED because
// it was fatally buggy. It called `apiClient(config)` recursively from inside
// the request interceptor, which created a self-referential promise that never
// resolved — causing EVERY GET request to hang forever (attendance "loads
// forever", students/classes appear empty). The retry + circuit-breaker logic
// above already prevents retry storms, so no separate coalescing layer is
// needed. If coalescing is ever re-added, it must be implemented via the axios
// adapter (not a request interceptor) to avoid recursion.

export const authService = AuthService;
export default AuthService;
