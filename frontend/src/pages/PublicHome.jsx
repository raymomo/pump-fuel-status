import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/common/Header';
import MapView from '../components/map/MapView';

import { API } from '../utils/api';
import { timeAgo } from '../utils/helpers';

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function PublicHome() {
  const [stations, setStations] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [searchText, setSearchText] = useState('');
  const [viewMode, setViewMode] = useState('all');
  const [displayMode, setDisplayMode] = useState('map');
  const [loading, setLoading] = useState(true);
  const [brandFilter, setBrandFilter] = useState([]);
  const [selectedFuelType, setSelectedFuelType] = useState([]);
  const [userLat, setUserLat] = useState(null);
  const [userLng, setUserLng] = useState(null);
  const [radius, setRadius] = useState(0);
  const [locating, setLocating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showRadius, setShowRadius] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  const [navBrands, setNavBrands] = useState([]);
  const [navFuelTypes, setNavFuelTypes] = useState([]);
  const [nearestStation, setNearestStation] = useState(null);
  const [nearestDist, setNearestDist] = useState(0);
  const [showNavSettings, setShowNavSettings] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportStation, setReportStation] = useState(null);
  const [reportFuelType, setReportFuelType] = useState('');
  const [reportAvailable, setReportAvailable] = useState(true);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const navigate = useNavigate();

  const publicToken = localStorage.getItem('public_token');
  const publicName = localStorage.getItem('public_name');
  const [showLoginCard, setShowLoginCard] = useState(false);
  const [reportingEnabled, setReportingEnabled] = useState(false);

  useEffect(() => {
    fetch(`${API}/feature/public_reporting_enabled`).then(r => r.json())
      .then(d => setReportingEnabled(!!d.enabled))
      .catch(() => {});
  }, []);

  const openReportMode = () => {
    if (!publicToken) {
      setShowLoginCard(true);
      return;
    }
    if (!userLat) {
      alert('กรุณาเปิด GPS ก่อน');
      locateMe();
      return;
    }
    // Find nearby stations (≤500m)
    const nearby = stations
      .map(s => ({ ...s, _dist: getDistance(userLat, userLng, s.lat, s.lng) * 1000 }))
      .filter(s => s._dist <= 500)
      .sort((a, b) => a._dist - b._dist);
    if (nearby.length === 0) {
      alert('ไม่พบปั๊มในรัศมี 500 เมตร');
      return;
    }
    setReportStation(nearby[0]);
    setReportFuelType('');
    setReportAvailable(true);
    setShowReportModal(true);
  };

  const submitReport = async () => {
    if (!reportStation || !reportFuelType) {
      alert('กรุณาเลือกชนิดน้ำมัน');
      return;
    }
    setReportSubmitting(true);
    try {
      const res = await fetch(`${API}/public/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicToken}` },
        body: JSON.stringify({
          station_id: reportStation.id,
          fuel_type: reportFuelType,
          is_available: reportAvailable,
          lat: userLat,
          lng: userLng,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('public_token');
          alert('กรุณาเข้าสู่ระบบใหม่');
          window.location.href = `${API}/auth/line`;
          return;
        }
        alert(data.error || 'เกิดข้อผิดพลาด');
        return;
      }
      alert(`รายงานสำเร็จ! (${data.same_reports} คนรายงานเหมือนกัน)`);
      setShowReportModal(false);
    } catch {
      alert('เกิดข้อผิดพลาด');
    } finally {
      setReportSubmitting(false);
    }
  };

  useEffect(() => {
    fetch(`${API}/provinces`).then(r => r.json()).then(setProvinces);
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = selectedProvince
      ? `${API}/stations-status?province_id=${selectedProvince}`
      : `${API}/stations-status`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setStations(data);
        setLoading(false);
      });
  }, [selectedProvince]);

  // ขอ GPS ทันทีเมื่อเปิดเว็บ
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
      },
      () => {},
      { enableHighAccuracy: true }
    );
  }, []);

  const locateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        if (radius === 0) setRadius(20);
        setLocating(false);
      },
      () => { setLocating(false); },
      { enableHighAccuracy: true }
    );
  };

  const hasActiveFilters = selectedProvince || brandFilter.length > 0 || selectedFuelType.length > 0 || viewMode !== 'all' || radius > 0;

  const clearAllFilters = () => {
    setSelectedProvince('');
    setBrandFilter([]);
    setSelectedFuelType([]);
    setViewMode('all');
    setRadius(0);
    setSearchText('');
  };

  const filtered = stations.filter(s => {
    if (radius > 0 && userLat && userLng) {
      const dist = getDistance(userLat, userLng, s.lat, s.lng);
      if (dist > radius) return false;
    }
    if (brandFilter.length > 0 && !brandFilter.includes(s.brand)) return false;
    if (selectedFuelType.length > 0 && !selectedFuelType.some(ft => s.fuels?.some(f => f.fuel_type === ft && f.is_available))) return false;
    if (viewMode === 'available' && !s.has_fuel) return false;
    if (viewMode === 'empty' && s.has_fuel) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return s.name.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q) ||
        s.brand.toLowerCase().includes(q) ||
        s.province_name?.toLowerCase().includes(q);
    }
    return true;
  }).map(s => ({ ...s, _distance: userLat ? getDistance(userLat, userLng, s.lat, s.lng) : null }))
    .sort((a, b) => (a._distance ?? 999) - (b._distance ?? 999));

  const navigateToNearest = () => {
    if (!userLat || !userLng) {
      alert('กรุณาเปิด GPS ก่อน');
      locateMe();
      return;
    }
    const matching = stations.filter(s => {
      if (navBrands.length > 0 && !navBrands.includes(s.brand)) return false;
      if (navFuelTypes.length > 0 && !navFuelTypes.some(ft => s.fuels?.some(f => f.fuel_type === ft && f.is_available))) return false;
      if (!s.has_fuel) return false;
      return true;
    });
    if (matching.length === 0) {
      alert('ไม่พบปั๊มที่ตรงตามเงื่อนไข ลองเปลี่ยนตั้งค่า');
      setShowNavSettings(true);
      return;
    }
    let nearest = matching[0];
    let minDist = getDistance(userLat, userLng, nearest.lat, nearest.lng);
    matching.forEach(s => {
      const d = getDistance(userLat, userLng, s.lat, s.lng);
      if (d < minDist) { minDist = d; nearest = s; }
    });
    setNearestStation(nearest);
    setNearestDist(minDist);
  };

  const handleStationClick = (id) => {
    const s = filtered.find(st => st.id === id);
    if (s) setSelectedStation(s);
    else navigate(`/station/${id}`);
  };

  const brands = useMemo(() => [...new Set(stations.map(s => s.brand))].sort(), [stations]);
  const fuelTypesList = useMemo(() => [...new Set(stations.flatMap(s => s.fuels?.map(f => f.fuel_type) || []))].sort(), [stations]);
  const { availableCount, emptyCount } = useMemo(() => ({
    availableCount: stations.filter(s => s.has_fuel).length,
    emptyCount: stations.filter(s => !s.has_fuel).length,
  }), [stations]);

  // Sidebar content (shared between mobile & desktop)
  const sidebar = (
    <div className="sidebar-inner">
      {/* Search */}
      <div className="sidebar-section">
        <label className="sidebar-label">🔍 ค้นหาปั๊ม</label>
        <input
          type="text"
          className="sidebar-search"
          placeholder="ชื่อปั๊ม, แบรนด์, ที่อยู่..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
        />
      </div>

      {/* Radius */}
      <div className="sidebar-section">
        <label className="sidebar-label">📍 รัศมีจากตำแหน่ง</label>
        <button className={`location-btn ${locating ? '' : ''}`} onClick={locateMe} disabled={locating} style={{ width: '100%', marginBottom: 8 }}>
          {locating ? '⏳ กำลังหา...' : userLat ? '✅ พบตำแหน่งแล้ว' : '📌 หาตำแหน่งของฉัน'}
        </button>
        {userLat && (
          <div className="sidebar-filters">
            {[0, 10, 20, 50, 100].map(r => (
              <button key={r} className={`sidebar-filter-btn ${radius === r ? 'active' : ''}`} onClick={() => setRadius(r)}>
                {r === 0 ? 'ทั้งหมด (ไม่จำกัด)' : `ภายใน ${r} กม. (${filtered.length} ปั๊ม)`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Province */}
      <div className="sidebar-section">
        <label className="sidebar-label">🏷️ จังหวัด</label>
        <select
          className="sidebar-select"
          value={selectedProvince}
          onChange={e => setSelectedProvince(e.target.value)}
        >
          <option value="">ทุกจังหวัด</option>
          {provinces.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Brand (multi-select) */}
      <div className="sidebar-section">
        <label className="sidebar-label">🏷️ แบรนด์</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {brands.map(b => (
            <button key={b} className={`sidebar-chip ${brandFilter.includes(b) ? 'active' : ''}`}
              onClick={() => setBrandFilter(brandFilter.includes(b) ? brandFilter.filter(x => x !== b) : [...brandFilter, b])}>
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Fuel type (multi-select) */}
      <div className="sidebar-section">
        <label className="sidebar-label">🛢️ ชนิดน้ำมัน</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <button className={`sidebar-chip ${selectedFuelType.length === 0 ? 'active' : ''}`} onClick={() => setSelectedFuelType([])}>ทั้งหมด</button>
          {fuelTypesList.map(ft => (
            <button key={ft} className={`sidebar-chip ${selectedFuelType.includes(ft) ? 'active' : ''}`}
              onClick={() => setSelectedFuelType(selectedFuelType.includes(ft) ? selectedFuelType.filter(x => x !== ft) : [...selectedFuelType, ft])}>
              {ft}
            </button>
          ))}
        </div>
      </div>

      {/* Filter status */}
      <div className="sidebar-section">
        <label className="sidebar-label">⛽ สถานะ</label>
        <div className="sidebar-filters">
          {[['all', `ทั้งหมด (${stations.length})`], ['available', `🟢 มีน้ำมัน (${availableCount})`], ['empty', `🔴 หมด (${emptyCount})`]].map(([key, label]) => (
            <button
              key={key}
              className={`sidebar-filter-btn ${viewMode === key ? 'active' : ''}`}
              onClick={() => setViewMode(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="sidebar-section">
        <label className="sidebar-label">📊 สรุป</label>
        <div className="sidebar-stats">
          <div className="sidebar-stat">
            <div className="sidebar-stat-num">{stations.length}</div>
            <div className="sidebar-stat-label">ปั๊มทั้งหมด</div>
          </div>
          <div className="sidebar-stat green">
            <div className="sidebar-stat-num">{availableCount}</div>
            <div className="sidebar-stat-label">มีน้ำมัน</div>
          </div>
          <div className="sidebar-stat red">
            <div className="sidebar-stat-num">{emptyCount}</div>
            <div className="sidebar-stat-label">หมด</div>
          </div>
        </div>
      </div>

      {/* Clear all */}
      {hasActiveFilters && (
        <div className="sidebar-section">
          <button className="clear-filters-btn" onClick={clearAllFilters}>✕ ล้างตัวกรองทั้งหมด</button>
        </div>
      )}

      {/* Quick links */}
      <div className="sidebar-section sidebar-links">
        <Link to="/overview" className="sidebar-link">📊 ภาพรวมประเทศ</Link>
        <Link to="/staff" className="sidebar-link">👤 สำหรับพนักงาน</Link>
        <Link to="/admin" className="sidebar-link">🛡️ ผู้ดูแลระบบ</Link>
      </div>
    </div>
  );

  return (
    <div>
      <Header />

      {/* ===== Mobile: Top controls ===== */}
      <div className="mobile-controls">
        {/* Mobile filter panel (เหมือน mobile app) */}
        {showFilters && (<div className="mobile-filter-overlay" onClick={() => { setShowFilters(false); setSelectedStation(null); }} />)}
        {showFilters && (
          <div className="mobile-filter-panel">
            {/* จังหวัด */}
            <div className="mobile-filter-section">
              <label className="mobile-filter-label">📍 จังหวัด</label>
              <div className="mobile-filter-chips scrollable">
                <button className={`filter-chip ${!selectedProvince ? 'active' : ''}`} onClick={() => setSelectedProvince('')}>ทั้งหมด</button>
                {provinces.map(p => (
                  <button key={p.id} className={`filter-chip ${selectedProvince === String(p.id) ? 'active' : ''}`}
                    onClick={() => setSelectedProvince(selectedProvince === String(p.id) ? '' : String(p.id))}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* แบรนด์ (multi-select) */}
            <div className="mobile-filter-section">
              <label className="mobile-filter-label">⛽ แบรนด์</label>
              <div className="mobile-filter-chips">
                {brands.map(b => (
                  <button key={b} className={`filter-chip brand ${brandFilter.includes(b) ? 'active' : ''}`}
                    onClick={() => setBrandFilter(brandFilter.includes(b) ? brandFilter.filter(x => x !== b) : [...brandFilter, b])}>
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* สถานะ */}
            <div className="mobile-filter-section">
              <label className="mobile-filter-label">⛽ สถานะ</label>
              <div className="mobile-filter-chips">
                <button className={`filter-chip status ${viewMode === 'available' ? 'active' : ''}`}
                  onClick={() => setViewMode(viewMode === 'available' ? 'all' : 'available')}>
                  {viewMode === 'available' ? '🟢 แสดงเฉพาะปั๊มที่มีน้ำมัน' : '🟢 ซ่อนปั๊มที่หมด'}
                </button>
              </div>
            </div>

            {/* รัศมี */}
            <div className="mobile-filter-section">
              <label className="mobile-filter-label">📏 รัศมี</label>
              <div className="mobile-filter-chips">
                {[0, 5, 10, 20, 50].map(r => (
                  <button key={r} className={`filter-chip ${radius === r ? 'active' : ''}`}
                    onClick={() => { setRadius(r); if (r > 0 && !userLat) locateMe(); }}>
                    {r === 0 ? 'ทั้งหมด' : `${r} กม.`}
                  </button>
                ))}
              </div>
            </div>

            {/* ชนิดน้ำมัน */}
            <div className="mobile-filter-section">
              <label className="mobile-filter-label">🛢️ ชนิดน้ำมัน</label>
              <div className="mobile-filter-chips">
                <button className={`filter-chip ${selectedFuelType.length === 0 ? 'active' : ''}`} onClick={() => setSelectedFuelType([])}>ทั้งหมด</button>
                {fuelTypesList.map(ft => (
                  <button key={ft} className={`filter-chip ${selectedFuelType.includes(ft) ? 'active' : ''}`}
                    onClick={() => setSelectedFuelType(selectedFuelType.includes(ft) ? selectedFuelType.filter(x => x !== ft) : [...selectedFuelType, ft])}>
                    {ft}
                  </button>
                ))}
              </div>
            </div>

            {/* ปุ่มล้าง */}
            {hasActiveFilters && (
              <button className="clear-filters-btn" onClick={clearAllFilters}>✕ ล้างตัวกรองทั้งหมด</button>
            )}
          </div>
        )}

        {/* Radius selector */}
        <div className="radius-bar">
          <div className="radius-options">
            <button className={`radius-opt ${radius === 0 ? 'active' : ''}`} onClick={() => setRadius(0)}>ทั้งหมด</button>
            {[5, 10, 20, 50].map(r => (
              <button key={r} className={`radius-opt ${radius === r ? 'active' : ''}`} onClick={() => { setRadius(r); if (!userLat) locateMe(); }}>
                {r}กม.
              </button>
            ))}
          </div>
          <span className="radius-info">🟢{filtered.filter(s => s.has_fuel).length} 🔴{filtered.filter(s => !s.has_fuel).length}</span>
        </div>

        {displayMode === 'list' && (
          <div className="filter-bar">
            {[['all', `ทั้งหมด (${filtered.length})`], ['available', `มีน้ำมัน (${availableCount})`], ['empty', `หมด (${emptyCount})`]].map(([key, label]) => (
              <button key={key} className={`filter-btn ${viewMode === key ? 'active' : ''}`} onClick={() => setViewMode(key)}>{label}</button>
            ))}
          </div>
        )}
      </div>

      {/* ===== Content Area (shared: mobile shows directly, desktop wraps with sidebar) ===== */}
      <div className="content-wrapper">
        {/* Desktop sidebar */}
        <aside className="desktop-sidebar">
          {sidebar}
        </aside>

        <main className="content-main">
          {/* Desktop tabs */}
          <div className="desktop-tabs">
            <button className={`tab-btn ${displayMode === 'map' ? 'active' : ''}`} onClick={() => setDisplayMode('map')}>🗺️ แผนที่</button>
            <button className={`tab-btn ${displayMode === 'list' ? 'active' : ''}`} onClick={() => setDisplayMode('list')}>📋 รายการ</button>
            <Link to="/overview" className="tab-btn">📊 ภาพรวม</Link>
            <span className="desktop-result-count">{filtered.length} ปั๊ม</span>
          </div>

          {loading ? (
            <div className="loading">กำลังโหลด...</div>
          ) : displayMode === 'map' ? (
            <div className="thailand-map">
              <MapView
                stations={filtered}
                userLat={userLat}
                userLng={userLng}
                radiusKm={radius}
                theme="light"
                onStationClick={handleStationClick}
                onMapClick={() => setSelectedStation(null)}
              />

              {/* Radius toggle ด้านขวา (เหมือน mobile) */}
              {/* Filter button (มุมขวา) */}
              <button className={`map-filter-mini ${showFilters ? 'active' : ''}`} onClick={() => { setShowFilters(!showFilters); setSelectedStation(null); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                {hasActiveFilters && <span className="filter-active-dot" />}
              </button>

              {/* Radius button */}
              <button className={`map-radius-toggle ${radius > 0 ? 'active' : ''}`} onClick={() => setShowRadius(!showRadius)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m10-10h-4M6 12H2"/>
                </svg>
                {radius > 0 && <span className="map-radius-value">{radius}</span>}
              </button>
              {showRadius && (
                <div className="map-radius-slide">
                  {[0, 5, 10, 20, 50].map(r => (
                    <button key={r} className={`map-radius-opt ${radius === r && r > 0 ? 'active' : ''}`}
                      onClick={() => { setRadius(r); setShowRadius(false); if (r > 0 && !userLat) locateMe(); }}>
                      {r === 0 ? '∞' : r}
                    </button>
                  ))}
                  <span className="map-radius-label">กม.</span>
                </div>
              )}

              {/* Floating filter chips on map (เหมือน mobile) */}
              <div className="map-floating-filters">
                <div className="map-chips-row-with-btn">
                  <div className="map-chips-row">
                    {fuelTypesList.map(ft => (
                      <button key={ft} className={`map-chip ${selectedFuelType.includes(ft) ? 'active' : ''}`}
                        onClick={() => setSelectedFuelType(selectedFuelType.includes(ft) ? selectedFuelType.filter(x => x !== ft) : [...selectedFuelType, ft])}>
                        {ft}
                      </button>
                    ))}
                  </div>
                  <button className="map-filter-icon-btn" onClick={() => { setShowFilters(!showFilters); setSelectedStation(null); }}>
                    <span>⚙</span>
                    {hasActiveFilters && <span className="filter-active-dot" />}
                  </button>
                </div>
                <div className="map-chips-row">
                  {brands.map(b => (
                    <button key={b} className={`map-chip brand ${brandFilter.includes(b) ? 'active' : ''}`}
                      onClick={() => setBrandFilter(brandFilter.includes(b) ? brandFilter.filter(x => x !== b) : [...brandFilter, b])}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Map filter panel (เหมือน mobile) */}
              {showFilters && (
                <div className="map-filter-panel">
                  <div className="mobile-filter-section">
                    <label className="mobile-filter-label">📍 จังหวัด</label>
                    <div className="mobile-filter-chips scrollable">
                      <button className={`filter-chip ${!selectedProvince ? 'active' : ''}`} onClick={() => setSelectedProvince('')}>ทั้งหมด</button>
                      {provinces.map(p => (
                        <button key={p.id} className={`filter-chip ${selectedProvince === String(p.id) ? 'active' : ''}`}
                          onClick={() => setSelectedProvince(selectedProvince === String(p.id) ? '' : String(p.id))}>
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mobile-filter-section">
                    <label className="mobile-filter-label">⛽ แบรนด์</label>
                    <div className="mobile-filter-chips">
                      {brands.map(b => (
                        <button key={b} className={`filter-chip brand ${brandFilter.includes(b) ? 'active' : ''}`}
                          onClick={() => setBrandFilter(brandFilter.includes(b) ? brandFilter.filter(x => x !== b) : [...brandFilter, b])}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mobile-filter-section">
                    <label className="mobile-filter-label">⛽ สถานะ</label>
                    <div className="mobile-filter-chips">
                      <button className={`filter-chip status ${viewMode === 'available' ? 'active' : ''}`}
                        onClick={() => setViewMode(viewMode === 'available' ? 'all' : 'available')}>
                        {viewMode === 'available' ? '🟢 แสดงเฉพาะปั๊มที่มีน้ำมัน' : '🟢 ซ่อนปั๊มที่หมด'}
                      </button>
                    </div>
                  </div>
                  <div className="mobile-filter-section">
                    <label className="mobile-filter-label">📏 รัศมี</label>
                    <div className="mobile-filter-chips">
                      {[0, 5, 10, 20, 50].map(r => (
                        <button key={r} className={`filter-chip ${radius === r ? 'active' : ''}`}
                          onClick={() => { setRadius(r); if (r > 0 && !userLat) locateMe(); }}>
                          {r === 0 ? 'ทั้งหมด' : `${r} กม.`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mobile-filter-section">
                    <label className="mobile-filter-label">🛢️ ชนิดน้ำมัน</label>
                    <div className="mobile-filter-chips">
                      <button className={`filter-chip ${selectedFuelType.length === 0 ? 'active' : ''}`} onClick={() => setSelectedFuelType([])}>ทั้งหมด</button>
                      {fuelTypesList.map(ft => (
                        <button key={ft} className={`filter-chip ${selectedFuelType.includes(ft) ? 'active' : ''}`}
                          onClick={() => setSelectedFuelType(selectedFuelType.includes(ft) ? selectedFuelType.filter(x => x !== ft) : [...selectedFuelType, ft])}>
                          {ft}
                        </button>
                      ))}
                    </div>
                  </div>
                  {hasActiveFilters && (
                    <button className="clear-filters-btn" onClick={clearAllFilters}>✕ ล้างตัวกรองทั้งหมด</button>
                  )}
                </div>
              )}

              {/* Station bottom card */}
              {selectedStation && (
                <div className="map-station-card">
                  <button className="map-card-close" onClick={() => setSelectedStation(null)}>✕</button>
                  <div className="map-card-header">
                    <div className="map-card-info">
                      <div className="map-card-name">{selectedStation.name}</div>
                      <div className="map-card-sub">{selectedStation.province_name} · {selectedStation.brand}</div>
                      {selectedStation._distance != null && (
                        <div className="map-card-distance">📏 {selectedStation._distance.toFixed(1)} กม.</div>
                      )}
                    </div>
                    <span className={`map-card-status ${selectedStation.has_fuel ? 'available' : 'empty'}`}>
                      {selectedStation.has_fuel ? '✓ มีน้ำมัน' : '✗ หมด'}
                    </span>
                  </div>
                  <div className="map-card-fuels">
                    {selectedStation.fuels?.map(f => (
                      <span key={f.fuel_type} className={`fuel-tag ${f.is_available ? 'available' : 'unavailable'}`}>
                        {f.is_available ? '✓' : '✗'} {f.fuel_type}
                      </span>
                    ))}
                  </div>
                  <div className="map-card-actions">
                    <Link to={`/station/${selectedStation.id}`} className="map-card-btn detail">📋 รายละเอียด</Link>
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedStation.lat},${selectedStation.lng}`}
                      target="_blank" rel="noopener noreferrer" className="map-card-btn nav">🧭 นำทาง</a>
                  </div>
                </div>
              )}

              <div className="map-legend">
                <span className="legend-item"><span className="legend-dot green" /> มีน้ำมัน</span>
                <span className="legend-item"><span className="legend-dot red" /> น้ำมันหมด</span>
              </div>
            </div>
          ) : (
            <div className="station-list">
              {filtered.length === 0 && <div className="loading">ไม่พบปั๊มในหมวดนี้</div>}
              {filtered.map(station => (
                <Link to={`/station/${station.id}`} key={station.id} className="station-card">
                  <div className="station-card-header">
                    <div>
                      <span className="station-province-tag">{station.province_name}</span>
                      <div className="station-name">{station.name}</div>
                    </div>
                    <span className={`station-brand brand-${station.brand}`}>{station.brand}</span>
                  </div>
                  <div className="station-address">{station.address}</div>
                  <div className="fuel-tags">
                    {station.fuels.map(f => (
                      <span key={f.fuel_type} className={`fuel-tag ${f.is_available ? 'available' : 'unavailable'}`}>
                        {f.is_available ? '✓' : '✗'} {f.fuel_type}
                        {f.is_available && f.remaining_cars != null && <span className="fuel-cars"> ~{f.remaining_cars} คัน</span>}
                      </span>
                    ))}
                  </div>
                  {station.fuels.some(f => f.updated_at) && (
                    <div className="station-updated-time">
                      อัปเดต: {timeAgo(Math.max(...station.fuels.filter(f => f.updated_at).map(f => new Date(f.updated_at).getTime())))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ===== Mobile Bottom Tab Bar (เหมือน mobile app) ===== */}
      <div className="mobile-bottom-bar">
        <button className={`bottom-tab ${displayMode === 'map' ? 'active' : ''}`} onClick={() => setDisplayMode('map')}>
          <span className="bottom-tab-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
            </svg>
          </span>
          <span className="bottom-tab-label">แผนที่</span>
        </button>
        <button className={`bottom-tab ${displayMode === 'list' ? 'active' : ''}`} onClick={() => setDisplayMode('list')}>
          <span className="bottom-tab-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </span>
          <span className="bottom-tab-label">รายการ</span>
        </button>
        {reportingEnabled && (
          <button className="bottom-tab-center" onClick={openReportMode}>
            <span className="bottom-tab-center-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </span>
            <span className="bottom-tab-label">รายงาน</span>
          </button>
        )}
        <button className="bottom-tab" onClick={navigateToNearest}>
          <span className="bottom-tab-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
          </span>
          <span className="bottom-tab-label">ใกล้ฉัน</span>
        </button>
        <Link to="/overview" className="bottom-tab">
          <span className="bottom-tab-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </span>
          <span className="bottom-tab-label">ภาพรวม</span>
        </Link>
      </div>

      {/* ===== LINE Login Card ===== */}
      {showLoginCard && (
        <div className="nav-modal-overlay" onClick={() => setShowLoginCard(false)}>
          <div className="line-login-card" onClick={e => e.stopPropagation()}>
            <div className="line-login-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="#fff"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
            </div>
            <div className="line-login-title">เข้าสู่ระบบด้วย LINE</div>
            <div className="line-login-desc">เพื่อรายงานสถานะน้ำมัน<br/>ให้คนอื่นรู้ว่าปั๊มไหนมีน้ำมัน</div>
            <a href={`${API}/auth/line`} className="line-login-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
              เข้าสู่ระบบด้วย LINE
            </a>
            <button className="line-login-cancel" onClick={() => setShowLoginCard(false)}>ยกเลิก</button>
            <div className="line-login-note">เราใช้ LINE เพื่อยืนยันตัวตนเท่านั้น<br/>ไม่มีการส่งข้อความรบกวน</div>
          </div>
        </div>
      )}

      {/* ===== Report Modal ===== */}
      {showReportModal && (
        <div className="nav-modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="nav-modal-card" onClick={e => e.stopPropagation()}>
            <div className="nav-modal-handle" />
            <div className="nav-modal-name">📝 รายงานสถานะน้ำมัน</div>
            {publicName && <div className="nav-modal-address">เข้าสู่ระบบเป็น: {publicName}</div>}

            {/* เลือกปั๊ม */}
            <div className="report-section">
              <div className="report-label">เลือกปั๊ม (ใกล้คุณ ≤500m)</div>
              <div className="report-stations">
                {stations
                  .map(s => ({ ...s, _dist: getDistance(userLat, userLng, s.lat, s.lng) * 1000 }))
                  .filter(s => s._dist <= 500)
                  .sort((a, b) => a._dist - b._dist)
                  .map(s => (
                    <button key={s.id} className={`report-station-btn ${reportStation?.id === s.id ? 'active' : ''}`}
                      onClick={() => setReportStation(s)}>
                      <span>{s.name}</span>
                      <span className="report-station-dist">{Math.round(s._dist)}m</span>
                    </button>
                  ))}
              </div>
            </div>

            {/* เลือกชนิดน้ำมัน */}
            {reportStation && (
              <div className="report-section">
                <div className="report-label">ชนิดน้ำมัน</div>
                <div className="report-chips">
                  {fuelTypesList.map(ft => (
                    <button key={ft} className={`filter-chip ${reportFuelType === ft ? 'active' : ''}`}
                      onClick={() => setReportFuelType(ft)}>
                      {ft}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* มี/หมด */}
            {reportFuelType && (
              <div className="report-section">
                <div className="report-label">สถานะ</div>
                <div className="report-status-btns">
                  <button className={`report-status-btn ok ${reportAvailable ? 'active' : ''}`}
                    onClick={() => setReportAvailable(true)}>🟢 มีน้ำมัน</button>
                  <button className={`report-status-btn no ${!reportAvailable ? 'active' : ''}`}
                    onClick={() => setReportAvailable(false)}>🔴 น้ำมันหมด</button>
                </div>
              </div>
            )}

            {/* Submit */}
            {reportFuelType && (
              <button className="report-submit-btn" onClick={submitReport} disabled={reportSubmitting}>
                {reportSubmitting ? 'กำลังส่ง...' : '📤 ส่งรายงาน'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ===== Nearest Station Card (เหมือน mobile) ===== */}
      {nearestStation && (
        <div className="nav-modal-overlay" onClick={() => setNearestStation(null)}>
          <div className="nav-modal-card" onClick={e => e.stopPropagation()}>
            <div className="nav-modal-handle" />
            <div className="nav-modal-name">{nearestStation.name}</div>
            <div className="nav-modal-meta">
              <span className={`nav-modal-status ${nearestStation.has_fuel ? 'ok' : 'no'}`}>
                {nearestStation.has_fuel ? '● มีน้ำมัน' : '● หมด'}
              </span>
              <span className="nav-modal-brand">{nearestStation.brand}</span>
              <span className="nav-modal-dist">{nearestDist.toFixed(1)} กม.</span>
            </div>
            <div className="nav-modal-address">{nearestStation.address || nearestStation.province_name || ''}</div>
            <div className="nav-modal-actions">
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${nearestStation.lat},${nearestStation.lng}`}
                target="_blank" rel="noopener noreferrer" className="nav-modal-btn go"
                onClick={() => setNearestStation(null)}>
                🧭 นำทาง
              </a>
              <button className="nav-modal-btn settings" onClick={() => { setNearestStation(null); setShowNavSettings(true); }}>
                ⚙️ ตั้งค่า
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Nav Settings Modal (เหมือน mobile) ===== */}
      {showNavSettings && (
        <div className="nav-modal-overlay" onClick={() => setShowNavSettings(false)}>
          <div className="nav-settings-card" onClick={e => e.stopPropagation()}>
            <div className="nav-settings-header">
              <button className="nav-settings-close" onClick={() => setShowNavSettings(false)}>✕</button>
              <span className="nav-settings-title">⚙️ ตั้งค่านำทาง</span>
              <button className="nav-settings-go" onClick={() => { setShowNavSettings(false); navigateToNearest(); }}>นำทาง</button>
            </div>
            <div className="nav-settings-body">
              <div className="nav-settings-section">
                <div className="nav-settings-label">⛽ แบรนด์ที่ต้องการ</div>
                <div className="nav-settings-hint">ไม่เลือก = ทุกแบรนด์</div>
                <div className="nav-settings-chips">
                  {brands.map(b => (
                    <button key={b} className={`nav-chip ${navBrands.includes(b) ? 'active brand' : ''}`}
                      onClick={() => setNavBrands(navBrands.includes(b) ? navBrands.filter(x => x !== b) : [...navBrands, b])}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
              <div className="nav-settings-section">
                <div className="nav-settings-label">🛢️ ชนิดน้ำมัน</div>
                <div className="nav-settings-hint">ไม่เลือก = ทุกชนิด (ต้องมีน้ำมันอย่างน้อย 1 ชนิด)</div>
                <div className="nav-settings-chips">
                  {fuelTypesList.map(ft => (
                    <button key={ft} className={`nav-chip ${navFuelTypes.includes(ft) ? 'active fuel' : ''}`}
                      onClick={() => setNavFuelTypes(navFuelTypes.includes(ft) ? navFuelTypes.filter(x => x !== ft) : [...navFuelTypes, ft])}>
                      {ft}
                    </button>
                  ))}
                </div>
              </div>
              {(navBrands.length > 0 || navFuelTypes.length > 0) && (
                <button className="nav-settings-clear" onClick={() => { setNavBrands([]); setNavFuelTypes([]); }}>✕ ล้างทั้งหมด</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PublicHome;
