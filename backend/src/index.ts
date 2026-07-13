import colyseusPkg from "colyseus";
const { Server, matchMaker } = colyseusPkg;
import wsTransportPkg from "@colyseus/ws-transport";
const { WebSocketTransport } = wsTransportPkg;
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

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("game", GameRoom);

const port = Number(process.env.PORT ?? 2567);
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Where I Go Fish backend listening on :${port} (lake capacity: ${ROOM_MAX_PLAYERS})`);
});
