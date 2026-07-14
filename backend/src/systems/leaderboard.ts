import { ArraySchema, MapSchema } from "@colyseus/schema";
import { LEADERBOARD_SIZE } from "@bomio/shared";
import { LeaderboardEntrySchema, PlayerSchema } from "../schema/State.js";

/** Recompute the room's top-N leaderboard (total catch value descending). Xếp hạng CẢ người thật
 * LẪN NPC (Vicent 2026-07-14) — NPC nay có tích điểm dần (xem NPC_CATCH_CHANCE trong
 * fishing.ts#updateReeling) nên cùng đua trên bảng cho hồ sống động; entry.isNpc để FE muốn đánh
 * dấu khác biệt thì tuỳ. Call periodically, not every tick. */
export function recomputeLeaderboard(
  players: MapSchema<PlayerSchema>,
  leaderboard: ArraySchema<LeaderboardEntrySchema>,
): void {
  const sorted = Array.from(players.values())
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, LEADERBOARD_SIZE);

  // Bỏ qua nếu top-N KHÔNG đổi so với lần trước — tránh clear()+rebuild ArraySchema mỗi giây (thao
  // tác đó ép Colyseus phát op xoá-hết-rồi-thêm-lại => re-sync cả 10 entry cho MỌI client dù nội dung
  // y hệt). Leaderboard phần lớn thời gian đứng yên giữa các lần bắt cá nên nhánh này cắt được nhiều
  // sync rác dưới tải cao. So sánh nông theo thứ tự các trường hiển thị.
  if (sorted.length === leaderboard.length) {
    let unchanged = true;
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      const b = leaderboard[i];
      if (!b || a.id !== b.playerId || a.totalValue !== b.totalValue || a.caughtCount !== b.caughtCount || a.name !== b.name) {
        unchanged = false;
        break;
      }
    }
    if (unchanged) return;
  }

  leaderboard.clear();
  for (const p of sorted) {
    const entry = new LeaderboardEntrySchema();
    entry.playerId = p.id;
    entry.name = p.name;
    entry.totalValue = p.totalValue;
    entry.caughtCount = p.caughtCount;
    entry.isNpc = p.isNpc;
    leaderboard.push(entry);
  }
}
