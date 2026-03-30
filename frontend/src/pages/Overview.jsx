import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/common/Header';

import { API } from '../utils/api';

function Overview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [recentUpdates, setRecentUpdates] = useState([]);
  const navigate = useNavigate();

  const timeAgo = (t) => {
    if (!t) return '';
    const diff = Math.floor((Date.now() - new Date(t).getTime()) / 1000);
    if (diff < 60) return 'เมื่อสักครู่';
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ชม.ที่แล้ว`;
    return `${Math.floor(diff / 86400)} วันที่แล้ว`;
  };

  useEffect(() => {
    fetch(`${API}/overview`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
    fetch(`${API}/recent-updates`)
      .then(r => r.json())
      .then(setRecentUpdates)
      .catch(() => {});
  }, []);

  if (loading) return <div className="loading">กำลังโหลด...</div>;

  const { summary, provinces } = data;

  const sorted = [...provinces].filter(p => p.total_stations > 0);
  sorted.sort((a, b) => a.fuel_availability_pct - b.fuel_availability_pct);

  const emptyProvinces = provinces.filter(p => p.total_stations === 0);

  const filteredSorted = search
    ? sorted.filter(p => p.province_name.toLowerCase().includes(search.toLowerCase()))
    : sorted;

  const filteredEmpty = search
    ? emptyProvinces.filter(p => p.province_name.toLowerCase().includes(search.toLowerCase()))
    : emptyProvinces;

  const pctColor = (pct) => pct >= 60 ? '#4caf50' : pct >= 30 ? '#ff9800' : '#ef5350';

  // Desktop sidebar
  const sidebar = (
    <div className="sidebar-inner">
      <div className="sidebar-section">
        <label className="sidebar-label">🔍 ค้นหาจังหวัด</label>
        <input
          type="text"
          className="sidebar-search"
          placeholder="ชื่อจังหวัด..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="sidebar-section">
        <label className="sidebar-label">📊 ภาพรวมทั้งประเทศ</label>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
          <div style={{ position: 'relative', width: 100, height: 100 }}>
            <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%' }}>
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e0e0e0" strokeWidth="10" />
              <circle cx="60" cy="60" r="52" fill="none"
                stroke={pctColor(summary.fuel_availability_pct)}
                strokeWidth="10"
                strokeDasharray={`${(summary.fuel_availability_pct / 100) * 327} 327`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 22, fontWeight: 700 }}>{summary.fuel_availability_pct}%</span>
              <span style={{ fontSize: 10, color: '#999' }}>คงเหลือ</span>
            </div>
          </div>
        </div>
        <div className="sidebar-stats">
          <div className="sidebar-stat">
            <div className="sidebar-stat-num">{summary.total_stations}</div>
            <div className="sidebar-stat-label">ทั้งหมด</div>
          </div>
          <div className="sidebar-stat green">
            <div className="sidebar-stat-num">{summary.stations_with_fuel}</div>
            <div className="sidebar-stat-label">มีน้ำมัน</div>
          </div>
          <div className="sidebar-stat red">
            <div className="sidebar-stat-num">{summary.stations_no_fuel}</div>
            <div className="sidebar-stat-label">ไม่มี</div>
          </div>
        </div>
      </div>

      {/* Top จังหวัดวิกฤต */}
      {sorted.length > 0 && (
        <div className="sidebar-section">
          <label className="sidebar-label">🚨 จังหวัดวิกฤตสุด</label>
          {sorted.slice(0, 5).map(p => (
            <div key={p.province_id} className="sidebar-crisis-item">
              <span className="sidebar-crisis-name">{p.province_name}</span>
              <span className="sidebar-crisis-pct" style={{ color: pctColor(p.fuel_availability_pct) }}>
                {p.fuel_availability_pct}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* อัปเดตล่าสุด */}
      <div className="sidebar-section">
        <label className="sidebar-label">🕐 อัปเดตล่าสุด</label>
        {recentUpdates.slice(0, 5).map((r, i) => (
          <Link to={`/station/${r.station_id}`} key={i} className="sidebar-recent-item">
            <div className="sidebar-recent-station">{r.station_name}</div>
            <div className="sidebar-recent-detail">
              <span className={r.is_available ? 'sidebar-recent-ok' : 'sidebar-recent-no'}>
                {r.is_available ? '✓' : '✗'} {r.fuel_type}
              </span>
              {r.remaining_cars != null && <span className="sidebar-recent-cars"> ~{r.remaining_cars}คัน</span>}
            </div>
            <div className="sidebar-recent-time">{r.updated_by} · {timeAgo(r.updated_at)}</div>
          </Link>
        ))}
        {recentUpdates.length === 0 && <div style={{ fontSize: 13, color: '#999', padding: 8 }}>ยังไม่มีข้อมูล</div>}
      </div>

      <div className="sidebar-section sidebar-links">
        <Link to="/" className="sidebar-link">🗺️ แผนที่/รายการ</Link>
        <Link to="/staff" className="sidebar-link">👤 สำหรับพนักงาน</Link>
        <Link to="/admin" className="sidebar-link">🛡️ ผู้ดูแลระบบ</Link>
      </div>
    </div>
  );

  // Province list component (shared mobile + desktop)
  const provinceList = (
    <>
      {filteredSorted.map(p => (
        <div key={p.province_id} className="province-row" onClick={() => navigate(`/?province=${p.province_id}`)}>
          <div className="province-row-left">
            <div className="province-row-name">{p.province_name}</div>
            <div className="province-row-detail">
              {p.total_stations} ปั๊ม — มีน้ำมัน {p.stations_with_fuel} / ไม่มี {p.stations_no_fuel}
            </div>
          </div>
          <div className="province-row-right">
            <div className="province-bar-container">
              <div className="province-bar-fill" style={{ width: `${p.fuel_availability_pct}%`, background: pctColor(p.fuel_availability_pct) }} />
            </div>
            <span className="province-pct" style={{ color: pctColor(p.fuel_availability_pct) }}>
              {p.fuel_availability_pct}%
            </span>
          </div>
        </div>
      ))}
      {filteredEmpty.map(p => (
        <div key={p.province_id} className="province-row empty-province">
          <div className="province-row-left">
            <div className="province-row-name">{p.province_name}</div>
            <div className="province-row-detail">ยังไม่มีปั๊มในระบบ</div>
          </div>
          <div className="province-row-right">
            <span className="province-pct" style={{ color: '#bbb' }}>—</span>
          </div>
        </div>
      ))}
    </>
  );

  return (
    <div>
      <Header />

      {/* ===== Mobile ===== */}
      <div className="mobile-controls">
        <div className="tab-nav">
          <Link to="/" className="tab-btn">🗺️ แผนที่/รายการ</Link>
          <button className="tab-btn active">📊 ภาพรวมประเทศ</button>
        </div>

        <div className="overview-hero">
          <div className="overview-pct">
            <svg viewBox="0 0 120 120" className="pct-ring">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e0e0e0" strokeWidth="10" />
              <circle cx="60" cy="60" r="52" fill="none"
                stroke={pctColor(summary.fuel_availability_pct)}
                strokeWidth="10"
                strokeDasharray={`${(summary.fuel_availability_pct / 100) * 327} 327`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div className="pct-text">
              <span className="pct-number">{summary.fuel_availability_pct}%</span>
              <span className="pct-label">น้ำมันคงเหลือ</span>
            </div>
          </div>

          <div className="overview-stats-grid">
            <div className="overview-stat"><div className="overview-stat-num">{summary.total_stations}</div><div className="overview-stat-label">ปั๊มทั้งหมด</div></div>
            <div className="overview-stat green"><div className="overview-stat-num">{summary.stations_with_fuel}</div><div className="overview-stat-label">มีน้ำมัน</div></div>
            <div className="overview-stat red"><div className="overview-stat-num">{summary.stations_no_fuel}</div><div className="overview-stat-label">ไม่มีน้ำมัน</div></div>
            <div className="overview-stat"><div className="overview-stat-num">{summary.available_fuels}/{summary.available_fuels + summary.unavailable_fuels}</div><div className="overview-stat-label">หัวจ่ายที่เปิด</div></div>
          </div>
        </div>

        <div className="overview-search">
          <input type="text" placeholder="🔍 ค้นหาจังหวัด..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* ===== Content (mobile: full width, desktop: sidebar + content) ===== */}
      <div className="content-wrapper content-wrapper--scroll">
        <aside className="desktop-sidebar">
          {sidebar}
        </aside>

        <main className="content-main content-main--scroll">
          <div className="desktop-tabs">
            <Link to="/" className="tab-btn">🗺️ แผนที่/รายการ</Link>
            <button className="tab-btn active">📊 ภาพรวมประเทศ</button>
            <span className="desktop-result-count">{filteredSorted.length + filteredEmpty.length} จังหวัด</span>
          </div>

          <div className="province-section-title">
            สถานะรายจังหวัด
            <span className="province-section-count">{filteredSorted.length + filteredEmpty.length} จังหวัด</span>
          </div>

          <div className="province-breakdown">
            {provinceList}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Overview;
