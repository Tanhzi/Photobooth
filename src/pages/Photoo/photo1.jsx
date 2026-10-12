import  { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Photo.css';
import Chatbot from '../../components/Chatbot';
import { useCountdown } from "../../contexts/CountdownContext";

function Photo() {
  const getAuth = () => {
    const saved = localStorage.getItem('auth');
    return saved ? JSON.parse(saved) : null;
  };

  const [auth, ] = useState(getAuth());
  const { id_admin } = auth || {};

  // State
  const [shootCountdown, setShootCountdown] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(1);
  const [photos, setPhotos] = useState([]); 
  const [processingStatus, setProcessingStatus] = useState({}); 
  
  const [flash, setFlash] = useState(false);
  const [isMirror, setIsMirror] = useState(false);
  
  const [initialTime, setInitialTime] = useState(5);
  const [subsequentTime, setSubsequentTime] = useState(8);
  const [isStarted, setIsStarted] = useState(false);
  const [maxPhotos, setMaxPhotos] = useState(8);
  const [isRetaking, setIsRetaking] = useState(false);
  const [retakeIndexState, setRetakeIndexState] = useState(null);
  
  const [currentPhotosState, setCurrentPhotosState] = useState([]);
  const [currentSelectedSlotsState, setCurrentSelectedSlotsState] = useState([]);
  const [currentAppliedFiltersState, setCurrentAppliedFiltersState] = useState({});
  const [previewCrop, setPreviewCrop] = useState(null);

  // Refs
  const photosContainerRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const imageCaptureRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  
  // API Config
  const API_URL = import.meta.env.VITE_API_BASE_URL;
  const AI_URL = import.meta.env.VITE_AI_API_URL || 'http://localhost:5000';

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

  // --- HELPER FUNCTIONS (Lấy từ code cũ) ---

  const blobToDataURL = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const getMaxPhotos = (cutValue) => {
    const cutNum = Number(cutValue);
    if (cutNum === 3) return 3;
    if (cutNum === 41 || cutNum === 42) return 4;
    if (cutNum === 6) return 6;
    return 8;
  };

  const getCropDimensions = (cutValue, videoWidth, videoHeight) => {
    const cutNum = Number(cutValue);
    let targetAspectRatio;
    switch (cutNum) {
      case 3: targetAspectRatio = 276 / 220; break;
      case 41: targetAspectRatio = 276 / 195; break;
      case 42: targetAspectRatio = 260 / 330; break;
      case 6: targetAspectRatio = 280 / 240; break;
      default: targetAspectRatio = 1;
    }

    const videoAspectRatio = videoWidth / videoHeight;
    let cropWidth, cropHeight, cropX, cropY;

    if (videoAspectRatio > targetAspectRatio) {
      cropHeight = videoHeight;
      cropWidth = Math.round(cropHeight * targetAspectRatio);
      cropX = Math.round((videoWidth - cropWidth) / 2);
      cropY = 0;
    } else {
      cropWidth = videoWidth;
      cropHeight = Math.round(cropWidth / targetAspectRatio);
      cropX = 0;
      cropY = Math.round((videoHeight - cropHeight) / 2);
    }
    return { cropWidth, cropHeight, cropX, cropY };
  };

  const updatePreviewCrop = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || !cut) return;

    const { cropWidth, cropHeight, cropX, cropY } = getCropDimensions(
      cut,
      video.videoWidth,
      video.videoHeight
    );

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

  // --- EFFECTS ---

  // 1. Xử lý logic Retake hoặc chụp mới
  useEffect(() => {
    if (incomingRetakeIndex !== undefined && incomingCurrentPhotos) {
      setIsRetaking(true);
      setRetakeIndexState(incomingRetakeIndex);
      setCurrentPhotosState(incomingCurrentPhotos);
      setCurrentSelectedSlotsState(incomingCurrentSelectedSlots || []);
      setCurrentAppliedFiltersState(incomingCurrentAppliedFilters || {});
      setPhotos([]);
      setPhotoIndex(1);
      setMaxPhotos(1);
      setIsStarted(true);
      setProcessingStatus({});
    } else {
      setIsRetaking(false);
      setRetakeIndexState(null);
      setCurrentPhotosState([]);
      setCurrentSelectedSlotsState([]);
      setCurrentAppliedFiltersState({});
      const maxPhotoCount = getMaxPhotos(cut);
      setMaxPhotos(maxPhotoCount);
      setPhotos([]);
      setPhotoIndex(1);
      setIsStarted(false);
      setProcessingStatus({});
    }
  }, [incomingRetakeIndex, incomingCurrentPhotos, cut]);

  // 2. Lấy cấu hình Camera từ API
  useEffect(() => {
    if (!id_admin) return;
    fetch(`${API_URL}/camera/basic?id_admin=${id_admin}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data) return;
        setInitialTime(Number(data.time1) || 5);
        setSubsequentTime(Number(data.time2) || 8);
        setIsMirror(Number(data.mirror) === 1);
      })
      .catch((err) => console.error('Lỗi khi lấy cấu hình:', err));
  }, [id_admin, API_URL]);

  // 3. Setup Camera (Lấy đầy đủ từ code cũ)
  const { formattedCountdown, countdown } = useCountdown();
  
  useEffect(() => {
    if (countdown === 0) {
      navigate('/Appclien');
    }
  }, [countdown, navigate]);

  useEffect(() => {
    let mounted = true;

    const setupCamera = async () => {
      let stream = null;
      const tryConstraints = [
        { audio: false, video: { facingMode: 'user', width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 30 } } },
        { audio: false, video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } } },
        { audio: false, video: { facingMode: 'user' } },
      ];

      for (const constraints of tryConstraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (!mounted) return;
          break;
        } catch (err) {
          console.warn('Thử độ phân giải thất bại:', constraints, err);
        }
      }

      if (!stream) {
        console.error('Không thể truy cập camera.');
        return;
      }

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      if (track) {
        if ('ImageCapture' in window) {
          imageCaptureRef.current = new window.ImageCapture(track);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const handleLoaded = () => {
          videoRef.current.play().catch(() => {});
          updatePreviewCrop();
        };
        videoRef.current.addEventListener('loadedmetadata', handleLoaded, { once: true });
      }
    };

    setupCamera();

    const handleBeforeUnload = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      mounted = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      imageCaptureRef.current = null;
    };
  }, [cut]);

  // 4. Logic đếm ngược chụp
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


  // === CHỨC NĂNG MỚI: LÀM NÉT ẢNH NGẦM ===
  const enhancePhotoInBackground = async (blob, index) => {
    try {
      // Đánh dấu ảnh này đang xử lý
      setProcessingStatus(prev => ({ ...prev, [index]: 'processing' }));
      
      const formData = new FormData();
      formData.append('image', blob, `capture_${index}.jpg`);

      // Gọi API làm nét
      const res = await fetch(`${AI_URL}/fast-enhance`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.success && data.enhanced_image) {
        // Cập nhật lại ảnh trong mảng photos tại vị trí index
        setPhotos(prevPhotos => {
          const newPhotos = [...prevPhotos];
          if (newPhotos[index]) {
            newPhotos[index] = data.enhanced_image;
          }
          return newPhotos;
        });
        console.log(`✅ Ảnh ${index + 1} đã làm nét xong.`);
      } else {
        console.error(`Lỗi làm nét ảnh ${index + 1}:`, data.error);
      }
    } catch (error) {
      console.error(`Lỗi kết nối khi làm nét ảnh ${index + 1}:`, error);
    } finally {
      // Đánh dấu đã xong (để cho phép chuyển trang)
      setProcessingStatus(prev => ({ ...prev, [index]: 'done' }));
    }
  };

  // === XỬ LÝ CHỤP ẢNH (Ghép logic cũ + mới) ===
  const handleTakePhoto = async () => {
    if (!streamRef.current || !videoRef.current || photoIndex > maxPhotos) return;

    const video = videoRef.current;
    let videoWidth = video.videoWidth;
    let videoHeight = video.videoHeight;

    if (!videoWidth || !videoHeight) {
      await new Promise((resolve) => {
        const onLoaded = () => {
          videoWidth = video.videoWidth;
          videoHeight = video.videoHeight;
          resolve();
        };
        video.addEventListener('loadedmetadata', onLoaded, { once: true });
        setTimeout(resolve, 500);
      });
    }

    const { cropWidth, cropHeight, cropX, cropY } = getCropDimensions(cut, videoWidth, videoHeight);

    const canvas = canvasRef.current;
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');

    // Cấu hình vẽ canvas
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, cropWidth, cropHeight);
    ctx.save();

    // Xử lý Mirror
    if (isMirror) {
      ctx.translate(cropWidth, 0);
      ctx.scale(-1, 1);
    }

    // Hàm chung để xử lý blob sau khi chụp
    const processBlob = (blob) => {
      if (!blob) return;
      blobToDataURL(blob).then((dataUrl) => {
        const currentIndex = photos.length; // Index hiện tại
        
        // 1. Hiển thị ảnh ngay lập tức (ảnh gốc)
        setPhotos((prev) => [...prev, dataUrl]);
        
        // 2. Gửi đi làm nét NGAY LẬP TỨC
        enhancePhotoInBackground(blob, currentIndex);

        // 3. Tăng index, flash, cuộn
        setPhotoIndex((prev) => prev + 1);
        setFlash(true);
        setTimeout(() => setFlash(false), 200);

        setTimeout(() => {
          if (photosContainerRef.current?.lastElementChild) {
            photosContainerRef.current.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        }, 50);
      });
    };

    // Logic chụp: Ưu tiên ImageCapture, Fallback dùng video drawImage
    if (imageCaptureRef.current) {
      try {
        const blob = await imageCaptureRef.current.takePhoto();
        const img = new Image();
        const imgDataUrl = await blobToDataURL(blob);

        await new Promise((resolve) => {
          img.onload = resolve;
          img.src = imgDataUrl;
        });

        const scaleX = img.width / videoWidth;
        const scaleY = img.height / videoHeight;

        ctx.drawImage(
          img,
          cropX * scaleX,
          cropY * scaleY,
          cropWidth * scaleX,
          cropHeight * scaleY,
          0,
          0,
          cropWidth,
          cropHeight
        );
        ctx.restore();

        // Xuất ra blob JPEG 0.95
        canvas.toBlob(processBlob, 'image/jpeg', 0.95);
        return;
      } catch (err) {
        console.warn('ImageCapture lỗi, dùng fallback:', err);
      }
    }

    // Fallback: Chụp trực tiếp từ video element
    ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    ctx.restore();
    canvas.toBlob(processBlob, 'image/jpeg', 0.95);
  };

  // === KIỂM TRA ĐIỀU KIỆN CHUYỂN TRANG ===
  useEffect(() => {
    // Chỉ chạy khi đã chụp đủ số ảnh
    if (photoIndex > maxPhotos) {
      
      // Kiểm tra xem có ảnh nào đang xử lý ('processing') không?
      const isStillProcessing = Object.values(processingStatus).some(status => status === 'processing');
      
      // Kiểm tra xem đã xử lý đủ số lượng ảnh chưa (số key 'done' + 'processing' == maxPhotos)
      const processedCount = Object.keys(processingStatus).length;
      const hasStartedAll = processedCount === maxPhotos;

      if (!isStillProcessing && hasStartedAll) {
        // Đã xong hết, chuyển trang
        setTimeout(() => {
          if (isRetaking) {
            const newPhoto = photos[0];
            const updatedPhotos = [...currentPhotosState];
            updatedPhotos[retakeIndexState] = newPhoto;
            const updatedSlots = [...currentSelectedSlotsState];
            if (updatedSlots[retakeIndexState]) {
                updatedSlots[retakeIndexState] = { ...updatedSlots[retakeIndexState], photo: newPhoto, flip: false };
            }
            const updatedFilters = { ...currentAppliedFiltersState };
            updatedFilters[retakeIndexState] = 'original';

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
                photos, // Mảng ảnh ĐÃ LÀM NÉT
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
        }, 1000);
      }
    }
  }, [photoIndex, maxPhotos, processingStatus, photos, isRetaking, navigate, currentPhotosState, currentSelectedSlotsState, currentAppliedFiltersState, retakeIndexState, size, cut, selectedFrame, selectedFrameId, price]);

  const handleScreenClick = () => {
    if (!isStarted) setIsStarted(true);
  };

  // UI Helper
  const isAllDone = photoIndex > maxPhotos;
  const pendingCount = Object.values(processingStatus).filter(s => s === 'processing').length;

  const getCurrentPhotoDisplay = () => {
    if (isAllDone) {
      return pendingCount > 0 ? `Đang xử lý ${pendingCount} ảnh...` : 'Hoàn thành!';
    }
    return `${photoIndex}/${maxPhotos}`;
  };

  return (
    <div className="photo-container" onClick={handleScreenClick}>
      <video
        ref={videoRef}
        className={`video-stream-fullscreen ${isMirror ? 'video-mirror' : ''}`}
        playsInline
        muted
        autoPlay
      />
      
      <div className="countdown">⌛: {formattedCountdown}</div>

      <canvas ref={canvasRef} className="d-none" />

      {previewCrop && (
        <div className="crop-mask-overlay">
          <div className="mask-bar" style={{ top: 0, left: 0, right: 0, height: `${previewCrop.y}px` }} />
          <div className="mask-bar" style={{ bottom: 0, left: 0, right: 0, height: `${window.innerHeight - (previewCrop.y + previewCrop.height)}px` }} />
          <div className="mask-bar" style={{ top: `${previewCrop.y}px`, left: 0, width: `${previewCrop.x}px`, height: `${previewCrop.height}px` }} />
          <div className="mask-bar" style={{ top: `${previewCrop.y}px`, right: 0, width: `${window.innerWidth - (previewCrop.x + previewCrop.width)}px`, height: `${previewCrop.height}px` }} />
          
          <div
            className="crop-outline"
            style={{
              left: `${previewCrop.x}px`,
              top: `${previewCrop.y}px`,
              width: `${previewCrop.width}px`,
              height: `${previewCrop.height}px`,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
            }}
          />
        </div>
      )}

      {flash && <div className="flash-overlay-fullscreen" />}

      {!isStarted && (
        <div className="camera-icon-overlay">
          <div className="camera-icon">
            <i className="fas fa-camera" />
            <p>Nhấn vào màn hình để bắt đầu chụp</p>
          </div>
        </div>
      )}

      {isStarted && photoIndex <= maxPhotos && (
        <div className="countdown-center">
          <div className="countdown-number-large">{shootCountdown}</div>
        </div>
      )}

      <div className="photo-counter-top-right">
        {getCurrentPhotoDisplay()}
        {isAllDone && pendingCount > 0 && (
           <div className="spinner-border text-light spinner-border-sm ms-2" role="status"></div>
        )}
      </div>

      {photos.length > 0 && (
        <div className="captured-photos-column" ref={photosContainerRef}>
          <div className="captured-photos-title">Ảnh đã chụp ({photos.length}/{maxPhotos})</div>
          {photos.map((photo, index) => (
            <div key={index} className="position-relative captured-photo-item" style={{width: '100%', height: 'auto', marginBottom: '10px'}}>
              <img
                src={photo}
                alt={`Ảnh ${index + 1}`}
                style={{width: '100%', borderRadius: '8px', display: 'block'}}
              />
              {/* Overlay loading nếu ảnh đang được xử lý */}
              {processingStatus[index] === 'processing' && (
                <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px'
                }}>
                    <div className="spinner-border text-light spinner-border-sm"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Chatbot />
    </div>
  );
}

export default Photo;