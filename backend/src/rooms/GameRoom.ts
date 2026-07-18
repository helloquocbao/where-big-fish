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
import { tryCast, retractCast, updateBiteScheduling, updateReeling, resolveReel, handleBossAction, handleAssistBoss } from "../systems/fishing.js";
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

  /** Safety net for onJoin/onMessage/simulation-interval handlers: Colyseus only wraps these in a
   * try/catch that reports here INSTEAD of letting the exception propagate to the process-wide
   * `uncaughtException` handler (which calls gracefullyShutdown -> process.exit, killing every room
   * on this machine for one bad client message). Without this method defined, none of the wrapping
   * happens at all — see @colyseus/core Room.js's `#registerUncaughtExceptionHandlers`. */
  onUncaughtException(err: Error, methodName: string): void {
    console.error(`[GameRoom ${this.roomId}] uncaught exception in ${methodName}:`, err);
  }

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
      // Send SPECIFICALLY to this client (do not broadcast) — only the player who failed the cast needs to know why.
      if (result === "too_far") {
        client.send("cast_rejected", { type: "cast_rejected", reason: "too_far_from_lake" });
      }
    });

    this.onMessage("retract", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const now = Date.now();
      if (now - player.lastActionMessageAt < MIN_ACTION_MESSAGE_INTERVAL_MS) return;
      player.lastActionMessageAt = now;
      retractCast(player);
    });

    this.onMessage("boss_action", (client, message: ClientMessage & { type: "boss_action" }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (message?.action !== "reel" && message?.action !== "run") return;

      const now = Date.now();
      if (now - player.lastActionMessageAt < MIN_ACTION_MESSAGE_INTERVAL_MS) return;
      player.lastActionMessageAt = now;
      handleBossAction(player, message.action, now, this.state.players, (playerId, event) => this.notifyPlayer(playerId, event));
    });

    this.onMessage("assist_boss", (client, message: ClientMessage & { type: "assist_boss" }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (typeof message?.targetPlayerId !== "string") return;

      const now = Date.now();
      if (now - player.lastActionMessageAt < MIN_ACTION_MESSAGE_INTERVAL_MS) return;
      player.lastActionMessageAt = now;
      handleAssistBoss(player, message.targetPlayerId, this.state.players, (playerId, event) => this.notifyPlayer(playerId, event));
    });

    // Client runs the fishing reel minigame themselves and reports the result back (client-authoritative, reduces server load —
    // Vicent 2026-07-14). Server clamps + rolls + awards points in resolveReel; sends specifically to this client.
    this.onMessage("reel_result", (client, message: ClientMessage & { type: "reel_result" }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (typeof message?.timeInZoneMs !== "number" || !Number.isFinite(message.timeInZoneMs)) return;

      const now = Date.now();
      if (now - player.lastActionMessageAt < MIN_ACTION_MESSAGE_INTERVAL_MS) return;
      player.lastActionMessageAt = now;
      resolveReel(
        player,
        message.timeInZoneMs,
        this.state.players,
        (playerId, event) => this.notifyPlayer(playerId, event),
        (event) => this.broadcast(event.type, event)
      );
    });

    this.setSimulationInterval(() => this.update(), TICK_INTERVAL_MS);
  }

  onJoin(client: Client, options: { name?: string; skinId?: string }): void {
    const player = new PlayerSchema();
    player.id = client.sessionId;
    // options comes straight from the untrusted joinOrCreate payload — must check typeof before calling
    // any string method on it (an array also has .slice() and would pass a truthy check unnoticed, then
    // crash the whole process later when Colyseus tries to string-encode it for broadcast).
    const rawName = typeof options?.name === "string" ? options.name.slice(0, 20).trim() : "";
    player.name = rawName || "Player";
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

  /** Sends an event specifically to the client of the relevant player (do not broadcast to the entire room). fish_bite and
   * catch_result are only relevant to that specific player — other clients ignore events of other players (see
   * frontend/src/main.ts) — so broadcasting to the entire room wastes bandwidth O(number of clients) per event.
   * NPCs (playerId format "npc_...") have no corresponding client -> automatically a no-op. The clients array is small
   * (<= ROOM_MAX_PLAYERS) so linear find here is negligible (only runs when there is a bite/catch, not
   * every tick/every player). */
  private notifyPlayer(playerId: string, event: ServerEvent): void {
    const client = this.clients.find((c) => c.sessionId === playerId);
    client?.send(event.type, event);
  }
}
