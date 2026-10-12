import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Chatbot from '../../components/Chatbot';
import './Guide.css';
import { useCountdown } from "../../contexts/CountdownContext";

function Guide() {
  const navigate = useNavigate();
  const location = useLocation();
  const { size, cut, frameType, selectedFrame, selectedFrameId } = location.state || {};

  // Lấy thông tin từ auth
  const getAuth = () => {
    const saved = localStorage.getItem('auth');
    return saved ? JSON.parse(saved) : null;
  };

  const [auth, ] = useState(getAuth());
  const { id_admin: idAdmin, id_topic: idTopic } = auth;

  const [backgroundImage, setBackgroundImage] = useState(null);
  const [logoImage, setLogoImage] = useState('/logo.jpg'); // fallback local
  const [isGlobalBackground, setIsGlobalBackground] = useState(false);

  const { formattedCountdown, countdown } = useCountdown();

  useEffect(() => {
    if (countdown === 0) {
      navigate('/Appclien');
    }
  }, [countdown, navigate]);

  // 🔥 Fetch event data
  const { data: eventData, isLoading, error } = useQuery({
    queryKey: ['event', idAdmin, idTopic],
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/event-client?id_admin=${idAdmin}&id_topic=${idTopic}`
      );
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    },
    enabled: !!idAdmin && !!idTopic,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ XỬ LÝ ẢNH: DÙNG URL CÔNG KHAI, KHÔNG DÙNG BASE64
  useEffect(() => {
    if (!eventData || eventData.status === 'error') return;

    const baseUrl = new URL(
      import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
    ).origin;

    // Background
    if (eventData.background) {
      const fullBgUrl = eventData.background.startsWith('http')
        ? eventData.background
        : `${baseUrl}${eventData.background}`;

      setBackgroundImage(fullBgUrl);
      setIsGlobalBackground(eventData.ev_back === 2); // 2 = all-pages → fixed
    } else {
      setBackgroundImage(null);
      setIsGlobalBackground(false);
    }

    // Logo
    if (eventData.logo && eventData.ev_logo === 1) {
      const fullLogoUrl = eventData.logo.startsWith('http')
        ? eventData.logo
        : `${baseUrl}${eventData.logo}`;
      setLogoImage(fullLogoUrl);
    } else {
      setLogoImage('/logo.jpg'); // fallback local
    }
  }, [eventData]);

  if (isLoading) {
    return <div className="app-container">Đang tải...</div>;
  }

  if (error) {
    console.error('Lỗi khi tải dữ liệu event:', error);
  }

  // Handler click thủ công
  const handleClick = () => {
    navigate('/Photo', {
      state: {
        size,
        cut,
        frameType,
        id_admin: idAdmin,
        id_topic: idTopic,
        selectedFrameId,
        selectedFrame,
      },
    });
  };

  return (
    <div
      className="app-container"
      style={backgroundImage
        ? {
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: isGlobalBackground ? 'fixed' : 'scroll',
          }
        : {}}
    >
      <div className="countdown">
        ⌛: {formattedCountdown}
      </div>

      {/* Logo ở góc trên bên trái */}
      <div className="logo-container">
        <img
          src={logoImage}
          alt="Memory Booth Logo"
          className="logo-custom"
          onError={(e) => {
            e.target.src = '/logo.jpg'; // fallback nếu lỗi
          }}
        />
      </div>

      {/* Phần trên - có thể click để điều hướng */}
      <div className="clickable-section" onClick={handleClick}>
        <div className="title-container">
          <h4 className="touch-to">HƯỚNG DẪN CHỤP</h4>
        </div>
        {/* Thông tin chính */}
        <div className="info-box-custom">
          <p>
            Nhấn vào màn hình tiếp tục.<br />
            Bạn được chụp các ảnh liên tiếp.<br />
            Hãy chuẩn bị phụ kiện bạn nhé!
          </p>
        </div>
      </div>

      {/* Instructions - ở dưới cùng màn hình */}
      <div className="instruction-container">
        <div className="instruction-row">
          <div className="instruction-box">
            <div className="icon-heart">
              <i className="fas fa-heart"></i>
              <span className="heart-number">1</span>
            </div>
            <p>KHÔNG VỨT PHỤ KIỆN XUỐNG ĐẤT KHI CHỤP</p>
          </div>
          <div className="instruction-box">
            <div className="icon-heart">
              <i className="fas fa-heart"></i>
              <span className="heart-number">2</span>
            </div>
            <p>VUI LÒNG BỒI THƯỜNG KHI LÀM HỎNG</p>
          </div>
          <div className="instruction-box">
            <div className="icon-heart">
              <i className="fas fa-heart"></i>
              <span className="heart-number">3</span>
            </div>
            <p>GIÚP CHÚNG MÌNH ĐẶT LẠI PHỤ KIỆN LÊN KỆ NHÉ</p>
          </div>
        </div>
        <h5 className="btn-thank-you">CHÚNG MÌNH XIN CẢM ƠN</h5>
      </div>
      <Chatbot />
    </div>
  );
}

export default Guide;