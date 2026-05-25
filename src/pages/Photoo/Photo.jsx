import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Photo.css';
import Chatbot from '../../components/Chatbot';
import { useCountdown } from "../../contexts/CountdownContext";

function Photo() {
  const getAuth = () => {
    const saved = localStorage.getItem('auth');
    return saved ? JSON.parse(saved) : null;
  };

  const [auth, setAuth] = useState(getAuth());
  const { id_admin } = auth || {};

  const [countdown2, setCountdown] = useState(5);
  const [photoIndex, setPhotoIndex] = useState(1);
  const [photos, setPhotos] = useState([]);
  const [flash, setFlash] = useState(false);
  const [isMirror, setIsMirror] = useState(false);
  const [initialTime, setInitialTime] = useState(5);
  const [subsequentTime, setSubsequentTime] = useState(8);
  const [isStarted, setIsStarted] = useState(true);
  const [maxPhotos, setMaxPhotos] = useState(8);
  const [isRetaking, setIsRetaking] = useState(false);
  const [retakeIndex, setRetakeIndex] = useState(null);
  const [currentPhotosState, setCurrentPhotosState] = useState([]);
  const [currentSelectedSlotsState, setCurrentSelectedSlotsState] = useState([]);
  const [currentAppliedFiltersState, setCurrentAppliedFiltersState] = useState({});

  const [previewCrop, setPreviewCrop] = useState(null);
  const photosContainerRef = useRef(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null); // Vẫn giữ lại canvas để cắt ảnh gốc DSLR
  const streamRef = useRef(null);
  const wsRef = useRef(null); // THÊM WEBSOCKET REF

  const navigate = useNavigate();
  const location = useLocation();
  const {
    size,
    cut,
    id_admin: idAdmin,
    id_topic: idTopic,
    selectedFrame,
    selectedFrameId,
    price,
    retakeIndex: incomingRetakeIndex,
    currentPhotos: incomingCurrentPhotos,
    currentSelectedSlots: incomingCurrentSelectedSlots,
    currentAppliedFilters: incomingCurrentAppliedFilters
  } = location.state || {};

  const { formattedCountdown, countdown } = useCountdown();

  useEffect(() => {
    if (countdown === 0) {
      navigate('/Appclien');
    }
  }, [countdown, navigate]);

  const getMaxPhotos = (cutValue) => {
    const cutNum = Number(cutValue);
    if (cutNum === 3) return 3;
    if (cutNum === 41 || cutNum === 42) return 4;
    if (cutNum === 6) return 6;
    return 8;
  };

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

  const updatePreviewCrop = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || !cut) return;
    const { cropWidth, cropHeight, cropX, cropY } = getCropDimensions(cut, video.videoWidth, video.videoHeight);
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;
    const videoAspectRatio = video.videoWidth / video.videoHeight;
    const containerAspectRatio = containerWidth / containerHeight;

    let displayWidth, displayHeight, offsetX, offsetY;
    if (videoAspectRatio > containerAspectRatio) {
      displayWidth = containerWidth;
      displayHeight = containerWidth / videoAspectRatio;
      offsetX = 0;
      offsetY = (containerHeight - displayHeight) / 2;
    } else {
      displayHeight = containerHeight;
      displayWidth = containerHeight * videoAspectRatio;
      offsetY = 0;
      offsetX = (containerWidth - displayWidth) / 2;
    }

    const scaleX = displayWidth / video.videoWidth;
    const scaleY = displayHeight / video.videoHeight;
    setPreviewCrop({
      x: offsetX + cropX * scaleX,
      y: offsetY + cropY * scaleY,
      width: cropWidth * scaleX,
      height: cropHeight * scaleY,
    });
  };

  // ================= KẾT NỐI WEBSOCKET =================
  useEffect(() => {
    wsRef.current = new WebSocket('ws://localhost:5000');

    wsRef.current.onopen = () => console.log('✅ Đã kết nối Local Server để điều khiển máy ảnh');

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_dslr_photo') {
          console.log("📸 Nhận ảnh gốc từ DSLR:", data.url);
          // Khi có ảnh mới, tiến hành cắt ảnh độ phân giải cao
          processHighResPhoto(data.url);
        }
      } catch (err) {
        console.error('Lỗi đọc tin nhắn WebSocket:', err);
      }
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // ================= INIT STATE & CẤU HÌNH =================
  useEffect(() => {
    const { retakeIndex: locRetakeIndex, currentPhotos: locCurrentPhotos, currentSelectedSlots: locCurrentSelectedSlots, currentAppliedFilters: locCurrentAppliedFilters } = location.state || {};
    if (locRetakeIndex !== undefined && locCurrentPhotos) {
      setIsRetaking(true); setRetakeIndex(locRetakeIndex); setCurrentPhotosState(locCurrentPhotos);
      setCurrentSelectedSlotsState(locCurrentSelectedSlots || []); setCurrentAppliedFiltersState(locCurrentAppliedFilters || {});
      setPhotos([]); setPhotoIndex(1); setMaxPhotos(1); setIsStarted(true);
    } else {
      setIsRetaking(false); setRetakeIndex(null); setCurrentPhotosState([]);
      setCurrentSelectedSlotsState([]); setCurrentAppliedFiltersState({});
      setMaxPhotos(getMaxPhotos(cut)); setPhotos([]); setPhotoIndex(1); setIsStarted(false);
    }
  }, [cut]);

  useEffect(() => {
    if (!id_admin) return;
    fetch(`${import.meta.env.VITE_API_BASE_URL}/camera/basic?id_admin=${id_admin}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data) return;
        setInitialTime(Number(data.time1) || 5);
        setSubsequentTime(Number(data.time2) || 8);
        setIsMirror(Number(data.mirror) === 1);
      }).catch(console.error);
  }, [id_admin]);

  // ================= SETUP WEBCAM CHỈ ĐỂ LÀM GƯƠNG SOI =================
  useEffect(() => {
    let mounted = true;
    const setupCamera = async () => {
      try {
        // Cấu hình đơn giản hơn vì chỉ dùng để review, không dùng để chụp
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } });
        if (!mounted) return;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          videoRef.current.addEventListener('loadedmetadata', updatePreviewCrop, { once: true });
        }
      } catch (err) {
        console.error('Lỗi khi truy cập camera review:', err);
      }
    };
    setupCamera();

    const handleBeforeUnload = () => { if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop()); };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      mounted = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    };
  }, [cut]);

  // ================= LOGIC CHUYỂN TRANG KHI CHỤP XONG =================
  useEffect(() => {
    if (!isStarted) return;

    // Khi đã chụp đủ số lượng ảnh
    if (photoIndex > maxPhotos) {
      setTimeout(() => {
        if (isRetaking) {
          const newPhoto = photos[0];
          const updatedPhotos = [...currentPhotosState]; updatedPhotos[retakeIndex] = newPhoto;
          const updatedSlots = [...currentSelectedSlotsState];
          if (updatedSlots[retakeIndex]) updatedSlots[retakeIndex] = { ...updatedSlots[retakeIndex], photo: newPhoto };
          navigate('/Selphoto', { state: { photos: updatedPhotos, size, cut, selectedFrame, selectedFrameId, price, selectedSlots: updatedSlots, appliedFilters: { ...currentAppliedFiltersState } } });
        } else {
          const initialSlots = photos.map((photo) => ({ photo, flip: false }));
          const initialFilters = {}; photos.forEach((_, i) => { initialFilters[i] = 'original'; });
          navigate('/Selphoto', { state: { photos, size, cut, selectedFrame, selectedFrameId, price, selectedSlots: initialSlots, appliedFilters: initialFilters } });
        }
      }, 1500);
      return;
    }

    const currentTime = photoIndex === 1 ? initialTime : subsequentTime;
    setCountdown(currentTime);
    const timer = setTimeout(() => {
      handleTakePhoto();
    }, currentTime * 1000);

    return () => clearTimeout(timer);
  }, [photoIndex, isStarted, maxPhotos, initialTime, subsequentTime, photos, navigate, size, cut, selectedFrame, selectedFrameId, price, isRetaking, retakeIndex, currentPhotosState, currentSelectedSlotsState, currentAppliedFiltersState]);

  // ================= VÒNG LẶP ĐẾM NGƯỢC HIỂN THỊ =================
  useEffect(() => {
    if (!isStarted || photoIndex > maxPhotos) return;
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isStarted, photoIndex, maxPhotos]);

  // ================= BẮN LỆNH CHỤP =================
  const handleTakePhoto = () => {
    if (photoIndex > maxPhotos) return;

    // 1. Chớp màn hình giả lập flash
    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    // 2. Gửi lệnh chụp qua WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'trigger_capture' }));
    } else {
      console.error("Lỗi: Server máy ảnh chưa được kết nối!");
    }
  };

  // ================= XỬ LÝ ẢNH NÉT CĂNG TỪ LOCAL SERVER =================
  const processHighResPhoto = (imageUrl) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Tránh lỗi CORS khi đọc ảnh từ localhost:5000
    
    img.onload = () => {
      const { cropWidth, cropHeight, cropX, cropY } = getCropDimensions(cut, img.width, img.height);
      const canvas = canvasRef.current;
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      const ctx = canvas.getContext('2d');

      // Vẽ ảnh DSLR kích thước gốc lên canvas để cắt gọn gàng theo tỷ lệ khung
      // Máy DSLR thường không cần lật gương (mirror) như webcam, nên giữ nguyên bản
      ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      // Xuất ảnh chuẩn JPEG chất lượng tối đa 1.0 (100%)
      const highResDataUrl = canvas.toDataURL('image/jpeg', 1.0);
      applyCapturedPhoto(highResDataUrl);
    };

    img.src = imageUrl;
  };

  const applyCapturedPhoto = (dataUrl) => {
    setPhotos((prev) => [...prev, dataUrl]);
    // CHỈ KHI NHẬN ĐƯỢC ẢNH VÀ CẮT XONG THÌ MỚI TĂNG INDEX (bắt đầu vòng đếm ngược tiếp theo)
    setPhotoIndex((prev) => prev + 1); 
    
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
    
    setTimeout(() => {
      if (photosContainerRef.current && photosContainerRef.current.lastElementChild) {
        photosContainerRef.current.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 50); 
  };

  const handleScreenClick = () => { if (!isStarted) setIsStarted(true); };
  const getCurrentPhotoDisplay = () => { return photoIndex <= maxPhotos ? `${photoIndex}/${maxPhotos}` : 'Hoàn thành!'; };

  return (
    <div className="photo-container" onClick={handleScreenClick}>
      {/* Webcam giờ chỉ làm gương soi (Mirror UI) */}
      <video
        ref={videoRef}
        className={`video-stream-fullscreen ${isMirror ? 'video-mirror' : ''}`}
        playsInline muted autoPlay
      />
      
      <div className="countdown">⌛: {formattedCountdown}</div>

      <canvas ref={canvasRef} className="d-none" />

      {previewCrop && (
        <div className="crop-mask-overlay">
          <div className="mask-bar" style={{ top: 0, left: 0, right: 0, height: `${previewCrop.y}px` }} />
          <div className="mask-bar" style={{ bottom: 0, left: 0, right: 0, height: `${window.innerHeight - (previewCrop.y + previewCrop.height)}px` }} />
          <div className="mask-bar" style={{ top: `${previewCrop.y}px`, left: 0, width: `${previewCrop.x}px`, height: `${previewCrop.height}px` }} />
          <div className="mask-bar" style={{ top: `${previewCrop.y}px`, right: 0, width: `${window.innerWidth - (previewCrop.x + previewCrop.width)}px`, height: `${previewCrop.height}px` }} />
          <div className="crop-outline" style={{ left: `${previewCrop.x}px`, top: `${previewCrop.y}px`, width: `${previewCrop.width}px`, height: `${previewCrop.height}px` }} />
        </div>
      )}

      {flash && <div className="flash-overlay-fullscreen" />}

      {!isStarted ? (
        <div className="camera-icon-overlay">
          <div className="camera-icon">
            <i className="fas fa-camera" />
            <p>Nhấn vào màn hình để bắt đầu chụp</p>
          </div>
        </div>
      ) : null}
      
      {isStarted && photoIndex <= maxPhotos && (
        <div className="countdown-center">
          <div className="countdown-number-large">{countdown2}</div>
        </div>
      )}

      <div className="photo-counter-top-right">{getCurrentPhotoDisplay()}</div>

      {photos.length > 0 && (
        <div className="captured-photos-column" ref={photosContainerRef}>
          <div className="captured-photos-title">Ảnh đã chụp ({photos.length}/{maxPhotos})</div>
          {photos.map((photo, index) => (
            <img key={index} src={photo} alt={`Ảnh ${index + 1}`} className="captured-photo-item" />
          ))}
        </div>
      )}
      <Chatbot />
    </div>
  );
}

export default Photo;