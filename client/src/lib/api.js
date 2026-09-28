// Resolve API URL dynamically from VITE_API_URL (e.g. for Vercel pointing to Render backend)
const resolveApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return '/api/v1';
  const clean = envUrl.trim().replace(/\/$/, '');
  return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
};
const API_URL = resolveApiUrl();

const getToken = () => localStorage.getItem('token');
const setToken = (t) => localStorage.setItem('token', t);
const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

const onTokenRefreshed = (newToken) => {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
};

/**
 * Attempt to refresh expired access token.
 */
const refreshAccessToken = async () => {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!res.ok) {
      clearAuth();
      return null;
    }

    const data = await res.json();
    const newToken = data.data?.accessToken;
    if (newToken) {
      setToken(newToken);
      return newToken;
    }
    clearAuth();
    return null;
  } catch {
    clearAuth();
    return null;
  }
};

/** Generic JSON API call with JWT auth and automatic 401 token refresh. */
const apiCall = async (endpoint, options = {}, isRetry = false) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new Error(
      'Cannot reach the server. Start the backend with: npm start'
    );
  }

  // Handle 401 Unauthorized (expired token) with automatic refresh & retry
  if (response.status === 401 && !isRetry && endpoint !== '/auth/login' && endpoint !== '/auth/register' && endpoint !== '/auth/refresh') {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;

      if (newToken) {
        onTokenRefreshed(newToken);
        return apiCall(endpoint, options, true);
      } else {
        onTokenRefreshed(null);
        clearAuth();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        throw new Error('Session expired. Please log in again.');
      }
    } else {
      // Queue requests while token is refreshing
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((newToken) => {
          if (newToken) {
            resolve(apiCall(endpoint, options, true));
          } else {
            reject(new Error('Session expired. Please log in again.'));
          }
        });
      });
    }
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('text/csv') || options.headers?.Accept === 'text/csv') {
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Export failed');
    }
    return response.blob();
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? 'Invalid response from server'
        : `Server error (${response.status}). Is the backend running?`
    );
  }

  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }

  return data;
};

/** Trigger browser download for CSV export endpoints with 401 refresh & retry support. */
const downloadCsv = async (endpoint, filename) => {
  const blob = await apiCall(endpoint, {
    headers: { Accept: 'text/csv' }
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const api = {
  // Auth & OTP
  login: (email, password, pharmacyId) =>
    apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, pharmacyId }),
    }),

  sendRegistrationOtp: (email, pharmacyId, name) =>
    apiCall('/auth/send-registration-otp', {
      method: 'POST',
      body: JSON.stringify({ email, pharmacyId, name }),
    }),

  register: (name, email, password, pharmacyId, otp) =>
    apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, pharmacyId, otp }),
    }),

  sendSettingsOtp: (action = 'SETTINGS_UPDATE') =>
    apiCall('/auth/send-settings-otp', {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),

  logout: () => {
    clearAuth();
    return apiCall('/auth/logout', { method: 'POST' }).catch(() => ({}));
  },

  getProfile: () => apiCall('/auth/profile'),

  updateProfile: (data) =>
    apiCall('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Notification preferences
  getPreferences: () => apiCall('/auth/preferences'),

  updatePreferences: (data) =>
    apiCall('/auth/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Dashboard & financials
  getDashboardStats: () => apiCall('/dashboard/stats'),
  getFinancialSummary: () => apiCall('/financials/summary'),
  getEmployeePerformance: () => apiCall('/financials/employee-performance'),

  // CSV exports
  downloadTransactionsCsv: () => downloadCsv('/export/transactions', 'all-transactions.csv'),
  downloadStockCsv: () => downloadCsv('/export/stock', 'current-stock.csv'),
  downloadStaffPerformanceCsv: () => downloadCsv('/export/staff-performance', 'employee-performance.csv'),

  // Medicine catalog
  getMedicines: () => apiCall('/inventory/medicines'),
  getMedicine: (id) => apiCall(`/inventory/medicines/${id}`),
  createMedicine: (data) =>
    apiCall('/inventory/medicines', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateMedicine: (id, data) =>
    apiCall(`/inventory/medicines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteMedicine: (id) => apiCall(`/inventory/medicines/${id}`, { method: 'DELETE' }),

  // Inventory batches
  getInventory: (page = 1, limit = 10, search = '') =>
    apiCall(`/inventory?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`),

  getAvailableStock: () => apiCall('/inventory/available'),

  createInventory: (data) =>
    apiCall('/inventory', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateInventory: (id, data) =>
    apiCall(`/inventory/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteInventory: (id) => apiCall(`/inventory/${id}`, { method: 'DELETE' }),

  // Sales
  sellStock: (data) =>
    apiCall('/inventory/sell', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Predictions - accept optional periods param
  getPrediction: (medicineId, periods = 30) =>
    apiCall('/predictions', {
      method: 'POST',
      body: JSON.stringify({ medicineId, periods }),
    }),

  getPredictionHistory: (page = 1, limit = 20, medicineId = null) => {
    let url = `/predictions/history?page=${page}&limit=${limit}`;
    if (medicineId) url += `&medicineId=${medicineId}`;
    return apiCall(url);
  },

  // Alerts
  getAlerts: (page = 1, limit = 10, status = '') =>
    apiCall(`/alerts?page=${page}&limit=${limit}&status=${status}`),

  getAlert: (id) => apiCall(`/alerts/${id}`),

  closeAlert: (id) => apiCall(`/alerts/${id}/close`, { method: 'PUT' }),

  // Staff
  getStaff: (page = 1, limit = 10, search = '') =>
    apiCall(`/staff?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`),

  sendStaffOtp: (action = 'create', staffName = '', staffId = '') =>
    apiCall('/staff/send-otp', {
      method: 'POST',
      body: JSON.stringify({ action, staffName, staffId }),
    }),

  createStaff: (data) =>
    apiCall('/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateStaff: (id, data) =>
    apiCall(`/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteStaff: (id, otp) =>
    apiCall(`/staff/${id}${otp ? `?otp=${encodeURIComponent(otp)}` : ''}`, {
      method: 'DELETE',
      body: otp ? JSON.stringify({ otp }) : undefined,
    }),

  getStaffSales: () => apiCall('/staff/sales'),

  // Help & Support
  submitSupportTicket: (data) =>
    apiCall('/support', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSupportTickets: (status = '', search = '') => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    const qs = params.toString();
    return apiCall(qs ? `/support?${qs}` : '/support');
  },

  updateTicketStatus: (id, status) =>
    apiCall(`/support/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
