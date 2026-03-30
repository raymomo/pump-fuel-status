import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [publicName, setPublicName] = useState(localStorage.getItem('public_name'));

  const logoutPublic = () => {
    localStorage.removeItem('public_token');
    localStorage.removeItem('public_name');
    localStorage.removeItem('public_picture');
    setPublicName(null);
    window.location.reload();
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [menuOpen]);

  return (
    <div className="header">
      <h1>⛽ Pump Finder</h1>
      <div className="header-links-desktop">
        <Link to="/staff" className="staff-link">พนักงาน</Link>
        <Link to="/admin" className="staff-link">Admin</Link>
      </div>
      <div className="header-menu-mobile" ref={menuRef}>
        <button className="header-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        {menuOpen && (
          <div className="header-dropdown" onClick={() => setMenuOpen(false)}>
            {publicName && (
              <div className="header-dropdown-profile">
                <span className="header-profile-name">🟢 {publicName}</span>
                <button className="header-logout-btn" onClick={(e) => { e.stopPropagation(); logoutPublic(); }}>ออกจากระบบ</button>
              </div>
            )}
            <Link to="/staff" className="header-dropdown-item">👤 พนักงาน</Link>
            <Link to="/admin" className="header-dropdown-item">🛡️ ผู้ดูแลระบบ</Link>
            <Link to="/staff/register" className="header-dropdown-item">📝 สมัครพนักงาน</Link>
          </div>
        )}
      </div>
    </div>
  );
}
