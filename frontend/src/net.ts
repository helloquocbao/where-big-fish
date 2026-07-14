/**
 * Colyseus connection wrapper. Keeps the rest of the app decoupled from the
 * colyseus.js API surface and from whether a server is actually reachable yet
 * (the backend may not be finished/running — callers get a rejected promise
 * with a readable reason instead of an uncaught exception).
 */

// Type-only import — erased at compile time, so this alone does NOT pull colyseus.js's actual code
// into the bundle. The runtime `Client` class is loaded lazily inside `connect()` via dynamic
// `import()` instead (see below), so its ~code-eval cost is deferred until the player actually
// presses Play instead of sitting on the initial connect-screen's critical path.
import type { Client, Room } from "colyseus.js";
import type { ClientMessage, RoomSnapshot, ServerEvent } from "@bomio/shared";
import { ROOM_NAME, SERVER_URL } from "./config.ts";
import { readSnapshot } from "./state.ts";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export interface NetEvents {
  onStatusChange?: (status: ConnectionStatus, detail?: string) => void;
  /** Fired for every discrete server event (fish_bite, catch_result) — see @bomio/shared's
   * ServerEvent. State sync alone can't carry "you just caught a legendary fish" — these events
   * are what the UI hooks into for toasts/sounds. */
  onGameEvent?: (event: ServerEvent) => void;
}

export class Net {
  private client: Client | null = null;
  private room: Room | null = null;
  private events: NetEvents;
  status: ConnectionStatus = "idle";

  constructor(events: NetEvents = {}) {
    this.events = events;
  }

  get sessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  private setStatus(status: ConnectionStatus, detail?: string) {
    this.status = status;
    this.events.onStatusChange?.(status, detail);
  }

  async connect(name: string, skinId: string): Promise<void> {
    this.setStatus("connecting");
    try {
      if (!this.client) {
        // Code-split chunk: colyseus.js is only fetched/parsed the first time someone actually
        // tries to connect (Play button), not bundled into the initial page load.
        const { Client } = await import("colyseus.js");
        this.client = new Client(SERVER_URL);
      }
      const room = await this.client.joinOrCreate(ROOM_NAME, { name, skinId });
      this.room = room;
      this.setStatus("connected");

      room.onLeave(() => {
        this.setStatus("disconnected", "Disconnected from server.");
      });
      room.onError((_code, message) => {
        this.setStatus("error", message ?? "Connection error occurred.");
      });
      // Wildcard listener: the backend broadcasts message type === payload.type (see
      // GameRoom.broadcastEvent), so the payload itself is already a well-formed ServerEvent.
      room.onMessage("*", (_type, message) => {
        this.events.onGameEvent?.(message as ServerEvent);
      });
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : "Could not connect to server (it might be offline).";
      this.setStatus("error", detail);
      throw err;
    }
  }

  /** Reads the latest snapshot from room.state, or an empty snapshot if not connected. */
  getSnapshot(): RoomSnapshot {
    if (!this.room) {
      return { players: [], leaderboard: [] };
    }
    return readSnapshot(this.room.state);
  }

  send(message: ClientMessage): void {
    if (!this.room || this.status !== "connected") return;
    const { type, ...payload } = message;
    try {
      this.room.send(type, payload);
    } catch {
      // Swallow send errors (e.g. socket closed mid-frame) — next frame will
      // pick up the disconnected status and stop sending.
    }
  }

  disconnect(): void {
    this.room?.leave();
    this.room = null;
    this.setStatus("idle");
  }
}
