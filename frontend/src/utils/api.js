const API = import.meta.env.VITE_API_URL || '/api';

// ============ AUTH ============
export function getToken(role = 'staff') {
  return localStorage.getItem(`${role}_token`);
}

export function authHeaders(role = 'staff') {
  const token = getToken(role);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function authFetch(url, options = {}, role = 'staff') {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(getToken(role) ? { Authorization: `Bearer ${getToken(role)}` } : {}),
    ...(isFormData ? {} : options.headers || {}),
  };
  return fetch(url, { ...options, headers }).then(async (res) => {
    if (res.status === 401) {
      localStorage.removeItem(`${role}_token`);
      localStorage.removeItem(role);
      if (role === 'admin') window.location.href = '/admin';
      else window.location.href = '/staff';
    }
    const newToken = res.headers.get('X-New-Token');
    if (newToken) localStorage.setItem(`${role}_token`, newToken);
    return res;
  });
}

// ============ PUBLIC ============
export const fetchProvinces = () => fetch(`${API}/provinces`).then(r => r.json());
export const fetchBrands = () => fetch(`${API}/brands`).then(r => r.json());
export const fetchStationsDots = () => fetch(`${API}/stations-dots`).then(r => r.json());
export const fetchStationsStatus = (provinceId) => {
  const url = provinceId ? `${API}/stations-status?province_id=${provinceId}` : `${API}/stations-status`;
  return fetch(url).then(r => r.json());
};
export const fetchStation = (id) => fetch(`${API}/stations/${id}`).then(r => r.json());
export const fetchOverview = () => fetch(`${API}/overview`).then(r => r.json());
export const fetchRecentUpdates = () => fetch(`${API}/recent-updates`).then(r => r.json());

// ============ ADMIN ============
export const adminFetch = (path, options = {}) => authFetch(`${API}/admin${path}`, options, 'admin').then(r => r.json());

export { API };
