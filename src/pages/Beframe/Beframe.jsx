import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Chatbot from '../../components/Chatbot';
import './Beframe.css';
import { useCountdown } from "../../contexts/CountdownContext";

function Beframe() {
  const location = useLocation();
  const navigate = useNavigate();

  // Nhận size và cut từ trang trước
  const { size, cut } = location.state || {};

  // Lấy thông tin từ auth
  const getAuth = () => {
    const saved = localStorage.getItem('auth');
    return saved ? JSON.parse(saved) : null;
  };
  const [auth] = useState(getAuth());
  const { id_admin, id_topic } = auth || {};

  // State danh sách khung ảnh
  const [framesList, setFramesList] = useState([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [selectedType, setSelectedType] = useState('all');
  const [frameTypes, setFrameTypes] = useState(['all']);

  // Lấy tất cả dữ liệu cần thiết từ CountdownContext
  const { formattedCountdown, startCountdown, isInitialized, countdown } = useCountdown();

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
  // Bắt đầu đếm ngược khi đã có dữ liệu
  useEffect(() => {
    if (isInitialized) {
      startCountdown();
    }
  }, [isInitialized, startCountdown]);

  // Tự động quay về trang chủ khi hết giờ
  useEffect(() => {
    if (countdown === 0) {
      navigate('/Appclien');
    }
  }, [countdown, navigate]);

  // 🔥 FETCH KHUNG ẢNH VÀ GHÉP FULL URL CHO FRAME
  useEffect(() => {
    if (!id_admin || !id_topic || !cut) return;

    async function fetchFrames() {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/frames-client?id_admin=${id_admin}&id_topic=${id_topic}&cuts=${cut}`
        );
        const result = await response.json();

        if (result.status === 'success' && result.data) {
          // ✅ XỬ LÝ: GHÉP FULL URL CHO MỖI FRAME
          const processedFrames = result.data
            .filter(f => f.frame) // Loại bỏ frame null
            .map(frame => {
              const fullFrameUrl = frame.frame.startsWith('http')
                ? frame.frame
                : `${frame.frame}`;

              return {
                ...frame,
                frame: fullFrameUrl, // ← DÙNG URL ĐẦY ĐỦ
                type: frame.type || 'default',
              };
            });

          setFramesList(processedFrames);

          const types = ['all', ...new Set(processedFrames.map(f => f.type))];
          setFrameTypes(types);
          setCurrentFrameIndex(0);
        } else {
          console.error("No frames found:", result.message);
          setFramesList([]);
        }
      } catch (error) {
        console.error("Fetch frames error:", error);
        setFramesList([]);
      }
    }

    fetchFrames();
  }, [id_admin, id_topic, cut]);

  // Lọc khung theo loại
  const filteredFrames = selectedType === 'all'
    ? framesList
    : framesList.filter(frame => frame.type === selectedType);

  // Reset index khi đổi tab
  useEffect(() => {
    if (filteredFrames.length > 0) {
      setCurrentFrameIndex(0);
    }
  }, [selectedType, filteredFrames.length]);

  // Xử lý khi nhấn "TIẾP TỤC"
  const handleContinue = () => {
    if (filteredFrames.length === 0) return;

    const selectedFrame = filteredFrames[currentFrameIndex];
    if (!selectedFrame.frame) return;

    navigate('/Photo', {
      state: {
        selectedFrame: selectedFrame.frame,
        selectedFrameId: selectedFrame.id,
        frameType: selectedFrame.type,
        size,
        cut,
        id_admin,
        id_topic,

      },
    });
  };

  // Chuyển khung ảnh
  const handlePrevFrame = () => {
    setCurrentFrameIndex(prev => (prev === 0 ? filteredFrames.length - 1 : prev - 1));
  };

  const handleNextFrame = () => {
    setCurrentFrameIndex(prev => (prev === filteredFrames.length - 1 ? 0 : prev + 1));
  };

  // Ảnh khung đang được chọn
  const currentFrameSrc = filteredFrames[currentFrameIndex]?.frame || null;

  return (
    <div className="frame-container">
      {/* Hiển thị thời gian đếm ngược */}
      <div className="countdown">
        ⌛: {formattedCountdown}
      </div>
      <h2 className="touch-to-crecuts pt-4">VUI LÒNG CHỌN KHUNG ẢNH BẠN MUỐN IN</h2>
      <div className="frame-content">
        {/* Cột trái: hiển thị khung ảnh được chọn (to) */}
        <div className="col-left">
          {currentFrameSrc ? (
            <div className="image-wrapper">
              <img
                src={currentFrameSrc}
                alt="Selected Frame"
                className="selected-frame-image"
                onError={(e) => {
                  e.target.src = '/placeholder-frame.png'; // fallback nếu cần
                }}
              />
            </div>
          ) : (
            <div className="no-image">Không có khung ảnh</div>
          )}
        </div>
        {/* Cột phải: tab + danh sách thumbnail */}
        <div className="col-right">
          {/* Tab chọn loại khung */}
          <div className="frame-tabs">
            {frameTypes.map(type => (
              <button
                key={type}
                className={`tab ${selectedType === type ? 'active' : ''}`}
                onClick={() => setSelectedType(type)}
              >
                {type === 'all' ? 'TẤT CẢ' : type.toUpperCase()}
              </button>
            ))}
          </div>
          {/* Danh sách thumbnail */}
          <div className="frame-thumbnails">
            <div className="thumbnails-wrapper">
              {filteredFrames.map((frame, index) => (
                <img
                  key={frame.id || index}
                  src={frame.frame}
                  alt={`Frame ${index + 1}`}
                  className={`thumbnail ${index === currentFrameIndex ? 'selected' : ''}`}
                  onClick={() => setCurrentFrameIndex(index)}
                  onError={(e) => {
                    e.target.style.opacity = '0.3'; // hoặc ẩn đi
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Nút tiếp tục */}
      <div className="frame-footer pb-5">
        <button className="continue-btn" onClick={handleContinue}>
          TIẾP TỤC
        </button>
      </div>
      <Chatbot />
    </div>
  );
}

export default Beframe;