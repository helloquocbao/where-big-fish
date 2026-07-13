/**
 * DOM overlay: connection screen (name + Play button), leaderboard panel, cast-charge meter,
 * reel-minigame bar, and the fish collection log. Kept separate from canvas rendering since these
 * are cheap DOM elements layered on top of the canvas rather than drawn.
 */

import type { LeaderboardEntry, PlayerState } from "@bomio/shared";
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  SKIN_CATALOG,
  DEFAULT_SKIN_ID,
  FISH_CATALOG,
  RARITY_LABEL,
  RARITY_COLOR,
  getFishSpecies,
  LAKE_DEFINITIONS,
  getLakeById,
} from "@bomio/shared";
import { drawSkinPreview, drawFishIcon, drawModalReelScene } from "./render.ts";
import type { FishRarity } from "@bomio/shared";

export class UI {
  readonly root: HTMLDivElement;
  private connectScreen: HTMLDivElement;
  private nameInput: HTMLInputElement;
  private playButton: HTMLButtonElement;
  private errorText: HTMLParagraphElement;

  private hud: HTMLDivElement;
  private leaderboardList: HTMLOListElement;
  private statusBanner: HTMLDivElement;
  private toast: HTMLDivElement;
  private toastTimeout: number | undefined;
  private caughtValue: HTMLSpanElement;
  private caughtCountValue: HTMLSpanElement;
  private currentLakeValue: HTMLSpanElement;
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D;
  private skinPreviewCanvas: HTMLCanvasElement;
  private skinPreviewCtx: CanvasRenderingContext2D;
  private skinSwatchesEl: HTMLDivElement;
  private selectedSkinId: string;

  private castMeter: HTMLDivElement;
  private castMeterFill: HTMLDivElement;

  private fishingModal: HTMLDivElement;
  private fishingModalCanvas: HTMLCanvasElement;
  private fishingModalCanvasCtx: CanvasRenderingContext2D;
  private fishingModalProgressFill: HTMLDivElement;
  private fishingModalTensionFill: HTMLDivElement;

  private collectionButton: HTMLButtonElement;
  private collectionCount: HTMLSpanElement;
  private collectionModal: HTMLDivElement;
  private collectionList: HTMLDivElement;

  private catchModal: HTMLDivElement;
  private catchModalCanvas: HTMLCanvasElement;
  private catchModalCtx: CanvasRenderingContext2D;
  private catchModalName: HTMLDivElement;
  private catchModalRarity: HTMLDivElement;
  private catchModalValue: HTMLDivElement;
  private catchModalNew: HTMLDivElement;
  private catchModalTimeout: number | undefined;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "game-ui";
    container.appendChild(this.root);

    // --- Connection screen ---
    this.connectScreen = document.createElement("div");
    this.connectScreen.className = "connect-screen";
    this.connectScreen.innerHTML = `
      <div class="connect-card">
        <h1>Where I Go Fish</h1>
        <p class="tagline">Multiple lakes, many fishers — cast your line and see what you catch.</p>
        <div class="skin-picker">
          <canvas class="skin-preview" width="90" height="110"></canvas>
          <div class="skin-swatches"></div>
        </div>
        <input type="text" maxlength="16" placeholder="Your name" class="name-input" />
        <button class="play-button" type="button">Play</button>
        <p class="error-text"></p>
      </div>
    `;
    this.root.appendChild(this.connectScreen);
    this.nameInput = this.connectScreen.querySelector(".name-input")!;
    this.playButton = this.connectScreen.querySelector(".play-button")!;
    this.errorText = this.connectScreen.querySelector(".error-text")!;
    this.skinPreviewCanvas = this.connectScreen.querySelector<HTMLCanvasElement>(".skin-preview")!;
    this.skinPreviewCtx = this.skinPreviewCanvas.getContext("2d")!;
    this.skinSwatchesEl = this.connectScreen.querySelector<HTMLDivElement>(".skin-swatches")!;

    const savedName = localStorage.getItem("bomio.name");
    if (savedName) this.nameInput.value = savedName;

    const savedSkin = localStorage.getItem("bomio.skin");
    this.selectedSkinId = SKIN_CATALOG.some((s) => s.id === savedSkin) ? savedSkin! : DEFAULT_SKIN_ID;
    this.skinSwatchesEl.innerHTML = SKIN_CATALOG.map(
      (skin) =>
        `<button type="button" class="skin-swatch${skin.id === this.selectedSkinId ? " selected" : ""}" data-skin="${skin.id}" style="background:${skin.bodyColor}" title="${escapeHtml(skin.name)}"></button>`,
    ).join("");
    this.skinSwatchesEl.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".skin-swatch");
      if (!btn?.dataset.skin) return;
      this.selectedSkinId = btn.dataset.skin;
      localStorage.setItem("bomio.skin", this.selectedSkinId);
      this.skinSwatchesEl.querySelectorAll(".skin-swatch").forEach((el) => el.classList.toggle("selected", el === btn));
    });

    const animateSkinPreview = () => {
      drawSkinPreview(this.skinPreviewCtx, this.skinPreviewCanvas.width, this.skinPreviewCanvas.height, this.selectedSkinId, Date.now());
      requestAnimationFrame(animateSkinPreview);
    };
    requestAnimationFrame(animateSkinPreview);

    // --- In-game HUD ---
    this.hud = document.createElement("div");
    this.hud.className = "hud hidden";
    this.hud.innerHTML = `
      <div class="leaderboard panel-cut">
        <h2>🏆 Leaderboard</h2>
        <ol class="leaderboard-list"></ol>
      </div>
      <div class="stats-panel panel-cut">
        <div>🎣 Fishing in <span class="stats-current-lake">—</span></div>
        <div>Fish caught <span class="stats-caught-count">0</span></div>
        <div>Total score <span class="stats-caught-value">0</span></div>
        <button type="button" class="collection-button">🐟 Fish Index (<span class="collection-count">0</span>/${FISH_CATALOG.length})</button>
      </div>
      <div class="minimap-frame panel-cut">
        <canvas class="minimap" width="140" height="140"></canvas>
      </div>
      <div class="cast-meter hidden">
        <div class="cast-meter-track"><div class="cast-meter-fill"></div></div>
        <div class="cast-meter-label">Hold mouse to power cast — release to fish</div>
      </div>
      <div class="fishing-modal hidden">
        <div class="fishing-modal-card panel-cut">
          <div class="fishing-modal-title">FISH HOOKED!</div>
          <div class="fishing-modal-subtitle">Hold mouse to reel — release periodically to prevent tension snap!</div>
          <div class="fishing-modal-game-container">
            <canvas class="fishing-modal-canvas" width="580" height="270"></canvas>
            <div class="fishing-modal-bars-container">
              <div class="fishing-modal-vertical-bar-wrapper">
                <div class="fishing-modal-vertical-bar-track">
                  <div class="fishing-modal-vertical-bar-fill progress fishing-modal-progress-fill"></div>
                </div>
                <div class="fishing-modal-vertical-bar-label">Progress</div>
              </div>
              <div class="fishing-modal-vertical-bar-wrapper">
                <div class="fishing-modal-vertical-bar-track">
                  <div class="fishing-modal-vertical-bar-fill tension fishing-modal-tension-fill"></div>
                </div>
                <div class="fishing-modal-vertical-bar-label">Tension</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="collection-modal hidden">
        <div class="collection-modal-card panel-cut">
          <div class="collection-modal-header">
            <h2>🐟 Fish Collection</h2>
            <button type="button" class="collection-close">×</button>
          </div>
          <div class="collection-list"></div>
        </div>
      </div>
      <div class="catch-modal hidden">
        <div class="catch-modal-card panel-cut">
          <button type="button" class="catch-modal-close">×</button>
          <div class="catch-modal-new hidden">New species caught!</div>
          <canvas class="catch-modal-canvas" width="140" height="100"></canvas>
          <div class="catch-modal-name"></div>
          <div class="catch-modal-rarity"></div>
          <div class="catch-modal-value"></div>
        </div>
      </div>
    `;
    this.root.appendChild(this.hud);
    this.leaderboardList = this.hud.querySelector<HTMLOListElement>(".leaderboard-list")!;
    this.caughtCountValue = this.hud.querySelector<HTMLSpanElement>(".stats-caught-count")!;
    this.caughtValue = this.hud.querySelector<HTMLSpanElement>(".stats-caught-value")!;
    this.currentLakeValue = this.hud.querySelector<HTMLSpanElement>(".stats-current-lake")!;
    this.minimapCanvas = this.hud.querySelector<HTMLCanvasElement>(".minimap")!;
    this.minimapCtx = this.minimapCanvas.getContext("2d")!;

    this.castMeter = this.hud.querySelector<HTMLDivElement>(".cast-meter")!;
    this.castMeterFill = this.hud.querySelector<HTMLDivElement>(".cast-meter-fill")!;

    this.fishingModal = this.hud.querySelector<HTMLDivElement>(".fishing-modal")!;
    this.fishingModalCanvas = this.hud.querySelector<HTMLCanvasElement>(".fishing-modal-canvas")!;
    this.fishingModalCanvasCtx = this.fishingModalCanvas.getContext("2d")!;
    this.fishingModalProgressFill = this.hud.querySelector<HTMLDivElement>(".fishing-modal-progress-fill")!;
    this.fishingModalTensionFill = this.hud.querySelector<HTMLDivElement>(".fishing-modal-tension-fill")!;

    this.collectionButton = this.hud.querySelector<HTMLButtonElement>(".collection-button")!;
    this.collectionCount = this.hud.querySelector<HTMLSpanElement>(".collection-count")!;
    this.collectionModal = this.hud.querySelector<HTMLDivElement>(".collection-modal")!;
    this.collectionList = this.hud.querySelector<HTMLDivElement>(".collection-list")!;
    this.collectionButton.addEventListener("click", () => this.collectionModal.classList.remove("hidden"));
    this.collectionModal.querySelector(".collection-close")!.addEventListener("click", () => this.collectionModal.classList.add("hidden"));
    this.renderCollectionList([]);

    this.catchModal = this.hud.querySelector<HTMLDivElement>(".catch-modal")!;
    this.catchModalCanvas = this.hud.querySelector<HTMLCanvasElement>(".catch-modal-canvas")!;
    this.catchModalCtx = this.catchModalCanvas.getContext("2d")!;
    this.catchModalName = this.hud.querySelector<HTMLDivElement>(".catch-modal-name")!;
    this.catchModalRarity = this.hud.querySelector<HTMLDivElement>(".catch-modal-rarity")!;
    this.catchModalValue = this.hud.querySelector<HTMLDivElement>(".catch-modal-value")!;
    this.catchModalNew = this.hud.querySelector<HTMLDivElement>(".catch-modal-new")!;
    const closeCatchModal = () => {
      this.catchModal.classList.add("hidden");
      window.clearTimeout(this.catchModalTimeout);
    };
    this.catchModal.querySelector(".catch-modal-close")!.addEventListener("click", closeCatchModal);
    this.catchModal.addEventListener("click", (e) => {
      if (e.target === this.catchModal) closeCatchModal();
    });

    this.statusBanner = document.createElement("div");
    this.statusBanner.className = "status-banner hidden";
    this.root.appendChild(this.statusBanner);

    this.toast = document.createElement("div");
    this.toast.className = "event-toast hidden";
    this.root.appendChild(this.toast);
  }

  /** Shows a short-lived toast (e.g. a catch result). `variant` only changes the accent color. */
  showToast(message: string, variant: "danger" | "warning" | "info" = "info") {
    window.clearTimeout(this.toastTimeout);
    this.toast.textContent = message;
    this.toast.className = `event-toast event-toast--${variant}`;
    this.toastTimeout = window.setTimeout(() => {
      this.toast.classList.add("hidden");
    }, 2200);
  }

  onPlay(callback: (name: string, skinId: string) => void) {
    const submit = () => {
      const name = this.nameInput.value.trim() || "Player";
      localStorage.setItem("bomio.name", name);
      callback(name, this.selectedSkinId);
    };
    this.playButton.addEventListener("click", submit);
    this.nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
  }

  setConnecting(isConnecting: boolean) {
    this.playButton.disabled = isConnecting;
    this.playButton.textContent = isConnecting ? "Connecting..." : "Play";
  }

  showError(message: string) {
    this.errorText.textContent = message;
  }

  showStatusBanner(message: string) {
    this.statusBanner.textContent = message;
    this.statusBanner.classList.remove("hidden");
  }

  hideStatusBanner() {
    this.statusBanner.classList.add("hidden");
  }

  enterGame() {
    this.connectScreen.classList.add("hidden");
    this.hud.classList.remove("hidden");
  }

  backToConnectScreen() {
    this.connectScreen.classList.remove("hidden");
    this.hud.classList.add("hidden");
    this.setConnecting(false);
  }

  updateLeaderboard(entries: LeaderboardEntry[], localPlayerId: string | null) {
    const top = [...entries].sort((a, b) => b.totalValue - a.totalValue).slice(0, 10);
    this.leaderboardList.innerHTML = top
      .map((entry) => {
        const isLocal = entry.playerId === localPlayerId;
        return `<li class="${isLocal ? "me" : ""}">${escapeHtml(entry.name)} — ${Math.round(entry.totalValue)} (${entry.caughtCount} 🐟)</li>`;
      })
      .join("");
  }

  /** Bottom-left readout: total fish caught + total value. */
  updateStats(caughtCount: number, totalValue: number) {
    this.caughtCountValue.textContent = String(caughtCount);
    this.caughtValue.textContent = String(Math.round(totalValue));
  }

  /** Tên hồ lần gần nhất người chơi thả cần thành công (PlayerState.currentLakeId) — "" nếu chưa
   * từng câu ở hồ nào phiên này. */
  updateCurrentLake(lakeId: string) {
    this.currentLakeValue.textContent = lakeId ? (getLakeById(lakeId)?.name ?? "—") : "—";
  }

  /** Fish collection log — count + the always-available modal list, checked off as species are
   * caught for the first time. `collection` is the local player's list of caught species ids. */
  updateCollection(collection: string[]) {
    this.collectionCount.textContent = String(collection.length);
    this.renderCollectionList(collection);
  }

  private renderCollectionList(collection: string[]) {
    const caught = new Set(collection);
    this.collectionList.innerHTML = FISH_CATALOG.map((fish) => {
      const isCaught = caught.has(fish.id);
      return `
        <div class="collection-item${isCaught ? " caught" : ""}">
          <span class="collection-item-dot" style="background:${isCaught ? fish.color : "#cfd6c9"}"></span>
          <span class="collection-item-name">${isCaught ? escapeHtml(fish.name) : "???"}</span>
          <span class="collection-item-rarity" style="color:${RARITY_COLOR[fish.rarity]}">${RARITY_LABEL[fish.rarity]}</span>
        </div>
      `;
    }).join("");
  }

  /** Cast-charge meter, shown while the mouse is held down — `fraction` is 0..1 or null (hidden)
   * when not currently charging (see InputController.castChargeFraction). */
  updateCastMeter(fraction: number | null) {
    if (fraction == null) {
      this.castMeter.classList.add("hidden");
      return;
    }
    this.castMeter.classList.remove("hidden");
    this.castMeterFill.style.width = `${Math.round(fraction * 100)}%`;
  }

  /** Modal to, chiếm giữa màn hình cho minigame kéo cá — TỰ ĐỘNG mở ngay khi cá cắn câu (giờ cá
   * cắn = vào thẳng reeling, không còn bước móc câu) và đóng lại tự nhiên khi có kết quả
   * (fishState quay về "idle"). Khác hẳn `showCatchModal`/collection modal: đây KHÔNG phải dialog
   * chờ người dùng đóng — GIỮ/THẢ chuột NGAY TRONG modal (xem `fishingModalInteractiveEl` +
   * `InputController.bindAdditionalTarget` ở main.ts) chính là cách kéo cần, nên modal luôn có
   * `pointer-events: auto` để bắt được thao tác đó. Nội dung: cảnh cần cong + cá vùng vẫy
   * (`drawModalReelScene`, màu theo `speciesId` đang kéo) + 2 thanh tiến độ (`reelProgress`) và độ
   * căng dây (`reelTension`, đổi màu xanh lá -> vàng -> đỏ theo mức nguy hiểm đứt dây). */
  updateFishingModal(
    active: boolean,
    data: { reelProgress?: number; reelTension?: number; speciesId?: string; nowMs?: number } = {},
  ) {
    this.fishingModal.classList.toggle("hidden", !active);
    if (!active) return;

    const progressPct = Math.max(0, Math.min(100, data.reelProgress ?? 0));
    const tensionPct = Math.max(0, Math.min(100, data.reelTension ?? 0));
    this.fishingModalProgressFill.style.height = `${progressPct}%`;
    this.fishingModalTensionFill.style.height = `${tensionPct}%`;
    this.fishingModalTensionFill.classList.toggle("warning", tensionPct >= 55 && tensionPct < 80);
    this.fishingModalTensionFill.classList.toggle("danger", tensionPct >= 80);

    const species = getFishSpecies(data.speciesId);
    drawModalReelScene(
      this.fishingModalCanvasCtx,
      this.fishingModalCanvas.width,
      this.fishingModalCanvas.height,
      tensionPct,
      species?.color ?? "#7fa8d9",
      data.nowMs ?? 0,
    );
  }

  /** Vùng DOM bắt thao tác chuột trong lúc modal câu cá đang mở — main.ts gọi
   * `InputController.bindAdditionalTarget` với phần tử này để mousedown/mouseup ngay trong modal
   * cũng kích hoạt móc câu/kéo cần y hệt như bấm trên canvas. */
  get fishingModalInteractiveEl(): HTMLDivElement {
    return this.fishingModal;
  }

  /** Modal ăn mừng khi LOCAL player tự mình câu được cá — hiện icon cá vẽ bằng canvas (màu theo
   * loài), tên/độ hiếm/giá trị, tự đóng sau vài giây hoặc bấm × / bấm ra ngoài để đóng sớm. */
  showCatchModal(speciesId: string, rarity: FishRarity | undefined, value: number, isFirstCatch: boolean) {
    const species = getFishSpecies(speciesId);
    if (!species) return;

    this.catchModalCtx.clearRect(0, 0, this.catchModalCanvas.width, this.catchModalCanvas.height);
    drawFishIcon(this.catchModalCtx, this.catchModalCanvas.width / 2, this.catchModalCanvas.height / 2, 84, species.color);

    this.catchModalName.textContent = species.name;
    this.catchModalRarity.textContent = rarity ? RARITY_LABEL[rarity] : "";
    this.catchModalRarity.style.color = rarity ? RARITY_COLOR[rarity] : "";
    this.catchModalValue.textContent = `+${Math.round(value)}`;
    this.catchModalNew.classList.toggle("hidden", !isFirstCatch);

    window.clearTimeout(this.catchModalTimeout);
    this.catchModal.classList.remove("hidden");
    this.catchModalTimeout = window.setTimeout(() => {
      this.catchModal.classList.add("hidden");
    }, 3200);
  }

  /** Bottom-right minimap: mỗi hồ vẽ theo đúng vị trí/hình dạng thật (thu nhỏ), mỗi người chơi 1
   * chấm scale từ world space, local player highlight riêng. */
  updateMinimap(players: PlayerState[], localPlayerId: string | null) {
    const ctx = this.minimapCtx;
    const size = this.minimapCanvas.width;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#d9f0b8";
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = "#5fb9d6";
    for (const lake of LAKE_DEFINITIONS) {
      ctx.beginPath();
      lake.polygon.forEach((p, i) => {
        const [mx, my] = worldToMinimap(lake.centerX + p.x, lake.centerY + p.y, size);
        if (i === 0) ctx.moveTo(mx, my);
        else ctx.lineTo(mx, my);
      });
      ctx.closePath();
      ctx.fill();
    }

    for (const player of players) {
      if (player.id === localPlayerId) continue;
      const [mx, my] = worldToMinimap(player.x, player.y, size);
      ctx.fillStyle = "rgba(75, 132, 37, 0.55)";
      ctx.beginPath();
      ctx.arc(mx, my, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    const localPlayer = players.find((p) => p.id === localPlayerId);
    if (localPlayer) {
      const [mx, my] = worldToMinimap(localPlayer.x, localPlayer.y, size);
      ctx.fillStyle = "#ffd93d";
      ctx.strokeStyle = "#c9960a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

/** World space (centered on origin, see WORLD_WIDTH/HEIGHT) -> minimap pixel space (top-left origin). */
function worldToMinimap(x: number, y: number, mapSize: number): [number, number] {
  return [((x + WORLD_WIDTH / 2) / WORLD_WIDTH) * mapSize, ((y + WORLD_HEIGHT / 2) / WORLD_HEIGHT) * mapSize];
}

function escapeHtml(input: string): string {
  const div = document.createElement("div");
  div.textContent = input;
  return div.innerHTML;
}

// Re-exported so main.ts can look up a caught species' display name/rarity for toasts without a
// second import path.
export { getFishSpecies };
