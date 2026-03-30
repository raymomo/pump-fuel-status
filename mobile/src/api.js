import { DOMAIN } from './utils/api';
const API_URL = `${DOMAIN}/api`;

export const api = {
  // Public
  getProvinces: () => fetch(`${API_URL}/provinces`).then(r => r.json()),
  getStationsStatus: (provinceId) => {
    const url = provinceId ? `${API_URL}/stations-status?province_id=${provinceId}` : `${API_URL}/stations-status`;
    return fetch(url).then(r => r.json());
  },
  getStation: (id) => fetch(`${API_URL}/stations/${id}`).then(r => r.json()),
  getOverview: () => fetch(`${API_URL}/overview`).then(r => r.json()),

  // Staff
  staffLogin: (username, password) =>
    fetch(`${API_URL}/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(r => r.json().then(d => ({ ok: r.ok, data: d }))),

  getStationFuels: (stationId) =>
    fetch(`${API_URL}/staff/station/${stationId}/fuels`).then(r => r.json()),

  updateFuelStatus: (body) =>
    fetch(`${API_URL}/staff/fuel-status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  // Admin
  adminLogin: (username, password) =>
    fetch(`${API_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(r => r.json().then(d => ({ ok: r.ok, data: d }))),

  getAdminStations: () => fetch(`${API_URL}/admin/stations`).then(r => r.json()),
  getAdminStaff: () => fetch(`${API_URL}/admin/staff`).then(r => r.json()),

  createStation: (body) =>
    fetch(`${API_URL}/admin/stations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  deleteStation: (id) =>
    fetch(`${API_URL}/admin/stations/${id}`, { method: 'DELETE' }).then(r => r.json()),

  createStaff: (body) =>
    fetch(`${API_URL}/admin/staff`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  deleteStaff: (id) =>
    fetch(`${API_URL}/admin/staff/${id}`, { method: 'DELETE' }).then(r => r.json()),

  createProvince: (name) =>
    fetch(`${API_URL}/admin/provinces`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then(r => r.json()),
  deleteProvince: (id) =>
    fetch(`${API_URL}/admin/provinces/${id}`, { method: 'DELETE' }).then(r => r.json()),
};
