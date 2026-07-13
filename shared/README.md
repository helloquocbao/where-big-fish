# Shared

Nguồn chân lý duy nhất cho mọi giá trị/luật chơi cả frontend và backend đều cần dùng giống nhau:

- Công thức số bomb theo số người trong room
- Thời gian đếm ngược bomb (7s), cooldown nhảy đè/ném bomb (8-10s)
- Ngưỡng tỷ lệ kích thước cho nhảy đè (>=2x, 0.5x-2x, <=0.5x)
- Giới hạn người/room (~100-150)
- Schema message realtime giữa client-server (vị trí, sự kiện bomb, sự kiện nhảy đè...)

Đổi gì ở đây phải ghi vào `../docs/progress.md`. Xem `../AGENTS.md` cho quy trình đầy đủ.
