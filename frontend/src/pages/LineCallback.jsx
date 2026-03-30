import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function LineCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    const name = params.get('name');
    const picture = params.get('picture');

    if (token) {
      localStorage.setItem('public_token', token);
      localStorage.setItem('public_name', name || '');
      localStorage.setItem('public_picture', picture || '');
      // Redirect back to home
      navigate('/', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [params, navigate]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p>กำลังเข้าสู่ระบบ...</p>
    </div>
  );
}
