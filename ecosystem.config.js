// Cấu hình PM2 để chạy NHIỀU process backend trên 1 máy (scale ngang theo số CPU core).
// Xem hướng dẫn đầy đủ + phần load balancer/Redis trong docs/scaling.md.
//
// Cách dùng:
//   npm run build                 # biên dịch backend -> backend/dist (BẮT BUỘC trước khi start)
//   REDIS_URL=redis://127.0.0.1:6379 pm2 start ecosystem.config.js
//   pm2 logs colyseus             # xem log; pm2 stop/delete colyseus để dừng
//
// LƯU Ý QUAN TRỌNG:
// - exec_mode PHẢI là 'fork', KHÔNG dùng 'cluster' (Colyseus không hỗ trợ cluster mode).
// - PM2 tự set NODE_APP_INSTANCE = 0,1,2,... cho từng process; backend/src/index.ts cộng số này vào
//   PORT nên instance 1 nghe :2567, instance 2 nghe :2568, ... (khớp upstream nginx trong docs).
// - Muốn scale ngang thật sự phải set REDIS_URL (presence + driver dùng chung) — thiếu nó thì mỗi
//   process chạy độc lập, matchmaking KHÔNG thấy room của nhau.

const os = require("os");

module.exports = {
  apps: [
    {
      name: "colyseus",
      script: "backend/dist/index.js",
      exec_mode: "fork", // KHÔNG đổi sang 'cluster'
      instances: os.cpus().length, // hoặc đặt số cụ thể, vd 4
      watch: false,
      env: {
        PORT: 2567,
        // Bỏ comment và chỉnh khi deploy thật:
        // REDIS_URL: "redis://127.0.0.1:6379",
        // PUBLIC_ADDRESS: "backend.yourgame.com", // xem docs/scaling.md (nginx định tuyến theo port)
        // CORS_ORIGIN: "https://your-frontend.example",
      },
    },
  ],
};
