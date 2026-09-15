# Hướng dẫn Deploy dự án Bomio (Production)

Tài liệu này hướng dẫn cách cấu hình và triển khai game Bomio lên các dịch vụ hosting/VPS để đảm bảo game chạy ổn định và chịu tải tốt.

---

## 1. Yêu cầu Hệ thống & Môi trường

- **Node.js**: Phiên bản >= 18.x (khuyến nghị Node 20 LTS hoặc mới hơn).
- **RAM**: Tối thiểu 512MB RAM cho 1 room chơi thông thường (Colyseus khá nhẹ, tuy nhiên logic game loop realtime chạy liên tục sẽ tiêu thụ CPU nhiều hơn RAM).
- **Băng thông**: WebSockets cần băng thông ổn định. Tránh cấu hình proxy giới hạn số kết nối đồng thời.

---

## 2. Các biến môi trường (Environment Variables)

### Backend
- `PORT`: Cổng mà game server sẽ listen (mặc định: `2567`). Các PaaS như Render, Fly.io, Heroku sẽ tự động cấp biến này.
- `NODE_ENV`: Set thành `production` để tối ưu hoá Node.js.

### Frontend (Vite)
- `VITE_SERVER_URL`: Địa chỉ WebSocket URL của Backend (ví dụ: `wss://game-backend.yourdomain.com`).
  - **Lưu ý**: Bắt buộc phải sử dụng giao thức bảo mật `wss://` (WebSocket Secure) nếu trang frontend chạy qua HTTPS. Nếu dùng HTTP thường, có thể dùng `ws://`.

---

## 3. Các phương thức Triển khai Backend (Game Server)

### Cách 1: Triển khai trên VPS (Ubuntu/Debian) sử dụng PM2

PM2 giúp quản lý tiến trình Node.js, tự khởi động lại khi server crash hoặc khi hệ thống reboot.

1. **Cài đặt các gói cần thiết & PM2**:
   ```bash
   sudo apt update
   sudo apt install nodejs npm -y
   sudo npm install -g pm2
   ```

2. **Clone source code và cài đặt dependencies**:
   ```bash
   git clone <repo-url> bomio
   cd bomio
   npm install
   ```

3. **Build dự án**:
   ```bash
   npm run build
   ```

4. **Khởi chạy Backend bằng PM2**:
   ```bash
   # Sử dụng script start của workspace backend
   pm2 start npm --name "bomio-backend" -- run start -w backend
   ```

5. **Lưu cấu hình PM2 để tự động chạy khi reset VPS**:
   ```bash
   pm2 save
   pm2 startup
   ```

---

### Cách 2: Triển khai bằng Docker

Tạo một `Dockerfile` ở thư mục gốc của dự án để đóng gói monorepo:

```dockerfile
# Dockerfile ở thư mục gốc
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package*.json ./shared/
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package*.json ./backend/
RUN npm ci --omit=dev

ENV NODE_ENV=production
ENV PORT=2567
EXPOSE 2567

CMD ["npm", "run", "start", "-w", "backend"]
```

---

## 4. Cấu hình Reverse Proxy (Nginx) cho WebSocket

Nếu bạn sử dụng VPS và chạy domain riêng, nên dùng **Nginx** làm reverse proxy đứng trước để quản lý SSL (HTTPS/WSS). Cấu hình Nginx cần bật tính năng forward WebSockets:

```nginx
server {
    listen 80;
    server_name game-backend.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name game-backend.yourdomain.com;

    # Cấu hình chứng chỉ SSL (Certbot Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/game-backend.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/game-backend.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:2567; # Cổng port của backend
        
        # Bắt buộc cho WebSocket
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Forward IP thật của người dùng cho backend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Tăng thời gian timeout tránh ngắt kết nối WebSocket đột ngột (mặc định 60s)
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

---

## 5. Triển khai Frontend

Vì Frontend là ứng dụng Single Page Application (Vite tĩnh), bạn có thể deploy lên bất kỳ nền tảng Hosting tĩnh nào rất nhanh và miễn phí:

1. **Các dịch vụ khuyến nghị**: Cloudflare Pages, Vercel, Netlify.
2. **Cấu hình Build**:
   - Build command: `npm run build`
   - Output directory: `frontend/dist`
   - Biến môi trường lúc build: Thiết lập `VITE_SERVER_URL=wss://game-backend.yourdomain.com` trong cài đặt môi trường của dịch vụ hosting.

## Content-page AdSense (2026-09-15)

- Public pages `/`, `/guide.html`, `/field-guide.html` each have one responsive Display placement after their content.
- Set `VITE_ADSENSE_SLOT_CONTENT` to the actual Display ad unit's `data-ad-slot`, then rebuild the frontend. No slot ID has been supplied yet; production remains inactive until configured.
- `VITE_ADSENSE_CLIENT_ID` can supply the publisher ID; otherwise the loader uses the existing account verification meta generated from ads.txt.
- Vite dev always shows a clearly labelled preview without live ad requests, even with `--mode production`.
- `/play/`, Policy and About do not import the advertising module. Review Auto ads settings in AdSense separately; they are account-controlled.
- Before serving ads where required, configure the appropriate Google-certified consent message/CMP in AdSense Privacy & messaging.
- Site approval is managed by Google; integration does not override a low-value-content rejection. No deployment or review submission was performed by this change.
