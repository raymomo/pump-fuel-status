import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

import { API } from '../utils/api';

function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

function StaffDashboard() {
  const [staff, setStaff] = useState(null);
  const [fuels, setFuels] = useState([]);
  const [saving, setSaving] = useState(null);
  const [editCars, setEditCars] = useState({});
  const [tab, setTab] = useState('fuel');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [stations, setStations] = useState([]);
  const [stationSearch, setStationSearch] = useState('');
  const [joinRequests, setJoinRequests] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem('staff');
    const token = localStorage.getItem('staff_token');
    if (!stored || !token) { navigate('/staff'); return; }
    const s = JSON.parse(stored);

    // Fetch fresh staff data
    authFetch(`${API}/staff/check/${s.id}`, {}, 'staff').then(r => {
      if (r.status === 401) return;
      return r.json();
    }).then(fresh => {
      if (!fresh) return;
      const updated = { ...s, ...fresh };
      localStorage.setItem('staff', JSON.stringify(updated));
      setStaff(updated);
      if (updated.has_station) {
        loadFuels(updated.station_id);
      }
    }).catch(() => {
      setStaff(s);
      if (s.has_station) loadFuels(s.station_id);
    });

    loadMyRequests(s.id);
    loadJoinRequests(s.id);
    fetch(`${API}/provinces`).then(r => r.json()).then(setProvinces);
    fetch(`${API}/staff/stations-list`).then(r => r.json()).then(setStations);
  }, [navigate]);

  const loadJoinRequests = (staffId) => {
    fetch(`${API}/staff/my-join-requests/${staffId}`).then(r => r.json()).then(setJoinRequests).catch(() => {});
  };

  const loadFuels = (stationId) => {
    fetch(`${API}/staff/station/${stationId}/fuels`)
      .then(r => r.json())
      .then(data => {
        setFuels(data);
        const cars = {};
        data.forEach(f => { cars[f.fuel_type] = f.remaining_cars ?? ''; });
        setEditCars(cars);
      });
  };

  const loadMyRequests = (staffId) => {
    fetch(`${API}/staff/my-requests/${staffId}`).then(r => r.json()).then(setMyRequests);
  };

  const updateFuel = async (fuel, newAvailable, newCars) => {
    setSaving(fuel.fuel_type);
    await authFetch(`${API}/staff/fuel-status`, {
      method: 'PUT',
      body: JSON.stringify({
        station_id: staff.station_id,
        fuel_type: fuel.fuel_type,
        is_available: newAvailable,
        staff_name: staff.name,
        remaining_cars: newCars === '' ? null : parseInt(newCars),
      }),
    }, 'staff');
    loadFuels(staff.station_id);
    setSaving(null);
  };

  const toggleFuel = (fuel) => {
    const newStatus = !fuel.is_available;
    updateFuel(fuel, newStatus, newStatus ? editCars[fuel.fuel_type] : null);
  };

  const saveCars = (fuel) => {
    updateFuel(fuel, fuel.is_available, editCars[fuel.fuel_type]);
  };

  const handleLogout = () => { localStorage.removeItem('staff'); localStorage.removeItem('staff_token'); navigate('/staff'); };

  const formatTime = (t) => {
    if (!t) return 'ยังไม่เคยอัปเดต';
    return new Date(t).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'medium' });
  };

  const timeAgo = (t) => {
    if (!t) return '';
    const diff = Math.floor((Date.now() - new Date(t).getTime()) / 1000);
    if (diff < 60) return `${diff} วินาทีที่แล้ว`;
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
    return `${Math.floor(diff / 86400)} วันที่แล้ว`;
  };

  const pendingCount = myRequests.filter(r => r.status === 'pending').length;

  const requestJoin = async (stationId) => {
    await authFetch(`${API}/staff/request-join`, {
      method: 'POST',
      body: JSON.stringify({ staff_id: staff.id, staff_name: staff.name, station_id: stationId }),
    }, 'staff');
    loadJoinRequests(staff.id);
  };

  const filteredStations = stationSearch
    ? stations.filter(s => s.name.toLowerCase().includes(stationSearch.toLowerCase()) || s.province_name.toLowerCase().includes(stationSearch.toLowerCase()))
    : stations;

  if (!staff) return <div className="loading">กำลังโหลด...</div>;

  // ===== ยังไม่มีปั๊ม → แสดงหน้าขอเข้าร่วม =====
  if (!staff.has_station) {
    return (
      <div>
        <div className="dashboard-header">
          <h1>👤 พนักงาน</h1>
          <p>สวัสดี {staff.name}</p>
          <div className="dashboard-actions">
            <button className="btn-logout" onClick={handleLogout}>ออกจากระบบ</button>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>⛽</div>
            <h3 style={{ marginBottom: 4 }}>ยังไม่ได้ประจำปั๊ม</h3>
            <p style={{ color: '#666', fontSize: 14 }}>เลือกปั๊มที่ต้องการ แล้วส่งคำขอให้ Admin อนุมัติ</p>
          </div>

          {/* คำขอที่ส่งไปแล้ว */}
          {joinRequests.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ marginBottom: 8, color: '#333' }}>คำขอของฉัน</h4>
              {joinRequests.map(r => (
                <div className="admin-card" key={r.id} style={{ marginBottom: 8 }}>
                  <div className="admin-card-main">
                    <div className="admin-card-title">{r.station_name}</div>
                    <div className="admin-card-sub">{r.province_name}</div>
                    <span className={`status-badge ${r.status === 'approved' ? 'has-fuel' : r.status === 'rejected' ? 'no-fuel' : ''}`}
                      style={r.status === 'pending' ? { background: '#fff3e0', color: '#9e3d00', display: 'inline-flex', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 16, marginTop: 6 } : { marginTop: 6 }}>
                      {r.status === 'pending' ? '⏳ รอการอนุมัติ' : r.status === 'approved' ? '✅ อนุมัติแล้ว' : '❌ ไม่อนุมัติ'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* คำขอเพิ่มปั๊มใหม่ */}
          {myRequests.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ marginBottom: 8, color: '#333' }}>คำขอเพิ่มปั๊มใหม่</h4>
              {myRequests.map(r => (
                <div className="admin-card" key={`req-${r.id}`} style={{ marginBottom: 8 }}>
                  <div className="admin-card-main">
                    <div className="admin-card-title">{r.name}</div>
                    <div className="admin-card-sub">{r.brand} · {r.province_name}</div>
                    <span className={`status-badge ${r.status === 'approved' ? 'has-fuel' : r.status === 'rejected' ? 'no-fuel' : ''}`}
                      style={r.status === 'pending' ? { background: '#fff3e0', color: '#9e3d00', display: 'inline-flex', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 16, marginTop: 6 } : { marginTop: 6 }}>
                      {r.status === 'pending' ? '⏳ รอการอนุมัติ' : r.status === 'approved' ? '✅ อนุมัติแล้ว' : '❌ ไม่อนุมัติ'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ขอเพิ่มปั๊มใหม่ */}
          <button className="admin-add-btn" onClick={() => setShowRequestForm(true)} style={{ marginBottom: 16 }}>
            + ปั๊มที่ต้องการไม่มีในระบบ? ขอเพิ่มปั๊มใหม่
          </button>

          {/* เลือกปั๊ม */}
          <h4 style={{ marginBottom: 8, color: '#333' }}>เลือกปั๊มที่มีในระบบ</h4>
          <input
            type="text"
            placeholder="🔍 ค้นหาปั๊ม..."
            value={stationSearch}
            onChange={e => setStationSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', border: '2px solid transparent', borderRadius: 12, fontSize: 15, background: '#f2f4f6', marginBottom: 10 }}
          />
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {filteredStations.map(s => {
              const alreadyRequested = joinRequests.some(r => r.station_id === s.id && r.status === 'pending');
              return (
                <div className="admin-card" key={s.id} style={{ marginBottom: 8 }}>
                  <div className="admin-card-main">
                    <div className="admin-card-title">{s.name}</div>
                    <div className="admin-card-sub">{s.province_name}</div>
                  </div>
                  {alreadyRequested ? (
                    <span style={{ fontSize: 12, color: '#999' }}>ส่งแล้ว</span>
                  ) : (
                    <button className="admin-btn edit" onClick={() => requestJoin(s.id)}>ขอเข้าร่วม</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal ขอเพิ่มปั๊มใหม่ */}
        {showRequestForm && (
          <div className="modal-overlay" onClick={() => setShowRequestForm(false)}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
              <RequestStationForm
                staff={staff}
                provinces={provinces}
                onClose={() => setShowRequestForm(false)}
                onSave={() => { setShowRequestForm(false); loadMyRequests(staff.id); }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== มีปั๊มแล้ว → แสดง dashboard ปกติ =====
  return (
    <div>
      <div className="dashboard-header">
        <h1>📋 รายงานสถานะน้ำมัน</h1>
        <p>{staff.station_name}</p>
        <div className="dashboard-actions">
          <button className="btn-logout" onClick={handleLogout}>ออกจากระบบ</button>
        </div>
      </div>

      <div style={{ padding: '12px 20px 4px', color: '#666', fontSize: 14 }}>
        สวัสดี <strong>{staff.name}</strong>
      </div>

      {/* Tabs */}
      <div className="tab-nav">
        <button className={`tab-btn ${tab === 'fuel' ? 'active' : ''}`} onClick={() => setTab('fuel')}>
          ⛽ รายงานน้ำมัน
        </button>
        <button className={`tab-btn ${tab === 'request' ? 'active' : ''}`} onClick={() => setTab('request')}>
          📝 ขอเพิ่มปั๊ม {pendingCount > 0 && `(${pendingCount})`}
        </button>
      </div>

      {/* ===== Fuel Tab ===== */}
      {tab === 'fuel' && (
        <div className="fuel-control-list">
          {fuels.map(f => (
            <div className="fuel-control-item" key={f.fuel_type}>
              <div style={{ flex: 1 }}>
                <div className="fuel-control-name">{f.fuel_type}</div>
                <div className="fuel-control-time">
                  อัปเดต: {formatTime(f.updated_at)}
                  {f.updated_at && <span className="time-ago"> ({timeAgo(f.updated_at)})</span>}
                </div>
                {f.updated_by && <div className="fuel-control-time">โดย: {f.updated_by}</div>}
                <span className={`status-badge ${f.is_available ? 'has-fuel' : 'no-fuel'}`} style={{ marginTop: 6 }}>
                  {f.is_available ? '● มีน้ำมัน' : '● หมด'}
                </span>
                {f.is_available && (
                  <div className="remaining-cars-input">
                    <label>รองรับอีกประมาณ</label>
                    <div className="cars-input-row">
                      <input type="number" min="0" placeholder="จำนวน" value={editCars[f.fuel_type] ?? ''} onChange={e => setEditCars({ ...editCars, [f.fuel_type]: e.target.value })} />
                      <span className="cars-unit">คัน</span>
                      <button className="cars-save-btn" onClick={() => saveCars(f)} disabled={saving === f.fuel_type}>บันทึก</button>
                    </div>
                  </div>
                )}
              </div>
              <label className="toggle">
                <input type="checkbox" checked={f.is_available === true} onChange={() => toggleFuel(f)} disabled={saving === f.fuel_type} />
                <span className="toggle-slider"></span>
              </label>
            </div>
          ))}
        </div>
      )}

      {/* ===== Request Tab ===== */}
      {tab === 'request' && (
        <div style={{ padding: '16px 20px 80px' }}>
          <button className="admin-add-btn" onClick={() => setShowRequestForm(true)}>
            + ขอเพิ่มปั๊มใหม่
          </button>

          {/* My requests list */}
          <div style={{ marginTop: 16, fontSize: 15, fontWeight: 700, color: '#333' }}>คำขอของฉัน</div>
          {myRequests.length === 0 && <div className="loading">ยังไม่มีคำขอ</div>}
          {myRequests.map(r => (
            <div className="admin-card" key={r.id} style={{ marginTop: 10 }}>
              <div className="admin-card-main">
                <div className="admin-card-title">{r.name}</div>
                <div className="admin-card-sub">{r.brand} · {r.province_name} · {r.address}</div>
                <div style={{ marginTop: 6 }}>
                  <span className={`status-badge ${r.status === 'approved' ? 'has-fuel' : r.status === 'rejected' ? 'no-fuel' : ''}`}
                    style={r.status === 'pending' ? { background: '#fff3e0', color: '#e65100', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 16 } : {}}>
                    {r.status === 'pending' ? '⏳ รอการอนุมัติ' : r.status === 'approved' ? '✅ อนุมัติแล้ว' : '❌ ไม่อนุมัติ'}
                  </span>
                </div>
                {r.admin_note && <div className="admin-card-sub" style={{ marginTop: 4 }}>หมายเหตุ: {r.admin_note}</div>}
                <div className="admin-card-sub">ส่งเมื่อ: {formatTime(r.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Request Form Modal ===== */}
      {showRequestForm && (
        <div className="modal-overlay" onClick={() => setShowRequestForm(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <RequestStationForm
              staff={staff}
              provinces={provinces}
              onClose={() => setShowRequestForm(false)}
              onSave={() => { setShowRequestForm(false); loadMyRequests(staff.id); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function RequestStationForm({ staff, provinces, onClose, onSave }) {
  const [form, setForm] = useState({
    name: '', brand: 'PTT', address: '', province_id: provinces[0]?.id || '', lat: '', lng: '', phone: '',
  });
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleMapClick = (latlng) => {
    setForm({ ...form, lat: latlng.lat.toFixed(6), lng: latlng.lng.toFixed(6) });
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { setError('เบราว์เซอร์ไม่รองรับ GPS'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setForm({ ...form, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }); setLocating(false); },
      () => { setError('ไม่สามารถเข้าถึงตำแหน่งได้'); setLocating(false); },
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    const res = await authFetch(`${API}/staff/request-station`, {
      method: 'POST',
      body: JSON.stringify({ ...form, lat: parseFloat(form.lat), lng: parseFloat(form.lng), staff_id: staff.id, staff_name: staff.name }),
    }, 'staff');
    if (!res.ok) { setError('เกิดข้อผิดพลาด'); return; }
    setSubmitted(true);
    setTimeout(() => onSave(), 1500);
  };

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h3 style={{ color: '#2e7d32' }}>ส่งคำขอเรียบร้อย!</h3>
        <p style={{ color: '#666', marginTop: 8 }}>รอ Admin อนุมัติ</p>
      </div>
    );
  }

  const mapCenter = form.lat && form.lng ? [parseFloat(form.lat), parseFloat(form.lng)] : [13.75, 100.52];

  return (
    <form onSubmit={handleSubmit}>
      <h3>📝 ขอเพิ่มปั๊มใหม่</h3>
      <p style={{ fontSize: 13, color: '#999', marginBottom: 16 }}>กรอกข้อมูลปั๊มแล้วส่งให้ Admin อนุมัติ</p>
      {error && <div className="error-msg">{error}</div>}
      <div className="form-group"><label>ชื่อปั๊ม</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="เช่น ปั๊ม ปตท. สาขาบางนา" /></div>
      <div className="form-row">
        <div className="form-group"><label>แบรนด์</label>
          <select value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })}>
            {['PTT','PT','Bangchak','Shell','Esso','Caltex','Susco','IRPC','Pure','FPT','Thaioil','Other'].map(b => <option key={b} value={b}>{b === 'Other' ? 'อื่นๆ' : b}</option>)}
          </select></div>
        <div className="form-group"><label>จังหวัด</label>
          <select value={form.province_id} onChange={e => setForm({ ...form, province_id: e.target.value })}>
            {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      </div>
      <div className="form-group"><label>ที่อยู่</label><input required value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
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
          <div className="form-group"><label>ละติจูด</label><input required type="number" step="any" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} /></div>
          <div className="form-group"><label>ลองจิจูด</label><input required type="number" step="any" value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} /></div>
        </div>
      </div>
      <div className="form-group"><label>โทรศัพท์</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button>
        <button type="submit" className="btn btn-primary">ส่งคำขอ</button>
      </div>
    </form>
  );
}

export default StaffDashboard;
