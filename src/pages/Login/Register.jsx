// src/components/Register.jsx hoặc src/pages/Register.jsx
import  { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AuthCommon.css';

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, ] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Trigger animation khi component mount
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !email || !password || !confirmPassword) {
      setError('Vui lòng điền đầy đủ thông tin!');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp!');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự!');
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }), // ✅ Gửi email
      });

      const data = await response.json();

      if (data.status === 'success') {
        alert('Đăng ký thành công! Vui lòng đăng nhập.');
        navigate('/'); // Chuyển hướng về trang đăng nhập
      } else {
        setError(data.message || 'Đăng ký thất bại. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Lỗi đăng ký:', err);
      setError('Có lỗi xảy ra. Vui lòng thử lại sau.');
    }
  };

  return (
    <div className={`register-container ${isLoading ? 'fade-in' : ''}`}>
      <div className="register-header">
        <img src="./logo.jpg" alt="Logo" className="register-logo" />
        <div className="register-title">
          <h2>ĐĂNG KÝ 💕</h2>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form className="register-form" onSubmit={handleRegister}>
        <div className="input-group">
          <span className="icon">👤</span>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-label="Username"
            required
          />
        </div>

        <div className="input-group">
          <span className="icon">📧</span>
          <input
            type="email" // ✅ Sử dụng type email để validate cơ bản
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email"
            required
          />
        </div>

        <div className="input-group">
          <span className="icon">🔒</span>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="Mật khẩu"
            required
          />
        </div>

        <div className="input-group">
          <span className="icon">🔁</span>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Xác nhận mật khẩu"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            aria-label="Xác nhận mật khẩu"
            required
          />
        </div>

        <button type="submit" className="register-button" aria-label="Đăng ký">
          ĐĂNG KÝ
        </button>
      </form>

      <div className="auth-links">
        <button className="link-button" onClick={() => navigate('/')}>
          ← Đã có tài khoản? Đăng nhập ngay
        </button>
      </div>
    </div>
  );
}

export default Register;