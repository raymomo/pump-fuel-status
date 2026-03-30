import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

import { API } from '../utils/api';

function StaffRegister() {
  const [form, setForm] = useState({ name: '', username: '', password: '', confirmPassword: '', phone: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) { setError('รหัสผ่านไม่ตรงกัน'); return; }
    if (form.password.length < 4) { setError('รหัสผ่านต้องมีอย่างน้อย 4 ตัว'); return; }

    try {
      const res = await fetch(`${API}/staff/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, username: form.username, password: form.password, phone: form.phone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(true);
      setTimeout(() => navigate('/staff'), 2000);
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
  };

  if (success) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2>สมัครสำเร็จ!</h2>
          <p style={{ color: '#666', marginTop: 8 }}>รอ Admin มอบหมายปั๊มให้</p>
          <p style={{ color: '#999', marginTop: 4, fontSize: 13 }}>กำลังไปหน้าเข้าสู่ระบบ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <form className="login-card register-card" onSubmit={handleSubmit}>
        <h2>📝 สมัครสมาชิกพนักงาน</h2>
        {error && <div className="error-msg">{error}</div>}

        <div className="form-group">
          <label>ชื่อ-นามสกุล</label>
          <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="เช่น สมชาย ใจดี" />
        </div>

        <div className="form-group">
          <label>เบอร์โทรศัพท์</label>
          <input required type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="เช่น 081-234-5678" />
        </div>

        <div className="form-group">
          <label>ชื่อผู้ใช้ (สำหรับ login)</label>
          <input required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="เช่น somchai" autoCapitalize="none" />
        </div>

        <div className="form-group">
          <label>รหัสผ่าน</label>
          <input required type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="อย่างน้อย 4 ตัว" />
        </div>

        <div className="form-group">
          <label>ยืนยันรหัสผ่าน</label>
          <input required type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} placeholder="กรอกรหัสผ่านอีกครั้ง" />
        </div>

        <p style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>* สมัครแล้ว Admin จะมอบหมายปั๊มให้ภายหลัง</p>

        <button type="submit" className="btn btn-primary">สมัครสมาชิก</button>
        <Link to="/staff" className="btn btn-back">← กลับหน้าเข้าสู่ระบบ</Link>
      </form>
    </div>
  );
}

export default StaffRegister;
