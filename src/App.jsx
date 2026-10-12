import  { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './pages/Login/AuthCommon.css';

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Xử lý thay đổi username
  const handleUsernameChange = (e) => {
    const value = e.target.value;
    setUsername(value);

    if (value.length > 50) {
      setUsernameError('Tên người dùng không được vượt quá 50 ký tự.');
    } else {
      setUsernameError('');
    }
  };

  // Xử lý thay đổi mật khẩu
  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);

    if (value.length > 50) {
      setPasswordError('Mật khẩu không được vượt quá 50 ký tự.');
    } else {
      setPasswordError('');
    }
  };

const handleLogin = async (e) => {
  e.preventDefault();
  setError('');

  // Kiểm tra rỗng
  if (!username.trim() || !password.trim()) {
    setError('Vui lòng nhập đầy đủ tên người dùng và mật khẩu.');
    return;
  }

  if (username.length > 50 || password.length > 50) {
    setError('Dữ liệu nhập vượt quá giới hạn 50 ký tự.');
    return;
  }

  // Ngăn nhấn nhiều lần
  if (isSubmitting) return;

  setIsSubmitting(true); // 🔒 Khóa nút

  try {
    const url = `${import.meta.env.VITE_API_BASE_URL}/login`;
    console.log('Đang gọi API đăng nhập:', { url, username });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Gửi/nhận cookie httpOnly (JWT) — token KHÔNG lưu trong localStorage
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('Lỗi parse JSON từ response:', jsonError, await response.text());
      setError('Máy chủ trả về dữ liệu không hợp lệ. Vui lòng thử lại sau.');
      setIsSubmitting(false); // 🔓 Mở khóa
      return;
    }

    console.log('Phản hồi từ server:', data);

    if (response.ok && data.status === 'success') {
      // Chỉ lưu thông tin người dùng — JWT nằm trong cookie httpOnly phía server
      const auth = {
        id: data.id,
        username: data.username,
        email: data.email,
        role: data.role,
        id_admin: data.id_admin || '',
        id_topic: data.id_topic || '',
      };

      localStorage.setItem('auth', JSON.stringify(auth));

        if (data.role === 2) {
          navigate('/Admin');
        } else if (data.role === 1) {
          navigate('/ManageQR');
        }
         else {
          navigate('/Appclien');
        }
    } else {
      const errorMsg = data.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
      setError(errorMsg);
      console.warn('Lỗi đăng nhập từ server:', errorMsg);
    }
  } catch (networkError) {
    console.error('Lỗi mạng hoặc kết nối API:', networkError);
    setError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.');
  } finally {
    setIsSubmitting(false); // 🔓 Luôn mở khóa sau khi xong
  }
};

  // Toggle ẩn/hiện mật khẩu
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className={`login-container ${isLoading ? 'fade-in' : ''}`}>
      <div className="login-header">
        <img src="./logo.jpg" alt="Logo" className="login-logo" />
        <div className="login-title">
          <h2>ĐĂNG NHẬP 💖</h2>
        </div>
      </div>

      <div className="login-form">
        {/* Lỗi chung (submit) */}
        {error && (
          <div
            className="error-message"
            style={{
              color: 'red',
              backgroundColor: '#ffe6e6',
              padding: '8px',
              borderRadius: '4px',
              marginBottom: '12px',
              textAlign: 'center',
              border: '1px solid #ffcccc',
            }}
          >
            {error}
          </div>
        )}

        {/* Username */}
        <div className="input-group">
          <span className="icon">📧</span>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={handleUsernameChange}
            aria-label="Username"
          />
        </div>
        {usernameError && (
          <div
            className="error-message"
            style={{
              color: 'red',
              fontSize: '0.85em',
              textAlign: 'left',
              marginTop: '4px',
              marginBottom: '8px',
            }}
          >
            {usernameError}
          </div>
        )}

        {/* Password với nút ẩn/hiện */}
        <div className="input-group" style={{ position: 'relative' }}>
          <span className="icon">🔒</span>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Mật khẩu"
            value={password}
            onChange={handlePasswordChange}
            aria-label="Mật khẩu"
            style={{ paddingRight: '40px' }} // Đảm bảo không bị che bởi nút 👁️
          />
          {/* Nút ẩn/hiện mật khẩu */}
          <button
            type="button"
            onClick={togglePasswordVisibility}
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.2em',
              color: '#666',
            }}
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>
        {passwordError && (
          <div
            className="error-message"
            style={{
              color: 'red',
              fontSize: '0.85em',
              textAlign: 'left',
              marginTop: '4px',
              marginBottom: '8px',
            }}
          >
            {passwordError}
          </div>
        )}

<button
  className="login-button"
  onClick={handleLogin}
  aria-label="Đăng nhập"
  disabled={isSubmitting} // 👈 Thay vì `isLoading`
>
  {isSubmitting ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP'}
</button>
      </div>

      <div className="auth-links">
        <button
          className="link-button"
          onClick={() => navigate('/ForgotPassword')}
        >
          Quên mật khẩu? →
        </button>
      </div>
    </div>
  );
}

export default App;