# Hướng dẫn phối hợp cho các Agent làm việc trên dự án

Mục đích: nhiều agent (hoặc nhiều người) có thể làm việc song song trên `frontend/`,
`backend/`, `shared/` mà không giẫm chân/ghi đè lên nhau.

## Cấu trúc thư mục

| Thư mục | Vai trò | Ai được sửa |
|---|---|---|
| `docs/` | Spec, concept brief, tài liệu quyết định thiết kế, log tiến độ | Tất cả agent, chỉ **thêm/cập nhật**, không xoá lịch sử quyết định đã chốt |
| `frontend/` | Toàn bộ code client (render, input, UI) | Chỉ agent phụ trách frontend |
| `backend/` | Toàn bộ code server (game loop, room, matchmaking, logic câu cá) | Chỉ agent phụ trách backend |
| `shared/` | Hợp đồng dùng chung giữa FE-BE: game constants, schema message realtime, type definitions | Cả hai agent đều được sửa, nhưng phải theo quy trình bên dưới |

## Quy tắc cốt lõi

1. **Không sửa file ngoài phạm vi thư mục của mình.** Agent frontend không tự ý sửa code
   trong `backend/` và ngược lại. Nếu phát hiện vấn đề ở phía kia, ghi chú vào
   `docs/progress.md` thay vì tự sửa.
2. **`shared/` là nguồn chân lý duy nhất** cho mọi giá trị/luật chơi mà cả hai phía đều cần
   biết giống nhau — ví dụ: bảng loài cá + độ hiếm (`FISH_CATALOG`), khung thời gian chờ cắn
   câu/móc câu (`HOOK_WINDOW_MS`), độ khó minigame kéo cá, tầm quăng cần, giới hạn người/hồ.
   **Không hardcode các số này riêng ở frontend hoặc backend** — luôn import/tham chiếu từ
   `shared/`.
3. **Đổi `shared/` phải ghi chú lại** trong `docs/progress.md` (đổi gì, vì sao, ai đổi) trước
   khi agent còn lại code dựa theo giá trị mới — tránh trường hợp 2 bên tính toán lệch nhau.
4. **Đọc `docs/concept_brief.md` trước khi code** — đây là spec nguồn cho toàn bộ luật chơi.
   Nếu cần đổi luật chơi so với brief, cập nhật brief trước, đừng tự diễn giải khác đi.
5. **Ghi log vào `docs/progress.md`** mỗi khi bắt đầu/hoàn thành một phần việc lớn — agent
   khác cần biết trạng thái hiện tại để tránh làm trùng hoặc giả định sai.

## Khi có xung đột

Nếu hai agent cùng cần sửa `shared/` cùng lúc, ưu tiên: BE đề xuất trước (vì logic luật chơi
authoritative nằm ở server), FE theo sau. Nếu không chắc, dừng lại và hỏi người dùng thay vì tự
quyết.

## Tài liệu tham chiếu

- `docs/concept_brief.md` — spec luật chơi/tính năng (nguồn chính)
- `docs/progress.md` — log tiến độ, quyết định, việc đang làm/đã làm
