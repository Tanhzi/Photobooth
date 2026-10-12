import  { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import Chatbot from '../../components/Chatbot';
import './Feedback.css';

const Feedback = () => {
  const navigate = useNavigate();

  // === CÁC STATE CŨ ===
  const [countdown, setCountdown] = useState(100);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [ratings, setRatings] = useState({
    quality: 0,
    smoothness: 0,
    photo: 0,
    service: 0
  });
  const [comment, setComment] = useState('');
  const [submitStatus, setSubmitStatus] = useState('');

  const [homeAnimation, setHomeAnimation] = useState(null);
  const [starAnimation, setStarAnimation] = useState(null);

  // === STATE MỚI CHO BẢN ĐỒ (MAP MODAL) ===
  const [isMapOpen, setIsMapOpen] = useState(false); // Trạng thái mở popup bản đồ
  const [selectedStore, setSelectedStore] = useState(null); // Lưu cửa hàng đang xem

  // === BÀN PHÍM ẢO ===
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [activeInput, setActiveInput] = useState(null); // 'name' hoặc 'comment'
  const keyboardRef = useRef(null);
  const nameInputRef = useRef(null);
  const commentInputRef = useRef(null);

  // Lấy thông tin từ auth
  const getAuth = () => {
    const saved = localStorage.getItem('auth');
    return saved ? JSON.parse(saved) : null;
  };
  const [auth] = useState(getAuth());
  const { id_admin } = auth || {};

  // ✅ Áp dụng background từ localStorage nếu có
  useEffect(() => {
    const savedBackground = localStorage.getItem('backgroundImage');
    if (savedBackground) {
      document.body.style.backgroundImage = `url(${savedBackground})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundRepeat = 'no-repeat';
      document.body.style.backgroundAttachment = 'fixed';
    }

    // Cleanup khi rời khỏi trang
    return () => {
      document.body.style.backgroundImage = 'none';
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (countdown === 0 && !autoTriggered) {
      setAutoTriggered(true);
      handleFinish();
    }
  }, [countdown, autoTriggered]);

  useEffect(() => {
    const timer = setTimeout(() => setIsFeedbackOpen(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = 'hidden';
    };
  }, []);

  useEffect(() => {
    fetch('/lotties/Home.json')
      .then(res => (res.ok ? res.json() : null))
      .then(setHomeAnimation)
      .catch(err => console.error('Lỗi tải home.json:', err));

    fetch('/lotties/Star.json')
      .then(res => (res.ok ? res.json() : null))
      .then(setStarAnimation)
      .catch(err => console.error('Lỗi tải star.json:', err));
  }, []);

  // === Đóng bàn phím khi click ra ngoài ===
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (keyboardRef.current && !keyboardRef.current.contains(e.target)) {
        setIsKeyboardOpen(false);
        setActiveInput(null);
      }
    };
    if (isKeyboardOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isKeyboardOpen]);

  const handleFinish = () => {
    navigate('/Appclien');
  };

  // Mở bàn phím và ghi nhớ input đang active
  const handleInputFocus = (type) => {
    setActiveInput(type);
    setIsKeyboardOpen(true);
  };

  // === LOGIC BÀN PHÍM ẢO ===
  const [isCaps, setIsCaps] = useState(false);
  
  const getLayout = () => {
    const letters = isCaps ? 'QWERTYUIOPASDFGHJKLZXCVBNM' : 'qwertyuiopasdfghjkllzxcvbnm';
    const firstRow = letters.slice(0, 10).split('');
    const secondRow = letters.slice(10, 19).split('');
    const thirdRow = letters.slice(19).split('');

    return [firstRow, secondRow, thirdRow];
  };

  const handleKeyClick = (key) => {
    if (key === 'BACKSPACE') {
      if (activeInput === 'name') {
        setCustomerName(prev => prev.slice(0, -1));
      } else if (activeInput === 'comment') {
        setComment(prev => prev.slice(0, -1));
      }
    } else if (key === 'SPACE') {
      if (activeInput === 'name') setCustomerName(prev => prev + ' ');
      else setComment(prev => prev + ' ');
    } else if (key === 'SHIFT') {
      setIsCaps(prev => !prev);
    } else if (key === 'ENTER') {
      if (activeInput === 'comment') setComment(prev => prev + '\n');
    } else if (key === 'ĐÓNG') {
      setIsKeyboardOpen(false);
      setActiveInput(null);
    } else {
      let char = key;
      if (activeInput === 'name') setCustomerName(prev => prev + char);
      else setComment(prev => prev + char);
    }
  };

  const handleStarClick = (criterion, value) => {
    setRatings(prev => ({ ...prev, [criterion]: value }));
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setSubmitStatus('Vui lòng nhập tên của bạn.');
      return;
    }
    const hasRating = Object.values(ratings).some(r => r > 0);
    if (!hasRating && !comment.trim()) {
      setSubmitStatus('Vui lòng đánh giá hoặc để lại bình luận.');
      return;
    }

    setSubmitStatus('Đang gửi...');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customerName.trim(),
          quality: ratings.quality,
          smoothness: ratings.smoothness,
          photo: ratings.photo,
          service: ratings.service,
          comment: comment.trim() || null,
          id_admin: id_admin,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitStatus(`Cảm ơn ${customerName}! Đánh giá đã được gửi thành công!`);
        setTimeout(() => {
          setIsFeedbackOpen(false);
          setCustomerName('');
          setRatings({ quality: 0, smoothness: 0, photo: 0, service: 0 });
          setComment('');
          setSubmitStatus('');
        }, 2500);
      } else {
        throw new Error(data.message || 'Lỗi server');
      }
    } catch (err) {
      console.error('Lỗi gửi đánh giá:', err);
      setSubmitStatus('Gửi thất bại. Vui lòng thử lại!');
      setTimeout(() => setSubmitStatus(''), 3000);
    }
  };

  const renderStars = (criterion, rating) => {
    return Array.from({ length: 5 }, (_, i) => i + 1).map(star => (
      <span
        key={star}
        className={`star ${star <= rating ? 'filled' : ''}`}
        onClick={() => handleStarClick(criterion, star)}
      >
        ★
      </span>
    ));
  };

  const stores = [
    { name: "SweetLens Quận 1", address: "123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM" },
    { name: "SweetLens Quận 7", address: "456 Đường Nguyễn Thị Thập, Phường Tân Phú, Quận 7, TP.HCM" },
    { name: "SweetLens Đà Nẵng", address: "789 Đường Bạch Đằng, Quận Hải Châu, Đà Nẵng" }
  ];

  // === ĐÃ SỬA: Hàm mở Popup bản đồ thay vì mở tab mới ===
  const handleNavigateToStore = (store) => {
    setSelectedStore(store);
    setIsMapOpen(true);
  };

  return (
    <div className="download-container">
      {/* Icon Home */}
      <div className="lottie-icon-wrapper home" onClick={handleFinish} title="Về màn hình chính">
        {homeAnimation ? (
          <Lottie animationData={homeAnimation} loop autoplay style={{ width: '64px', height: '64px' }} />
        ) : (
          <span style={{ fontSize: '32px' }}>🏠</span>
        )}
      </div>

      <div className="countdown_dl">⌛: {countdown}</div>

      <div className="content-wrapper">
        <section className="hero-section">
          <h1 className="title">💖 SweetLens Photo Booth 💖</h1>
          <p className="subtitle">
            Nơi lưu giữ những khoảnh khắc ngọt ngào — Chụp ảnh, in ảnh, thanh toán tự động chỉ trong vài giây!
          </p>
        </section>

        <section className="features-grid">
          <div className="feature-card"><div className="icon">📸</div><h3>Chụp ảnh tự động</h3><p>Máy chụp tự động sau 10s...</p></div>
          <div className="feature-card"><div className="icon">🖨️</div><h3>In ảnh siêu tốc</h3><p>Chất lượng cao, in trong 15s...</p></div>
          <div className="feature-card"><div className="icon">💳</div><h3>Thanh toán không chạm</h3><p>Hỗ trợ QR, voucher...</p></div>
        </section>

        <section className="stores-section">
          <h2 className="section-title">📍 Các chi nhánh SweetLens</h2>
          <div className="stores-grid">
            {stores.map((store, index) => (
              <div key={index} className="store-card">
                <h3 className="store-name">🎀 {store.name}</h3>
                <p className="store-address">{store.address}</p>
                {/* Nút này giờ sẽ mở popup */}
                <button className="navigate-btn" onClick={() => handleNavigateToStore(store)}>🗺️ Chỉ đường</button>
              </div>
            ))}
          </div>
        </section>

        <footer className="page-footer">
          <p>© 2025 SweetLens Photo Booth — Nơi lưu giữ những khoảnh khắc ngọt ngào nhất 💖</p>
          <p>Liên hệ: support@sweetlens.vn | Hotline: 1900 888 666</p>
        </footer>
      </div>

      {/* Icon Feedback */}
      <div className="lottie-icon-wrapper feedback" onClick={() => setIsFeedbackOpen(true)} aria-label="Phản hồi trải nghiệm">
        {starAnimation ? (
          <Lottie animationData={starAnimation} loop autoplay style={{ width: '74px', height: '74px' }} />
        ) : (
          <span style={{ fontSize: '74px' }}>🎀</span>
        )}
      </div>

      {/* === MODAL BẢN ĐỒ (MỚI THÊM VÀO) === */}
      {isMapOpen && selectedStore && (
        <div className="feedback-overlay" onClick={() => setIsMapOpen(false)}>
          <div 
            className="feedback-container" 
            onClick={(e) => e.stopPropagation()}
            style={{ width: '90%', maxWidth: '800px', height: '80vh', display: 'flex', flexDirection: 'column' }} // Style riêng cho map to hơn
          >
            <div className="feedback-header">
              <span style={{ fontSize: '40px' }}>📍</span>
              <div style={{ marginLeft: '12px', flex: 1 }}>
                <span className='h4' style={{ display: 'block' }}>{selectedStore.name}</span>
                <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#555' }}>{selectedStore.address}</span>
              </div>
              <button className="feedback-close" onClick={() => setIsMapOpen(false)}>×</button>
            </div>
            
<div style={{ position: 'relative', width: '100%', height: '100%' }}>
  <iframe
    title="Google Map Store Location"
    width="100%"
    height="100%"
    frameBorder="0"
    style={{ border: 0 }}
    src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedStore.address)}&z=15&output=embed`}
  ></iframe>
  {/* Lớp phủ chặn click */}
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      cursor: 'default'
    }}
    onClick={(e) => e.stopPropagation()}
  ></div>
</div>
          </div>
        </div>
      )}

      {/* === Modal Feedback Form (Cũ) === */}
      {isFeedbackOpen && (
        <div className="feedback-overlay" onClick={() => setIsFeedbackOpen(false)}>
          <div className="feedback-container" onClick={(e) => e.stopPropagation()}>
            <div className="feedback-header">
              {starAnimation ? (
                <Lottie animationData={starAnimation} loop autoplay style={{ width: '64px', height: '64px' }} />
              ) : (
                <span style={{ fontSize: '64px' }}>🎀</span>
              )}
              <span className='h4'>Phản hồi SweetLens</span>
              <button className="feedback-close" onClick={() => setIsFeedbackOpen(false)}>×</button>
            </div>
            <div className="feedback-content">
              <div className="name-input-section">
                <label className="name-label">Họ & tên <span className="required">*</span></label>
                <input
                  ref={nameInputRef}
                  type="text"
                  className="feedback-comment"
                  placeholder="Nhập tên của bạn..."
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  onFocus={() => handleInputFocus('name')}
                  readOnly 
                />
              </div>
              <div className="rating-criteria">
                {[
                  { key: 'quality', label: 'Chất lượng máy & thiết bị' },
                  { key: 'smoothness', label: 'Độ mượt mà khi sử dụng' },
                  { key: 'photo', label: 'Ảnh đẹp, sắc nét' },
                  { key: 'service', label: 'Dịch vụ & hỗ trợ' }
                ].map(({ key, label }) => (
                  <div key={key} className="criterion">
                    <div className="criterion-label">{label}</div>
                    <div className="stars">{renderStars(key, ratings[key])}</div>
                  </div>
                ))}
              </div>

              <textarea
                ref={commentInputRef}
                className="feedback-comment"
                placeholder="Chia sẻ thêm ý kiến... (tùy chọn)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onFocus={() => handleInputFocus('comment')}
                readOnly
                rows="3"
              />

              {submitStatus && (
                <p className={`feedback-status ${submitStatus.includes('Cảm ơn') ? 'success' : 'error'}`}>
                  {submitStatus}
                </p>
              )}

              <button
                className="feedback-submit-btn"
                onClick={handleSubmitFeedback}
                disabled={Object.values(ratings).every(r => r === 0) && !comment.trim()}
              >
                💌 Gửi phản hồi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === BÀN PHÍM ẢO === */}
      {isKeyboardOpen && (
        <div className="virtual-keyboard" ref={keyboardRef}>
          {getLayout().map((row, rowIndex) => (
            <div key={rowIndex} className="keyboard-row-dl">
              {row.map((key) => (
                <button
                  key={key}
                  className="key-dl"
                  onClick={() => handleKeyClick(key)}
                >
                  {key}
                </button>
              ))}
            </div>
          ))}

          {/* Hàng cuối: Space, Backspace, v.v. */}
          <div className="keyboard-row-dl">
            <button className="key-dl wide" onClick={() => handleKeyClick('ĐÓNG')}>Đóng</button>
            <button className="key-dl" onClick={() => handleKeyClick('SHIFT')}>{isCaps ? 'Aa' : 'aA'}</button>
            <button className="key-dl wide" onClick={() => handleKeyClick('SPACE')}>Space</button>
            <button className="key-dl" onClick={() => handleKeyClick('BACKSPACE')}>⌫</button>
          </div>
        </div>
      )}
      <Chatbot />
    </div>

  );
};

export default Feedback;