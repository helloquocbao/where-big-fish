import colyseusPkg from "colyseus";
import type { Client } from "colyseus";
const { Room } = colyseusPkg;

import {
  ROOM_MAX_PLAYERS,
  SERVER_TICK_RATE,
  MIN_MOVE_MESSAGE_INTERVAL_MS,
  MIN_ACTION_MESSAGE_INTERVAL_MS,
  getSkinDefinition,
} from "@bomio/shared";
import type { ClientMessage, ServerEvent } from "@bomio/shared";
import { RoomState, PlayerSchema } from "../schema/State.js";
import { stepPlayerMovement } from "../systems/movement.js";
import { tryCast, updateBiteScheduling, updateReeling, resolveReel } from "../systems/fishing.js";
import { recomputeLeaderboard } from "../systems/leaderboard.js";
import { randomSpawnPoint } from "../systems/utils.js";
import { rebalanceNpcFishers, updateNpcFishers } from "../systems/npcFishers.js";

const TICK_INTERVAL_MS = 1000 / SERVER_TICK_RATE;
const LEADERBOARD_INTERVAL_MS = 1000;
const NPC_REBALANCE_INTERVAL_MS = 1000;

export class GameRoom extends Room<RoomState> {
  maxClients = ROOM_MAX_PLAYERS;

  private lastLeaderboardUpdate = 0;
  private lastNpcRebalance = 0;
  private lastNpcUpdate = 0;

  onCreate(): void {
    this.setState(new RoomState());
    rebalanceNpcFishers(this.state.players); // fill the lake with NPC fishers before anyone joins

    this.onMessage("move", (client, message: ClientMessage & { type: "move" }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (typeof message?.angle !== "number" || !Number.isFinite(message.angle)) return;
      if (typeof message?.moving !== "boolean") return;

      const now = Date.now();
      if (now - player.lastMoveMessageAt < MIN_MOVE_MESSAGE_INTERVAL_MS) return;
      player.lastMoveMessageAt = now;

      player.desiredAngle = message.angle;
      player.desiredMoving = message.moving;
    });

    this.onMessage("cast", (client, message: ClientMessage & { type: "cast" }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (typeof message?.angle !== "number" || !Number.isFinite(message.angle)) return;
      if (typeof message?.power !== "number" || !Number.isFinite(message.power)) return;

      const now = Date.now();
      if (now - player.lastActionMessageAt < MIN_ACTION_MESSAGE_INTERVAL_MS) return;
      player.lastActionMessageAt = now;
      const result = tryCast(player, message.angle, message.power, now);
      // Gửi RIÊNG cho client này (không broadcast) — chỉ người vừa thả cần hụt cần biết vì sao.
      if (result === "too_far") {
        client.send("cast_rejected", { type: "cast_rejected", reason: "too_far_from_lake" });
      }
    });

    // Client tự chạy minigame kéo cá rồi báo kết quả về (client-authoritative, giảm tải server —
    // Vicent 2026-07-14). Server clamp + roll + cộng điểm trong resolveReel; gửi riêng cho client này.
    this.onMessage("reel_result", (client, message: ClientMessage & { type: "reel_result" }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (typeof message?.timeInZoneMs !== "number") return;
      resolveReel(player, message.timeInZoneMs, (playerId, event) => this.notifyPlayer(playerId, event));
    });

    this.setSimulationInterval(() => this.update(), TICK_INTERVAL_MS);
  }

  onJoin(client: Client, options: { name?: string; skinId?: string }): void {
    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.name = (options?.name ?? "Player").slice(0, 20) || "Player";
    player.skinId = getSkinDefinition(options?.skinId).id;
    const spawn = randomSpawnPoint();
    player.x = spawn.x;
    player.y = spawn.y;
    player.angle = 0;

    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
  }

  private update(): void {
    // A single runtime error in any one system shouldn't kill the room's simulation loop for
    // everyone in it — catch here means a bug in one tick logs and gets skipped instead.
    try {
      this.tick();
    } catch (err) {
      console.error(`[GameRoom ${this.roomId}] error during update tick:`, err);
    }
  }

  private tick(): void {
    const now = Date.now();
    const deltaSeconds = TICK_INTERVAL_MS / 1000;

    if (now - this.lastNpcUpdate >= 200) {
      this.lastNpcUpdate = now;
      updateNpcFishers(this.state.players, now);
    }

    for (const [, player] of this.state.players) {
      stepPlayerMovement(player, deltaSeconds);
    }

    const notify = (playerId: string, event: ServerEvent) => this.notifyPlayer(playerId, event);
    updateBiteScheduling({ players: this.state.players, now, deltaSeconds, notify });
    updateReeling({ players: this.state.players, now, deltaSeconds, notify });

    if (now - this.lastLeaderboardUpdate >= LEADERBOARD_INTERVAL_MS) {
      this.lastLeaderboardUpdate = now;
      recomputeLeaderboard(this.state.players, this.state.leaderboard);
    }

    if (now - this.lastNpcRebalance >= NPC_REBALANCE_INTERVAL_MS) {
      this.lastNpcRebalance = now;
      rebalanceNpcFishers(this.state.players);
    }
  }

  /** Gửi 1 event tới ĐÚNG client của người chơi liên quan (không broadcast cả room). fish_bite và
   * catch_result chỉ có ý nghĩa với chính người chơi đó — client bỏ qua event của người khác (xem
   * frontend/src/main.ts) — nên broadcast toàn room là lãng phí băng thông O(số client) mỗi event.
   * NPC (playerId dạng "npc_...") không có client tương ứng → tự động là no-op. clients array nhỏ
   * (<= ROOM_MAX_PLAYERS) nên find tuyến tính ở đây không đáng kể (chỉ chạy khi có bite/catch, không
   * phải mỗi tick/mỗi người). */
  private notifyPlayer(playerId: string, event: ServerEvent): void {
    const client = this.clients.find((c) => c.sessionId === playerId);
    client?.send(event.type, event);
  }
}
