// src/layouts/AdminLayout.jsx
import  { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Các trang chỉ Admin (role 2) được vào — khớp menu của Navbar
const ADMIN_ONLY_PATHS = [
  '/Admin',
  '/Event',
  '/Promotion',
  '/Revenue',
  '/AccountUser',
  '/Rating',
  '/ContentChat',
  '/Pricecut',
  '/Camera',
];

const AdminLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const raw = localStorage.getItem('auth');
    const auth = raw ? JSON.parse(raw) : null;

    if (!auth) {
      navigate('/', { replace: true });
      return;
    }

    // Customer (role 0) chỉ được dùng luồng kiosk
    if (auth.role === 0) {
      navigate('/Appclien', { replace: true });
      return;
    }

    // Staff (role 1) chỉ được vào các trang của Staff
    if (auth.role === 1 && ADMIN_ONLY_PATHS.includes(location.pathname)) {
      navigate('/ManageQR', { replace: true });
    }
  }, [navigate, location.pathname]);

  const auth = JSON.parse(localStorage.getItem('auth') || 'null');

  if (!auth) {
    return null; // hoặc loading spinner
  }

  return <>{children}</>;
};

export default AdminLayout;
