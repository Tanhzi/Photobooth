import  { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Photo.css';
import Chatbot from '../../components/Chatbot';
import { useCountdown } from "../../contexts/CountdownContext";
import { bridgeWsUrl, bridgeAssetUrl } from '../../lib/bridge';

// ================= MÁY ẢNH QUA LOCAL SERVER (digiCamControl) =================
// Trang này KHÔNG dùng camera trình duyệt để chụp.
// Luồng: đếm ngược -> gửi `trigger_capture` qua WebSocket tới bridge (serverr)
//        -> bridge gọi digiCamControl chụp -> chokidar thấy ảnh mới trong Raw/
//        -> bridge broadcast `new_dslr_photo` -> trang nhận URL, cắt theo cut, lưu.
const CAPTURE_TIMEOUT_MS = 15000; // digiCamControl chụp ~2-5s, mock ~1.5s
const MAX_AUTO_RETRY = 1;

function Photo() {
  const getAuth = () => {
    const saved = localStorage.getItem('auth');
    return saved ? JSON.parse(saved) : null;
  };

  const [auth] = useState(getAuth());
  const { id_admin } = auth || {};

  const [shootCountdown, setShootCountdown] = useState(0); // đếm ngược trước mỗi lần chụp
  const [photoIndex, setPhotoIndex] = useState(1);
  const [photos, setPhotos] = useState([]);
  const [flash, setFlash] = useState(false);

  const [initialTime, setInitialTime] = useState(5);
  const [subsequentTime, setSubsequentTime] = useState(8);
  const [isStarted, setIsStarted] = useState(false);
  const [maxPhotos, setMaxPhotos] = useState(8);
  const [isRetaking, setIsRetaking] = useState(false);
  const [retakeIndex, setRetakeIndex] = useState(null);

  const [currentPhotosState, setCurrentPhotosState] = useState([]);
  const [currentSelectedSlotsState, setCurrentSelectedSlotsState] = useState([]);
  const [currentAppliedFiltersState, setCurrentAppliedFiltersState] = useState({});

  // Trạng thái kết nối bridge + lỗi không nhận được ảnh
  const [bridgeStatus, setBridgeStatus] = useState('connecting'); // connected | connecting | disconnected
  const [captureError, setCaptureError] = useState(null);

  const photosContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const pendingCaptureRef = useRef(false); // đang chờ ảnh DSLR trả về
  const captureTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);

  const navigate = useNavigate();
  const location = useLocation();
  const {
    size,
    cut,
    selectedFrame,
    selectedFrameId,
    price,
    retakeIndex: incomingRetakeIndex,
    currentPhotos: incomingCurrentPhotos,
    currentSelectedSlots: incomingCurrentSelectedSlots,
    currentAppliedFilters: incomingCurrentAppliedFilters
  } = location.state || {};

  const getMaxPhotos = (cutValue) => {
    const cutNum = Number(cutValue);
    if (cutNum === 3) return 3;
    if (cutNum === 41 || cutNum === 42) return 4;
    if (cutNum === 6) return 6;
    return 8;
  };

  const { formattedCountdown, countdown } = useCountdown();

  useEffect(() => {
    if (countdown === 0) {
      navigate('/Appclien');
    }
  }, [countdown, navigate]);

  const getCropDimensions = (cutValue, sourceWidth, sourceHeight) => {
    const cutNum = Number(cutValue);
    let targetAspectRatio;
    switch (cutNum) {
      case 3: targetAspectRatio = 276 / 220; break;
      case 41: targetAspectRatio = 276 / 195; break;
      case 42: targetAspectRatio = 260 / 330; break;
      case 6: targetAspectRatio = 280 / 240; break;
      default: targetAspectRatio = 1;
    }

    const sourceAspectRatio = sourceWidth / sourceHeight;
    let cropWidth, cropHeight, cropX, cropY;

    if (sourceAspectRatio > targetAspectRatio) {
      cropHeight = sourceHeight;
      cropWidth = Math.round(cropHeight * targetAspectRatio);
      cropX = Math.round((sourceWidth - cropWidth) / 2);
      cropY = 0;
    } else {
      cropWidth = sourceWidth;
      cropHeight = Math.round(cropWidth / targetAspectRatio);
      cropX = 0;
      cropY = Math.round((sourceHeight - cropHeight) / 2);
    }

    cropWidth = Math.min(cropWidth, sourceWidth);
    cropHeight = Math.min(cropHeight, sourceHeight);
    cropX = Math.max(0, Math.min(cropX, sourceWidth - cropWidth));
    cropY = Math.max(0, Math.min(cropY, sourceHeight - cropHeight));

    return { cropWidth, cropHeight, cropX, cropY };
  };

  // ================= KẾT NỐI WEBSOCKET TỚI BRIDGE (TỰ KẾT NỐI LẠI) =================
  useEffect(() => {
    let disposed = false;
    let reconnectTimer = null;

    const connect = () => {
      if (disposed) return;
      let ws;
      try {
        ws = new WebSocket(bridgeWsUrl);
      } catch (err) {
        console.error('Lỗi tạo WebSocket bridge:', err);
        setBridgeStatus('disconnected');
        reconnectTimer = setTimeout(connect, 3000);
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) return;
        console.log('✅ Đã kết nối Local Server (máy ảnh digiCamControl):', bridgeWsUrl);
        setBridgeStatus('connected');
      };

      ws.onmessage = (event) => {
        if (disposed) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_dslr_photo' && pendingCaptureRef.current) {
            pendingCaptureRef.current = false;
            if (captureTimeoutRef.current) {
              clearTimeout(captureTimeoutRef.current);
              captureTimeoutRef.current = null;
            }
            retryCountRef.current = 0;
            setCaptureError(null);
            const imageUrl = bridgeAssetUrl(data.fileName, data.url);
            console.log('📸 Nhận ảnh DSLR từ bridge:', imageUrl);
            processHighResPhoto(imageUrl);
          }
        } catch (err) {
          console.error('Lỗi đọc tin nhắn WebSocket:', err);
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        setBridgeStatus('disconnected');
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        try { ws.close(); } catch { /* bỏ qua */ }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* bỏ qua */ }
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ================= INIT STATE & CẤU HÌNH =================
  useEffect(() => {
    if (incomingRetakeIndex !== undefined && incomingCurrentPhotos) {
      setIsRetaking(true);
      setRetakeIndex(incomingRetakeIndex);
      setCurrentPhotosState(incomingCurrentPhotos);
      setCurrentSelectedSlotsState(incomingCurrentSelectedSlots || []);
      setCurrentAppliedFiltersState(incomingCurrentAppliedFilters || {});
      setPhotos([]);
      setPhotoIndex(1);
      setMaxPhotos(1);
      setIsStarted(true);
    } else {
      setIsRetaking(false);
      setRetakeIndex(null);
      setCurrentPhotosState([]);
      setCurrentSelectedSlotsState([]);
      setCurrentAppliedFiltersState({});
      const maxPhotoCount = getMaxPhotos(cut);
      setMaxPhotos(maxPhotoCount);
      setPhotos([]);
      setPhotoIndex(1);
      setIsStarted(false);
    }
  }, [incomingRetakeIndex, incomingCurrentPhotos, cut]);

  useEffect(() => {
    if (!id_admin) return;
    fetch(`${import.meta.env.VITE_API_BASE_URL}/camera/basic?id_admin=${id_admin}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data) return;
        setInitialTime(Number(data.time1) || 5);
        setSubsequentTime(Number(data.time2) || 8);
      })
      .catch((err) => console.error('Lỗi khi lấy cấu hình:', err));
  }, [id_admin]);

  // Đếm ngược và chụp ảnh (chỉ bắn lệnh khi đang chờ ảnh cũ xong)
  useEffect(() => {
    if (!isStarted || photoIndex > maxPhotos) return;

    const currentTime = photoIndex === 1 ? initialTime : subsequentTime;
    setShootCountdown(currentTime);

    const shootTimer = setTimeout(() => {
      handleTakePhoto();
    }, currentTime * 1000);

    const interval = setInterval(() => {
      setShootCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      clearTimeout(shootTimer);
      clearInterval(interval);
    };
  }, [photoIndex, isStarted, maxPhotos, initialTime, subsequentTime]);

  // ✅ CHUYỂN TRANG KHI CHỤP ĐỦ ẢNH
  useEffect(() => {
    if (photoIndex > maxPhotos) {
      setTimeout(() => {
        if (isRetaking) {
          const newPhoto = photos[0];
          const updatedPhotos = [...currentPhotosState];
          updatedPhotos[retakeIndex] = newPhoto;
          const updatedSlots = [...currentSelectedSlotsState];
          if (updatedSlots[retakeIndex]) {
            updatedSlots[retakeIndex] = { ...updatedSlots[retakeIndex], photo: newPhoto, flip: false };
          }
          const updatedFilters = { ...currentAppliedFiltersState };
          updatedFilters[retakeIndex] = 'original';

          navigate('/Selphoto', {
            state: {
              photos: updatedPhotos,
              size,
              cut,
              selectedFrame,
              selectedFrameId,
              price,
              selectedSlots: updatedSlots,
              appliedFilters: updatedFilters,
            },
          });
        } else {
          const initialSlots = photos.map((photo) => ({ photo, flip: false }));
          const initialFilters = {};
          photos.forEach((_, i) => {
            initialFilters[i] = 'original';
          });
          navigate('/Selphoto', {
            state: {
              photos,
              size,
              cut,
              selectedFrame,
              selectedFrameId,
              price,
              selectedSlots: initialSlots,
              appliedFilters: initialFilters,
            },
          });
        }
      }, 1500);
    }
  }, [photoIndex, maxPhotos, isRetaking, photos, navigate]);

  // ================= BẮN LỆNH CHỤP QUA BRIDGE =================
  const triggerCapture = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setCaptureError('Server máy ảnh chưa kết nối. Kiểm tra bridge (serverr) rồi nhấn màn hình để thử lại.');
      return;
    }

    setCaptureError(null);
    pendingCaptureRef.current = true;
    ws.send(JSON.stringify({ type: 'trigger_capture' }));
    console.log(`📸 Đã gửi lệnh chụp (lần thử ${retryCountRef.current + 1})...`);

    if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
    captureTimeoutRef.current = setTimeout(() => {
      if (!pendingCaptureRef.current) return;
      if (retryCountRef.current < MAX_AUTO_RETRY) {
        retryCountRef.current += 1;
        console.warn('⏳ Chưa nhận được ảnh từ máy ảnh, thử lại...');
        triggerCapture();
      } else {
        pendingCaptureRef.current = false;
        setCaptureError('Không nhận được ảnh từ máy ảnh. Nhấn màn hình để thử lại.');
      }
    }, CAPTURE_TIMEOUT_MS);
  };

  const handleTakePhoto = () => {
    if (photoIndex > maxPhotos || pendingCaptureRef.current) return;
    retryCountRef.current = 0;
    triggerCapture();
  };

  // ================= NHẬN ẢNH DSLR -> CẮT THEO CUT -> LƯU =================
  const processHighResPhoto = (imageUrl) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // ảnh từ origin của bridge (localhost/ngrok)

    img.onload = () => {
      const { cropWidth, cropHeight, cropX, cropY } = getCropDimensions(cut, img.width, img.height);
      const canvas = canvasRef.current;
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      const ctx = canvas.getContext('2d');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // DSLR chụp thẳng (không gương) -> không lật
      ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      applyCapturedPhoto(canvas.toDataURL('image/jpeg', 1.0));
    };

    img.onerror = () => {
      console.error('Lỗi tải ảnh DSLR:', imageUrl);
      pendingCaptureRef.current = false;
      setCaptureError('Không tải được ảnh từ máy ảnh. Nhấn màn hình để thử lại.');
    };

    img.src = imageUrl;
  };

  const applyCapturedPhoto = (dataUrl) => {
    setPhotos((prev) => [...prev, dataUrl]);
    setPhotoIndex((prev) => prev + 1);
    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    setTimeout(() => {
      if (photosContainerRef.current?.lastElementChild) {
        photosContainerRef.current.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 50);
  };

  const handleScreenClick = () => {
    if (captureError) {
      retryCountRef.current = 0;
      triggerCapture();
      return;
    }
    if (!isStarted && bridgeStatus === 'connected') setIsStarted(true);
  };

  const getCurrentPhotoDisplay = () => {
    return photoIndex <= maxPhotos ? `${photoIndex}/${maxPhotos}` : 'Hoàn thành!';
  };

  const bridgeStatusText = () => {
    if (bridgeStatus === 'connected') return 'Máy ảnh: đã kết nối';
    if (bridgeStatus === 'connecting') return 'Máy ảnh: đang kết nối...';
    return 'Máy ảnh: MẤT KẾT NỐI (đang thử lại...)';
  };

  return (
    <div className="photo-container" onClick={handleScreenClick}>
      {/* Không dùng camera trình duyệt — nền tối, ảnh chỉ đến từ DSLR qua bridge */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 40%, #1b1b1b 0%, #000 70%)',
        }}
      />

      {/* Countdown tổng (góc trên) */}
      <div className="countdown">⌛: {formattedCountdown}</div>

      {/* Trạng thái kết nối máy ảnh */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          zIndex: 30,
          color: '#fff',
          fontSize: 14,
          padding: '4px 10px',
          borderRadius: 12,
          background: bridgeStatus === 'connected' ? 'rgba(40,160,70,0.75)' : 'rgba(180,60,60,0.8)',
        }}
      >
        {bridgeStatusText()}
      </div>

      <canvas ref={canvasRef} className="d-none" />

      {flash && <div className="flash-overlay-fullscreen" />}

      {!isStarted && (
        <div className="camera-icon-overlay">
          <div className="camera-icon">
            <i className="fas fa-camera" />
            {bridgeStatus === 'connected' ? (
              <p>Nhấn vào màn hình để bắt đầu chụp</p>
            ) : (
              <p>Đang kết nối máy ảnh (digiCamControl)... vui lòng đợi</p>
            )}
          </div>
        </div>
      )}

      {captureError && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 40,
            background: 'rgba(180, 40, 40, 0.92)',
            color: '#fff',
            padding: '22px 30px',
            borderRadius: 12,
            textAlign: 'center',
            maxWidth: 480,
            fontSize: 18,
          }}
        >
          <i className="fas fa-exclamation-triangle" style={{ fontSize: 30, marginBottom: 10 }} />
          <p style={{ margin: '8px 0' }}>{captureError}</p>
          <p style={{ margin: 0, opacity: 0.85, fontSize: 15 }}>Nhấn vào màn hình</p>
        </div>
      )}

      {isStarted && photoIndex <= maxPhotos && !captureError && (
        <div className="countdown-center">
          <div className="countdown-number-large">{shootCountdown}</div>
        </div>
      )}

      <div className="photo-counter-top-right">{getCurrentPhotoDisplay()}</div>

      {photos.length > 0 && (
        <div className="captured-photos-column" ref={photosContainerRef}>
          <div className="captured-photos-title">Ảnh đã chụp ({photos.length}/{maxPhotos})</div>
          {photos.map((photo, index) => (
            <img
              key={index}
              src={photo}
              alt={`Ảnh ${index + 1}`}
              className="captured-photo-item"
            />
          ))}
        </div>
      )}
      <Chatbot />
    </div>
  );
}

export default Photo;
