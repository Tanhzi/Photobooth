import  { useState, useEffect, useRef } from 'react';
import Lottie from 'lottie-react';
import './Chatbot.css';
import { getAuthHeaders } from '../api';

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [aiRobotLottie, setAiRobotLottie] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const listeningTimeoutRef = useRef(null);
  const API_URL = import.meta.env.VITE_API_BASE_URL;

  const quickReplies = [
    { icon: '👋', text: 'Xin chào', message: 'Xin chào! Bạn có thể giới thiệu về SweetLens không?' },
    { icon: '📍', text: 'Địa chỉ', message: 'Địa chỉ của SweetLens ở đâu?' },
    // { icon: '📸', text: 'Chụp ảnh', message: 'Tôi muốn biết về dịch vụ chụp ảnh' },
    { icon: '🎉', text: 'Sự kiện', message: 'Bên mình hiện có sự kiện gì không?' },
    { icon: '💰', text: 'Bảng giá', message: 'Bảng giá dịch vụ của SweetLens' },
    { icon: '🕐', text: 'Giờ mở cửa', message: 'SweetLens mở cửa lúc mấy giờ?' },
    { icon: '📞', text: 'Liên hệ', message: 'Liên hệ với SweetLens bằng cách nào?' },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const { webkitSpeechRecognition } = window;
    if (!webkitSpeechRecognition) return;

    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'vi-VN';

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputMessage(transcript);
      setIsListening(false);

      if (listeningTimeoutRef.current) {
        clearTimeout(listeningTimeoutRef.current);
        listeningTimeoutRef.current = null;
      }
    };

    recognition.onerror = (event) => {
      console.error('Lỗi nhận diện giọng nói:', event.error);
      setIsListening(false);
      setInputMessage('');

      if (listeningTimeoutRef.current) {
        clearTimeout(listeningTimeoutRef.current);
        listeningTimeoutRef.current = null;
      }

      if (event.error !== 'no-speech') {
        alert('❌ Không thể nhận diện giọng nói.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (listeningTimeoutRef.current) {
        clearTimeout(listeningTimeoutRef.current);
        listeningTimeoutRef.current = null;
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      if (listeningTimeoutRef.current) {
        clearTimeout(listeningTimeoutRef.current);
      }
    };
  }, []);

  const handleSendMessage = async (messageText = inputMessage) => {
    if (!messageText.trim() || isLoading) return;

    const userMsg = { role: 'user', content: messageText };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Lấy id_admin từ phiên đăng nhập để backend lấy dữ liệu chatbot của quán
      let idAdmin = null;
      try {
        const savedAuth = localStorage.getItem('auth');
        if (savedAuth) idAdmin = JSON.parse(savedAuth)?.id_admin ?? null;
      } catch { /* bo qua */ }

      // Lịch sử hội thoại gần nhất (trước tin nhắn hiện tại)
      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ question: messageText, id_admin: idAdmin, history }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Máy chủ không phản hồi đúng định dạng JSON.');
      }

      // ✅ Backend trả về { "answer": "...", "time": ... }
      if (response.ok && data.answer !== undefined) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
      } else {
        throw new Error(data.error || 'AI hiện không trả lời được.');
      }
    } catch (err) {
      console.error('Lỗi khi gọi chatbot:', err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '❌ Không thể kết nối trợ lý AI. Vui lòng thử lại sau!' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickReply = (message) => {
    handleSendMessage(message);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Tính năng này chỉ hoạt động trên Chrome hoặc Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      recognitionRef.current.start();

      listeningTimeoutRef.current = setTimeout(() => {
        listeningTimeoutRef.current = null;
        setIsListening(false);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Bạn có thể nói lại được không, mình không nghe rõ.' }
        ]);
      }, 5000);
    }
  };

  const handleClear = () => {
    setInputMessage('');
    inputRef.current?.focus();
  };

  const handleClose = () => {
    setIsOpen(false);
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInputMessage('');

      if (listeningTimeoutRef.current) {
        clearTimeout(listeningTimeoutRef.current);
        listeningTimeoutRef.current = null;
      }
    }
  };

  const handleOpen = () => setIsOpen(true);

  useEffect(() => {
    fetch('/lotties/AIRobot.json')
      .then((res) => (res.ok ? res.json() : null))
      .then(setAiRobotLottie)
      .catch((err) => console.error('Lỗi tải AIRobot.json:', err));
  }, []);

  return (
    <>
      <button
        className="floating-chat-btn"
        onClick={handleOpen}
        aria-label="Hỗ trợ AI"
      >
        {aiRobotLottie ? (
          <Lottie
            animationData={aiRobotLottie}
            loop
            autoplay
            style={{ width: '200px', height: '200px' }}
          />
        ) : (
          '💬'
        )}
      </button>

      {isOpen && (
        <div className="chat-overlay" onClick={handleClose}>
          <div className="chat-container" onClick={(e) => e.stopPropagation()}>
            <div className="chat-header">
              {aiRobotLottie ? (
                <Lottie
                  animationData={aiRobotLottie}
                  loop
                  autoplay
                  style={{ width: '60px', height: '60px', verticalAlign: 'middle', marginRight: '8px' }}
                />
              ) : (
                '💬'
              )}
              <span className="h3">Trợ lý SweetLens AI</span>
              <button className="chat-close" onClick={handleClose}>×</button>
            </div>
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="chat-welcome">
                  Xin chào! Bạn có thể <strong>nói</strong> hoặc <strong>chọn nhanh</strong> các lựa chọn bên dưới nhé! 😊
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} className={`message ${msg.role}`}>
                    {msg.content}
                  </div>
                ))
              )}
              {isLoading && (
                <div className="message assistant">
                  <span className="typing-indicator">Đang suy nghĩ...</span>
                </div>
              )}

              {!isLoading && !inputMessage.trim() && (
                <div className="quick-replies-container">
                  {quickReplies.map((reply, idx) => (
                    <button
                      key={idx}
                      className="quick-reply-btn"
                      onClick={() => handleQuickReply(reply.message)}
                    >
                      <span className="quick-reply-icon">{reply.icon}</span>
                      <span className="quick-reply-text">{reply.text}</span>
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
            <div className="chat-input-area">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={isListening ? '... đang nghe ...' : 'Nói câu hỏi...'}
                disabled={isLoading || isListening}
                className="chat-input"
              />
              <button
                onClick={handleClear}
                disabled={isLoading || !inputMessage || isListening}
                className="chat-clear-btn"
                title="Xoá nội dung"
              >
                ✕
              </button>
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isLoading || isListening}
                className="chat-send-btn"
                title="Gửi tin nhắn"
              >
                ↵
              </button>
            </div>

            <div className="voice-control-area">
              <button
                className={`voice-toggle-btn ${isListening ? 'active' : ''}`}
                onClick={toggleListening}
                disabled={isLoading}
                title={isListening ? 'Nhấn để dừng nói' : 'Nhấn để nói (tiếng Việt)'}
              >
                {isListening ? '🛑 Dừng' : '🎤 Nói'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;