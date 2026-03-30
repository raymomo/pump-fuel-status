import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

import { API } from '../utils/api';

function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Auto redirect if already logged in
  useEffect(() => {
    const stored = localStorage.getItem('admin');
    if (stored) navigate('/admin/dashboard', { replace: true });
  }, [navigate]);

  // Load saved username
  useEffect(() => {
    const saved = localStorage.getItem('admin_remember');
    if (saved) {
      const { username: u } = JSON.parse(saved);
      setUsername(u);
      setRemember(true);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin', JSON.stringify(data));
      if (remember) {
        localStorage.setItem('admin_remember', JSON.stringify({ username }));
      } else {
        localStorage.removeItem('admin_remember');
      }
      navigate('/admin/dashboard');
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
  };

  return (
    <div className="login-page admin-login-page">
      <form className="login-card" onSubmit={handleLogin}>
        <h2>🛡️ เข้าสู่ระบบผู้ดูแล</h2>
        {error && <div className="error-msg">{error}</div>}
        <div className="form-group">
          <label>ชื่อผู้ใช้</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" required />
        </div>
        <div className="form-group">
          <label>รหัสผ่าน</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="รหัสผ่าน" required />
        </div>
        <label className="remember-check">
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
          <span>จดจำการเข้าสู่ระบบ</span>
        </label>
        <button type="submit" className="btn btn-primary">เข้าสู่ระบบ</button>
        <Link to="/" className="btn btn-back">← กลับหน้าหลัก</Link>
      </form>
    </div>
  );
}

export default AdminLogin;
