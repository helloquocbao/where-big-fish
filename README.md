# Where Big Fish (wherebigfish.com)

Game câu cá multiplayer web — nhiều người cùng đứng câu quanh 1 hồ theo thời gian thực. Spec đầy
đủ: `docs/concept_brief.md`. Quy tắc phối hợp code: `AGENTS.md`. Lịch sử quyết định/pivot:
`docs/progress.md`.

## Cấu trúc

- `shared/` — hằng số luật chơi + type dùng chung, nguồn chân lý duy nhất cho FE/BE (`@bomio/shared`)
- `backend/` — Colyseus game server (Node + TypeScript)
- `frontend/` — client Vite + TypeScript + Canvas, kết nối qua `colyseus.js`
- `docs/` — spec, log tiến độ

## Chạy thử local

```bash
npm install          # cài đặt tất cả workspace (shared/backend/frontend)
npm run dev:backend  # chạy server tại ws://localhost:2567
npm run dev:frontend # chạy client tại http://localhost:5173 (xem log Vite để chắc cổng)
```

Mở trình duyệt tới địa chỉ Vite in ra, nhập tên, bấm Play để vào hồ.

**Cách chơi**: WASD/mũi tên để di chuyển quanh hồ, giữ chuột trái để tích lực rồi thả ra để quăng
cần theo hướng con trỏ. Cá cắn câu là TỰ ĐỘNG vào minigame kéo cá (không còn bước móc câu bằng
Space) — modal kéo cá mở ra ngay, giữ chuột để kéo dây, thả định kỳ để hạ độ căng dây tránh đứt,
kéo tới khi thanh tiến độ đầy.

## Trạng thái hiện tại (MVP)

Đã có: đi lại quanh hồ, thả cần (giữ chuột tích lực), chờ cắn câu theo độ hiếm loài cá, móc câu
theo khung thời gian, minigame kéo cá, sổ sưu tập cá theo phiên chơi, leaderboard theo tổng giá trị
cá bắt được, NPC câu cá lấp chỗ trống, matchmaking tự động lấp hồ.

Chưa có (xem roadmap trong `docs/concept_brief.md`): nhiều hồ khác nhau, tài khoản/lưu tiến trình
xuyên suốt (sổ sưu tập hiện mất khi rời phòng), kinh tế/nâng cấp cần câu-mồi, polish hiệu ứng/âm
thanh khi bắt cá.

Các con số cấu hình (thời gian chờ cắn câu, độ khó minigame, giới hạn hồ...) đều lấy từ
`shared/src/constants.ts` — chỉnh ở đó khi playtest thay vì sửa rải rác trong backend/frontend.

> Lưu ý: dự án này đã pivot từ 1 concept game PvP kiểu slither.io/agar.io (tên tạm "Bomio") sang
> game câu cá — 1 vài file cũ trong `backend/src/systems/` (`pounce.ts`, `bomb.ts`, `bullets.ts`,
> `collision.ts`, `extraLives.ts`, `death.ts`, `food.ts`, `spatialGrid.ts`, `bots.ts`) không còn
> được dùng và đã để rỗng (`export {}`) thay vì xoá — có thể xoá tay nếu muốn dọn sạch repo.
