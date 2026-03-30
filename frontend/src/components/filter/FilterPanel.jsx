import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function FilterPanel({
  searchText, setSearchText,
  provinces, selectedProvince, setSelectedProvince,
  brands, selectedBrands, setSelectedBrands,
  fuelTypes, selectedFuelTypes, setSelectedFuelTypes,
  viewMode, setViewMode,
  radius, setRadius,
  userLat, locateMe, locating,
  stations, filtered, theme,
}) {
  const availableCount = stations.filter(s => s.has_fuel).length;
  const emptyCount = stations.filter(s => !s.has_fuel).length;

  return (
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
        <button className="location-btn" onClick={locateMe} disabled={locating} style={{ width: '100%', marginBottom: 8 }}>
          {locating ? '⏳ กำลังหา...' : userLat ? '✅ พบตำแหน่งแล้ว' : '📌 หาตำแหน่งของฉัน'}
        </button>
        {userLat && (
          <div className="sidebar-filters">
            {[0, 10, 20, 50, 100].map(r => (
              <button key={r} className={`sidebar-filter-btn ${radius === r ? 'active' : ''}`} onClick={() => setRadius(r)}>
                {r === 0 ? 'ทั้งหมด' : `${r} กม.`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Province */}
      <div className="sidebar-section">
        <label className="sidebar-label">🏷️ จังหวัด</label>
        <select className="sidebar-select" value={selectedProvince} onChange={e => setSelectedProvince(e.target.value)}>
          <option value="">ทุกจังหวัด</option>
          {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Brand (multi-select) */}
      <div className="sidebar-section">
        <label className="sidebar-label">🏷️ แบรนด์</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {brands.map(b => (
            <button key={b} className={`sidebar-chip ${selectedBrands.includes(b) ? 'active' : ''}`}
              onClick={() => setSelectedBrands(selectedBrands.includes(b) ? selectedBrands.filter(x => x !== b) : [...selectedBrands, b])}>
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Fuel type */}
      <div className="sidebar-section">
        <label className="sidebar-label">🛢️ ชนิดน้ำมัน</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <button className={`sidebar-chip ${selectedFuelTypes.length === 0 ? 'active' : ''}`} onClick={() => setSelectedFuelTypes([])}>ทั้งหมด</button>
          {fuelTypes.map(ft => (
            <button key={ft} className={`sidebar-chip ${selectedFuelTypes.includes(ft) ? 'active' : ''}`}
              onClick={() => setSelectedFuelTypes(selectedFuelTypes.includes(ft) ? selectedFuelTypes.filter(x => x !== ft) : [...selectedFuelTypes, ft])}>
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
            <button key={key} className={`sidebar-filter-btn ${viewMode === key ? 'active' : ''}`} onClick={() => setViewMode(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="sidebar-section">
        <label className="sidebar-label">📊 สรุป ({filtered.length} ปั๊ม)</label>
        <div className="sidebar-stats">
          <div className="sidebar-stat">
            <div className="sidebar-stat-num">{stations.length}</div>
            <div className="sidebar-stat-label">ทั้งหมด</div>
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

      {/* Quick links */}
      <div className="sidebar-section sidebar-links">
        <Link to="/overview" className="sidebar-link">📊 ภาพรวมประเทศ</Link>
        <Link to="/staff" className="sidebar-link">👤 สำหรับพนักงาน</Link>
        <Link to="/admin" className="sidebar-link">🛡️ ผู้ดูแลระบบ</Link>
      </div>
    </div>
  );
}
