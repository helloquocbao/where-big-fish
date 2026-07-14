import colyseusPkg from "colyseus";
const { Server, matchMaker } = colyseusPkg;
import wsTransportPkg from "@colyseus/ws-transport";
const { WebSocketTransport } = wsTransportPkg;
import { RedisPresence } from "@colyseus/redis-presence";
import { RedisDriver } from "@colyseus/redis-driver";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { ROOM_MAX_PLAYERS } from "@bomio/shared";
import { GameRoom } from "./rooms/GameRoom.js";

const app = express();
// CORS_ORIGIN (comma-separated if multiple) restricts which frontend origin(s) may connect - audit
// fix chuẩn bị deploy: mặc định vẫn cho phép tất cả origin (giữ nguyên hành vi hiện tại, không phá
// vỡ deploy hiện có) nếu biến này không được set, nhưng cho phép khóa lại khi đã biết domain
// frontend thật. Đặt CORS_ORIGIN=https://your-frontend.example khi deploy production.
const corsOrigin = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim());
app.use(cors(corsOrigin ? { origin: corsOrigin } : undefined));

// audit fix chuẩn bị deploy: `app.use(cors(...))` ở trên KHÔNG áp dụng cho endpoint HTTP
// "/matchmake/*" - Colyseus tự gỡ hết listener "request" gốc trên httpServer và chèn listener
// riêng xử lý matchmake TRƯỚC KHI request tới được Express (xem attachMatchMakingRoutes trong
// @colyseus/core), dùng CORS header cứng "Access-Control-Allow-Origin: <origin bất kỳ>" bất kể
// origin là gì. Đây chính là endpoint client thật sự gọi đầu tiên (joinOrCreate), nên phải khóa
// riêng ở đây thì CORS_ORIGIN mới thực sự có tác dụng, không chỉ khóa được các route Express khác
// (hiện repo này không có route Express nào khác ngoài matchmake).
if (corsOrigin) {
  const allowedOrigins = new Set(corsOrigin);
  matchMaker.controller.getCorsHeaders = (req: { headers?: Record<string, string | string[] | undefined> }) => {
    const origin = req.headers?.["origin"];
    const allowed = typeof origin === "string" && allowedOrigins.has(origin);
    return { "Access-Control-Allow-Origin": allowed ? origin : "" };
  };
}

const httpServer = createServer(app);

// --- Scale-out ngang (opt-in qua env, xem docs/scaling.md) ---
// Khi REDIS_URL được set: dùng Redis presence (IPC pub/sub giữa các process) + Redis driver (danh
// sách room dùng chung) để NHIỀU process/máy cùng matchmake và phân phối room. KHÔNG set: chạy
// single-process in-memory y hệt trước đây — dev local không cần Redis, không đổi hành vi.
const redisUrl = process.env.REDIS_URL;

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
  ...(redisUrl ? { presence: new RedisPresence(redisUrl), driver: new RedisDriver(redisUrl) } : {}),
  // Mỗi process cần 1 địa chỉ public riêng để client (sau khi reserve seat qua LB) kết nối THẲNG
  // tới đúng process đang giữ room. Chỉ cần khi chạy nhiều process sau load balancer (xem
  // docs/scaling.md); single-process bỏ trống là được.
  ...(process.env.PUBLIC_ADDRESS ? { publicAddress: process.env.PUBLIC_ADDRESS } : {}),
});

gameServer.define("game", GameRoom);

// Log khi bắt đầu drain room (Colyseus tự bắt SIGTERM/SIGINT và gracefully shutdown mặc định —
// rolling deploy/restart sẽ để room đóng gọn thay vì cắt kết nối đột ngột).
gameServer.onShutdown(() => {
  console.log("[shutdown] draining rooms gracefully...");
});

// PM2 chạy N process cùng entrypoint, mỗi process nhận NODE_APP_INSTANCE = 0,1,2... → cộng vào PORT
// để mỗi instance nghe 1 cổng riêng (2567, 2568, ...). Single-process thì offset = 0 (giữ 2567).
const basePort = Number(process.env.PORT ?? 2567);
const instanceOffset = Number(process.env.NODE_APP_INSTANCE ?? 0);
const port = basePort + instanceOffset;

httpServer.listen(port, "0.0.0.0", () => {
  const mode = redisUrl ? "redis scale-out" : "single-process";
  console.log(`Where Big Fish backend listening on :${port} (lake capacity: ${ROOM_MAX_PLAYERS}) [${mode}]`);
});
