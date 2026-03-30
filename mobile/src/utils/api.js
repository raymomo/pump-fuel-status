import { storage } from './storage';

export const DOMAIN = 'https://pingnoi.me';
const BASE_URL = `${DOMAIN}/api`;

// Fetch with auth token + auto refresh + 401 handling
const authFetch = async (url, options = {}, role = 'staff') => {
  const data = await storage.get(role);
  const token = data?.token;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  // Auto refresh — backend ส่ง token ใหม่ถ้าใกล้หมดอายุ
  const newToken = res.headers.get('X-New-Token');
  if (newToken && data) {
    await storage.set(role, { ...data, token: newToken });
  }
  // Token หมดอายุ — ลบ session
  if (res.status === 401) {
    await storage.remove(role);
  }
  return res;
};

// ============ PUBLIC ============
export const getProvinces = () =>
  fetch(`${BASE_URL}/provinces`).then(r => r.json());

export const getStationsDots = () =>
  fetch(`${BASE_URL}/stations-dots`).then(r => r.json());

export const getBrands = () =>
  fetch(`${BASE_URL}/brands`).then(r => r.json());

export const getStationsStatus = (provinceId, bustCache = false) => {
  const params = new URLSearchParams();
  if (provinceId) params.set('province_id', provinceId);
  if (bustCache) params.set('nocache', '1');
  const qs = params.toString();
  return fetch(`${BASE_URL}/stations-status${qs ? `?${qs}` : ''}`).then(r => r.json());
};

export const getStation = (id) =>
  fetch(`${BASE_URL}/stations/${id}`).then(r => r.json());

export const getOverview = () =>
  fetch(`${BASE_URL}/overview`).then(r => r.json());

export const getRecentUpdates = () =>
  fetch(`${BASE_URL}/recent-updates`).then(r => r.json());

export const getStationReports = (id) =>
  fetch(`${BASE_URL}/stations/${id}/reports`).then(r => r.json()).catch(() => []);

// ============ PUBLIC USER ============
export const getLineLoginUrl = () => {
  const channelId = '2009571255';
  const callbackUrl = encodeURIComponent(`${DOMAIN}/api/auth/line/callback`);
  const state = Math.random().toString(36).slice(2);
  return `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${callbackUrl}&state=${state}&scope=profile%20openid`;
};

export const submitPublicReport = async (token, data) => {
  const res = await fetch(`${BASE_URL}/public/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  return { ok: res.ok, data: result };
};

// ============ STAFF ============
export const staffLogin = async (username, password) => {
  const res = await fetch(`${BASE_URL}/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
};

export const staffRegister = async (name, username, password, phone) => {
  const res = await fetch(`${BASE_URL}/staff/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, username, password, phone }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
};

export const staffCheck = (id) =>
  fetch(`${BASE_URL}/staff/check/${id}`).then(r => r.json());

export const getStationFuels = (stationId) =>
  fetch(`${BASE_URL}/staff/station/${stationId}/fuels`).then(r => r.json());

export const updateFuelStatus = (body) =>
  authFetch(`${BASE_URL}/staff/fuel-status`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }, 'staff').then(r => r.json());

export const getStationsList = () =>
  fetch(`${BASE_URL}/staff/stations-list`).then(r => r.json());

export const requestJoinStation = (body) =>
  authFetch(`${BASE_URL}/staff/request-join`, {
    method: 'POST',
    body: JSON.stringify(body),
  }, 'staff').then(r => r.json());

export const getMyJoinRequests = (staffId) =>
  fetch(`${BASE_URL}/staff/my-join-requests/${staffId}`).then(r => r.json());

export const requestNewStation = (body) =>
  authFetch(`${BASE_URL}/staff/request-station`, {
    method: 'POST',
    body: JSON.stringify(body),
  }, 'staff').then(r => r.json());

export const getMyStationRequests = (staffId) =>
  fetch(`${BASE_URL}/staff/my-requests/${staffId}`).then(r => r.json());

// ============ ADMIN ============
export const adminLogin = async (username, password) => {
  const res = await fetch(`${BASE_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
};

export const adminFetch = (path, options = {}) =>
  authFetch(`${BASE_URL}/admin${path}`, options, 'admin').then(r => r.json());

// Admin CRUD helpers
export const adminGet = (path) => adminFetch(path);
export const adminPost = (path, body) => adminFetch(path, { method: 'POST', body: JSON.stringify(body) });
export const adminPut = (path, body) => adminFetch(path, { method: 'PUT', body: JSON.stringify(body) });
export const adminDelete = (path) => adminFetch(path, { method: 'DELETE' });
