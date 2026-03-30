import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

import { API } from '../utils/api';

const adminFetch = (url, options = {}) => {
  const token = localStorage.getItem('admin_token');
  const isFormData = options.body instanceof FormData;
  return fetch(url, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(isFormData ? {} : options.headers || {}),
    },
  }).then(res => {
    // Token หมดอายุ → redirect ไป login
    if (res.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin');
      window.location.href = '/admin';
      return res;
    }
    // Auto refresh token ถ้าใกล้หมดอายุ
    const newToken = res.headers.get('X-New-Token');
    if (newToken) {
      localStorage.setItem('admin_token', newToken);
    }
    return res;
  });
};

function AdminDashboard() {
  const [admin, setAdmin] = useState(null);
  const [tab, setTab] = useState('stations');
  const [stations, setStations] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [requests, setRequests] = useState([]);
  const [joinReqs, setJoinReqs] = useState([]);
  const [fuelTypes, setFuelTypes] = useState([]);
  const [brandsList, setBrandsList] = useState([]);
  const [fuelProvinceFilter, setFuelProvinceFilter] = useState('');
  const [fuelPage, setFuelPage] = useState(1);
  const fuelPerPage = 20;
  const [admins, setAdmins] = useState([]);
  const [auditLogs, setAuditLogs] = useState({ logs: [], total: 0, page: 1, totalPages: 1 });
  const [auditPage, setAuditPage] = useState(1);
  const [settings, setSettings] = useState([]);
  const perPage = 20;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const stored = localStorage.getItem('admin');
    const token = localStorage.getItem('admin_token');
    if (!stored || !token) { navigate('/admin'); return; }
    setAdmin(JSON.parse(stored));
    loadAll();
    loadSettings();
  }, [navigate]);

  // Auto open edit modal from query string ?edit=ID
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && stations.length > 0) {
      const station = stations.find(s => s.id === parseInt(editId));
      if (station) {
        setTab('stations');
        setModal({ type: 'station', data: station });
        setSearchParams({});
      }
    }
  }, [searchParams, stations]);

  const loadAll = async () => {
    const [stData, staffData, provData, reqData, ftData, brData] = await Promise.all([
      adminFetch(`${API}/admin/stations`).then(r => r.json()),
      adminFetch(`${API}/admin/staff`).then(r => r.json()),
      fetch(`${API}/provinces`).then(r => r.json()),
      adminFetch(`${API}/admin/station-requests`).then(r => r.json()),
      adminFetch(`${API}/admin/fuel-types`).then(r => r.json()),
      adminFetch(`${API}/admin/brands`).then(r => r.json()),
    ]);
    // Load fuel types per station (1 request instead of N)
    const fuelsMap = await adminFetch(`${API}/admin/stations-fuels`).then(r => r.json());
    const stationsWithFuels = stData.map(s => ({ ...s, _fuels: fuelsMap[s.id] || [] }));
    setStations(stationsWithFuels);
    setStaffList(staffData);
    setProvinces(provData);
    setRequests(reqData);
    setFuelTypes(ftData);
    setBrandsList(Array.isArray(brData) ? brData : []);
    adminFetch(`${API}/admin/admins`).then(r => r.json()).then(setAdmins);
    adminFetch(`${API}/admin/join-requests`).then(r => r.json()).then(setJoinReqs).catch(() => {});
  };

  const loadAuditLogs = (p = 1) => {
    adminFetch(`${API}/admin/audit-logs?page=${p}&limit=20`).then(r => r.json()).then(d => { setAuditLogs(d); setAuditPage(p); });
  };

  const loadSettings = () => {
    adminFetch(`${API}/admin/settings`).then(r => r.json()).then(d => { if (Array.isArray(d)) setSettings(d); });
  };

  const toggleSetting = async (key) => {
    const current = settings.find(s => s.key === key);
    const newValue = current?.value === 'true' ? 'false' : 'true';
    await adminFetch(`${API}/admin/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: newValue, admin_name: admin?.name }),
    });
    loadSettings();
  };

  const handleLogout = () => { localStorage.removeItem('admin'); localStorage.removeItem('admin_token'); navigate('/admin'); };

  const deleteStation = async (id, name) => {
    if (!confirm(`ลบปั๊ม "${name}" ?`)) return;
    await adminFetch(`${API}/admin/stations/${id}`, { method: 'DELETE' });
    loadAll();
  };

  const deleteStaff = async (id, name) => {
    if (!confirm(`ลบพนักงาน "${name}" ?`)) return;
    await adminFetch(`${API}/admin/staff/${id}`, { method: 'DELETE' });
    loadAll();
  };

  const deleteProvince = async (id, name) => {
    if (!confirm(`ลบจังหวัด "${name}" ?`)) return;
    const res = await adminFetch(`${API}/admin/provinces/${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); alert(d.error); return; }
    loadAll();
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = (ids) => {
    const allSelected = ids.every(id => selected.has(id));
    const next = new Set(selected);
    ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
    setSelected(next);
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    const type = tab === 'stations' ? 'ปั๊ม' : tab === 'staff' ? 'พนักงาน' : 'จังหวัด';
    if (!confirm(`ลบ ${selected.size} ${type} ที่เลือก?`)) return;

    const endpoint = tab === 'stations' ? 'stations' : tab === 'staff' ? 'staff' : 'provinces';
    const errors = [];
    for (const id of selected) {
      const res = await adminFetch(`${API}/admin/${endpoint}/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); errors.push(d.error); }
    }
    if (errors.length > 0) alert('บางรายการลบไม่ได้: ' + errors.join(', '));
    setSelected(new Set());
    loadAll();
  };

  const approveRequest = async (id) => {
    const note = prompt('หมายเหตุ (ถ้ามี):') ?? '';
    await adminFetch(`${API}/admin/station-requests/${id}/approve`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_note: note }) });
    loadAll();
  };

  const rejectRequest = async (id) => {
    const note = prompt('เหตุผลที่ไม่อนุมัติ:');
    if (note === null) return;
    await adminFetch(`${API}/admin/station-requests/${id}/reject`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_note: note }) });
    loadAll();
  };

  const deleteFuelType = async (id, name) => {
    if (!confirm(`ลบชนิดน้ำมัน "${name}" ออกจากทุกปั๊ม?`)) return;
    await adminFetch(`${API}/admin/fuel-types/${id}`, { method: 'DELETE' });
    loadAll();
  };

  const addFuelType = () => setModal({ type: 'fueltype' });

  const toggleStationFuel = async (stationId, fuelName, enabled) => {
    if (enabled) {
      await adminFetch(`${API}/admin/stations/${stationId}/fuels/${encodeURIComponent(fuelName)}`, { method: 'DELETE' });
    } else {
      await adminFetch(`${API}/admin/stations/${stationId}/fuels`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fuel_type: fuelName }),
      });
    }
  };

  const addAdmin = () => setModal({ type: 'admin' });

  const deleteAdmin = async (id, name) => {
    if (!confirm(`ลบผู้ดูแล "${name}" ?`)) return;
    const res = await adminFetch(`${API}/admin/admins/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    loadAll();
  };

  const approveJoin = async (id) => {
    await adminFetch(`${API}/admin/join-requests/${id}/approve`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    loadAll();
  };

  const rejectJoin = async (id) => {
    const note = prompt('เหตุผล:');
    if (note === null) return;
    await adminFetch(`${API}/admin/join-requests/${id}/reject`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_note: note }) });
    loadAll();
  };

  const pendingJoins = joinReqs.filter(r => r.status === 'pending');
  const pendingRequests = requests.filter(r => r.status === 'pending');

  if (!admin) return <div className="loading">กำลังโหลด...</div>;

  // Filter by search + brand
  const q = search.toLowerCase();
  const brands = [...new Set(stations.map(s => s.brand))].sort();
  const filteredStations = stations.filter(s => {
    if (brandFilter && s.brand !== brandFilter) return false;
    if (provinceFilter && String(s.province_id) !== provinceFilter) return false;
    if (q && !s.name.toLowerCase().includes(q) && !s.brand.toLowerCase().includes(q) && !s.province_name.toLowerCase().includes(q)) return false;
    return true;
  });
  const filteredStaff = q ? staffList.filter(s => s.name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q) || s.station_name.toLowerCase().includes(q)) : staffList;
  const filteredProvinces = q ? provinces.filter(p => p.name.toLowerCase().includes(q)) : provinces;

  const currentList = tab === 'stations' ? filteredStations : tab === 'staff' ? filteredStaff : tab === 'provinces' ? filteredProvinces : tab === 'fueltypes' ? fuelTypes : tab === 'admins' ? admins : [];
  const currentCount = currentList.length;
  const totalPages = Math.max(1, Math.ceil(currentCount / perPage));
  const safePage = Math.min(page, totalPages);
  const pagedStations = filteredStations.slice((safePage - 1) * perPage, safePage * perPage);
  const pagedStaff = filteredStaff.slice((safePage - 1) * perPage, safePage * perPage);
  const pagedProvinces = filteredProvinces.slice((safePage - 1) * perPage, safePage * perPage);
  const pagedFuelTypes = fuelTypes.slice((safePage - 1) * perPage, safePage * perPage);
  const pagedAdmins = admins.slice((safePage - 1) * perPage, safePage * perPage);

  const Pagination = () => {
    if (totalPages <= 1) return null;
    const pages = [];
    const maxShow = 5;
    let start = Math.max(1, safePage - Math.floor(maxShow / 2));
    let end = Math.min(totalPages, start + maxShow - 1);
    if (end - start < maxShow - 1) start = Math.max(1, end - maxShow + 1);

    for (let i = start; i <= end; i++) pages.push(i);

    return (
      <div className="pagination">
        <button disabled={safePage <= 1} onClick={() => setPage(1)}>«</button>
        <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>‹</button>
        {start > 1 && <span className="pagination-dots">...</span>}
        {pages.map(p => (
          <button key={p} className={p === safePage ? 'pagination-active' : ''} onClick={() => setPage(p)}>{p}</button>
        ))}
        {end < totalPages && <span className="pagination-dots">...</span>}
        <button disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>›</button>
        <button disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>»</button>
        <span className="pagination-info">{currentCount} รายการ</span>
      </div>
    );
  };

  // Sidebar
  const sidebar = (
    <div className="sidebar-inner">
      <div className="sidebar-section">
        <label className="sidebar-label">🔍 ค้นหา</label>
        <input
          type="text"
          className="sidebar-search"
          placeholder={tab === 'stations' ? 'ชื่อปั๊ม, แบรนด์...' : tab === 'staff' ? 'ชื่อพนักงาน...' : 'ชื่อจังหวัด...'}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {tab === 'stations' && (
        <>
          <div className="sidebar-section">
            <label className="sidebar-label">📍 จังหวัด</label>
            <select className="sidebar-select" value={provinceFilter} onChange={e => { setProvinceFilter(e.target.value); setPage(1); }}>
              <option value="">ทุกจังหวัด</option>
              {provinces.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </select>
          </div>
          <div className="sidebar-section">
            <label className="sidebar-label">🏷️ แบรนด์</label>
            <select className="sidebar-select" value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setPage(1); }}>
              <option value="">ทุกแบรนด์</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </>
      )}

      <div className="sidebar-section">
        <label className="sidebar-label">📂 เมนูจัดการ</label>
        <div className="sidebar-filters">
          <button className={`sidebar-filter-btn ${tab === 'stations' ? 'active' : ''}`} onClick={() => { setTab('stations'); setSearch(''); setPage(1); }}>
            ⛽ ปั๊ม ({stations.length})
          </button>
          <button className={`sidebar-filter-btn ${tab === 'staff' ? 'active' : ''}`} onClick={() => { setTab('staff'); setSearch(''); setPage(1); }}>
            👤 พนักงาน ({staffList.length})
          </button>
          <button className={`sidebar-filter-btn ${tab === 'provinces' ? 'active' : ''}`} onClick={() => { setTab('provinces'); setSearch(''); setPage(1); }}>
            📍 จังหวัด ({provinces.length})
          </button>
          <button className={`sidebar-filter-btn ${tab === 'fueltypes' ? 'active' : ''}`} onClick={() => { setTab('fueltypes'); setSearch(''); setPage(1); }}>
            🛢️ ชนิดน้ำมัน ({fuelTypes.length})
          </button>
          <button className={`sidebar-filter-btn ${tab === 'brands' ? 'active' : ''}`} onClick={() => { setTab('brands'); setSearch(''); setPage(1); }}>
            🏷️ แบรนด์ ({brandsList.length})
          </button>
          <button className={`sidebar-filter-btn ${tab === 'requests' ? 'active' : ''}`} onClick={() => { setTab('requests'); setSearch(''); setPage(1); }} style={pendingRequests.length > 0 ? { borderColor: '#e65100', background: '#fff3e0' } : {}}>
            📨 คำขอ {(pendingRequests.length + pendingJoins.length) > 0 && <span style={{ background: '#e65100', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 11, marginLeft: 4 }}>{pendingRequests.length + pendingJoins.length}</span>}
          </button>
          <button className={`sidebar-filter-btn ${tab === 'admins' ? 'active' : ''}`} onClick={() => { setTab('admins'); setSearch(''); setPage(1); }}>
            🛡️ ผู้ดูแลระบบ ({admins.length})
          </button>
          <button className={`sidebar-filter-btn ${tab === 'audit' ? 'active' : ''}`} onClick={() => { setTab('audit'); loadAuditLogs(1); }}>
            📋 Audit Log
          </button>
          <button className={`sidebar-filter-btn ${tab === 'settings' ? 'active' : ''}`} onClick={() => { setTab('settings'); loadSettings(); }}>
            ⚙️ ตั้งค่าระบบ
          </button>
        </div>
      </div>

      <div className="sidebar-section">
        <label className="sidebar-label">📊 สรุป</label>
        <div className="sidebar-stats">
          <div className="sidebar-stat">
            <div className="sidebar-stat-num">{stations.length}</div>
            <div className="sidebar-stat-label">ปั๊ม</div>
          </div>
          <div className="sidebar-stat">
            <div className="sidebar-stat-num">{staffList.length}</div>
            <div className="sidebar-stat-label">พนักงาน</div>
          </div>
          <div className="sidebar-stat">
            <div className="sidebar-stat-num">{provinces.length}</div>
            <div className="sidebar-stat-label">จังหวัด</div>
          </div>
        </div>
      </div>

      <div className="sidebar-section sidebar-links">
        <Link to="/" className="sidebar-link">⛽ หน้าเช็คน้ำมัน</Link>
        <Link to="/overview" className="sidebar-link">📊 ภาพรวมประเทศ</Link>
        <button className="sidebar-link" onClick={() => setModal({ type: 'changePassword' })} style={{ border: 'none', background: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, fontSize: 14 }}>
          🔑 เปลี่ยนรหัสผ่าน
        </button>
        <button className="sidebar-link" onClick={handleLogout} style={{ border: 'none', background: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', color: '#c62828', fontWeight: 600, padding: '10px 12px', borderRadius: 8, fontSize: 14 }}>
          🚪 ออกจากระบบ
        </button>
      </div>
    </div>
  );

  // Mobile: Cards
  const renderCards = () => (
    <div className="admin-content">
      {tab === 'stations' && (
        <>
          <button className="admin-add-btn" onClick={() => setModal({ type: 'station', data: null })}>+ เพิ่มปั๊มใหม่</button>
          {pagedStations.map(s => (
            <div className="admin-card" key={s.id}>
              <div className="admin-card-main">
                <div className="admin-card-title">{s.name}</div>
                <div className="admin-card-sub"><span className={`station-brand brand-${s.brand}`}>{s.brand}</span> {s.province_name} — {s.staff_count} พนักงาน</div>
                <div className="admin-card-sub">{s.address}</div>
              </div>
              <div className="admin-card-actions">
                <button className="admin-btn edit" onClick={() => setModal({ type: 'station', data: s })}>แก้ไข</button>
                <button className="admin-btn delete" onClick={() => deleteStation(s.id, s.name)}>ลบ</button>
              </div>
            </div>
          ))}
        </>
      )}
      {tab === 'staff' && (
        <>
          <button className="admin-add-btn" onClick={() => setModal({ type: 'staff', data: null })}>+ เพิ่มพนักงานใหม่</button>
          {pagedStaff.map(s => (
            <div className="admin-card" key={s.id}>
              <div className="admin-card-main">
                <div className="admin-card-title">{s.name}</div>
                <div className="admin-card-sub">ผู้ใช้: <strong>{s.username}</strong> — ประจำ: {s.station_name}</div>
              </div>
              <div className="admin-card-actions">
                <button className="admin-btn edit" onClick={() => setModal({ type: 'staff', data: s })}>แก้ไข</button>
                <button className="admin-btn delete" onClick={() => deleteStaff(s.id, s.name)}>ลบ</button>
              </div>
            </div>
          ))}
        </>
      )}
      {tab === 'provinces' && (
        <>
          <button className="admin-add-btn" onClick={() => setModal({ type: 'province', data: null })}>+ เพิ่มจังหวัดใหม่</button>
          {pagedProvinces.map(p => (
            <div className="admin-card" key={p.id}>
              <div className="admin-card-main"><div className="admin-card-title">{p.name}</div></div>
              <div className="admin-card-actions"><button className="admin-btn delete" onClick={() => deleteProvince(p.id, p.name)}>ลบ</button></div>
            </div>
          ))}
        </>
      )}
      {tab === 'fueltypes' && (
        <>
          <button className="admin-add-btn" onClick={addFuelType}>+ เพิ่มชนิดน้ำมันใหม่</button>
          {pagedFuelTypes.map(ft => (
            <div className="admin-card" key={ft.id}>
              <div className="admin-card-main">
                <div className="admin-card-title">🛢️ {ft.name}</div>
                <div className="admin-card-sub">ลำดับ: {ft.sort_order}</div>
              </div>
              <div className="admin-card-actions">
                <button className="admin-btn delete" onClick={() => deleteFuelType(ft.id, ft.name)}>ลบ</button>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 12, fontSize: 12, color: '#999', padding: '8px 0' }}>
            💡 จัดการน้ำมันรายปั๊มได้ที่ tab ปั๊ม → กดแก้ไข
          </div>
        </>
      )}
      {tab === 'requests' && (
        <>
          {/* ===== คำขอเข้าร่วมปั๊ม ===== */}
          {joinReqs.length > 0 && (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#333', padding: '8px 0' }}>👤 คำขอเข้าร่วมปั๊ม</div>
              {joinReqs.map(r => (
                <div className="admin-card" key={`join-${r.id}`} style={{ borderLeft: r.status === 'pending' ? '4px solid var(--primary)' : '4px solid #ccc' }}>
                  <div className="admin-card-main">
                    <div className="admin-card-title">{r.staff_name}</div>
                    <div className="admin-card-sub">โทร: {r.staff_phone || '-'} → ปั๊ม: {r.station_name} ({r.province_name})</div>
                    <span className={`status-badge ${r.status === 'approved' ? 'has-fuel' : r.status === 'rejected' ? 'no-fuel' : ''}`}
                      style={r.status === 'pending' ? { background: '#fff3e0', color: '#9e3d00', display: 'inline-flex', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 16, marginTop: 6 } : { marginTop: 6 }}>
                      {r.status === 'pending' ? '⏳ รอ' : r.status === 'approved' ? '✅ อนุมัติ' : '❌ ปฏิเสธ'}
                    </span>
                  </div>
                  {r.status === 'pending' && (
                    <div className="admin-card-actions" style={{ flexDirection: 'column', gap: 6 }}>
                      <button className="admin-btn edit" onClick={() => approveJoin(r.id)}>✅ อนุมัติ</button>
                      <button className="admin-btn delete" onClick={() => rejectJoin(r.id)}>❌ ปฏิเสธ</button>
                    </div>
                  )}
                </div>
              ))}
              <div style={{ fontSize: 15, fontWeight: 700, color: '#333', padding: '12px 0 8px' }}>⛽ คำขอเพิ่มปั๊ม</div>
            </>
          )}

          {requests.length === 0 && joinReqs.length === 0 && <div className="loading">ไม่มีคำขอ</div>}
          {requests.map(r => (
            <div className="admin-card" key={r.id} style={{ borderLeft: r.status === 'pending' ? '4px solid #e65100' : r.status === 'approved' ? '4px solid #4caf50' : '4px solid #ef5350' }}>
              <div className="admin-card-main">
                <div className="admin-card-title">{r.name}</div>
                <div className="admin-card-sub">{r.brand} · {r.province_name}</div>
                <div className="admin-card-sub">{r.address}</div>
                <div className="admin-card-sub">ส่งโดย: {r.requested_by_name}</div>
                <span className={`status-badge ${r.status === 'approved' ? 'has-fuel' : r.status === 'rejected' ? 'no-fuel' : ''}`}
                  style={r.status === 'pending' ? { background: '#fff3e0', color: '#e65100', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 16, marginTop: 6 } : { marginTop: 6 }}>
                  {r.status === 'pending' ? '⏳ รอการอนุมัติ' : r.status === 'approved' ? '✅ อนุมัติแล้ว' : '❌ ไม่อนุมัติ'}
                </span>
              </div>
              {r.status === 'pending' && (
                <div className="admin-card-actions" style={{ flexDirection: 'column', gap: 6 }}>
                  <button className="admin-btn edit" onClick={() => approveRequest(r.id)}>✅ อนุมัติ</button>
                  <button className="admin-btn delete" onClick={() => rejectRequest(r.id)}>❌ ปฏิเสธ</button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
      {tab === 'admins' && (
        <>
          <button className="admin-add-btn" onClick={addAdmin}>+ เพิ่มผู้ดูแลระบบ</button>
          {pagedAdmins.map(a => (
            <div className="admin-card" key={a.id}>
              <div className="admin-card-main">
                <div className="admin-card-title">🛡️ {a.name}</div>
                <div className="admin-card-sub">ผู้ใช้: {a.username}</div>
              </div>
              <div className="admin-card-actions">
                <button className="admin-btn delete" onClick={() => deleteAdmin(a.id, a.name)}>ลบ</button>
              </div>
            </div>
          ))}
        </>
      )}
      {tab === 'audit' && (
        <>
          {auditLogs.logs.length === 0 && <div className="loading">ยังไม่มี log</div>}
          {auditLogs.logs.map(log => (
            <div className="admin-card" key={log.id} style={{ borderLeft: `4px solid ${log.user_type === 'admin' ? '#6a1b9a' : '#1a73e8'}` }}>
              <div className="admin-card-main">
                <div className="admin-card-title">{log.action === 'login' ? '🔑' : log.action === 'update_fuel' ? '⛽' : log.action === 'register' ? '📝' : '📌'} {log.action}</div>
                <div className="admin-card-sub">{log.entity_type}: {log.entity_name}</div>
                {log.details && <div className="admin-card-sub">{log.details}</div>}
                <div className="admin-card-sub">โดย: {log.user_name} ({log.user_type}) · IP: {log.ip_address}</div>
                <div className="admin-card-sub">{new Date(log.created_at).toLocaleString('th-TH')}</div>
              </div>
            </div>
          ))}
          {auditLogs.totalPages > 1 && (() => {
            const tp = auditLogs.totalPages;
            const maxShow = 5;
            let start = Math.max(1, auditPage - Math.floor(maxShow / 2));
            let end = Math.min(tp, start + maxShow - 1);
            if (end - start < maxShow - 1) start = Math.max(1, end - maxShow + 1);
            const pages = [];
            for (let i = start; i <= end; i++) pages.push(i);
            return (
              <div className="pagination">
                <button disabled={auditPage <= 1} onClick={() => loadAuditLogs(1)}>«</button>
                <button disabled={auditPage <= 1} onClick={() => loadAuditLogs(auditPage - 1)}>‹</button>
                {start > 1 && <span className="pagination-dots">...</span>}
                {pages.map(p => (
                  <button key={p} className={p === auditPage ? 'pagination-active' : ''} onClick={() => loadAuditLogs(p)}>{p}</button>
                ))}
                {end < tp && <span className="pagination-dots">...</span>}
                <button disabled={auditPage >= tp} onClick={() => loadAuditLogs(auditPage + 1)}>›</button>
                <button disabled={auditPage >= tp} onClick={() => loadAuditLogs(tp)}>»</button>
                <span className="pagination-info">{auditLogs.total} รายการ</span>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );

  // Desktop: Table
  const renderTable = () => (
    <div className="admin-table-wrap">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bulk-bar">
          <span>เลือกแล้ว {selected.size} รายการ</span>
          <button className="bulk-delete-btn" onClick={bulkDelete}>🗑️ ลบที่เลือก</button>
          <button className="bulk-clear-btn" onClick={() => setSelected(new Set())}>ยกเลิก</button>
        </div>
      )}

      {tab === 'stations' && (
        <>
          <div className="admin-table-header">
            <h3>⛽ ปั๊มทั้งหมด ({filteredStations.length})</h3>
            <button className="admin-add-btn-sm" onClick={() => setModal({ type: 'station', data: null })}>+ เพิ่มปั๊ม</button>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input type="checkbox"
                    checked={pagedStations.length > 0 && pagedStations.every(s => selected.has(s.id))}
                    onChange={() => toggleSelectAll(pagedStations.map(s => s.id))}
                  />
                </th>
                <th>ชื่อปั๊ม</th><th>แบรนด์</th><th>จังหวัด</th><th>ที่อยู่</th><th>โทร</th><th>พนักงาน</th><th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {pagedStations.map(s => (
                <tr key={s.id} className={selected.has(s.id) ? 'row-selected' : ''}>
                  <td><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} /></td>
                  <td className="td-name">{s.name}</td>
                  <td><span className={`station-brand brand-${s.brand}`}>{s.brand}</span></td>
                  <td>{s.province_name}</td>
                  <td className="td-address">{s.address}</td>
                  <td>{s.phone || '-'}</td>
                  <td style={{ textAlign: 'center' }}>{s.staff_count}</td>
                  <td>
                    <div className="admin-card-actions">
                      <button className="admin-btn edit" onClick={() => setModal({ type: 'station', data: s })}>แก้ไข</button>
                      <button className="admin-btn delete" onClick={() => deleteStation(s.id, s.name)}>ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === 'staff' && (
        <>
          <div className="admin-table-header">
            <h3>👤 พนักงานทั้งหมด ({filteredStaff.length})</h3>
            <button className="admin-add-btn-sm" onClick={() => setModal({ type: 'staff', data: null })}>+ เพิ่มพนักงาน</button>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input type="checkbox"
                    checked={pagedStaff.length > 0 && pagedStaff.every(s => selected.has(s.id))}
                    onChange={() => toggleSelectAll(pagedStaff.map(s => s.id))}
                  />
                </th>
                <th>ชื่อ-นามสกุล</th><th>ชื่อผู้ใช้</th><th>ประจำปั๊ม</th><th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {pagedStaff.map(s => (
                <tr key={s.id} className={selected.has(s.id) ? 'row-selected' : ''}>
                  <td><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} /></td>
                  <td className="td-name">{s.name}</td>
                  <td><code>{s.username}</code></td>
                  <td>{s.station_name}</td>
                  <td>
                    <div className="admin-card-actions">
                      <button className="admin-btn edit" onClick={() => setModal({ type: 'staff', data: s })}>แก้ไข</button>
                      <button className="admin-btn delete" onClick={() => deleteStaff(s.id, s.name)}>ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === 'provinces' && (
        <>
          <div className="admin-table-header">
            <h3>📍 จังหวัดทั้งหมด ({filteredProvinces.length})</h3>
            <button className="admin-add-btn-sm" onClick={() => setModal({ type: 'province', data: null })}>+ เพิ่มจังหวัด</button>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input type="checkbox"
                    checked={pagedProvinces.length > 0 && pagedProvinces.every(p => selected.has(p.id))}
                    onChange={() => toggleSelectAll(pagedProvinces.map(p => p.id))}
                  />
                </th>
                <th>ชื่อจังหวัด</th><th style={{ width: 120 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {pagedProvinces.map(p => (
                <tr key={p.id} className={selected.has(p.id) ? 'row-selected' : ''}>
                  <td><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                  <td className="td-name">{p.name}</td>
                  <td>
                    <div className="admin-card-actions">
                      <button className="admin-btn delete" onClick={() => deleteProvince(p.id, p.name)}>ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === 'fueltypes' && (
        <>
          <div className="admin-table-header">
            <h3>🛢️ ชนิดน้ำมันทั้งระบบ ({fuelTypes.length})</h3>
            <button className="admin-add-btn-sm" onClick={addFuelType}>+ เพิ่มชนิดน้ำมัน</button>
          </div>
          <table className="admin-table">
            <thead><tr><th>ลำดับ</th><th>ชื่อชนิดน้ำมัน</th><th style={{ width: 120 }}>จัดการ</th></tr></thead>
            <tbody>
              {pagedFuelTypes.map(ft => (
                <tr key={ft.id}>
                  <td style={{ textAlign: 'center', width: 60 }}>{ft.sort_order}</td>
                  <td className="td-name">🛢️ {ft.name}</td>
                  <td><div className="admin-card-actions"><button className="admin-btn delete" onClick={() => deleteFuelType(ft.id, ft.name)}>ลบ</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>

          {(() => {
            const fuelStations = stations.filter(s => !fuelProvinceFilter || String(s.province_id) === fuelProvinceFilter);
            const fuelTotalPages = Math.max(1, Math.ceil(fuelStations.length / fuelPerPage));
            const fuelSafePage = Math.min(fuelPage, fuelTotalPages);
            const pagedFuelStations = fuelStations.slice((fuelSafePage - 1) * fuelPerPage, fuelSafePage * fuelPerPage);

            return (<>
          <div className="admin-table-header" style={{ marginTop: 24 }}>
            <h3>จัดการน้ำมันรายปั๊ม ({fuelStations.length})</h3>
            <select value={fuelProvinceFilter} onChange={e => { setFuelProvinceFilter(e.target.value); setFuelPage(1); }} style={{ padding: '8px 12px', borderRadius: 8, border: '2px solid #e0e0e0', fontSize: 14 }}>
              <option value="">ทุกจังหวัด</option>
              {provinces.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </select>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ปั๊ม</th>
                <th>จังหวัด</th>
                {fuelTypes.map(ft => <th key={ft.name} style={{ fontSize: 11, textAlign: 'center', padding: '8px 6px' }}>{ft.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {pagedFuelStations.map(s => (
                <tr key={s.id}>
                  <td className="td-name">{s.name}</td>
                  <td style={{ fontSize: 12, color: '#888' }}>{s.province_name}</td>
                  {fuelTypes.map(ft => {
                    const enabled = s._fuels?.find(f => f.name === ft.name)?.enabled ?? false;
                    return (
                      <td key={ft.name} style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={enabled}
                          onChange={async () => { await toggleStationFuel(s.id, ft.name, enabled); loadAll(); }}
                          style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#4caf50' }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {fuelTotalPages > 1 && (() => {
            const maxShow = 5;
            let start = Math.max(1, fuelSafePage - Math.floor(maxShow / 2));
            let end = Math.min(fuelTotalPages, start + maxShow - 1);
            if (end - start < maxShow - 1) start = Math.max(1, end - maxShow + 1);
            const pages = [];
            for (let i = start; i <= end; i++) pages.push(i);
            return (
              <div className="pagination">
                <button disabled={fuelSafePage <= 1} onClick={() => setFuelPage(1)}>«</button>
                <button disabled={fuelSafePage <= 1} onClick={() => setFuelPage(fuelSafePage - 1)}>‹</button>
                {start > 1 && <span className="pagination-dots">...</span>}
                {pages.map(p => (
                  <button key={p} className={p === fuelSafePage ? 'pagination-active' : ''} onClick={() => setFuelPage(p)}>{p}</button>
                ))}
                {end < fuelTotalPages && <span className="pagination-dots">...</span>}
                <button disabled={fuelSafePage >= fuelTotalPages} onClick={() => setFuelPage(fuelSafePage + 1)}>›</button>
                <button disabled={fuelSafePage >= fuelTotalPages} onClick={() => setFuelPage(fuelTotalPages)}>»</button>
                <span className="pagination-info">{fuelStations.length} ปั๊ม</span>
              </div>
            );
          })()}
          </>);
          })()}
        </>
      )}

      {tab === 'brands' && (
        <>
          <div className="admin-table-header">
            <h3>🏷️ แบรนด์ ({brandsList.length})</h3>
            <button className="admin-add-btn-sm" onClick={() => setModal({ type: 'brand', data: null })}>+ เพิ่มแบรนด์</button>
          </div>
          <table className="admin-table">
            <thead><tr><th style={{ width: 60 }}>Logo</th><th>ชื่อ</th><th style={{ width: 60 }}>สี</th><th style={{ width: 60 }}>ลำดับ</th><th style={{ width: 120 }}>จัดการ</th></tr></thead>
            <tbody>
              {brandsList.map(b => (
                <tr key={b.id}>
                  <td style={{ textAlign: 'center' }}>{b.logo_url ? <img src={b.logo_url} alt={b.name} style={{ width: 32, height: 32, objectFit: 'contain' }} /> : <span style={{ color: b.color || '#999', fontSize: 20, fontWeight: 800 }}>{b.name?.charAt(0)}</span>}</td>
                  <td className="td-name">{b.name}</td>
                  <td style={{ textAlign: 'center' }}>{b.color && <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: 4, background: b.color, border: '1px solid #ddd' }} />}</td>
                  <td style={{ textAlign: 'center' }}>{b.sort_order}</td>
                  <td>
                    <div className="admin-card-actions">
                      <button className="admin-btn edit" onClick={() => setModal({ type: 'brand', data: b })}>แก้ไข</button>
                      <button className="admin-btn delete" onClick={() => { if (confirm(`ลบแบรนด์ "${b.name}" ?`)) { adminFetch(`${API}/admin/brands/${b.id}`, { method: 'DELETE' }).then(() => loadAll()); } }}>ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === 'requests' && (
        <>
          {/* คำขอเข้าร่วมปั๊ม */}
          {joinReqs.length > 0 && (
            <>
              <div className="admin-table-header">
                <h3>👤 คำขอเข้าร่วมปั๊ม ({joinReqs.length})</h3>
              </div>
              <table className="admin-table" style={{ marginBottom: 24 }}>
                <thead>
                  <tr><th>ชื่อพนักงาน</th><th>เบอร์โทร</th><th>ปั๊มที่ขอ</th><th>จังหวัด</th><th>สถานะ</th><th>จัดการ</th></tr>
                </thead>
                <tbody>
                  {joinReqs.map(r => (
                    <tr key={`join-${r.id}`} style={{ borderLeft: r.status === 'pending' ? '4px solid var(--primary)' : 'none' }}>
                      <td className="td-name">{r.staff_name}</td>
                      <td>{r.staff_phone || '-'}</td>
                      <td>{r.station_name}</td>
                      <td>{r.province_name}</td>
                      <td>
                        <span className={`status-badge ${r.status === 'approved' ? 'has-fuel' : r.status === 'rejected' ? 'no-fuel' : ''}`}
                          style={r.status === 'pending' ? { background: '#fff3e0', color: '#9e3d00', display: 'inline-flex', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 16 } : {}}>
                          {r.status === 'pending' ? '⏳ รอ' : r.status === 'approved' ? '✅ อนุมัติ' : '❌ ปฏิเสธ'}
                        </span>
                      </td>
                      <td>
                        {r.status === 'pending' && (
                          <div className="admin-card-actions">
                            <button className="admin-btn edit" onClick={() => approveJoin(r.id)}>✅ อนุมัติ</button>
                            <button className="admin-btn delete" onClick={() => rejectJoin(r.id)}>❌ ปฏิเสธ</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* คำขอเพิ่มปั๊ม */}
          <div className="admin-table-header">
            <h3>⛽ คำขอเพิ่มปั๊ม ({requests.length})</h3>
          </div>
          <table className="admin-table">
            <thead>
              <tr><th>ชื่อปั๊ม</th><th>แบรนด์</th><th>จังหวัด</th><th>ที่อยู่</th><th>ส่งโดย</th><th>สถานะ</th><th>จัดการ</th></tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} style={{ borderLeft: r.status === 'pending' ? '4px solid #e65100' : 'none' }}>
                  <td className="td-name">{r.name}</td>
                  <td><span className={`station-brand brand-${r.brand}`}>{r.brand}</span></td>
                  <td>{r.province_name}</td>
                  <td className="td-address">{r.address}</td>
                  <td>{r.requested_by_name}</td>
                  <td>
                    <span className={`status-badge ${r.status === 'approved' ? 'has-fuel' : r.status === 'rejected' ? 'no-fuel' : ''}`}
                      style={r.status === 'pending' ? { background: '#fff3e0', color: '#e65100', display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 16 } : {}}>
                      {r.status === 'pending' ? '⏳ รอ' : r.status === 'approved' ? '✅ อนุมัติ' : '❌ ปฏิเสธ'}
                    </span>
                  </td>
                  <td>
                    {r.status === 'pending' && (
                      <div className="admin-card-actions">
                        <button className="admin-btn edit" onClick={() => approveRequest(r.id)}>✅ อนุมัติ</button>
                        <button className="admin-btn delete" onClick={() => rejectRequest(r.id)}>❌ ปฏิเสธ</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === 'admins' && (
        <>
          <div className="admin-table-header">
            <h3>🛡️ ผู้ดูแลระบบ ({admins.length})</h3>
            <button className="admin-add-btn-sm" onClick={addAdmin}>+ เพิ่มผู้ดูแล</button>
          </div>
          <table className="admin-table">
            <thead><tr><th>ชื่อ</th><th>ชื่อผู้ใช้</th><th>วันที่สร้าง</th><th style={{ width: 100 }}>จัดการ</th></tr></thead>
            <tbody>
              {pagedAdmins.map(a => (
                <tr key={a.id}>
                  <td className="td-name">🛡️ {a.name}</td>
                  <td><code>{a.username}</code></td>
                  <td style={{ fontSize: 12, color: '#888' }}>{new Date(a.created_at).toLocaleDateString('th-TH')}</td>
                  <td><div className="admin-card-actions"><button className="admin-btn delete" onClick={() => deleteAdmin(a.id, a.name)}>ลบ</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === 'audit' && (
        <>
          <div className="admin-table-header">
            <h3>📋 Audit Log ({auditLogs.total})</h3>
          </div>
          <table className="admin-table">
            <thead><tr><th>เวลา</th><th>การกระทำ</th><th>ประเภท</th><th>รายการ</th><th>รายละเอียด</th><th>ผู้กระทำ</th><th>ประเภทผู้ใช้</th><th>IP</th></tr></thead>
            <tbody>
              {auditLogs.logs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString('th-TH')}</td>
                  <td className="td-name">{log.action}</td>
                  <td>{log.entity_type}</td>
                  <td>{log.entity_name}</td>
                  <td className="td-address">{log.details}</td>
                  <td>{log.user_name}</td>
                  <td><span className={`station-brand ${log.user_type === 'admin' ? 'brand-Pure' : 'brand-Caltex'}`}>{log.user_type}</span></td>
                  <td style={{ fontSize: 11, color: '#999' }}>{log.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {auditLogs.totalPages > 1 && (() => {
            const tp = auditLogs.totalPages;
            const maxShow = 5;
            let start = Math.max(1, auditPage - Math.floor(maxShow / 2));
            let end = Math.min(tp, start + maxShow - 1);
            if (end - start < maxShow - 1) start = Math.max(1, end - maxShow + 1);
            const pages = [];
            for (let i = start; i <= end; i++) pages.push(i);
            return (
              <div className="pagination">
                <button disabled={auditPage <= 1} onClick={() => loadAuditLogs(1)}>«</button>
                <button disabled={auditPage <= 1} onClick={() => loadAuditLogs(auditPage - 1)}>‹</button>
                {start > 1 && <span className="pagination-dots">...</span>}
                {pages.map(p => (
                  <button key={p} className={p === auditPage ? 'pagination-active' : ''} onClick={() => loadAuditLogs(p)}>{p}</button>
                ))}
                {end < tp && <span className="pagination-dots">...</span>}
                <button disabled={auditPage >= tp} onClick={() => loadAuditLogs(auditPage + 1)}>›</button>
                <button disabled={auditPage >= tp} onClick={() => loadAuditLogs(tp)}>»</button>
                <span className="pagination-info">{auditLogs.total} รายการ</span>
              </div>
            );
          })()}
        </>
      )}

      {tab === 'settings' && (
        <>
          <div className="admin-table-header">
            <h3>⚙️ ตั้งค่าระบบ</h3>
          </div>
          <div style={{ padding: '16px 0' }}>
            {settings.map(s => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#fff', borderRadius: 12, marginBottom: 10, border: '1px solid #e5e7eb' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>
                    {s.key === 'public_reporting_enabled' ? '📢 ระบบรายงานจากประชาชน' : s.key}
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                    {s.key === 'public_reporting_enabled' ? 'เปิดให้ประชาชน login ด้วย LINE แล้วรายงานสถานะน้ำมัน' : s.key}
                  </div>
                  {s.updated_by && <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>แก้ไขล่าสุดโดย: {s.updated_by}</div>}
                </div>
                <button
                  onClick={() => toggleSetting(s.key)}
                  style={{
                    width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                    background: s.value === 'true' ? '#4ade80' : '#d1d5db',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 11, background: '#fff',
                    position: 'absolute', top: 3,
                    left: s.value === 'true' ? 27 : 3,
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>🛡️ ระบบจัดการ</h1>
          <p>สวัสดี {admin.name}</p>
        </div>
        <button className="btn-logout" onClick={handleLogout}>ออกจากระบบ</button>
      </div>

      {/* Mobile controls */}
      <div className="mobile-controls">
        <div className="mobile-search">
          <input type="text" placeholder="🔍 ค้นหา..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {tab === 'stations' && (
          <>
            <div className="province-filter">
              <select value={provinceFilter} onChange={e => { setProvinceFilter(e.target.value); setPage(1); }}>
                <option value="">📍 ทุกจังหวัด</option>
                {provinces.map(p => <option key={p.id} value={String(p.id)}>📍 {p.name}</option>)}
              </select>
            </div>
            <div className="province-filter">
              <select value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setPage(1); }}>
                <option value="">ทุกแบรนด์</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </>
        )}
        <div className="tab-nav">
          <button className={`tab-btn ${tab === 'stations' ? 'active' : ''}`} onClick={() => { setTab('stations'); setSearch(''); setBrandFilter(''); setProvinceFilter(''); setPage(1); setSelected(new Set()); }}>⛽ ปั๊ม ({stations.length})</button>
          <button className={`tab-btn ${tab === 'staff' ? 'active' : ''}`} onClick={() => { setTab('staff'); setSearch(''); setBrandFilter(''); setPage(1); setSelected(new Set()); }}>👤 พนักงาน ({staffList.length})</button>
          <button className={`tab-btn ${tab === 'provinces' ? 'active' : ''}`} onClick={() => { setTab('provinces'); setSearch(''); setBrandFilter(''); setPage(1); setSelected(new Set()); }}>📍 จังหวัด ({provinces.length})</button>
          <button className={`tab-btn ${tab === 'fueltypes' ? 'active' : ''}`} onClick={() => { setTab('fueltypes'); setSearch(''); setBrandFilter(''); setPage(1); setSelected(new Set()); }}>🛢️ น้ำมัน</button>
          <button className={`tab-btn ${tab === 'brands' ? 'active' : ''}`} onClick={() => { setTab('brands'); setSearch(''); setBrandFilter(''); setPage(1); setSelected(new Set()); }}>🏷️ แบรนด์</button>
          <button className={`tab-btn ${tab === 'requests' ? 'active' : ''}`} onClick={() => { setTab('requests'); setSearch(''); setBrandFilter(''); setPage(1); setSelected(new Set()); }}>📨 คำขอ {pendingRequests.length > 0 && `(${pendingRequests.length})`}</button>
          <button className={`tab-btn ${tab === 'admins' ? 'active' : ''}`} onClick={() => { setTab('admins'); setSearch(''); setBrandFilter(''); setPage(1); setSelected(new Set()); }}>🛡️ ผู้ดูแล</button>
          <button className={`tab-btn ${tab === 'audit' ? 'active' : ''}`} onClick={() => { setTab('audit'); loadAuditLogs(1); }}>📋 Log</button>
          <button className={`tab-btn ${tab === 'settings' ? 'active' : ''}`} onClick={() => { setTab('settings'); loadSettings(); }}>⚙️ ตั้งค่า</button>
        </div>
      </div>

      {/* Desktop + Mobile content */}
      <div className="content-wrapper content-wrapper--scroll">
        <aside className="desktop-sidebar">
          {sidebar}
        </aside>

        <main className="content-main content-main--scroll">
          <div className="desktop-tabs">
            <button className={`tab-btn ${tab === 'stations' ? 'active' : ''}`} onClick={() => { setTab('stations'); setSearch(''); setPage(1); }}>⛽ ปั๊ม</button>
            <button className={`tab-btn ${tab === 'staff' ? 'active' : ''}`} onClick={() => { setTab('staff'); setSearch(''); setPage(1); }}>👤 พนักงาน</button>
            <button className={`tab-btn ${tab === 'provinces' ? 'active' : ''}`} onClick={() => { setTab('provinces'); setSearch(''); setPage(1); }}>📍 จังหวัด</button>
            <button className={`tab-btn ${tab === 'fueltypes' ? 'active' : ''}`} onClick={() => { setTab('fueltypes'); setSearch(''); setPage(1); }}>🛢️ น้ำมัน</button>
            <button className={`tab-btn ${tab === 'requests' ? 'active' : ''}`} onClick={() => { setTab('requests'); setSearch(''); setPage(1); }} style={pendingRequests.length > 0 ? { background: '#fff3e0', color: '#e65100', border: '1.5px solid #e65100' } : {}}>📨 คำขอ {pendingRequests.length > 0 && `(${pendingRequests.length})`}</button>
            <button className={`tab-btn ${tab === 'admins' ? 'active' : ''}`} onClick={() => { setTab('admins'); setSearch(''); setPage(1); }}>🛡️ ผู้ดูแล</button>
            <button className={`tab-btn ${tab === 'audit' ? 'active' : ''}`} onClick={() => { setTab('audit'); loadAuditLogs(1); }}>📋 Log</button>
            <button className={`tab-btn ${tab === 'settings' ? 'active' : ''}`} onClick={() => { setTab('settings'); loadSettings(); }}>⚙️ ตั้งค่า</button>
            <span className="desktop-result-count">{currentCount} รายการ</span>
          </div>

          {tab === 'settings' ? (
            <div style={{ padding: '16px' }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: '#1a1a1a' }}>⚙️ ตั้งค่าระบบ</h3>
              {settings.map(s => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#fff', borderRadius: 12, marginBottom: 10, border: '1px solid #e5e7eb' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>
                      {s.key === 'public_reporting_enabled' ? '📢 ระบบรายงานจากประชาชน' : s.key}
                    </div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                      {s.key === 'public_reporting_enabled' ? 'เปิดให้ประชาชน login ด้วย LINE แล้วรายงานสถานะน้ำมัน' : s.key}
                    </div>
                    {s.updated_by && <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>แก้ไขล่าสุดโดย: {s.updated_by}</div>}
                  </div>
                  <button
                    onClick={() => toggleSetting(s.key)}
                    style={{
                      width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                      background: s.value === 'true' ? '#4ade80' : '#d1d5db',
                      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: 11, background: '#fff',
                      position: 'absolute', top: 3,
                      left: s.value === 'true' ? 27 : 3,
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="admin-mobile-only">{renderCards()}{tab !== 'audit' && tab !== 'requests' && <Pagination />}</div>
              <div className="admin-desktop-only">{renderTable()}{tab !== 'audit' && tab !== 'requests' && <Pagination />}</div>
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            {modal.type === 'station' && <StationForm data={modal.data} provinces={provinces} fuelTypes={fuelTypes} onClose={() => setModal(null)} onSave={() => { setModal(null); loadAll(); }} />}
            {modal.type === 'staff' && <StaffForm data={modal.data} stations={stations} onClose={() => setModal(null)} onSave={() => { setModal(null); loadAll(); }} />}
            {modal.type === 'province' && <ProvinceForm onClose={() => setModal(null)} onSave={() => { setModal(null); loadAll(); }} />}
            {modal.type === 'admin' && <AdminForm onClose={() => setModal(null)} onSave={() => { setModal(null); loadAll(); }} />}
            {modal.type === 'changePassword' && <ChangePasswordForm onClose={() => setModal(null)} onSave={() => setModal(null)} />}
            {modal.type === 'fueltype' && <FuelTypeForm nextOrder={fuelTypes.length + 1} onClose={() => setModal(null)} onSave={() => { setModal(null); loadAll(); }} />}
            {modal.type === 'brand' && <BrandForm data={modal.data} onClose={() => setModal(null)} onSave={() => { setModal(null); loadAll(); }} />}
          </div>
        </div>
      )}
    </div>
  );
}

// Map click handler
function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

// ===== Station Form =====
function StationForm({ data, provinces, fuelTypes, onClose, onSave }) {
  const [form, setForm] = useState({
    name: data?.name || '', brand: data?.brand || 'PTT', address: data?.address || '',
    province_id: data?.province_id || (provinces[0]?.id || ''),
    lat: data?.lat || '', lng: data?.lng || '', phone: data?.phone || '',
  });
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [stationFuels, setStationFuels] = useState([]);
  const [stationStaff, setStationStaff] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);

  useEffect(() => {
    if (data?.id) {
      adminFetch(`${API}/admin/stations/${data.id}/fuels`).then(r => r.json()).then(setStationFuels);
      loadStationStaff();
      adminFetch(`${API}/admin/staff`).then(r => r.json()).then(setAllStaff);
    }
  }, [data]);

  const loadStationStaff = () => {
    if (data?.id) adminFetch(`${API}/admin/stations/${data.id}/staff`).then(r => r.json()).then(setStationStaff);
  };

  const removeStaff = async (staffId, name) => {
    if (!confirm(`ถอด "${name}" ออกจากปั๊มนี้?`)) return;
    await adminFetch(`${API}/admin/stations/${data.id}/staff/${staffId}`, { method: 'DELETE' });
    loadStationStaff();
  };

  const addStaff = async (staffId) => {
    await adminFetch(`${API}/admin/stations/${data.id}/staff`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staffId }),
    });
    setStaffSearch('');
    setShowStaffDropdown(false);
    loadStationStaff();
  };

  const availableStaff = allStaff
    .filter(s => !stationStaff.some(ss => ss.id === s.id))
    .filter(s => {
      if (!staffSearch) return false;
      const q = staffSearch.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q) || (s.phone && s.phone.includes(q));
    })
    .slice(0, 10);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    const url = data ? `${API}/admin/stations/${data.id}` : `${API}/admin/stations`;
    const res = await adminFetch(url, { method: data ? 'PUT' : 'POST',
      body: JSON.stringify({ ...form, lat: parseFloat(form.lat), lng: parseFloat(form.lng) }) });
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    onSave();
  };

  const handleMapClick = (latlng) => {
    setForm({ ...form, lat: latlng.lat.toFixed(6), lng: latlng.lng.toFixed(6) });
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { setError('เบราว์เซอร์ไม่รองรับ GPS'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm({ ...form, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) });
        setLocating(false);
      },
      () => { setError('ไม่สามารถเข้าถึงตำแหน่งได้'); setLocating(false); },
      { enableHighAccuracy: true }
    );
  };

  const mapCenter = form.lat && form.lng ? [parseFloat(form.lat), parseFloat(form.lng)] : [13.75, 100.52];

  return (
    <form onSubmit={handleSubmit}>
      <h3>{data ? 'แก้ไขปั๊ม' : 'เพิ่มปั๊มใหม่'}</h3>
      {error && <div className="error-msg">{error}</div>}
      <div className="form-group"><label>ชื่อปั๊ม</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
      <div className="form-row">
        <div className="form-group"><label>แบรนด์</label>
          <select value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })}>
            {brandsList.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select></div>
        <div className="form-group"><label>จังหวัด</label>
          <select value={form.province_id} onChange={e => setForm({ ...form, province_id: e.target.value })}>
            {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      </div>
      <div className="form-group"><label>ที่อยู่</label><input required value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>

      {/* Location picker */}
      <div className="form-group">
        <label>📍 ตำแหน่ง (กดบนแผนที่ หรือกรอกเอง)</label>
        <div className="location-buttons">
          <button type="button" className="location-btn" onClick={useMyLocation} disabled={locating}>
            {locating ? '⏳ กำลังหา...' : '📌 ใช้ตำแหน่งปัจจุบัน'}
          </button>
        </div>
        <div className="map-picker">
          <MapContainer center={mapCenter} zoom={form.lat ? 15 : 6} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
            <MapClickHandler onMapClick={handleMapClick} />
            {form.lat && form.lng && <Marker position={[parseFloat(form.lat), parseFloat(form.lng)]} />}
          </MapContainer>
        </div>
        <div className="form-row" style={{ marginTop: 8 }}>
          <div className="form-group"><label>ละติจูด</label><input required type="number" step="any" placeholder="13.7563" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} /></div>
          <div className="form-group"><label>ลองจิจูด</label><input required type="number" step="any" placeholder="100.5018" value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} /></div>
        </div>
      </div>

      <div className="form-group"><label>โทรศัพท์</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>

      {/* Fuel types toggle (edit mode only) */}
      {data && stationFuels.length > 0 && (
        <div className="form-group">
          <label>🛢️ ชนิดน้ำมันที่ขาย</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {stationFuels.map(ft => (
              <button
                key={ft.name}
                type="button"
                className={`fuel-tag ${ft.enabled ? 'available' : 'unavailable'}`}
                style={{ cursor: 'pointer', border: 'none', padding: '6px 12px', fontSize: 13 }}
                onClick={async () => {
                  if (ft.enabled) {
                    await adminFetch(`${API}/admin/stations/${data.id}/fuels/${encodeURIComponent(ft.name)}`, { method: 'DELETE' });
                  } else {
                    await adminFetch(`${API}/admin/stations/${data.id}/fuels`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fuel_type: ft.name }) });
                  }
                  const res = await adminFetch(`${API}/admin/stations/${data.id}/fuels`);
                  setStationFuels(await res.json());
                }}
              >
                {ft.enabled ? '✓' : '✗'} {ft.name}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>กดเพื่อเปิด/ปิดชนิดน้ำมันที่ปั๊มนี้ขาย</div>
        </div>
      )}

      {/* Staff management (edit mode only) */}
      {data && (
        <div className="form-group">
          <label>👤 พนักงานที่ดูแล ({stationStaff.length} คน)</label>
          {stationStaff.length === 0 && <div style={{ fontSize: 13, color: '#999', padding: '8px 0' }}>ยังไม่มีพนักงาน</div>}
          {stationStaff.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--surface-container-low)', borderRadius: 'var(--radius-md)', marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>@{s.username} {s.phone && `· ${s.phone}`}</div>
              </div>
              <button type="button" className="admin-btn delete" onClick={() => removeStaff(s.id, s.name)}>ถอดออก</button>
            </div>
          ))}

          {/* เพิ่มพนักงาน */}
          <div style={{ position: 'relative', marginTop: 8 }}>
            <input
              type="text"
              placeholder="🔍 พิมพ์ชื่อ, username หรือเบอร์โทร เพื่อค้นหาพนักงาน..."
              value={staffSearch}
              onChange={e => { setStaffSearch(e.target.value); setShowStaffDropdown(true); }}
              onFocus={() => setShowStaffDropdown(true)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '2px solid transparent', background: 'var(--surface-container-low)', fontSize: 14 }}
            />
            {showStaffDropdown && staffSearch && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-ambient)', zIndex: 10, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                {availableStaff.length === 0 && <div style={{ padding: 12, color: '#999', textAlign: 'center', fontSize: 13 }}>ไม่พบพนักงาน</div>}
                {availableStaff.map(s => (
                  <div key={s.id} onClick={() => addStaff(s.id)}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--surface-container-low)', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.target.style.background = 'var(--surface-container-low)'}
                    onMouseLeave={e => e.target.style.background = 'transparent'}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>@{s.username} {s.station_name !== 'ยังไม่มี' ? `· ประจำ: ${s.station_name}` : '· ยังไม่มีปั๊ม'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button><button type="submit" className="btn btn-primary">{data ? 'บันทึก' : 'เพิ่มปั๊ม'}</button></div>
    </form>
  );
}

// ===== Staff Form =====
function StaffForm({ data, stations, onClose, onSave }) {
  const [form, setForm] = useState({ name: data?.name || '', username: data?.username || '', password: '', station_id: data?.station_id || (stations[0]?.id || '') });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!data && !form.password) { setError('กรุณาใส่รหัสผ่าน'); return; }
    const url = data ? `${API}/admin/staff/${data.id}` : `${API}/admin/staff`;
    const body = { ...form }; if (data && !body.password) delete body.password;
    const res = await adminFetch(url, { method: data ? 'PUT' : 'POST', body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    onSave();
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>{data ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงานใหม่'}</h3>
      {error && <div className="error-msg">{error}</div>}
      <div className="form-group"><label>ชื่อ-นามสกุล</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
      <div className="form-group"><label>ชื่อผู้ใช้</label><input required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></div>
      <div className="form-group"><label>รหัสผ่าน {data ? '(เว้นว่างถ้าไม่เปลี่ยน)' : ''}</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!data} /></div>
      <div className="form-group"><label>ประจำปั๊ม</label>
        <select value={form.station_id} onChange={e => setForm({ ...form, station_id: e.target.value })}>
          {stations.map(s => <option key={s.id} value={s.id}>{s.name} ({s.province_name})</option>)}</select></div>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button><button type="submit" className="btn btn-primary">{data ? 'บันทึก' : 'เพิ่มพนักงาน'}</button></div>
    </form>
  );
}

// ===== Province Form =====
// ===== Fuel Type Form =====
// ===== Change Password Form =====
function ChangePasswordForm({ onClose, onSave }) {
  const [form, setForm] = useState({ current: '', newPass: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (form.newPass !== form.confirm) { setError('รหัสผ่านใหม่ไม่ตรงกัน'); return; }
    if (form.newPass.length < 4) { setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัว'); return; }
    const res = await adminFetch(`${API}/admin/change-password`, {
      method: 'PUT',
      body: JSON.stringify({ current_password: form.current, new_password: form.newPass }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setSuccess(true);
    setTimeout(onSave, 1500);
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h3>เปลี่ยนรหัสผ่านสำเร็จ!</h3>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3>🔑 เปลี่ยนรหัสผ่าน</h3>
      {error && <div className="error-msg">{error}</div>}
      <div className="form-group"><label>รหัสผ่านปัจจุบัน</label><input required type="password" value={form.current} onChange={e => setForm({ ...form, current: e.target.value })} /></div>
      <div className="form-group"><label>รหัสผ่านใหม่</label><input required type="password" value={form.newPass} onChange={e => setForm({ ...form, newPass: e.target.value })} placeholder="อย่างน้อย 4 ตัว" /></div>
      <div className="form-group"><label>ยืนยันรหัสผ่านใหม่</label><input required type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} /></div>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button><button type="submit" className="btn btn-primary">เปลี่ยนรหัสผ่าน</button></div>
    </form>
  );
}

// ===== Fuel Type Form =====
function FuelTypeForm({ nextOrder, onClose, onSave }) {
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState(String(nextOrder));
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    const res = await adminFetch(`${API}/admin/fuel-types`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sort_order: parseInt(sortOrder) || 0 }),
    });
    const data = await res.json();
    if (data.error) { setError(data.error); return; }
    onSave();
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>🛢️ เพิ่มชนิดน้ำมันใหม่</h3>
      {error && <div className="error-msg">{error}</div>}
      <div className="form-group"><label>ชื่อชนิดน้ำมัน</label><input required value={name} onChange={e => setName(e.target.value)} placeholder="เช่น E85, LPG, ดีเซล B20" /></div>
      <div className="form-group"><label>ลำดับการแสดง</label><input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} placeholder="ตัวเลข ยิ่งน้อยยิ่งแสดงก่อน" /></div>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button><button type="submit" className="btn btn-primary">เพิ่มชนิดน้ำมัน</button></div>
    </form>
  );
}

// ===== Admin Form =====
function AdminForm({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (form.password !== form.confirmPassword) { setError('รหัสผ่านไม่ตรงกัน'); return; }
    if (form.password.length < 4) { setError('รหัสผ่านต้องมีอย่างน้อย 4 ตัว'); return; }
    const res = await adminFetch(`${API}/admin/admins`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, username: form.username, password: form.password }),
    });
    const data = await res.json();
    if (data.error) { setError(data.error); return; }
    onSave();
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>🛡️ เพิ่มผู้ดูแลระบบ</h3>
      {error && <div className="error-msg">{error}</div>}
      <div className="form-group"><label>ชื่อ-นามสกุล</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="เช่น สมชาย ใจดี" /></div>
      <div className="form-group"><label>ชื่อผู้ใช้ (สำหรับ login)</label><input required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="เช่น admin2" autoCapitalize="none" /></div>
      <div className="form-group"><label>รหัสผ่าน</label><input required type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="อย่างน้อย 4 ตัว" /></div>
      <div className="form-group"><label>ยืนยันรหัสผ่าน</label><input required type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} placeholder="กรอกรหัสผ่านอีกครั้ง" /></div>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button><button type="submit" className="btn btn-primary">เพิ่มผู้ดูแล</button></div>
    </form>
  );
}

// ===== Province Form =====
function ProvinceForm({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await adminFetch(`${API}/admin/provinces`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    onSave();
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>เพิ่มจังหวัดใหม่</h3>
      {error && <div className="error-msg">{error}</div>}
      <div className="form-group"><label>ชื่อจังหวัด</label><input required value={name} onChange={e => setName(e.target.value)} placeholder="เช่น เชียงราย" /></div>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button><button type="submit" className="btn btn-primary">เพิ่มจังหวัด</button></div>
    </form>
  );
}

function BrandForm({ data, onClose, onSave }) {
  const [form, setForm] = useState({ name: data?.name || '', logo_url: data?.logo_url || '', color: data?.color || '#e65100', sort_order: data?.sort_order ?? 0 });
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await adminFetch(`${API}/admin/upload`, { method: 'POST', headers: {}, body: fd });
      const d = await res.json();
      if (d.url) setForm({ ...form, logo_url: d.url });
      else setError(d.error || 'อัปโหลดไม่สำเร็จ');
    } catch { setError('อัปโหลดไม่สำเร็จ'); }
    setUploading(false);
  };
  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    const url = data ? `${API}/admin/brands/${data.id}` : `${API}/admin/brands`;
    const res = await adminFetch(url, { method: data ? 'PUT' : 'POST', body: JSON.stringify({ ...form, sort_order: parseInt(form.sort_order) || 0 }) });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'เกิดข้อผิดพลาด'); return; }
    onSave();
  };
  return (
    <form onSubmit={handleSubmit}>
      <h3>{data ? 'แก้ไขแบรนด์' : 'เพิ่มแบรนด์ใหม่'}</h3>
      {error && <div className="error-msg">{error}</div>}
      <div className="form-group"><label>ชื่อแบรนด์ *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="เช่น PTT, Shell" /></div>
      <div className="form-group">
        <label>โลโก้</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
            {uploading ? '⏳ กำลังอัปโหลด...' : '📤 อัปโหลดรูป'}
            <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
          </label>
          <input value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} placeholder="หรือวาง URL..." style={{ flex: 1 }} />
        </div>
      </div>
      {form.logo_url && <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><img src={form.logo_url} alt="preview" style={{ maxHeight: 48, objectFit: 'contain', background: '#f5f5f5', borderRadius: 8, padding: 4 }} /><button type="button" style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: 13 }} onClick={() => setForm({ ...form, logo_url: '' })}>✕ ลบ</button></div>}
      <div className="form-row">
        <div className="form-group">
          <label>สี</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ width: 48, height: 36, padding: 2, cursor: 'pointer', border: '2px solid #ddd', borderRadius: 8 }} />
            <input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} placeholder="#e65100" style={{ flex: 1 }} />
          </div>
        </div>
        <div className="form-group"><label>ลำดับการแสดง</label><input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} /></div>
      </div>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button><button type="submit" className="btn btn-primary">{data ? 'บันทึก' : 'เพิ่มแบรนด์'}</button></div>
    </form>
  );
}

export default AdminDashboard;
