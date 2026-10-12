# SweetLens — Frontend

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![ESLint](https://img.shields.io/badge/ESLint-9-4B32C3?logo=eslint&logoColor=white)](https://eslint.org/)
[![License](https://img.shields.io/badge/license-proprietary-C0392B.svg)](#giấy-phép)

Giao diện hệ thống **Photo Booth SweetLens** — màn hình kiosk tự phục vụ cho khách hàng và panel quản trị dành cho admin/staff.

> Repo này chỉ chứa **frontend**: [github.com/Tanhzi/Photobooth](https://github.com/Tanhzi/Photobooth).
> Backend API (Laravel) nằm trong repo riêng: [github.com/Tanhzi/dslr-backend](https://github.com/Tanhzi/dslr-backend).

---

## Mục lục

- [Tổng quan](#tổng-quan)
- [Kiến trúc](#kiến-trúc)
- [Tính năng](#tính-năng)
- [Công nghệ](#công-nghệ)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt nhanh](#cài-đặt-nhanh)
- [Cấu hình môi trường](#cấu-hình-môi-trường)
- [Các lệnh phổ biến](#các-lệnh-phổ-biến)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Xác thực & phân quyền](#xác-thực--phân-quyền)
- [Caching phía client](#caching-phía-client)
- [Triển khai (Vercel)](#triển-khai-vercel)
- [Chất lượng mã](#chất-lượng-mã)
- [Ghi chú](#ghi-chú)
- [Giấy phép](#giấy-phép)

---

## Tổng quan

| Thành phần | Mô tả |
|---|---|
| **Kiosk khách hàng** | Luồng cảm ứng 12 bước: đăng nhập → chọn gói → thanh toán → chọn khung → chụp → chọn ảnh → ghép khung → QR → in → đánh giá |
| **Panel quản trị** | 13 trang admin/staff: dashboard doanh thu, sự kiện, khung ảnh, sticker, AI, khuyến mãi, người dùng, doanh thu, cấu hình máy ảnh, giá, QR/đơn hàng, đánh giá, nội dung chatbot |
| **Chatbot AI** | Widget chatbot (văn bản) — trả lời qua backend với dữ liệu admin cấu hình |
| **Phân vai trò** | `role=0` khách (kiosk), `role=1` staff, `role=2` admin |

## Kiến trúc

```
┌─────────────────────────────┐
│   SweetLens Frontend (FE)   │  React 19 + Vite — triển khai Vercel
└──────────┬──────────────────┘
           │ VITE_API_BASE_URL (cookie httpOnly + credentials: 'include')
           ▼
┌─────────────────────────────┐
│  Backend API (repo riêng)   │  Laravel 12 — Render/Supabase
└─────────────────────────────┘

┌─────────────────────────────┐
│  Bridge cục bộ (serverr)    │  Node.js :5000 — chỉ chạy tại booth
│  • digiCamControl (máy ảnh) │
│  • Máy in SELPHY            │
│  • Máy nhận tiền (COM)      │
└─────────────────────────────┘
           ▲
           │ VITE_BRIDGE_URL
      Kiosk (máy chụp tại booth)
```

- FE **không dùng dev proxy** — gọi thẳng `VITE_API_BASE_URL` (backend phải cho CORS origin `http://localhost:5173`).
- Máy admin dùng `VITE_AI_API_URL` (Vercel → ngrok → bridge); máy kiosk đặt `VITE_BRIDGE_URL`.

## Tính năng

### Kiosk khách hàng

| Bước | Trang | Nội dung |
|---|---|---|
| 1 | `Login` | Đăng nhập / đăng ký / quên mật khẩu |
| 2 | `Appclien` | Trang chủ |
| 3 | `ChoosePackage` | Chọn gói (số khung + giá) |
| 4 | `Discount` | Mã giảm giá & thanh toán (máy nhận tiền) |
| 5–6 | `Beframe`, `Guide` | Chọn khung, hướng dẫn chụp |
| 7 | `Photoo` | Chụp ảnh (đếm ngược) |
| 8 | `Selphoto` | Chọn ảnh + hiệu ứng/filter |
| 9 | `Frame` | Ghép khung ảnh |
| 10 | `Qrcode` | Mã QR tải ảnh / nhận qua email |
| 11 | `Print` | In ảnh qua bridge cục bộ |
| 12 | `Feedback` | Đánh giá & phản hồi |

### Panel quản trị (13 trang)

| Nhóm | Tính năng |
|---|---|
| `App` | Dashboard: đếm người dùng, thu nhập, biểu đồ ApexCharts |
| `Event` | CRUD sự kiện, ghi chú, upload logo & ảnh nền |
| `FrameAD` | CRUD khung ảnh, thử camera trực tiếp |
| `Sticker` | Upload & quản lý sticker |
| `AiTopic` | Quản lý AI topic, tạo ảnh AI (gọi bridge `:5000`) |
| `Promotion` | CRUD mã giảm giá, xóa hàng loạt |
| `AccountUser` | CRUD người dùng, gán sự kiện |
| `Revenue` | Báo cáo doanh thu theo khoảng ngày/tháng/quý/năm |
| `Camera` | Thời gian chụp, bộ đếm giờ, cài đặt gương |
| `Pricecut` | Cấu hình giá theo khổ in |
| `ManageQR` | Quản lý QR & đơn hàng |
| `Rating` | Quản lý đánh giá khách hàng |
| `ContentChat` | Nội dung dữ liệu chatbot |

## Công nghệ

| Công nghệ | Phiên bản | Vai trò |
|---|---|---|
| React | ^19.0 | Framework giao diện |
| Vite | ^6.1 | Build tool & dev server |
| react-router-dom | ^7.1 | Routing (`createHashRouter`) |
| @tanstack/react-query | ^5.90 | Server state & cache |
| Bootstrap | ^5.3.3 | UI responsive (tải qua CDN) |
| ApexCharts | ^5.3 | Biểu đồ thống kê |
| Lottie React | ^2.4 | Animation |
| react-icons | ^5.5 | Icons |
| gifshot / qrcode | ^0.4 / ^1.5 | Tạo GIF & QR trong trang QR |
| ESLint | ^9.19 | Kiểm tra mã (flat config) |

> **Lưu ý deps chưa dùng:** `firebase`, `sharp`, `simple-keyboard`, `qrcode.react`, `react-apexcharts`, `bootstrap` (package — UI tải Bootstrap qua CDN trong `index.html`) hiện chưa được import trong `src/` — có thể gỡ bằng `npm uninstall` nếu muốn giảm cài đặt.

## Yêu cầu hệ thống

- Node.js >= 18 và npm
- Backend API SweetLens đang chạy (mặc định `http://localhost:8000`)
- *(Tùy chọn)* Bridge `serverr` tại `:5000` nếu test chụp ảnh/in ấn cục bộ

## Cài đặt nhanh

```bash
git clone https://github.com/Tanhzi/Photobooth.git sweetlens
cd sweetlens

cp .env.example .env      # rồi chỉnh URL nếu cần
npm install
npm run dev               # http://localhost:5173
```

## Cấu hình môi trường

Tạo file `.env` từ `.env.example`:

| Biến | Mô tả | Giá trị |
|---|---|---|
| `VITE_API_BASE_URL` | URL backend kèm tiền tố `/api` | Dev: `http://localhost:8000/api` · Prod: `https://dslr-api.onrender.com/api` |
| `VITE_AI_API_URL` | Bridge cho admin AI (Vercel → ngrok) | `http://localhost:5000` hoặc URL ngrok |
| `VITE_BRIDGE_URL` | Bridge cho kiosk; bỏ trống sẽ fallback `VITE_AI_API_URL` | — |

> `.env` bị gitignore — chỉ commit `.env.example` (không chứa secret).
> **Không** đặt `/api` (relative) cho production: FE gọi **trực tiếp** Render vì upload ảnh + GIF base64 1 request có thể vượt 4.5MB — giới hạn body của Vercel (rewrite/proxy sẽ trả 413).

## Các lệnh phổ biến

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Dev server + HMR tại `:5173` |
| `npm run build` | Build production → `dist/` |
| `npm run preview` | Xem bản build `dist/` cục bộ |
| `npm run lint` | Kiểm tra mã (ESLint) |
| `npm run lint:fix` | Tự sửa lỗi auto-fix được |

## Cấu trúc thư mục

```
sweetlens/
├── index.html              # Entry HTML (Bootstrap/FontAwesome CDN)
├── vite.config.js
├── eslint.config.js        # ESLint flat config
├── .env.example
└── src/
    ├── main.jsx            # Entry + router (28 route) + QueryClient
    ├── App.jsx             # Trang đăng nhập
    ├── api.js              # HTTP client (JWT + in-memory cache)
    ├── admin/              # 13 trang quản trị
    ├── pages/              # Luồng kiosk khách hàng
    ├── components/         # Navbar, Chatbot, ChatBotWidget, RootLayout...
    ├── contexts/           # DataCacheContext, CountdownContext
    └── layouts/            # AdminLayout (guard admin/staff)
```

## Xác thực & phân quyền

- JWT nằm trong **cookie httpOnly** do backend set khi đăng nhập — **không lưu trong `localStorage`** (chống XSS đọc token); mọi `fetch` đều gửi `credentials: 'include'`.
- `localStorage.auth` chỉ chứa thông tin người dùng (`id`, `username`, `role`, `id_admin`...) — không có token.
- **Tự gia hạn:** request gặp `401` → `api.js` gọi `POST /api/refresh` (cookie sliding, grace 7 ngày) rồi thử lại 1 lần; thất bại → đăng xuất về `/`.
- Phân quyền: **admin (2) → staff (1) → khách (0)** — `AdminLayout` chặn route quản trị theo role; backend cũng kiểm tra bằng middleware `role`.
- Backend vẫn nhận header `Authorization: Bearer` (client không phải trình duyệt / phiên cũ).

## Caching phía client

- **In-memory cache** cho request GET (TTL 5 phút, cấu hình theo request).
- `invalidateCache(pattern)` tự gọi sau mọi mutation (POST/PUT/DELETE) trong component admin.
- Cache hit trả về object `Response` giả lập → `res.json()`, `res.ok` hoạt động bình thường.

## Triển khai (Vercel)

1. Import repo → Framework **Vite** (build `npm run build`, output `dist`).
2. Cấu hình Environment Variables:
   - `VITE_API_BASE_URL` = `https://dslr-api.onrender.com/api` (**gọi trực tiếp**, xem chú ý bên dưới)
   - `VITE_AI_API_URL` = URL ngrok của bridge (nếu dùng admin AI trên web)
3. HashRouter (`/#/path`) nên **không cần** cấu hình rewrite rule trên hosting tĩnh.

### Checklist kết nối FE ↔ BE an toàn (cookie JWT)

FE (Vercel) gọi thẳng BE (Render) — **cross-site**:

| Việc | Trên Render (BE env) |
|---|---|
| Whitelist origin FE | `CORS_ORIGINS=https://<fe>.vercel.app,http://localhost:5173` |
| Cookie hoạt động cross-site | `JWT_COOKIE_SAMESITE=None` (attr `Secure` tự thêm — HTTPS bắt buộc, Render đã có) |
| TTL token | `JWT_TTL=60` (phút), `JWT_REFRESH_GRACE=10080` (7 ngày) |

> **Không dùng Vercel rewrites** (`/api/:path*` → backend) cho project này:
> `POST /api/media` gửi toàn bộ ảnh + GIF base64 trong **1 request** (vài MB) —
> vượt giới hạn body 4.5MB của Vercel → 413. Gọi trực tiếp Render (đã set
> upload 64M/128M) là chắc chắn nhất.
>
> Dev local không cần gì thêm: `localhost:5173` → `localhost:8000` là
> cross-origin (cần CORS — mặc định đã có) nhưng **cùng site** → cookie `lax` hoạt động.

## Chất lượng mã

- `npm run lint` — **0 error** (73 warning `react-hooks/exhaustive-deps` giữ có chủ đích để không đổi hành vi).
- Dòng code chết (file copy, biến không dùng) đã dọn; file dead code được giữ lại theo yêu cầu.

## Ghi chú

- **Chatbot:** gọi `POST /api/chat` của backend — backend tự nạp dữ liệu `content_chat` (theo `id_admin`, cache 10 phút) rồi gọi OpenRouter (model free, có fallback).
- **Máy ảnh/máy in:** kiosk giao tiếp qua bridge cục bộ `serverr` (`VITE_BRIDGE_URL`); không cài bridge thì chỉ mất chức năng chụp/in tại booth.
- **Trang `FrameAD`:** thử khung với camera trực tiếp (cần cấp quyền webcam).
- **Kiosk:** thiết kế cho màn hình cảm ứng dọc.

## Giấy phép

Dự án phát triển cho mục đích thương mại — **SweetLens**. Mọi quyền được bảo lưu.
