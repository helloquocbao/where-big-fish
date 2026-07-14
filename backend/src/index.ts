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
// fix preparation for deployment: by default, still allow all origins (preserving current behavior, not breaking
// existing deployments) if this variable is not set, but allow restricting it when the real frontend
// domain is known. Set CORS_ORIGIN=https://your-frontend.example when deploying to production.
const corsOrigin = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim());
app.use(cors(corsOrigin ? { origin: corsOrigin } : undefined));

// audit fix preparation for deployment: `app.use(cors(...))` above does NOT apply to the HTTP endpoint
// "/matchmake/*" - Colyseus itself removes all original "request" listeners on httpServer and inserts a
// custom listener to handle matchmaking BEFORE the request reaches Express (see attachMatchMakingRoutes in
// @colyseus/core), using a hardcoded CORS header "Access-Control-Allow-Origin: <any origin>" regardless of
// what the origin is. This is the endpoint that clients actually call first (joinOrCreate), so we must restrict
// it here specifically for CORS_ORIGIN to actually take effect, not just restricting other Express routes
// (currently, this repo has no other Express routes besides matchmake).
if (corsOrigin) {
  const allowedOrigins = new Set(corsOrigin);
  matchMaker.controller.getCorsHeaders = (req: { headers?: Record<string, string | string[] | undefined> }) => {
    const origin = req.headers?.["origin"];
    const allowed = typeof origin === "string" && allowedOrigins.has(origin);
    return { "Access-Control-Allow-Origin": allowed ? origin : "" };
  };
}

const httpServer = createServer(app);

// --- Horizontal scale-out (opt-in via env, see docs/scaling.md) ---
// When REDIS_URL is set: use Redis presence (IPC pub/sub between processes) + Redis driver (shared
// room list) so MULTIPLE processes/machines can matchmake and distribute rooms. NOT set: run
// single-process in-memory exactly as before — local dev does not need Redis, no behavioral change.
const redisUrl = process.env.REDIS_URL;

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
  ...(redisUrl ? { presence: new RedisPresence(redisUrl), driver: new RedisDriver(redisUrl) } : {}),
  // Each process needs a unique public address so the client (after reserving a seat via LB) connects DIRECTLY
  // to the correct process holding the room. Only needed when running multiple processes behind a load balancer (see
  // docs/scaling.md); single-process can leave this empty.
  ...(process.env.PUBLIC_ADDRESS ? { publicAddress: process.env.PUBLIC_ADDRESS } : {}),
});

gameServer.define("game", GameRoom);

// Log when starting to drain rooms (Colyseus automatically catches SIGTERM/SIGINT and gracefully shuts down by default —
// rolling deploy/restart will allow rooms to close cleanly instead of cutting connections abruptly).
gameServer.onShutdown(() => {
  console.log("[shutdown] draining rooms gracefully...");
});

// PM2 runs N processes with the same entrypoint, each process receives NODE_APP_INSTANCE = 0,1,2... -> add to PORT
// so each instance listens on a unique port (2567, 2568, ...). Single-process has offset = 0 (keep 2567).
const basePort = Number(process.env.PORT ?? 2567);
const instanceOffset = Number(process.env.NODE_APP_INSTANCE ?? 0);
const port = basePort + instanceOffset;

httpServer.listen(port, "0.0.0.0", () => {
  const mode = redisUrl ? "redis scale-out" : "single-process";
  console.log(`Where Big Fish backend listening on :${port} (lake capacity: ${ROOM_MAX_PLAYERS}) [${mode}]`);
});
