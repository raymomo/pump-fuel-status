import { Link } from 'react-router-dom';

export default function StationCard({ station, timeAgo }) {
  const s = station;
  return (
    <div className="station-list-card">
      <Link to={`/station/${s.id}`} className="station-list-link">
        <div className="station-list-left">
          <div className={`station-list-dot ${s.has_fuel ? 'green' : 'red'}`}>
            {s.brand_logo ? (
              <img src={s.brand_logo} alt={s.brand} style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: 2 }} />
            ) : (
              <span>⛽</span>
            )}
          </div>
        </div>
        <div className="station-list-right">
          <div className="station-list-name">{s.name}</div>
          <div className="station-list-sub">{s.province_name} · {s.brand} {s._distance != null ? `· ${s._distance.toFixed(1)} กม.` : ''}</div>
          <div className="station-list-fuels">
            {s.fuels?.slice(0, 4).map(f => (
              <span key={f.fuel_type} className={`fuel-mini ${f.is_available ? 'ok' : 'no'}`}>{f.fuel_type}</span>
            ))}
            {(s.fuels?.length || 0) > 4 && <span className="fuel-more">+{s.fuels.length - 4}</span>}
          </div>
        </div>
        <div className="station-list-status">
          <span className={s.has_fuel ? 'status-ok' : 'status-no'}>{s.has_fuel ? 'มี' : 'หมด'}</span>
        </div>
      </Link>
      <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`} target="_blank" rel="noopener noreferrer" className="station-list-nav">
        🧭
      </a>
    </div>
  );
}
