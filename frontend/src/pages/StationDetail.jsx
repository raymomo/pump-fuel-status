import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '../components/common/Header';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

import { API } from '../utils/api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function StationDetail() {
  const { id } = useParams();
  const [station, setStation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publicReports, setPublicReports] = useState([]);
  const isAdmin = !!localStorage.getItem('admin');

  useEffect(() => {
    fetch(`${API}/stations/${id}`)
      .then(r => r.json())
      .then(data => { setStation(data); setLoading(false); });
    fetch(`${API}/stations/${id}/reports`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPublicReports(data); });
  }, [id]);

  if (loading) return <div className="loading">กำลังโหลด...</div>;
  if (!station) return <div className="loading">ไม่พบข้อมูลปั๊ม</div>;

  const formatTime = (t) => {
    if (!t) return '';
    return new Date(t).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'medium' });
  };

  const timeAgo = (t) => {
    if (!t) return '';
    const diff = Math.floor((Date.now() - new Date(t).getTime()) / 1000);
    if (diff < 60) return 'เมื่อสักครู่';
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ชม.ที่แล้ว`;
    return `${Math.floor(diff / 86400)} วันที่แล้ว`;
  };

  const availCount = station.fuels?.filter(f => f.is_available).length || 0;
  const totalCount = station.fuels?.length || 0;

  return (
    <div className="detail-page">
      <Header />

      <Link to="/" className="back-btn">← กลับหน้าหลัก</Link>

      {/* Desktop: side-by-side layout */}
      <div className="detail-layout">
        {/* Left: Info + Map */}
        <div className="detail-left">
          <div className="detail-info">
            <span className="station-province-tag">{station.province_name}</span>
            <h2>{station.name}</h2>
            <span className={`station-brand brand-${station.brand}`} style={{ display: 'inline-block', marginBottom: 8 }}>{station.brand}</span>
            <p>{station.address}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {station.lat && station.lng && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`} target="_blank" rel="noopener noreferrer" className="detail-nav-btn">
                  🧭 นำทางไปปั๊ม
                </a>
              )}
              {isAdmin && (
                <Link to={`/admin/dashboard?edit=${station.id}`} className="detail-edit-btn">
                  ✏️ แก้ไขปั๊ม
                </Link>
              )}
              {station.phone && (
                <a href={`tel:${station.phone}`} className="detail-phone">📞 {station.phone}</a>
              )}
            </div>
            <div className="detail-summary">
              <div className="detail-summary-item green">
                <span className="detail-summary-num">{availCount}</span>
                <span className="detail-summary-label">มีน้ำมัน</span>
              </div>
              <div className="detail-summary-item red">
                <span className="detail-summary-num">{totalCount - availCount}</span>
                <span className="detail-summary-label">หมด</span>
              </div>
              <div className="detail-summary-item">
                <span className="detail-summary-num">{totalCount}</span>
                <span className="detail-summary-label">ชนิด</span>
              </div>
            </div>
          </div>

          {station.lat && station.lng && (
            <div className="map-container">
              <MapContainer center={[station.lat, station.lng]} zoom={15} scrollWheelZoom={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                <Marker position={[station.lat, station.lng]}>
                  <Popup>{station.name}</Popup>
                </Marker>
              </MapContainer>
            </div>
          )}
        </div>

        {/* Right: Fuel list */}
        <div className="detail-right">
          <h3 className="detail-fuel-title">สถานะน้ำมัน</h3>
          <div className="fuel-list">
            {station.fuels?.map(f => (
              <div className="fuel-item" key={f.fuel_type}>
                <div>
                  <div className="fuel-item-name">{f.fuel_type}</div>
                  {f.is_available && f.remaining_cars != null && (
                    <div className="fuel-remaining">🚗 รองรับอีก ~<strong>{f.remaining_cars}</strong> คัน</div>
                  )}
                  <div className="fuel-item-time">
                    อัปเดต: {formatTime(f.updated_at)} ({timeAgo(f.updated_at)})
                  </div>
                  {f.updated_by && <div className="fuel-item-time">โดย: {f.updated_by}</div>}
                </div>
                <span className={`status-badge ${f.is_available ? 'has-fuel' : 'no-fuel'}`}>
                  {f.is_available ? '● มีน้ำมัน' : '● หมด'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Public Reports */}
      {publicReports.length > 0 && (
        <div className="public-reports-section">
          <h3 className="detail-fuel-title">📢 รายงานจากประชาชน</h3>
          <div className="public-reports-list">
            {publicReports.map((r, i) => (
              <div key={i} className="public-report-item">
                <div className="public-report-header">
                  <span className={`status-badge ${r.is_available ? 'has-fuel' : 'no-fuel'}`}>
                    {r.is_available ? '● มี' : '● หมด'}
                  </span>
                  <span className="public-report-fuel">{r.fuel_type}</span>
                  <span className="public-report-confidence">{r.confidence}%</span>
                </div>
                <div className="public-report-reporters">
                  {r.reporters.map((p, j) => (
                    <div key={j} className="public-report-person">
                      {p.picture && <img src={p.picture} alt="" className="public-report-avatar" />}
                      <span>{p.name}</span>
                      <span className="public-report-dist">{p.distance_meters ? `${Math.round(p.distance_meters)}m` : ''}</span>
                    </div>
                  ))}
                </div>
                <div className="public-report-count">{r.reporters.length} คนรายงาน</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default StationDetail;
