import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PublicHome from './pages/PublicHome';
import StationDetail from './pages/StationDetail';
import Overview from './pages/Overview';
import StaffLogin from './pages/StaffLogin';
import StaffRegister from './pages/StaffRegister';
import StaffDashboard from './pages/StaffDashboard';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import LineCallback from './pages/LineCallback';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PublicHome />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/station/:id" element={<StationDetail />} />
        <Route path="/staff" element={<StaffLogin />} />
        <Route path="/staff/register" element={<StaffRegister />} />
        <Route path="/staff/dashboard" element={<StaffDashboard />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/line-callback" element={<LineCallback />} />
      </Routes>
    </Router>
  );
}

export default App;
