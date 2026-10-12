import PropTypes from 'prop-types';
import './FaceSwapSection.css';

const FaceSwapSection = ({ 
  swapTemplates,        // Danh sách templates từ API
  loadingTemplates,     // Trạng thái đang tải danh sách
  selectedSwapId,       // ID template đang chọn
  filterCategories,     // Danh sách category (unique_names)
  selectedCategory,     // Category đang chọn
  isProcessingSwap,     // Trạng thái đang thực hiện swap (gọi AI)
  onSelectTemplate,     // Hàm xử lý khi chọn ảnh
  onCategoryChange,     // Hàm đổi category
  onResetSwap           // Hàm quay về mặc định
}) => {

  return (
    <div className="faceswap-section mt-4">
      {/* HEADER & FILTER */}
      <div className="faceswap-header">
        <h4 className="mb-3 text-center">Chọn phong cách FaceSwap</h4>
        
        <div className="faceswap-categories">
          <button 
            className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => onCategoryChange('all')}
          >
            Tất cả
          </button>
          {filterCategories.map((cat, index) => (
            <button
              key={index}
              className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => onCategoryChange(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* GRID ẢNH */}
      <div className="faceswap-grid-container">
        {loadingTemplates ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Đang tải...</span>
            </div>
          </div>
        ) : (
          <div className="faceswap-grid">
            {/* Nút Mặc định (Không áp dụng) */}
            <div 
              className={`faceswap-item no-effect ${!selectedSwapId ? 'selected' : ''}`}
              onClick={onResetSwap}
            >
              <div className="no-effect-icon">🚫</div>
              <span>Gốc</span>
            </div>

            {/* Danh sách Templates */}
            {swapTemplates.map(item => (
              <div
                key={item.id}
                className={`faceswap-item ${selectedSwapId === item.id ? 'selected' : ''}`}
                onClick={() => !isProcessingSwap && onSelectTemplate(item)}
              >
                <img src={item.illustration} alt={item.name} loading="lazy" />
                <div className="item-name">{item.name}</div>
                
                {/* Overlay khi đang xử lý swap cho item này hoặc item đã chọn */}
                {selectedSwapId === item.id && isProcessingSwap && (
                  <div className="processing-overlay">
                    <div className="spinner-border spinner-border-sm text-light" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

FaceSwapSection.propTypes = {
  swapTemplates: PropTypes.array,
  loadingTemplates: PropTypes.bool,
  selectedSwapId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  filterCategories: PropTypes.array,
  selectedCategory: PropTypes.string,
  isProcessingSwap: PropTypes.bool,
  onSelectTemplate: PropTypes.func,
  onCategoryChange: PropTypes.func,
  onResetSwap: PropTypes.func
};

FaceSwapSection.defaultProps = {
  swapTemplates: [],
  loadingTemplates: false,
  filterCategories: [],
  selectedCategory: 'all',
  isProcessingSwap: false,
  onSelectTemplate: () => {},
  onCategoryChange: () => {},
  onResetSwap: () => {}
};

export default FaceSwapSection;