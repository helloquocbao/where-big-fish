---
title: Concept Brief — "Where I Go Fish" (whereigfish.com)
author: BA Draft (qua trao đổi với Vicent)
date: 2026-07-05
status: MVP câu cá đã prototype xong, đang chơi thử để tinh chỉnh con số
updated: 2026-07-11 — PIVOT toàn bộ concept từ game PvP "nhảy đè/bomb" sang game câu cá
  multiplayer nhiều hồ, quyết định trực tiếp với Vicent (xem docs/progress.md để biết lịch sử/lý
  do). Toàn bộ nội dung bên dưới thay thế hoàn toàn bản concept PvP cũ.
updated: 2026-07-11 — Hiện thực hoá "nhiều hồ" (mục 1): nhiều hồ hình dạng/cá khác nhau trong 1
  map/room duy nhất (không phải chọn hồ trước khi vào), di chuyển đổi từ hướng chuột liên tục sang
  WASD/mũi tên (đứng yên khi thả tay), chuột tách riêng để nhắm hướng thả cần. Xem docs/progress.md.
updated: 2026-07-11 — Đổi minigame kéo cá (mục 2 bước 4) từ "đưa vùng bắt trùng vị trí cá dao động"
  sang mô hình độ căng dây (tension) trực quan hơn, chỉ dùng chuột, kèm hình cá+cần câu cong hoạt
  hình và modal kết quả khi bắt được cá. Xem docs/progress.md.
updated: 2026-07-11 — Bỏ bước "móc câu" (mục 2, core loop 4 bước -> 3): cá cắn là TỰ ĐỘNG móc, modal
  minigame kéo cá mở ra ngay. Đồng thời đại trùng tu UI theo phong cách cozy Stardew (khung gỗ +
  giấy da). Xem docs/progress.md.
---

# Game câu cá multiplayer nhiều hồ — "Where I Go Fish"

**TL;DR**: Người chơi đứng quanh 1 hồ (room realtime, thấy người khác câu cùng lúc), thả cần ->
chờ cá cắn câu -> cá cắn là tự vào minigame kéo cá kỹ năng -> bắt được cá theo độ hiếm,
cộng vào sổ sưu tập cá nhân và bảng xếp hạng theo tổng giá trị. Không có PvP, không có "chết" —
tông game thư giãn (casual) pha thêm lớp cạnh tranh nhẹ qua sưu tầm + xếp hạng, không phải qua
giành giật trực tiếp với người khác.

## Situation

- Domain `whereigfish.com` đã có sẵn, muốn build game câu cá thay vì tiếp tục hướng .io PvP cũ
  (xem lịch sử ở docs/progress.md — concept gốc là game kiểu slither.io/agar.io với cơ chế "nhảy
  đè").
- Hạ tầng kỹ thuật đã có (Colyseus realtime room-based server, Vite + Canvas client) — tái sử dụng
  được phần lớn: kiến trúc room = hồ, matchmaking tự động lấp phòng, style nhân vật quả bóng
  Kirby-style (mắt to, tai thỏ, vây bên hông) vẫn giữ nguyên, chỉ bỏ khẩu súng và các hiệu ứng combat.

## Complication

- Game câu cá solo (không multiplayer) thì rất phổ biến, không có gì khác biệt để giữ chân người
  chơi so với hàng loạt game câu cá mobile casual sẵn có.
- Cần giữ được cảm giác "hồ có người khác cùng câu" (điểm khác biệt chính so với game câu cá solo)
  mà không cần dựng lại toàn bộ cơ chế PvP phức tạp — ban đầu có cân nhắc "hồ sự kiện" (cá hiếm
  spawn định kỳ, ai câu được trước thắng) nhưng **đã quyết định bỏ** theo yêu cầu trực tiếp của
  Vicent để giữ MVP đơn giản, tránh race-condition phức tạp giữa nhiều người cùng nhắm 1 con cá.
- Vẫn cần một lớp "muốn chơi lại" (progression hook) dù không có PvP — chọn sưu tầm cá hiếm
  (collection log) làm động lực chính, thay vì kinh tế/nâng cấp phức tạp ở giai đoạn MVP.

## Resolution — Core Concept

### 1. Nhân vật & Map nhiều hồ

- Nhân vật: giữ nguyên quả bóng tròn kiểu Kirby (mắt to, tai thỏ, vây hông, phụ kiện theo skin) từ
  bản game cũ — chỉ bỏ khẩu súng (không còn combat). Không còn cơ chế lớn dần theo điểm (agar.io
  style) — nhân vật giữ 1 kích thước cố định (`PLAYER_VISUAL_SIZE`), không có khái niệm "chết".
- **Nhiều hồ câu trong 1 map, 1 room duy nhất** (đổi từ bản MVP đầu chỉ có 1 hồ/room — xem
  `docs/progress.md` log ngày đổi thiết kế): map là 1 room Colyseus chứa `LAKE_DEFINITIONS`
  (`shared/src/lakes.ts`), mỗi hồ hình dạng/kích thước khác nhau (polygon méo mó sinh xác định theo
  seed, không phải ellipse đều), rải rác khắp map, tối đa `ROOM_MAX_PLAYERS` người thật cùng lúc
  trong CẢ map (không phải mỗi hồ). NPC câu cá (thuần cosmetic) lấp chỗ trống theo
  `NPC_FISHER_TARGET_POPULATION` **tính riêng từng hồ** để hồ nào cũng có người, không dồn hết vào 1
  hồ.
- **Mỗi hồ có tập cá riêng** (`fishWeights` trong `LakeDefinition`) — không phải cả 8 loài
  `FISH_CATALOG` random đều ở mọi hồ như bản đầu. Hồ nhỏ/gần điểm xuất phát chỉ có cá thường, hồ
  lớn/xa/hiểm hơn thiên về cá hiếm-huyền thoại — khuyến khích đi khám phá nhiều hồ để sưu tập đủ.
- Người chơi đi lại bằng **WASD hoặc phím mũi tên** (đổi từ "luôn đi liên tục theo hướng chuột" kiểu
  .io cũ — giờ đứng yên khi không giữ phím nào). Hướng chuột TÁCH BIỆT khỏi đi bộ, chỉ dùng để nhắm
  hướng thả cần (kiểu twin-stick). Phải đứng trong `LAKE_CAST_RANGE` tính từ biên 1 hồ mới thả cần
  được (đứng giữa đồng trống xa hồ thì bị từ chối) — **đứng yên khi đang trong bất kỳ trạng thái câu
  cá nào** (đã thả cần trở đi) vẫn giữ nguyên, không thể vừa đi vừa câu.

### 2. Core loop — 3 bước

1. **Thả cần (Cast)**: giữ chuột trái rồi thả ra — chỉ có hiệu lực khi đang đứng trong
   `LAKE_CAST_RANGE` của 1 hồ (xem mục 1). Thời gian giữ (tối đa `CAST_MAX_CHARGE_MS`) quyết định
   lực quăng 0-100%, nội suy ra khoảng cách quăng giữa `CAST_MIN_RANGE` và `CAST_MAX_RANGE` theo
   hướng con trỏ. Ngay khi cần chạm mặt hồ, server roll ngay 1 loài cá sẽ cắn câu (theo tập cá +
   trọng số độ hiếm RIÊNG của hồ đó đang câu, xem `LakeDefinition.fishWeights`) — người chơi CHƯA
   biết là loài gì cho tới khi cá cắn câu.
2. **Chờ cắn câu (Waiting)**: chờ ngẫu nhiên theo khoảng `biteWaitMinMs`-`biteWaitMaxMs` của loài cá
   đã roll (loài hiếm chờ lâu hơn). Phao nổi trên mặt hồ với hiệu ứng bập bềnh nhẹ.
3. **Kéo cá (Reel minigame) — mô hình độ căng dây (tension)**: cá cắn câu là TỰ ĐỘNG móc, modal
   minigame mở ra ngay (không còn bước "móc câu" bấm-kịp-0.9s như bản trước — bỏ theo quyết định
   của Vicent để đơn giản hoá, không còn cảnh lỡ tay trễ nhịp mất lượt). Modal hiện cảnh cần câu
   cong + hình cá vùng vẫy (màu theo loài, vẫy mạnh/nhanh dần theo độ căng dây) + 2 thanh trạng
   thái. CHỈ dùng chuột: **giữ chuột kéo** thì `reelProgress` (tiến độ) tăng NHƯNG `reelTension`
   (độ căng dây) cũng tăng theo — loài khó (`reelDifficulty` cao) căng nhanh hơn nhiều; **thả chuột
   ra** thì độ căng giảm dần nhưng cá giằng lại khiến tiến độ tụt (giằng mạnh hơn ở loài khó) —
   buộc người chơi phải xen kẽ kéo/thả đúng nhịp thay vì chỉ giữ chuột suốt. `reelProgress` đầy
   100% = bắt được cá (cộng điểm/giá trị, thêm vào sổ sưu tập nếu là loài lần đầu, hiện modal
   tên+hình+độ hiếm+giá trị cá); tụt về 0% = cá thoát; `reelTension` chạm mốc tối đa = **đứt dây,
   mất cá** bất kể tiến độ đang bao nhiêu.

### 3. Cá & độ hiếm

- 4 mốc độ hiếm: **Thường** (common), **Không phổ biến** (uncommon), **Hiếm** (rare), **Huyền
  thoại** (legendary) — xem toàn bộ danh sách 8 loài trong `shared/src/constants.ts#FISH_CATALOG`.
- Loài hiếm hơn: trọng số roll thấp hơn, thời gian chờ cắn câu lâu hơn, giá trị cao hơn, minigame
  kéo cá khó hơn (dao động nhanh/thất thường hơn, vùng bắt hẹp hơn) — độ khó và phần thưởng đi kèm
  nhau, đúng cảm giác "câu được cá hiếm phải xứng đáng khó hơn".
- **Sổ sưu tập (Collection log)**: danh sách các loài đã từng bắt được (không lặp lại), hiện trong
  modal "Sổ Cá" — động lực chơi lại chính của MVP này. Hiện tại lưu theo phiên chơi (mất khi rời
  phòng, không có tài khoản/DB) — xem mục Next Steps.

### 4. Bảng xếp hạng

- Xếp theo **tổng giá trị cá đã bắt được** trong phiên hiện tại (room-local, giống MVP leaderboard
  của bản game cũ) — đây là lớp "cạnh tranh nhẹ" duy nhất, hoàn toàn không tương tác trực tiếp giữa
  người chơi (không giành giật cá của nhau).

### 5. NPC câu cá (population filler)

- Thuần cosmetic, tái sử dụng đúng state machine câu cá thật (không phải logic giả lập riêng) —
  tự thả cần, cá cắn là tự động vào kéo cá (không còn bước móc câu nên NPC cũng không cần "phản
  ứng" gì nữa), tự kéo cá theo nhịp kéo/thả xen kẽ đơn giản (hysteresis theo độ căng dây). Mỗi NPC
  được gán cố định 1 hồ lúc tạo (spawn ngay mép
  hồ đó, không di chuyển) — dân số NPC cân bằng THEO TỪNG HỒ (không phải tổng toàn map) để hồ nào
  cũng có người chứ không dồn hết vào 1 hồ. Không cạnh tranh, không xuất hiện trên bảng xếp hạng
  theo cách gây khó chịu — giữ mọi hồ luôn có cảm giác "có người" ngay từ lúc mới launch, giống vai
  trò bot ở bản game cũ.

## USP so với game câu cá solo thông thường

> Nhiều người chơi thật cùng đứng câu quanh 1 hồ theo thời gian thực — nhìn thấy người khác đang
> câu, đang kéo cá cùng lúc — tạo cảm giác "có bạn câu" mà game câu cá solo không có, nhưng không
> cần giành giật/PvP để đạt được cảm giác đó.

## Giả định đã chốt (quyết định trực tiếp với Vicent)

| Chủ đề | Quyết định |
|---|---|
| Tông game | Kết hợp casual (hồ thường ai câu cũng có phần) + cạnh tranh nhẹ (xếp hạng + sưu tầm), KHÔNG giành giật real-time |
| Hồ sự kiện/giành cá hiếm | Bỏ hẳn — quá phức tạp cho MVP, dời việc "giữ tính cạnh tranh" sang xếp hạng + sưu tầm |
| Kiến trúc | Giữ real-time multiplayer (Colyseus, room = CẢ MAP nhiều hồ, không phải room = 1 hồ như bản MVP đầu) dù chỉ còn vai trò xã hội, không bắt buộc kỹ thuật. "Nhiều server" đến miễn phí từ việc Colyseus tự tạo room mới khi 1 room đầy |
| Progression hook | Sưu tầm cá hiếm (collection log) — mỗi hồ có tập cá riêng nên khuyến khích đi nhiều hồ, chưa làm kinh tế/nâng cấp cần câu ở MVP này |
| Giới hạn người/hồ | `ROOM_MAX_PLAYERS` (40) người thật cho CẢ map + NPC lấp chỗ trống ~3/hồ (tính riêng từng hồ, không phải tổng map) |

## Còn lại cần tinh chỉnh qua playtest (không chặn việc chơi thử ngay)

1. Con số cụ thể: thời gian chờ cắn câu, độ khó minigame kéo cá theo từng loài, tầm quăng cần —
   đã có giá trị khởi điểm hợp lý trong `FISH_CATALOG`/`constants.ts`, cần chơi thử để tinh chỉnh.
2. Cân bằng độ hiếm — hiện tại chưa test xem tỷ lệ bắt được cá huyền thoại có quá hiếm/quá dễ.
3. Hình dạng hồ (mục 1) đã đổi từ 1 ellipse cố định sang nhiều polygon méo mó riêng từng hồ — vẫn
   có thể cần tinh chỉnh kích thước/độ méo qua playtest. Người chơi giờ KHÔNG đi xuyên qua được mặt
   nước (chặn ở `backend/src/systems/movement.ts#stepPlayerMovement`, dùng đúng polygon hồ thật —
   xem `shared/src/lakes.ts#isInsideAnyLake`) — chỉ đi được trên bờ, đụng mép hồ thì trượt dọc theo
   bờ thay vì dừng khựng lại (đổi từ đơn giản hoá "đi xuyên nước được" ở bản MVP đầu).

## Next Steps (Phase 2, chưa làm trong MVP này)

1. ~~**Nhiều hồ**~~ — ĐÃ LÀM (xem mục 1 + `docs/progress.md`): nhiều hồ hình dạng/cá khác nhau
   rải trong 1 map/room, di chuyển bằng WASD/mũi tên thay vì chọn hồ trước khi vào. Còn lại nếu
   muốn đào sâu thêm: catalog cá theo "loại hồ" chủ đề rõ rệt hơn (hồ nước ngọt/hồ băng/sông...)
   thay vì chỉ trọng số khác nhau trên cùng 1 danh sách loài.
2. **Tài khoản & lưu tiến trình**: sổ sưu tập hiện mất khi rời phòng (không có DB) — cần tài khoản
   để giữ collection log/thành tích xuyên suốt nhiều lần chơi, giống hướng "meta progression Phase
   2" đã định hình từ bản concept PvP cũ.
3. **Kinh tế/nâng cấp**: dùng tổng giá trị cá bắt được để mua cần câu/mồi tốt hơn (câu xa hơn, giảm
   độ khó minigame, tăng tỷ lệ ra cá hiếm) — hiện chưa có, tổng giá trị chỉ dùng để xếp hạng.
4. **Polish**: hiệu ứng bắt cá rõ ràng hơn (hiện chỉ có toast chữ), âm thanh, animation ăn mừng khi
   bắt được cá hiếm/huyền thoại.

---
*Tài liệu tổng hợp qua trao đổi trực tiếp với Vicent, chưa qua bước validate thị trường/đối thủ.*
