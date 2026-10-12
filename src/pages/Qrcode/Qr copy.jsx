import  { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import gifshot from 'gifshot';
import './qr.css';
import Chatbot from '../../components/Chatbot';
import { useCountdown } from "../../contexts/CountdownContext";

const generateSessionId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

function Qr() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id_pay, id_frame, photos = [], finalImage, size, cut } = location.state || {};

  const getAuth = () => {
    const saved = localStorage.getItem('auth');
    return saved ? JSON.parse(saved) : null;
  };

  const [auth, ] = useState(getAuth());
  const { id_admin } = auth || {};

  const [previewQr, setPreviewQr] = useState(null);
  const [finalImageWithQr, setFinalImageWithQr] = useState(null);
  const [showQrOverlay, setShowQrOverlay] = useState(false);

  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [doNotSaveToWeb, setDoNotSaveToWeb] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);

  const { formattedCountdown, countdown } = useCountdown();

  // === BÀN PHÍM ẢO — GIỐNG HẾT DOWNLOAD.JSX ===
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isCaps, ] = useState(false);
  const keyboardRef = useRef(null);
  const emailInputRef = useRef(null);


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

  // Đóng bàn phím khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (keyboardRef.current && !keyboardRef.current.contains(e.target)) {
        setIsKeyboardOpen(false);
      }
    };
    if (isKeyboardOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isKeyboardOpen]);

  const openKeyboard = () => {
    setIsKeyboardOpen(true);
    emailInputRef.current?.blur();
  };

const getLayout = () => {
  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const letters = isCaps ? 'QWERTYUIOPASDFGHJKLZXCVBNM' : 'qwertyuiopasdfghjkllzxcvbnm';
  const firstRow = letters.slice(0, 10).split('');
  const secondRow = letters.slice(10, 19).split('');
  const thirdRow = letters.slice(19).split('');

  return [numbers, firstRow, secondRow, thirdRow];
};


const handleKeyClick = (key) => {
  if (key === 'BACKSPACE') {
    setEmail(prev => prev.slice(0, -1));
  } else if (key === 'SPACE') {
    setEmail(prev => prev + ' ');
  } else if (key === 'CLEAR') {
    setEmail('');
  } else if (key === 'ĐÓNG') {
    setIsKeyboardOpen(false);
  } else {
    setEmail(prev => prev + key);
  }
};

  // === Tạo QR preview ===
  useEffect(() => {
    const fakeSessionId = 'preview_' + Math.random().toString(36).substr(2, 9);
    const fakeUrl = `${import.meta.env.VITE_API_BASE_URL}/download?session_id=${fakeSessionId}`;
    QRCode.toDataURL(fakeUrl, { width: 256, margin: 2 })
      .then(dataUrl => setPreviewQr(dataUrl))
      .catch(err => console.error('Lỗi tạo QR preview:', err));
  }, []);

  // === Cập nhật ảnh có QR ===
// === Cập nhật ảnh có QR (Đã tối ưu PNG) ===
  useEffect(() => {
    if (!finalImage || !previewQr) {
      setFinalImageWithQr(finalImage);
      return;
    }

    const drawQrOnImage = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        if (showQrOverlay) {
          const qrImg = new Image();
          qrImg.crossOrigin = 'anonymous';
          qrImg.onload = () => {
            // Tăng kích thước QR để sắc nét hơn trên khổ ảnh lớn
            const qrSize = Math.min(canvas.width * 0.2, 300); 
            const margin = 20;
            const qrY = canvas.height - qrSize - margin;

            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = String(now.getFullYear()).slice(-2);
            const dateStr = `${day}-${month}-${year}`;

            // Vẽ nền trắng cho QR và Ngày tháng
            ctx.font = `bold ${qrSize * 0.15}px Arial`;
            const textWidth = ctx.measureText(dateStr).width;
            const spacing = 15;
            const totalWidth = textWidth + spacing + qrSize;
            const startX = canvas.width - margin - totalWidth;
            const padding = 10;
            const backgroundHeight = qrSize + padding * 2;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // Nền trắng rõ hơn chút
            ctx.fillRect(startX - padding, qrY - padding, totalWidth + padding * 2, backgroundHeight);
            
            // Vẽ chữ
            ctx.fillStyle = '#000';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(dateStr, startX, qrY + qrSize / 2);
            
            // Vẽ QR
            ctx.drawImage(qrImg, startX + textWidth + spacing, qrY, qrSize, qrSize);
            
            // [QUAN TRỌNG] Xuất ra PNG để giữ nguyên chất lượng
            setFinalImageWithQr(canvas.toDataURL('image/png')); 
          };
          qrImg.src = previewQr;
        } else {
          setFinalImageWithQr(finalImage);
        }
      };
      img.src = finalImage;
    };

    drawQrOnImage();
  }, [showQrOverlay, finalImage, previewQr]);

  // === Xử lý GIF ===
  const [gifBase64, setGifBase64] = useState(null);
  const [videoConfig, setVideoConfig] = useState({ video: 0 });
  const [isGifReady, setIsGifReady] = useState(false);

  useEffect(() => {
    if (doNotSaveToWeb || !photos?.length) {
      setIsGifReady(true);
      return;
    }

    const loadConfigAndGif = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/camera?id_admin=${id_admin}`);
        const config = await res.json();
        setVideoConfig(config);

// Trong useEffect tạo GIF
if (config.video === 1) {
  // Bước 1: Xác định tỉ lệ từ ảnh đầu tiên
  const firstImg = new Image();
  firstImg.src = photos[0];
  firstImg.onload = () => {
    const targetWidth = config.gifWidth || 640;
    const aspectRatio = firstImg.width / firstImg.height;
    const targetHeight = Math.round(targetWidth / aspectRatio);

    gifshot.createGIF(
      {
        images: photos,
        interval: config.interval || 0.5,
        gifWidth: targetWidth,
        gifHeight: targetHeight,
        // 👇 Quan trọng: giữ tỉ lệ bằng cách không dùng fixed height/width cứng
        // gifshot tự scale giữ nội dung, nhưng nếu bạn set cả 2 thì nó bóp méo
        // → nên chỉ set width, tính height theo ratio (như trên)
      },
      (obj) => {
        if (!obj.error) {
          setGifBase64(obj.image);
        } else {
          console.error('Lỗi tạo GIF:', obj.error);
        }
        setIsGifReady(true);
      }
    );
  };
  firstImg.onerror = () => {
    console.error('Không load được ảnh đầu tiên để tính tỉ lệ');
    setIsGifReady(true);
  };
} else {
  setIsGifReady(true);
}
      } catch (err) {
        console.error('Lỗi tải cấu hình video:', err);
        setIsGifReady(true);
      }
    };

    loadConfigAndGif();
  }, [photos, id_admin, doNotSaveToWeb]);

  // === API functions ===
  const uploadCollection = async (filesToUpload, id_qr, downloadLink) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: filesToUpload,
          id_qr: id_qr,
          id_admin: id_admin,
          download_link: downloadLink,
        }),
      });
      if (!response.ok) throw new Error('Upload thất bại');
    } catch (error) {
      console.error('Lỗi upload:', error);
    }
  };

  const sendQrEmail = async (email, id_qr) => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/send-qr-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, id_qr: id_qr }),
      });
      setEmailSent(true);
    } catch (err) {
      console.error('Gửi email QR thất bại:', err);
    }
  };

const sendOriginalImagesEmail = async (email, images, gifData = null) => {
  const validImages = images.filter(img =>
    typeof img === 'string' &&
    img.startsWith('data:image/') &&
    img.includes(';base64,')
  );

  // Thêm GIF nếu có
  if (gifData) {
    validImages.push(gifData);
  }

  if (validImages.length === 0) {
    console.error('Không có ảnh hợp lệ để gửi');
    return;
  }

  try {
    const id_qr = generateSessionId();
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/send-original-images-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, id_qr: id_qr, images: validImages }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Lỗi từ server:', errorData);
      return;
    }

    setEmailSent(true);
  } catch (err) {
    console.error('Gửi ảnh gốc thất bại:', err);
    alert('Gửi email thất bại. Vui lòng thử lại.');
  }
};

  const updateIdFrameAndIdQr = async (id, id_frame, id_qr, email = null) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/update-pay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, id_frame, id_qr, email }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Cập nhật thất bại');
      }
      return true;
    } catch (error) {
      console.error('Lỗi cập nhật DB:', error);
      alert('Cập nhật thông tin thất bại: ' + error.message);
      return false;
    }
  };

  // === Xử lý khi nhấn "TIẾP TỤC" ===
// === Xử lý khi nhấn "TIẾP TỤC" (Đã tối ưu PNG) ===
  const handleContinue = async () => {
    if (isContinuing) return;
    setIsContinuing(true);

    const emailTrimmed = email.trim();

    try {
      let finalImageToSend = finalImage;
      let qrDataUrl = null;
      let id_qr = null;
      let downloadLink = null;

      // Logic tạo QR và link download
      if (!doNotSaveToWeb) {
        id_qr = generateSessionId();
        downloadLink = `${import.meta.env.VITE_API_BASE_URL}/download?id_qr=${id_qr}`;
        qrDataUrl = await QRCode.toDataURL(downloadLink, { width: 512, margin: 2 }); // Tăng resolution QR gốc

        // Nếu người dùng chọn in QR lên ảnh
        if (showQrOverlay) {
          finalImageToSend = await (new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);

              const qrImg = new Image();
              qrImg.crossOrigin = 'anonymous';
              qrImg.onload = () => {
                // Tính toán vị trí vẽ (Giống hệt useEffect ở trên)
                const qrSize = Math.min(canvas.width * 0.2, 300);
                const margin = 20;
                const qrY = canvas.height - qrSize - margin;

                const now = new Date();
                const day = String(now.getDate()).padStart(2, '0');
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const year = String(now.getFullYear()).slice(-2);
                const dateStr = `${day}-${month}-${year}`;

                ctx.font = `bold ${qrSize * 0.15}px Arial`;
                const textWidth = ctx.measureText(dateStr).width;
                const spacing = 15;
                const totalWidth = textWidth + spacing + qrSize;
                const startX = canvas.width - margin - totalWidth;
                const padding = 10;
                const backgroundHeight = qrSize + padding * 2;

                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.fillRect(startX - padding, qrY - padding, totalWidth + padding * 2, backgroundHeight);
                
                ctx.fillStyle = '#000';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(dateStr, startX, qrY + qrSize / 2);
                
                ctx.drawImage(qrImg, startX + textWidth + spacing, qrY, qrSize, qrSize);
                
                // [QUAN TRỌNG] Resolve bằng PNG
                resolve(canvas.toDataURL('image/png'));
              };
              qrImg.src = qrDataUrl;
            };
            img.src = finalImage;
          }));
        }
      }

      // Cập nhật Database
      const idQrToSave = doNotSaveToWeb ? null : id_qr;
      const updateSuccess = await updateIdFrameAndIdQr(id_pay, id_frame, idQrToSave, emailTrimmed || null);
      if (!updateSuccess) {
        setIsContinuing(false);
        return;
      }

      // Chuyển sang trang in (Print.jsx)
      navigate('/Print', {
        state: {
          compositeImage: finalImageToSend, // Đây giờ là PNG chất lượng cao
          qrImage: qrDataUrl,
          size,
          cut,
        },
      });

      // Xử lý gửi mail và upload
      if (doNotSaveToWeb) {
        if (emailTrimmed) {
          sendOriginalImagesEmail(emailTrimmed, [finalImage, ...photos], gifBase64);
        }
      } else {
        const filesToUpload = [
          { data: qrDataUrl, type: 'qr' },
          { data: finalImage, type: 'composite' },
          ...photos.map(data => ({ data, type: 'single' })),
        ];
        if (videoConfig?.video === 1 && gifBase64) {
          filesToUpload.push({ data: gifBase64, type: 'gif' });
        }
        uploadCollection(filesToUpload, id_qr, downloadLink);
        if (emailTrimmed) {
          sendQrEmail(emailTrimmed, id_qr);
        }
      }
    } catch (err) {
      console.error('Lỗi khi tiếp tục:', err);
      alert('Lỗi: ' + (err.message || 'Không xác định'));
      setIsContinuing(false);
    }
  };

  // Tự động tiếp tục khi đếm ngược = 0
  useEffect(() => {
    if (countdown === 0 && !isContinuing) {
      handleContinue();
    }
  }, [countdown, isContinuing]);

  // === JSX ===
  return (
    <div className="qr-container">
      <div className="countdown">⏳: {formattedCountdown}</div>
      <h1 className="touch-to-crecuts mau_h1_qr">TẠO MÃ QR ĐỂ TẢI XUỐNG</h1>

      <div className="qr-layout box5">
        {/* CỘT TRÁI: Ảnh preview */}
        <div className="preview-column">
          <div className="image-preview-wrapper">
            <img
              src={showQrOverlay ? finalImageWithQr || finalImage : finalImage}
              alt="Ảnh preview"
              className="preview-image-main"
            />
          </div>
        </div>

        {/* CỘT PHẢI: Tùy chọn */}
        <div className="qr-column">
          <div className="privacy-toggle">
            <label className="toggle-label">
              <div className="switch">
                <input
                  type="checkbox"
                  checked={doNotSaveToWeb}
                  onChange={(e) => setDoNotSaveToWeb(e.target.checked)}
                />
                <span className="slider"></span>
              </div>
              <span>🔒 Không lưu trữ ảnh</span>
            </label>
          </div>

          <div className="email-section">
            {!emailSent ? (
              <>
                <label className="email-label">Nhập email để nhận ảnh:</label>
                <input
                  ref={emailInputRef}
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={openKeyboard}
                  placeholder="example@gmail.com"
                  className="email-input"
                  readOnly
                />
              </>
            ) : (
              <div className="email-success">✅ Đã gửi thông tin vào email!</div>
            )}
          </div>

          {!doNotSaveToWeb && (
            <div className="qr-toggle-wrapper">
              <label className="toggle-label">
                <div className="switch">
                  <input
                    type="checkbox"
                    checked={showQrOverlay}
                    onChange={(e) => setShowQrOverlay(e.target.checked)}
                  />
                  <span className="slider"></span>
                </div>
                <span>In QR lên ảnh</span>
              </label>
            </div>
          )}

          {!doNotSaveToWeb && previewQr && (
            <div className="qr-code-section">
              <h3 className="color">Mã QR tải ảnh</h3>
              <img
                src={previewQr}
                alt="Mã QR preview"
                className="qr-image"
              />
            </div>
          )}
        </div>
      </div>

      <div className="continue-container">
        <button
          className="continue-button"
          onClick={handleContinue}
          disabled={isContinuing || (doNotSaveToWeb ? false : !isGifReady)}
        >
          {isContinuing ? 'ĐANG XỬ LÝ...' : 'TIẾP TỤC'}
        </button>
      </div>

      {/* BÀN PHÍM ẢO — GIỐNG HẾT DOWNLOAD.JSX */}
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
            <button className="key-dl" onClick={() => handleKeyClick('@')}>@</button>
            <button className="key-dl" onClick={() => handleKeyClick('.')}>.</button>
            <button className="key-dl wide" onClick={() => handleKeyClick('SPACE')}>Space</button>
            <button className="key-dl" onClick={() => handleKeyClick('BACKSPACE')}>⌫</button>
          </div>
        </div>
      )}

      <Chatbot />
    </div>
  );
}

export default Qr;