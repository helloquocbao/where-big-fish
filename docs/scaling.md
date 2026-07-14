# Scale ngang backend (nhiều process / nhiều máy)

Hướng dẫn chạy backend Colyseus dưới tải cao bằng cách chạy nhiều process. Phần code trong repo đã
sẵn sàng (opt-in qua biến môi trường) — tài liệu này mô tả cách bật + phần hạ tầng cần bạn tự dựng.

> Bối cảnh: game này rooms **độc lập hoàn toàn** (mỗi hồ tự chứa state, leaderboard per-room, không
> có state chia sẻ xuyên room). Nhờ vậy scale ngang rất "sạch": mỗi room sống trọn trên 1 process,
> Redis chỉ lo phần matchmaking/seat-reservation dùng chung. Không phải viết lại logic game.

## Biến môi trường

| Biến | Bắt buộc? | Ý nghĩa |
|---|---|---|
| `REDIS_URL` | Cần khi chạy >1 process | Kết nối Redis dùng chung (presence + driver). VD `redis://127.0.0.1:6379`. **Không set** → chạy single-process in-memory như cũ. |
| `PUBLIC_ADDRESS` | Cần khi chạy sau load balancer | Địa chỉ public riêng của process để client kết nối thẳng sau khi reserve seat. VD `backend.yourgame.com`. |
| `PORT` | Không (mặc định 2567) | Cổng gốc. Mỗi process cộng thêm `NODE_APP_INSTANCE` (PM2 tự set) → 2567, 2568, ... |
| `CORS_ORIGIN` | Nên set ở production | Origin frontend được phép kết nối (phân tách bằng dấu phẩy nếu nhiều). Không set = cho phép mọi origin. |

## 1. Local / dev (không đổi)

Không cần Redis, không cần PM2 — vẫn như trước:

```bash
npm run dev:backend   # single-process tại :2567, log "[single-process]"
```

## 2. Nhiều process trên 1 máy (PM2)

Cần: [Redis](https://redis.io/) đang chạy + [PM2](https://pm2.keymetrics.io/) (`npm i -g pm2`).

```bash
npm run build         # biên dịch backend -> backend/dist (BẮT BUỘC)
# Redis nhanh bằng Docker (tùy chọn):
#   docker run -d --name redis -p 6379:6379 redis:7-alpine
REDIS_URL=redis://127.0.0.1:6379 pm2 start ecosystem.config.js
pm2 logs colyseus     # mỗi instance log 1 cổng: :2567, :2568, ... [redis scale-out]
```

`ecosystem.config.js` (ở gốc repo) chạy `os.cpus().length` process ở `exec_mode: 'fork'`
(**không** dùng `cluster`). PM2 tự set `NODE_APP_INSTANCE` nên mỗi process nghe 1 cổng riêng.

Dừng: `pm2 stop colyseus` / `pm2 delete colyseus`.

## 3. Load balancer (nginx) đứng trước các process

Client phải đi qua 1 entrypoint duy nhất; nginx proxy WebSocket tới các process theo cổng. Mẫu tối
thiểu (thay `backend.yourgame.com` + đường dẫn SSL của bạn):

```nginx
upstream colyseus_servers {
    server 127.0.0.1:2567;
    server 127.0.0.1:2568;
    server 127.0.0.1:2569;
    server 127.0.0.1:2570;
}

server {
    listen 443 ssl;
    server_name backend.yourgame.com;
    ssl_certificate     /path/fullchain.pem;
    ssl_certificate_key /path/privkey.pem;

    # Reserve seat (matchmaking) — LB phân phối tới bất kỳ process nào
    location / {
        proxy_pass http://colyseus_servers/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_buffering off;
    }

    # Kết nối thẳng tới process giữ room theo cổng lấy từ URL (vd /2568/...)
    location ~ "^/(?<PORT>2[0-9]{3})/(.*)" {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_buffering off;
    }
}
```

Khi chạy sau nginx, đặt `PUBLIC_ADDRESS` cho mỗi process (Colyseus nhúng địa chỉ này vào thông tin
seat-reservation để client kết nối đúng process giữ room). Cách phổ biến: dùng `PUBLIC_ADDRESS` kèm
định tuyến theo cổng như block `location ~ "^/(?<PORT>...)"` ở trên.

## 4. Nhiều máy

Như mục 3 nhưng các process nằm trên nhiều host: trỏ `upstream` của LB tới IP:port từng máy, mỗi
process đặt `PUBLIC_ADDRESS` là địa chỉ công khai của chính nó, và **tất cả cùng trỏ về 1 Redis**
(managed như ElastiCache/Upstash, hoặc 1 Redis chung). Redis là điểm dùng chung duy nhất.

## Graceful shutdown

Colyseus tự bắt `SIGTERM`/`SIGINT` và đóng room gọn trước khi thoát (rolling deploy/restart không
cắt kết nối đột ngột). Backend log `[shutdown] draining rooms gracefully...` khi bắt đầu drain.

## Lưu ý / giới hạn hiện tại

- **Chưa test runtime path Redis trong repo này** (máy build không có Redis + không có LB). Đã
  verify: typecheck pass, import Redis package chạy được ở runtime, single-process khởi động OK.
  **Cần test lại mục 2–3 trên môi trường staging có Redis** trước khi lên production.
- **Leaderboard hiện là per-room** — chạy nhiều process thì mỗi room vẫn có bảng riêng (đúng như
  bây giờ, không vỡ gì). Nếu muốn leaderboard **toàn cục xuyên mọi room/process** thì phải lưu
  Redis/DB riêng — đó là việc bổ sung, chưa nằm trong gói này.
- **Bảo mật**: nhớ đặt `CORS_ORIGIN` = domain frontend thật ở production, và đặt Redis trong mạng
  riêng (không phơi ra Internet, có mật khẩu nếu managed).
- **Colyseus Cloud**: nếu không muốn tự dựng Redis/nginx, có thể deploy lên Colyseus Cloud — khi đó
  KHÔNG cần set `REDIS_URL`/`PUBLIC_ADDRESS` (Cloud tự lo), chỉ cần entrypoint hiện tại.
