import  { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Chatbot from '../../components/Chatbot';
import { bridgeWsUrl } from '../../lib/bridge';
import './Print.css';

const Print = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const { compositeImage, qrImage, size, cut } = location.state || {};
  
  const [countdown, setCountdown] = useState(50);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const [printStatus, setPrintStatus] = useState(null);

  const printTriggeredRef = useRef(false);

  // Áp dụng background
  useEffect(() => {
    const savedBackground = localStorage.getItem('backgroundImage');
    if (savedBackground) {
      document.body.style.backgroundImage = `url(${savedBackground})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundRepeat = 'no-repeat';
      document.body.style.backgroundAttachment = 'fixed';
    }
    return () => {
      document.body.style.backgroundImage = 'none';
    };
  }, []);

  // Countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Auto finish
  useEffect(() => {
    if (countdown === 0 && !autoTriggered) {
      setAutoTriggered(true);
      handleFinish();
    }
  }, [countdown, autoTriggered]);

  // === LOGIC IN ẢNH ===
  useEffect(() => {
    if (printTriggeredRef.current) return;
    if (!compositeImage || !size || cut == null) {
      setPrintStatus('Thiếu thông tin để in');
      return;
    }

    printTriggeredRef.current = true;

    // 1. Tên máy in
    const printer = 'Canon SELPHY CP1300';
    
    // 2. Định hướng giấy: cut 3 (dải ngang) in Landscape, còn lại Portrait
    const orientation = [3].includes(parseInt(cut)) ? 'Landscape' : 'Portrait';
    
    // 3. Xác định chế độ cắt (Split Mode): cut 3/41 là dải nhỏ -> 2 bản/tờ + máy in cắt đôi
    const isSplitMode = [3, 41].includes(parseInt(cut));

    // 4. Số tờ: `size` đã được ChoosePackage quy đổi sang SỐ TỜ
    //    (cut 3/41: giá trị giá/2; cut 42/6: bằng giá trị giá) -> không chia thêm
    const copies = Math.max(1, Math.round(Number(size)));

    // 5. Khổ giấy Canon
    const paper = 'Postcard';

    setPrintStatus('Đang chuẩn bị in...');

    try {
      const WS_URL = bridgeWsUrl;
      
      console.log(`[PRINTER] Connecting to WebSocket: ${WS_URL} (split=${isSplitMode}, tờ=${copies}, ${orientation})`);
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('✅ Kết nối WebSocket máy in thành công');
        ws.send(JSON.stringify({
          type: 'print-request',
          data: { 
            image: compositeImage, 
            printer, 
            orientation, 
            copies, // Số lượng tờ giấy thực tế cần in
            paper,
            isSplitMode 
          }
        }));
        setPrintStatus(`Đang in ${copies} tờ...`);
      };

      ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            if (message.type === 'print-complete') {
              setPrintStatus('In thành công');
            } else if (message.type === 'print-error') {
              setPrintStatus('Lỗi in: ' + message.error);
            }
        } catch (e) {
            console.error('Lỗi parse message in:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ Lỗi WebSocket:', error);
        setPrintStatus('Lỗi kết nối Server in');
      };
      
      return () => {
          if (ws.readyState === 1) ws.close();
      };

    } catch (error) {
      console.error('Lỗi khi gửi yêu cầu in:', error);
      setPrintStatus('Lỗi: ' + error.message);
    }
  }, [compositeImage, size, cut]);

  const handleFinish = () => {
    navigate('/Feedback');
  };

  const handleRetryPrint = () => {
    printTriggeredRef.current = false;
    setPrintStatus('Đang thử in lại...');
  };

  return (
    <div className="choose-container">
      <h1 className="touch-to-crecuts pt-5">Ảnh đang được in</h1>
      <div className='countdown'>
        ⌛: {countdown}
      </div>
      {printStatus && (
        <div style={{
          position: 'absolute', top: '50px', left: '10px',
          fontSize: '16px', background: '#fff', padding: '5px',
          borderRadius: '5px', zIndex: 1000, boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          {printStatus}
          {printStatus.includes('Lỗi') && (
            <button onClick={handleRetryPrint} style={{
              marginLeft: '10px', padding: '3px 8px',
              background: '#4CAF50', color: 'white', border: 'none',
              borderRadius: '3px', cursor: 'pointer'
            }}>Thử lại</button>
          )}
        </div>
      )}
      <div className="choose-image-row">
        {qrImage ? (
          <>
            <img src={compositeImage} alt="Ảnh chính" className="choose-left" />
            <div className="choose-middle mx-5">
              <img src={qrImage} alt="QR Code cho ảnh" />
              <div className="qr-label">QR Code Ảnh</div>
            </div>
          </>
        ) : (
          <img src={compositeImage} alt="Ảnh chính" className="choose-centered" />
        )}
      </div>
      <div className="d-flex justify-content-center">
        <button className="continue-btn" onClick={handleFinish}>Đánh Giá</button>
      </div>
      <Chatbot />
    </div>
  );
};

export default Print;