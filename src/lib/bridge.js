// Helper kết nối tới local bridge serverr (máy ảnh digiCamControl, máy in, AI...)
// Ưu tiên VITE_BRIDGE_URL (kiosk đặt localhost), fallback VITE_AI_API_URL (ngrok cho admin).
const raw = (import.meta.env.VITE_BRIDGE_URL || import.meta.env.VITE_AI_API_URL || 'http://localhost:5000')
  .replace(/\/+$/, '');

export const bridgeHttpUrl = raw;
export const bridgeWsUrl = raw.replace(/^http/, 'ws');

// Ảnh chụp từ DSLR: build URL theo origin của bridge (không phụ thuộc localhost hardcoded)
export const bridgeAssetUrl = (fileName, legacyUrl) =>
  fileName ? `${raw}/raw-photos/${fileName}` : legacyUrl;
