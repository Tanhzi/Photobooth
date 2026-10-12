// src/admin/Page/Setting2/Setting2.jsx
import  { useEffect, useState, useRef } from 'react';
import Navbar from '../../components/Navbar';
import './FrameAD.css';
import { apiGet, apiDelete, invalidateCache } from '../../api';

const FrameAD = () => {
  const getAuth = () => {
      const saved = localStorage.getItem('auth');
      return saved ? JSON.parse(saved) : null;
  };
  const [auth, ] = useState(getAuth());
  const {id_admin, username: adminName } = auth || {};
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [frames, setFrames] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCut, setFilterCut] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFrames, setTotalFrames] = useState(0);
  // XÓA HÀNG LOẠT
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAllGlobal, setSelectAllGlobal] = useState(false);
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  // Form states cho THÊM NHIỀU KHUNG
  const [frameForms, setFrameForms] = useState([
    { id_topic: '', frame: null, type: '', cuts: '', key: Date.now() }
  ]);
  // Form chỉnh sửa
  const [editFormData, setEditFormData] = useState({
    id_topic: '',
    frame: null,
    type: '',
    cuts: ''
  });
  // States cho "Chụp thử"
  const [showCameraTestModal, setShowCameraTestModal] = useState(false);
  const [countdown2, setCountdown2] = useState(5);
  const [photoIndex, setPhotoIndex] = useState(1);
  const [photos, setPhotos] = useState([]);
  const [flash, setFlash] = useState(false);
  const [isMirror, setIsMirror] = useState(false);
  const [initialTime, setInitialTime] = useState(5);
  const [subsequentTime, setSubsequentTime] = useState(8);
  const [isStarted, setIsStarted] = useState(false);
  const [maxPhotos, setMaxPhotos] = useState(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const imageCaptureRef = useRef(null);
  // States cho "Thử nghiệm"
  const [showUploadTestModal, setShowUploadTestModal] = useState(false);
  const [, setTestImage] = useState(null);
  // States chung cho preview kết quả
  const [, setCompositeImage] = useState(null);
  const [finalPreview, setFinalPreview] = useState(null);
  const [showResultPreview, setShowResultPreview] = useState(false);
  const itemsPerPage = 10;
  const filterWrapperRef = useRef(null);

  // === LẤY DANH SÁCH KHUNG ẢNH ===
  const fetchFrames = async (page = 1, search = '', cut = '') => {
    if (!id_admin) return;
    setLoading(true);
    try {
      let url = `/frames?page=${page}&limit=${itemsPerPage}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (cut && cut !== 'all') url += `&cuts=${cut}`;
      const res = await apiGet(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.status === 'success') {
        setFrames(data.data || []);
        setTotalPages(data.total_pages || 1);
        setTotalFrames(data.total || 0);
        setCurrentPage(page);

        // Cập nhật checkbox khi có chọn toàn cục
        if (selectAllGlobal) {
          const currentIds = data.data.map(f => f.id);
          setSelectedIds(prev => [...new Set([...prev, ...currentIds])]);
        }
      } else {
        setFrames([]);
      }
    } catch (err) {
      console.error('Lỗi fetch frames:', err);
      alert('Không tải được khung ảnh!');
      setFrames([]);
    } finally {
      setLoading(false);
    }
  };

  // === LẤY DANH SÁCH SỰ KIỆN ===
  const fetchEvents = async () => {
    if (!id_admin) return;
    try {
      const res = await apiGet('/events');
      if (!res.ok) throw new Error('Không tải được sự kiện');
      const data = await res.json();
      setEvents(data.data || []);
    } catch (err) {
      console.error('Lỗi fetch events:', err);
      setEvents([]);
    }
  };

  useEffect(() => {
    if (id_admin) {
      fetchFrames(1);
      fetchEvents();
    }
  }, [id_admin]);

  useEffect(() => {
    const delay = setTimeout(() => {
      fetchFrames(1, searchTerm, filterCut);
    }, 400);
    return () => clearTimeout(delay);
  }, [searchTerm, filterCut]);

  // Click outside filter
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterWrapperRef.current && !filterWrapperRef.current.contains(e.target)) {
        filterWrapperRef.current.querySelector('.framead-filter-menu')?.classList.remove('show');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      fetchFrames(page, searchTerm, filterCut);
    }
  };

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  // === MODAL THÊM NHIỀU KHUNG ===
  const openAddModal = () => {
    setFrameForms([{ id_topic: '', frame: null, type: '', cuts: '', key: Date.now() }]);
    setShowAddModal(true);
  };

  const addFrameForm = () => {
    setFrameForms(prev => [...prev, {
      id_topic: '', frame: null, type: '', cuts: '', key: Date.now()
    }]);
  };

  const removeFrameForm = (key) => {
    setFrameForms(prev => prev.filter(f => f.key !== key));
  };

  const updateFrameForm = (key, field, value) => {
    setFrameForms(prev => prev.map(f =>
      f.key === key ? { ...f, [field]: value } : f
    ));
  };

  // CẬP NHẬT: Xử lý nhiều file cùng lúc
  const handleFileChangeMultiple = (key, files) => {
    if (!files || files.length === 0) return;

    // Lấy form hiện tại
    const currentForm = frameForms.find(f => f.key === key);
    if (!currentForm) return;

    // Nếu chỉ chọn 1 file, cập nhật form hiện tại
    if (files.length === 1) {
      setFrameForms(prev => prev.map(f =>
        f.key === key ? { ...f, frame: files[0] } : f
      ));
      return;
    }

    // Nếu chọn nhiều file, tạo nhiều form với thuộc tính giống nhau
    const newForms = [];
    
    // File đầu tiên gán vào form hiện tại
    newForms.push({
      ...currentForm,
      frame: files[0]
    });

    // Các file còn lại tạo form mới
    for (let i = 1; i < files.length; i++) {
      newForms.push({
        id_topic: currentForm.id_topic,
        type: currentForm.type,
        cuts: currentForm.cuts,
        frame: files[i],
        key: Date.now() + i
      });
    }

    // Thay thế form hiện tại và thêm các form mới
    setFrameForms(prev => {
      const otherForms = prev.filter(f => f.key !== key);
      return [...otherForms, ...newForms];
    });
  };

  // === MODAL SỬA ===
  const openEditModal = (frame) => {
    setSelectedFrame(frame);
    setEditFormData({
      id_topic: String(frame.id_topic || ''),
      frame: null,
      type: frame.type || '',
      cuts: frame.cuts || ''
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const hasIdTopicChanged = editFormData.id_topic !== '' &&
                              editFormData.id_topic !== String(selectedFrame.id_topic);
    const hasTypeChanged = editFormData.type !== selectedFrame.type;
    const hasCutsChanged = editFormData.cuts !== selectedFrame.cuts;
    const hasFileChanged = editFormData.frame !== null;
    if (!hasIdTopicChanged && !hasTypeChanged && !hasCutsChanged && !hasFileChanged) {
      alert('Bạn chưa thay đổi gì cả!');
      return;
    }
    const formData = new FormData();
    if (hasIdTopicChanged) formData.append('id_topic', editFormData.id_topic);
    if (hasTypeChanged) formData.append('type', editFormData.type);
    if (hasCutsChanged) formData.append('cuts', editFormData.cuts);
    if (hasFileChanged) formData.append('frame', editFormData.frame);
    const authObj = JSON.parse(localStorage.getItem('auth') || '{}');
    const token = authObj.token;
    const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/frames/${selectedFrame.id}`, {
        method: 'POST',
        headers: { ...authHeaders, 'X-HTTP-Method-Override': 'PUT' },
        credentials: 'include',
        body: formData
      });
      const result = await res.json();
      if (res.ok && result.status === 'success') {
        invalidateCache('/frames');
        alert('Cập nhật khung ảnh thành công!');
        closeModal();
        fetchFrames(currentPage, searchTerm, filterCut);
      } else {
        alert(result.message || 'Lỗi khi cập nhật!');
      }
    } catch (err) {
      alert('Lỗi kết nối mạng!');
    }
  };

  const toggleSelectFrame = (frame) => {
    setSelectedFrame(prev => (prev?.id === frame.id ? null : frame));
  };

  // === ĐÓNG MODAL ===
  const closeModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setSelectedFrame(null);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const invalid = frameForms.some(f => !f.id_topic || !f.type || !f.cuts || !f.frame);
    if (invalid) {
      alert('Vui lòng điền đầy đủ thông tin cho tất cả các khung!');
      return;
    }
    const formData = new FormData();
    const authObj = JSON.parse(localStorage.getItem('auth') || '{}');
    const token = authObj.token;
    const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
    frameForms.forEach((form, idx) => {
      formData.append(`frames[${idx}][id_topic]`, form.id_topic);
      formData.append(`frames[${idx}][type]`, form.type);
      formData.append(`frames[${idx}][cuts]`, form.cuts);
      formData.append(`frames[${idx}][frame]`, form.frame);
    });
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/frames`, {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: formData
      });
      const result = await res.json();
      if (res.ok) {
        invalidateCache('/frames');
        alert(`Thêm thành công ${frameForms.length} khung ảnh!`);
        closeModal();
        fetchFrames(currentPage, searchTerm, filterCut);
      } else {
        alert(result.message || 'Lỗi server!');
      }
    } catch (err) {
      alert('Lỗi kết nối mạng!');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa khung ảnh này?\nDữ liệu sẽ mất vĩnh viễn!')) return;
    try {
      const res = await apiDelete(`/frames/${id}`);
      if (res.ok) {
        invalidateCache('/frames');
        alert('Xóa thành công!');
        setSelectedIds(prev => prev.filter(x => x !== id));
        if (selectedFrame?.id === id) {
          setSelectedFrame(null);
        }
        fetchFrames(currentPage, searchTerm, filterCut);
      } else {
        alert('Không thể xóa!');
      }
    } catch (err) {
      alert('Lỗi kết nối!');
    }
  };

  const cutOptions = [
    { value: '3', label: 'Cut 3 - Khổ nhỏ' },
    { value: '41', label: 'Cut 4 - Khổ nhỏ' },
    { value: '42', label: 'Cut 4 - Khổ to' },
    { value: '6', label: 'Cut 6 - Khổ to' }
  ];

  // Helper functions
  const getMaxPhotos = (cutValue) => {
    const cutNum = Number(cutValue);
    if (cutNum === 3) return 3;
    if (cutNum === 41 || cutNum === 42) return 4;
    if (cutNum === 6) return 6;
    return 4;
  };

  const blobToDataURL = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const loadImage = (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  // CHỌN TẤT CẢ TRÊN TẤT CẢ CÁC TRANG
  const toggleSelectAllGlobal = async () => {
    if (selectAllGlobal) {
      setSelectedIds([]);
      setSelectAllGlobal(false);
    } else {
      setLoading(true);
      try {
        let allIds = [];
        for (let page = 1; page <= totalPages; page++) {
          let url = `/frames?page=${page}&limit=1000`;
          if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
          if (filterCut && filterCut !== 'all') url += `&cuts=${filterCut}`;

          const res = await apiGet(url);
          const data = await res.json();
          if (data.status === 'success') {
            allIds = allIds.concat(data.data.map(f => f.id));
          }
        }
        setSelectedIds(allIds);
        setSelectAllGlobal(true);
        alert(`Đã chọn tất cả ${allIds.length} khung ảnh!`);
      } catch (err) {
        alert('Lỗi khi chọn tất cả!');
      } finally {
        setLoading(false);
        fetchFrames(currentPage, searchTerm, filterCut);
      }
    }
  };

  // TOGGLE CHỌN 1 KHUNG
  const toggleSelectId = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // XÓA HÀNG LOẠT
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return alert('Vui lòng chọn ít nhất 1 khung ảnh để xóa!');
    if (!confirm(`Xóa vĩnh viễn ${selectedIds.length} khung ảnh đã chọn?\nDữ liệu sẽ mất vĩnh viễn!`)) return;

    try {
      await Promise.all(selectedIds.map(id => apiDelete(`/frames/${id}`)));
      invalidateCache('/frames');
      alert(`Đã xóa thành công ${selectedIds.length} khung ảnh!`);
      setSelectedIds([]);
      setSelectAllGlobal(false);
      fetchFrames(currentPage, searchTerm, filterCut);
    } catch (err) {
      alert('Lỗi xóa hàng loạt!');
    }
  };

  // KIỂM TRA TRANG HIỆN TẠI ĐÃ CHỌN HẾT CHƯA
  const isCurrentPageFullySelected = frames.length > 0 && frames.every(f => selectedIds.includes(f.id));

  // ===============================================
  // HÀM PHÂN TÍCH KHUNG ẢNH ĐỂ TÌM VỊ TRÍ CÁC Ô TRỐNG
  // ===============================================
  const analyzeFrameSlots = async (frameSrc, cutValue, onProgress) => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        if (onProgress) onProgress('Đang tải khung ảnh...');
        const img = await loadImage(frameSrc);
        
        if (onProgress) onProgress('Đang phân tích vị trí ô ảnh...');
        
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        const isTransparent = (x, y) => {
          const idx = (y * canvas.width + x) * 4;
          return data[idx + 3] < 128;
        };
        
        if (onProgress) onProgress('Đang tìm các ô trống...');
        
        const visited = new Array(canvas.height).fill(null).map(() => 
          new Array(canvas.width).fill(false)
        );
        
        const regions = [];
        
        const floodFill = (startX, startY) => {
          const stack = [[startX, startY]];
          let minX = startX, maxX = startX;
          let minY = startY, maxY = startY;
          let pixelCount = 0;
          
          while (stack.length > 0) {
            const [x, y] = stack.pop();
            
            if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
            if (visited[y][x]) continue;
            if (!isTransparent(x, y)) continue;
            
            visited[y][x] = true;
            pixelCount++;
            
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            
            stack.push([x + 1, y]);
            stack.push([x - 1, y]);
            stack.push([x, y + 1]);
            stack.push([x, y - 1]);
          }
          
          return {
            x: minX,
            y: minY,
            w: maxX - minX + 1,
            h: maxY - minY + 1,
            pixelCount
          };
        };
        
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            if (!visited[y][x] && isTransparent(x, y)) {
              const region = floodFill(x, y);
              
              const minArea = canvas.width * canvas.height * 0.01;
              if (region.pixelCount > minArea) {
                regions.push(region);
              }
            }
          }
        }
        
        if (onProgress) onProgress('Đang sắp xếp vị trí ô ảnh...');
        
        if (cutValue === '3') {
          regions.sort((a, b) => a.x - b.x);
        } else if (cutValue === '41') {
          regions.sort((a, b) => a.y - b.y);
        } else if (cutValue === '42' || cutValue === '6') {
          const threshold = canvas.width * 0.3;
          regions.sort((a, b) => {
            const colDiff = Math.abs(a.x - b.x);
            if (colDiff < threshold) {
              return a.y - b.y;
            } else {
              return a.x - b.x;
            }
          });
        }
        
        console.log('🔍 Đã tìm thấy', regions.length, 'ô trống trong khung:', regions);
        
        resolve(regions);
        
      } catch (error) {
        console.error('Lỗi phân tích khung:', error);
        reject(error);
      }
    });
  };

  // ===============================================
  // HÀM TẠO COMPOSITE IMAGE MỚI
  // ===============================================
  const generateCompositeImage = async (images, cutValue, frameSrc) => {
    try {
      console.log('📊 Đang phân tích khung ảnh...');
      const slots = await analyzeFrameSlots(frameSrc, cutValue, (msg) => {
        setProcessingMessage(msg);
      });
      
      if (slots.length === 0) {
        console.error('❌ Không tìm thấy ô trống nào trong khung!');
        return null;
      }
      
      if (slots.length < images.length) {
        console.warn(`⚠️ Khung chỉ có ${slots.length} ô nhưng có ${images.length} ảnh!`);
      }
      
      setProcessingMessage('Đang chuẩn bị canvas...');
      
      const frameImg = await loadImage(frameSrc);
      const compositeWidth = frameImg.width;
      const compositeHeight = frameImg.height;
      
      const canvas = document.createElement('canvas');
      canvas.width = compositeWidth;
      canvas.height = compositeHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, compositeWidth, compositeHeight);
      
      const actualSlots = slots.slice(0, images.length);
      
      for (let i = 0; i < images.length; i++) {
        setProcessingMessage(`Đang ghép ảnh ${i + 1}/${images.length}...`);
        
        const slot = actualSlots[i];
        
        console.log(`🖼️ Đang vẽ ảnh ${i + 1}/${images.length} vào vị trí:`, slot);
        
        let photoSrc, shouldFlip;
        if (typeof images[i] === 'string') {
          photoSrc = images[i];
          shouldFlip = false;
        } else {
          photoSrc = images[i].photo;
          shouldFlip = images[i].flip || false;
        }
        
        const img = await loadImage(photoSrc);
        
        const slotRatio = slot.w / slot.h;
        const imgRatio = img.width / img.height;
        
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        
        if (imgRatio > slotRatio) {
          sw = sh * slotRatio;
          sx = (img.width - sw) / 2;
        } else {
          sh = sw / slotRatio;
          sy = (img.height - sh) / 2;
        }
        
        ctx.save();
        
        if (shouldFlip) {
          ctx.translate(slot.x + slot.w, slot.y);
          ctx.scale(-1, 1);
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, slot.w, slot.h);
        } else {
          ctx.drawImage(img, sx, sy, sw, sh, slot.x, slot.y, slot.w, slot.h);
        }
        
        ctx.restore();
      }
      
      setProcessingMessage('Hoàn tất ghép ảnh!');
      console.log('✅ Hoàn thành composite image');
      return canvas.toDataURL('image/png');
      
    } catch (error) {
      console.error('❌ Lỗi tạo composite:', error);
      return null;
    }
  };

  const createFinalPreview = async (compositeSrc, frameSrc, cutValue) => {
    try {
      const baseImg = await loadImage(compositeSrc);
      const frameImg = await loadImage(frameSrc);
      
      let canvasWidth, canvasHeight;
      
      if (cutValue === '3') {
        canvasWidth = 1800;
        canvasHeight = 600;
      } else if (cutValue === '41') {
        canvasWidth = 600;
        canvasHeight = 1800;
      } else if (cutValue === '42' || cutValue === '6') {
        canvasWidth = 1200;
        canvasHeight = 1800;
      } else {
        canvasWidth = baseImg.width;
        canvasHeight = baseImg.height;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      
      ctx.drawImage(baseImg, 0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(frameImg, 0, 0, canvasWidth, canvasHeight);
      
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error("Lỗi tạo preview:", error);
      return null;
    }
  };

  useEffect(() => {
    if (!id_admin) return;
    apiGet(`/camera/basic?id_admin=${id_admin}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data) return;
        setInitialTime(Number(data.time1) || 5);
        setSubsequentTime(Number(data.time2) || 8);
        setIsMirror(Number(data.mirror) === 1);
      })
      .catch((err) => console.error('Lỗi khi lấy cấu hình:', err));
  }, [id_admin]);

  useEffect(() => {
    if (!showCameraTestModal) return;
    let mounted = true;
    const setupCamera = async () => {
      try {
        const constraints = {
          audio: false,
          video: {
            facingMode: 'user',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
        };
        let stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mounted) return;
        streamRef.current = stream;
        try {
          const track = stream.getVideoTracks()[0];
          if (track && 'ImageCapture' in window) {
            imageCaptureRef.current = new window.ImageCapture(track);
          } else {
            imageCaptureRef.current = null;
          }
        } catch (e) {
          imageCaptureRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          const handleLoaded = () => {
            videoRef.current.play().catch(() => {});
          };
          videoRef.current.addEventListener('loadedmetadata', handleLoaded, { once: true });
        }
      } catch (err) {
        console.error('Lỗi khi truy cập camera:', err);
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
  }, [showCameraTestModal]);

  useEffect(() => {
    if (!isStarted || !showCameraTestModal) return;
    if (photoIndex > maxPhotos) {
      setIsProcessing(true);
      setProcessingMessage('Đã chụp xong! Đang chuẩn bị ghép khung...');
      
      setTimeout(async () => {
        console.log('🎬 Bắt đầu ghép ảnh cho "Chụp thử"...');
        setProcessingMessage('Đang phân tích khung ảnh...');
    
    try {
      const composite = await generateCompositeImage(
        photos, 
        selectedFrame.cuts, 
        selectedFrame.frame
      );
      
      if (!composite) {
        alert('Lỗi khi tạo composite image!');
        setShowCameraTestModal(false);
        setIsProcessing(false);
        return;
      }
      
      setCompositeImage(composite);
      setProcessingMessage('Đang ghép khung ảnh...');
      
      const preview = await createFinalPreview(
        composite, 
        selectedFrame.frame, 
        selectedFrame.cuts
      );
      
      setFinalPreview(preview);
      setShowResultPreview(true);
      setShowCameraTestModal(false);
    } catch (error) {
      console.error('Lỗi ghép ảnh:', error);
      alert('Có lỗi xảy ra khi ghép ảnh!');
      setShowCameraTestModal(false);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  }, 100);
  return;
}
const currentTime = photoIndex === 1 ? initialTime : subsequentTime;
setCountdown2(currentTime);
const timer = setTimeout(() => {
  handleTakePhoto();
}, currentTime * 1000);
return () => clearTimeout(timer);}, [photoIndex, isStarted, maxPhotos, initialTime, subsequentTime, photos, selectedFrame]);
useEffect(() => {
if (!isStarted || !showCameraTestModal) return;
if (photoIndex <= maxPhotos) {
const interval = setInterval(() => {
setCountdown2((prev) => (prev > 0 ? prev - 1 : 0));
}, 1000);
return () => clearInterval(interval);
}
}, [isStarted, photoIndex, maxPhotos, showCameraTestModal]);
const handleTakePhoto = async () => {
if (!streamRef.current || !videoRef.current) return;
if (photoIndex > maxPhotos) return;
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
if (!videoWidth || !videoHeight) {
console.error('Không lấy được kích thước video để chụp');
return;
}
const canvas = canvasRef.current;
canvas.width = videoWidth;
canvas.height = videoHeight;
const ctx = canvas.getContext('2d');
ctx.clearRect(0, 0, videoWidth, videoHeight);
ctx.save();
if (isMirror) {
ctx.translate(videoWidth, 0);
ctx.scale(-1, 1);
}
if (imageCaptureRef.current) {
try {
const blob = await imageCaptureRef.current.takePhoto();
const imgDataUrl = await blobToDataURL(blob);
const img = new Image();
await new Promise((resolve) => {
img.onload = resolve;
img.src = imgDataUrl;
});
ctx.drawImage(img, 0, 0, videoWidth, videoHeight);
ctx.restore();
canvas.toBlob(async (blob) => {
if (!blob) return;
const dataUrl = await blobToDataURL(blob);
setPhotos((prev) => [...prev, dataUrl]);
setPhotoIndex((prev) => prev + 1);
setFlash(true);
setTimeout(() => setFlash(false), 200);
}, 'image/jpeg', 0.92);
return;
} catch (err) {
console.warn('ImageCapture lỗi, fallback canvas:', err);
}
}
ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
ctx.restore();
canvas.toBlob(async (blob) => {
if (!blob) return;
const dataUrl = await blobToDataURL(blob);
setPhotos((prev) => [...prev, dataUrl]);
setPhotoIndex((prev) => prev + 1);
setFlash(true);
setTimeout(() => setFlash(false), 200);
}, 'image/jpeg', 0.92);
};
const handleScreenClick = () => {
if (!isStarted) setIsStarted(true);
};
const getCurrentPhotoDisplay = () => {
if (photoIndex <= maxPhotos) return `${photoIndex}/${maxPhotos}`;
return 'Hoàn thành!';
};
const openCameraTest = () => {
if (selectedFrame) {
setPhotos([]);
setPhotoIndex(1);
setIsStarted(false);
setMaxPhotos(getMaxPhotos(selectedFrame.cuts));
setShowCameraTestModal(true);
}
};
const openUploadTest = () => {
if (selectedFrame) {
setTestImage(null);
setShowUploadTestModal(true);
}
};
const handleUploadChange = (e) => {
const file = e.target.files[0];
if (file) {
setIsProcessing(true);
setProcessingMessage('Đang tải ảnh lên...');
const reader = new FileReader();
reader.onloadend = async () => {
    console.log('🧪 Bắt đầu ghép ảnh cho "Thử nghiệm"...');
    
    setProcessingMessage('Tải ảnh lên thành công! Đang chuẩn bị ghép khung...');
    
    try {
      const dataUrl = reader.result;
      setTestImage(dataUrl);
      const cut = selectedFrame.cuts;
      const max = getMaxPhotos(cut);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setProcessingMessage('Đang phân tích khung ảnh...');
      
      const replicated = Array.from({ length: max }, () => dataUrl);
      
      const composite = await generateCompositeImage(
        replicated, 
        cut, 
        selectedFrame.frame
      );
      
      if (!composite) {
        alert('Lỗi khi tạo composite image!');
        setShowUploadTestModal(false);
        setIsProcessing(false);
        return;
      }
      
      setCompositeImage(composite);
      setProcessingMessage('Đang ghép khung ảnh...');
      
      const preview = await createFinalPreview(
        composite, 
        selectedFrame.frame, 
        cut
      );
      
      setFinalPreview(preview);
      setShowResultPreview(true);
      setShowUploadTestModal(false);
    } catch (error) {
      console.error('Lỗi ghép ảnh:', error);
      alert('Có lỗi xảy ra khi ghép ảnh!');
      setShowUploadTestModal(false);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };
  
  reader.onerror = () => {
    alert('Lỗi khi đọc file!');
    setIsProcessing(false);
    setProcessingMessage('');
  };
  
  reader.readAsDataURL(file);
}
};
const closeResultPreview = () => {
setShowResultPreview(false);
setFinalPreview(null);
setCompositeImage(null);
setPhotos([]);
setTestImage(null);
};
  return (
  <div className="framead-root">
<Navbar sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} id={id_admin} username={adminName} />
<div className="framead-scroll-container">
<div className={`framead-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
<div className="framead-header">
<h2 className="framead-title">THIẾT LẬP KHUNG ẢNH</h2>
</div>
<div className="framead-controls">
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button className="btn-pink" onClick={openAddModal}>
            <i className="bi bi-plus-lg"></i> Thêm khung mới
          </button>
          <button 
            className={`btn-pink batch-delete-btn ${selectedIds.length === 0 ? 'disabled' : ''}`} 
            onClick={handleBatchDelete}
          >
            Xóa {selectedIds.length > 0 ? selectedIds.length : 'nhiều khung'}
          </button>
          <button className="btn-pink" onClick={openCameraTest} disabled={!selectedFrame}>
            Chụp thử
          </button>
          <button className="btn-pink" onClick={openUploadTest} disabled={!selectedFrame}>
            Thử nghiệm
          </button>
        </div>

        <div className="searchFilterFrame">
          <div className="framead-search">
            <i className="bi bi-search"></i>
            <input type="text" placeholder="Tìm theo kiểu khung hoặc chủ đề..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          <div className="framead-filter-wrapper" ref={filterWrapperRef}>
            <button className="filter-toggle-btn" onClick={e => e.currentTarget.nextElementSibling.classList.toggle('show')}>
              <i className="bi bi-funnel"></i>
            </button>
            <div className="framead-filter-menu">
              <button className={!filterCut ? 'active' : ''} onClick={() => setFilterCut('')}>Tất cả loại cut</button>
              {cutOptions.map(opt => (
                <button key={opt.value} className={filterCut === opt.value ? 'active' : ''} onClick={() => setFilterCut(opt.value)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="framead-table-wrapper">
        <table className="framead-table">
          <thead>
            <tr>
              <th style={{ width: '50px', textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={selectAllGlobal || isCurrentPageFullySelected} 
                  onChange={toggleSelectAllGlobal} 
                  className="custom-checkbox" 
                  title={selectAllGlobal ? "Bỏ chọn tất cả" : "Chọn tất cả khung ảnh"} 
                />
              </th>
              <th>STT</th>
              <th>KHUNG ẢNH</th>
              <th>CHỦ ĐỀ</th>
              <th>LOẠI CUT</th>
              <th>KIỂU KHUNG</th>
              <th style={{ textAlign: 'center' }}>HÀNH ĐỘNG</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ textAlign: 'center' }}>Đang tải...</td></tr>
            ) : frames.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center' }}>Chưa có khung ảnh nào</td></tr>
            ) : (
              frames.map((frame, index) => (
                <tr 
                  key={frame.id} 
                  className={`
                    ${selectedFrame?.id === frame.id ? 'selected-row' : ''} 
                    ${selectedIds.includes(frame.id) ? 'batch-selected-row' : ''}
                  `}
                >
                  <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(frame.id)} 
                      onChange={() => toggleSelectId(frame.id)} 
                      className="custom-checkbox" 
                    />
                  </td>
                  <td onClick={() => toggleSelectFrame(frame)} style={{ cursor: 'pointer' }}>
                    {(currentPage - 1) * itemsPerPage + index + 1}
                  </td>
                  <td onClick={() => toggleSelectFrame(frame)} style={{ cursor: 'pointer' }}>
                    <img src={frame.frame || '/placeholder.png'} alt="frame" className="frame-thumb" />
                  </td>
                  <td onClick={() => toggleSelectFrame(frame)} style={{ cursor: 'pointer' }}>
                    {frame.event_name || 'Chưa có'}
                  </td>
                  <td onClick={() => toggleSelectFrame(frame)} style={{ cursor: 'pointer' }}>
                    {cutOptions.find(c => c.value === frame.cuts)?.label || frame.cuts}
                  </td>
                  <td onClick={() => toggleSelectFrame(frame)} style={{ cursor: 'pointer' }}>
                    {frame.type}
                  </td>
                  <td className="framead-actions" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEditModal(frame)} className="edit-btn" title="Sửa">
                      <i className="bi bi-pencil"></i>
                    </button>
                    <button onClick={() => handleDelete(frame.id)} className="delete-btn" title="Xóa">
                      <i className="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="framead-pagination">
        <span>
          Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {
            Math.min(currentPage * itemsPerPage, totalFrames)
          } trên {totalFrames} khung
        </span>
        <div className="pagination-buttons">
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>«</button>
          {[...Array(totalPages)].map((_, i) => (
            <button key={i + 1} onClick={() => handlePageChange(i + 1)} className={currentPage === i + 1 ? 'active' : ''}>
              {i + 1}
            </button>
          ))}
          <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>»</button>
        </div>
      </div>
    </div>
  </div>

  {/* MODAL THÊM - CẬP NHẬT HỖ TRỢ NHIỀU FILE */}
  {showAddModal && (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content wide" onClick={e => e.stopPropagation()}>
        <h3>Thêm nhiều khung ảnh mới</h3>
        <form onSubmit={handleAddSubmit}>
          <div className="frames-list">
            {frameForms.map((form, idx) => (
              <div key={form.key} className="frame-form-item">
                <div className="form-header">
                  <span>Khung #{idx + 1}</span>
                  {frameForms.length > 1 && (
                    <button type="button" className="remove-form" onClick={() => removeFrameForm(form.key)}>
                      <i className="bi bi-x"></i>
                    </button>
                  )}
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Chủ đề sự kiện <span style={{color:'red'}}>*</span></label>
                    <select value={form.id_topic} onChange={e => updateFrameForm(form.key, 'id_topic', e.target.value)} required>
                      <option value="">Chọn chủ đề</option>
                      {events.map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Ảnh khung <span style={{color:'red'}}>*</span></label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple
                      onChange={e => handleFileChangeMultiple(form.key, e.target.files)} 
                      required={!form.frame}
                    />
                    {form.frame && <small>📎 {form.frame.name}</small>}
                    {idx === 0 && (
                      <small style={{display: 'block', marginTop: '5px', color: '#666', fontStyle: 'italic'}}>
                        💡 Chọn nhiều file để tự động tạo nhiều khung với cùng thuộc tính
                      </small>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Kiểu khung <span style={{color:'red'}}>*</span></label>
                    <input type="text" value={form.type} onChange={e => updateFrameForm(form.key, 'type', e.target.value)} placeholder="VD: Sinh nhật, Noel..." required />
                  </div>
                  <div className="form-group">
                    <label>Loại cut <span style={{color:'red'}}>*</span></label>
                    <select value={form.cuts} onChange={e => updateFrameForm(form.key, 'cuts', e.target.value)} required>
                      <option value="">Chọn loại cut</option>
                      {cutOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="add-more-btn" onClick={addFrameForm}>
            <i className="bi bi-plus-circle"></i> Thêm khung khác
          </button>
          <div className="modal-buttons">
            <button type="button" onClick={closeModal} className="cancel">Hủy</button>
            <button type="submit" className="submit">
              Thêm tất cả {frameForms.length} khung
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

  {/* MODAL SỬA */}
  {showEditModal && (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>Sửa khung ảnh</h3>
        <form onSubmit={handleEditSubmit}>
          <div className="form-group">
            <label>Chủ đề sự kiện <span style={{color:'red'}}>*</span></label>
            <select value={editFormData.id_topic} onChange={e => setEditFormData(prev => ({ ...prev, id_topic: e.target.value }))} required>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Ảnh khung (Để trống nếu không đổi)</label>
            <input type="file" accept="image/*" onChange={e => e.target.files[0] && setEditFormData(prev => ({ ...prev, frame: e.target.files[0] }))} />
            {editFormData.frame && <small className="file-name">Attachment: {editFormData.frame.name}</small>}
          </div>
          <div className="form-group">
            <label>Kiểu khung <span style={{color:'red'}}>*</span></label>
            <input type="text" value={editFormData.type} onChange={e => setEditFormData(prev => ({ ...prev, type: e.target.value }))} placeholder="VD: Sinh nhật, Noel..." required />
          </div>
          <div className="form-group">
            <label>Phân loại <span style={{color:'red'}}>*</span></label>
            <select value={editFormData.cuts} onChange={e => setEditFormData(prev => ({ ...prev, cuts: e.target.value }))} required>
              {cutOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="modal-buttons">
            <button type="button" onClick={closeModal} className="cancel">Hủy</button>
            <button type="submit" className="submit">Cập nhật</button>
          </div>
        </form>
      </div>
    </div>
  )}

  {/* MODAL CHỤP THỬ */}
  {showCameraTestModal && (
    <div className="camera-test-modal" onClick={handleScreenClick}>
      <h3>Chụp thử cho khung: {selectedFrame.type}</h3>
      <p>Nhấn màn hình để bắt đầu - {getCurrentPhotoDisplay()}</p>
      <div className="live-view-fullscreen">
        <video
          ref={videoRef}
          className="video-stream-fullscreen"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {flash && <div className="flash-overlay-fullscreen" />}
        {isStarted && photoIndex <= maxPhotos && (
          <div className="countdown-center">
            <div className="countdown-number-large">{countdown2}</div>
          </div>
        )}
        {photos.length > 0 && (
          <div className="captured-photos-column">
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
      </div>
    </div>
  )}

  {/* MODAL THỬ NGHIỆM */}
  {showUploadTestModal && (
    <div className="modal-overlay" onClick={() => setShowUploadTestModal(false)}>
      <div className="upload-test-modal" onClick={e => e.stopPropagation()}>
        <h3>Thử nghiệm ghép khung: {selectedFrame.type}</h3>
        <label className="upload-label">
          <i className="bi bi-upload"></i>
          <span>Chọn ảnh mẫu để ghép vào khung<br/>(Ảnh sẽ được replicate vào tất cả slot)</span>
          <input type="file" accept="image/*" onChange={handleUploadChange} />
        </label>
      </div>
    </div>
  )}

  {/* RESULT PREVIEW */}
  {showResultPreview && (
    <div className="result-preview">
      <p>Ảnh hoàn thiện sau khi ghép khung</p>
      {finalPreview ? (
        <img src={finalPreview} alt="Final Result" className="final-result" />
      ) : (
        <p>Đang tạo ảnh...</p>
      )}
      <button className="close-preview" onClick={closeResultPreview}>×</button>
    </div>
  )}

  {/* LOADING OVERLAY */}
  {isProcessing && (
    <div className="processing-overlay">
      <div className="processing-content">
        <div className="processing-spinner"></div>
        <p className={`processing-message ${
          processingMessage.includes('thành công') || processingMessage.includes('Tải ảnh lên thành công') 
            ? 'success' 
            : ''
        }`}>
          {processingMessage}
        </p>
      </div>
    </div>
  )}
</div>
);
};
export default FrameAD;