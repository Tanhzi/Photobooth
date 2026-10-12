import  { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Chatbot from '../../components/Chatbot';
import './Discount.css';
import { useCountdown } from "../../contexts/CountdownContext";
import { getAuthHeaders } from '../../api';

function Discount() {
  const navigate = useNavigate();
  const location = useLocation();
  const { price, size, cut } = location.state || {};

  // Lấy thông tin từ auth
  const getAuth = () => {
    const saved = localStorage.getItem('auth');
    return saved ? JSON.parse(saved) : null;
  };

  const [auth, ] = useState(getAuth());
  const { id, id_admin } = auth || {};

  const [depositAmount, setDepositAmount] = useState(0);
  const [discountCode, setDiscountCode] = useState('');
  const [discountValue, setDiscountValue] = useState(0);
  const [, setAvailableDiscounts] = useState([]);
  const [discountError, setDiscountError] = useState(''); // State lưu lỗi mã giảm giá

  const { initializeCountdown } = useCountdown();
  const discountInputRef = useRef(null);

  // ✅ Áp dụng background từ localStorage nếu có
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

  // ✅ Gọi initialize khi vào Discount
  useEffect(() => {
    if (id_admin && initializeCountdown) {
      initializeCountdown(id_admin);
    }
  }, [id_admin, initializeCountdown]);

  // ============================================================
  // 🔥 KẾT NỐI WEBSOCKET NHẬN TIỀN (ĐÃ CẬP NHẬT)
  // ============================================================
  useEffect(() => {
    // 1. Lấy URL API từ biến môi trường (Nếu không có thì fallback về localhost:5000)
    const API_URL = import.meta.env.VITE_AI_API_URL || 'http://localhost:5000';
    
    // 2. Chuyển đổi giao thức http -> ws hoặc https -> wss
    // Ví dụ: https://my-ngrok.app -> wss://my-ngrok.app
    const WS_URL = API_URL.replace(/^http/, 'ws');

    console.log(`[DEPOSIT] Đang kết nối tới máy nhận tiền qua: ${WS_URL}`);
    
    let ws = null;
    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
          console.log('✅ Kết nối WebSocket nhận tiền thành công.');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // Server gửi: { type: 'deposit', deposit: 10000 }
            if (data.type === 'deposit' && data.deposit !== undefined) {
              console.log(`💰 Nhận được tiền: ${data.deposit}`);
              setDepositAmount(prev => prev + data.deposit);
            }
          } catch (error) {
            console.error('❌ Lỗi parse dữ liệu từ WebSocket:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('❌ Lỗi kết nối WebSocket:', error);
        };

        ws.onclose = () => {
            console.log('⚠️ WebSocket nhận tiền đã đóng.');
        };
    } catch (err) {
        console.error('Lỗi khởi tạo WebSocket:', err);
    }

    // Cleanup khi rời trang
    return () => {
        if (ws && ws.readyState === 1) {
            ws.close();
        }
    };
  }, []);

  // ============================================================

  // Lấy danh sách mã giảm giá
  useEffect(() => {
    const fetchDiscounts = async () => {
      if (!id_admin) return;
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/discounts?id_admin=${id_admin}`);
        const data = await response.json();
        setAvailableDiscounts(data);
      } catch (error) {
        console.error("❌ Không thể tải mã giảm giá:", error);
      }
    };
    fetchDiscounts();
  }, [id_admin]);

  const parsePrice = (priceString) => {
    if (!priceString) return 0;
    return parseInt(priceString.replace(/\D/g, ''), 10);
  };

  // ✅ Xử lý nhấn số trên bàn phím ảo
  const handleKeyPress = (value) => {
    if (discountCode.length >= 8) {
      setDiscountError('Mã giảm giá chỉ có 8 kí tự');
      return;
    }
    setDiscountCode(prev => prev + value);
    if (discountError) setDiscountError('');
  };

  // ✅ Xử lý xóa ký tự
  const handleBackspace = () => {
    if (discountCode.length > 0) {
      setDiscountCode(prev => prev.slice(0, -1));
      if (discountError) setDiscountError('');
    }
  };

  // ✅ Áp dụng mã giảm giá
  const handleApplyDiscount = async () => {
    setDiscountError(''); // Reset lỗi

    if (!discountCode.trim()) {
      setDiscountError('Vui lòng nhập mã giảm giá!');
      return;
    }

    if (discountCode.length !== 8) {
      setDiscountError('Mã giảm giá phải có đúng 8 kí tự!');
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/discounts/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          code: discountCode,
          id_admin,
        })
      });

      const result = await response.json();

      if (result.status === 'success') {
        setDiscountValue(result.value);
        const requiredAfterDiscount = parsePrice(price) - result.value;
        // Nếu giảm giá >= giá tiền -> Chuyển trang luôn
        if (requiredAfterDiscount <= 0) {
          const success = await submitPaymentData(result.value);
          if (success) {
            navigate('/Beframe', { state: { size, cut } });
          }
        }
      } else {
        setDiscountError(result.message || 'Không thể áp dụng mã giảm giá!');
        setDiscountCode('');
        setDiscountValue(0);
      }
    } catch (error) {
      console.error('❌ Lỗi khi áp dụng mã giảm giá:', error);
      setDiscountError('Có lỗi xảy ra khi áp dụng mã giảm giá');
      setDiscountCode('');
      setDiscountValue(0);
    }
  };

  // Gửi dữ liệu thanh toán
  const submitPaymentData = async (discountValueToUse = discountValue) => {
    if (!id || !id_admin) {
      alert('Thiếu thông tin người dùng.');
      return false;
    }

    try {
      const currentDate = new Date().toISOString().split('T')[0];
      const paymentData = {
        price: parsePrice(price),
        id_admin,
        id_client: id,
        cuts: cut,
        date: currentDate,
        discount: discountValueToUse > 0 ? 1 : 0,
        discount_price: discountValueToUse,
        discount_code: discountCode,
      };

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/pays`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(paymentData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Unknown error');
      }

      const result = await response.json();
      console.log('Payment data submitted successfully:', result);

      // Cập nhật count_quantity nếu dùng mã giảm giá
      if (discountCode && discountValueToUse > 0) {
        try {
          const discountResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/discounts/use`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify({ code: discountCode, id_admin })
          });
          const discountResult = await discountResponse.json();
          if (discountResult.status !== 'success') {
            console.warn('Cảnh báo khi cập nhật mã giảm giá:', discountResult.message);
          }
        } catch (discountError) {
          console.error('Lỗi khi cập nhật số lượng sử dụng mã giảm giá:', discountError);
        }
      }

      return true;
    } catch (error) {
      console.error('Error submitting payment data:', error);
      alert(`Lỗi khi lưu dữ liệu thanh toán: ${error.message}`);
      return false;
    }
  };

  const requiredAmount = Math.max(0, parsePrice(price) - discountValue);
  const currentDeposit = depositAmount;

  // Tự động chuyển trang khi đủ tiền
  useEffect(() => {
    if (currentDeposit >= requiredAmount && requiredAmount > 0) {
      console.log("✅ Đã nhận đủ tiền:", currentDeposit);
      submitPaymentData()
        .then(success => {
          if (success) {
            navigate('/Beframe', { state: { size, cut } });
          }
        });
    }
  }, [currentDeposit, requiredAmount, navigate, size, cut, id, id_admin]);

  return (
    <div className="discount-container">
      <div className="voucher-section">
        <label className="voucher-label">Voucher Code</label>
        <div className="voucher-input-wrapper">
          <input
            type="text"
            className="voucher-input"
            placeholder="Nhập mã Giảm giá..."
            value={discountCode}
            onChange={(e) => {
              let value = e.target.value.replace(/\D/g, '').slice(0, 8);
              setDiscountCode(value);
              if (discountError) setDiscountError('');
            }}
            ref={discountInputRef}
          />
          <button className="apply-discount" onClick={handleApplyDiscount}>
            Áp dụng
          </button>
          
        </div>

        {/* 👇 Hiển thị lỗi ngay dưới ô nhập */}
        <p className="discount-error-message">{discountError}</p>

        <div className="payment-info">
          <p className="amount-needed">Số tiền cần nạp vào máy: {price}</p>
          <p className="discount-applied">Giảm giá: {discountValue} VNĐ</p>
          <p className="amount-remaining">
            Số tiền cần nạp sau giảm giá: {requiredAmount} VNĐ
          </p>
        </div>

        <div className="payment-info1">
          <div className="deposit-input-wrapper">
            <p className="amount-paid">Số tiền đã nạp: {depositAmount} VNĐ</p>
            <input
              type="text"
              className="deposit-input"
              value={depositAmount}
              readOnly
              placeholder={requiredAmount > 0 ? requiredAmount : 0}
            />
          </div>
        </div>

        <button className="back-button" onClick={() => navigate(-1)}>
          <i className="fas fa-arrow-left"></i> Quay lại
        </button>
      </div>

      <div className="keypad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(num => (
          <button
            key={num}
            className="key"
            onClick={() => handleKeyPress(num.toString())}
          >
            {num}
          </button>
        ))}
        <button className="key arrow" onClick={handleBackspace}>←</button>
      </div>
      <Chatbot />
    </div>
  );
}

export default Discount;