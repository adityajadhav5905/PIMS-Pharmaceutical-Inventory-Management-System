// Use same-origin proxy in dev (see vite.config.js). Override with VITE_API_URL if needed.
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const getToken = () => localStorage.getItem('token');

/** Generic JSON API call with JWT auth. */
const apiCall = async (endpoint, options = {}) => {
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
    });
  } catch {
    throw new Error(
      'Cannot reach the server. Start the backend with: cd server && npm run dev'
    );
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('text/csv')) {
    if (!response.ok) throw new Error('Export failed');
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

/** Trigger browser download for CSV export endpoints. */
const downloadCsv = async (endpoint, filename) => {
  const token = getToken();
  let response;

  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new Error('Cannot reach the server for export.');
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Download failed');
  }

  const blob = await response.blob();
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
  // Auth
  login: (email, password) =>
    apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (name, email, password) =>
    apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  getProfile: () => apiCall('/auth/profile'),

  updateProfile: (data) =>
    apiCall('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Dashboard & financials
  getDashboardStats: () => apiCall('/dashboard/stats'),
  getFinancialSummary: () => apiCall('/financials/summary'),

  // CSV exports
  downloadTransactionsCsv: () => downloadCsv('/export/transactions', 'all-transactions.csv'),
  downloadStockCsv: () => downloadCsv('/export/stock', 'current-stock.csv'),

  // Inventory
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

  getMedicines: () => apiCall('/inventory/medicines'),

  getPrediction: (medicineId) =>
    apiCall('/predictions', {
      method: 'POST',
      body: JSON.stringify({ medicineId }),
    }),

  sellStock: (data) =>
    apiCall('/inventory/sell', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Alerts
  getAlerts: (page = 1, limit = 10, status = '') =>
    apiCall(`/alerts?page=${page}&limit=${limit}&status=${status}`),

  getAlert: (id) => apiCall(`/alerts/${id}`),

  closeAlert: (id) => apiCall(`/alerts/${id}/close`, { method: 'PUT' }),

  // Staff
  getStaff: (page = 1, limit = 10, search = '') =>
    apiCall(`/staff?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`),

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

  deleteStaff: (id) => apiCall(`/staff/${id}`, { method: 'DELETE' }),

  getStaffSales: () => apiCall('/staff/sales'),
};
