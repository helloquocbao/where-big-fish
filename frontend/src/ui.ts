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
  computeReelZoneSize,
  computeActualDifficulty,
} from "@bomio/shared";
import { drawSkinPreview, drawFishIcon, drawModalReelScene } from "./render.ts";
import type { FishRarity } from "@bomio/shared";
import { audioManager } from "./audio.ts";
import { initAdSense, loadAdBanner } from "./ads.ts";

// Speaker icon drawn using SVG instead of system emojis 🔊/🔇 — emoji speakers render distorted/broken at small sizes on
// many machines (especially Windows, depending on the pre-installed emoji font), while SVG uses `currentColor` so it is always
// sharp and automatically matches the button text color (var(--c-ink) in .wood-button) on all machines.
const SPEAKER_ON_SVG = `<svg viewBox="0 0 24 24" width="60%" height="60%" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 9v6h3.6l5.4 4V5l-5.4 4H4z" fill="currentColor"/>
  <path d="M16 8.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M18.6 6a9 9 0 0 1 0 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const SPEAKER_OFF_SVG = `<svg viewBox="0 0 24 24" width="60%" height="60%" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 9v6h3.6l5.4 4V5l-5.4 4H4z" fill="currentColor"/>
  <path d="M16 9l5.5 6M21.5 9 16 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`;

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
  private skinPreviewRaf: number | undefined;
  private animateSkinPreview: () => void = () => {};

  // Dirty-check keys so the leaderboard/collection DOM is only rebuilt when the data actually changes,
  // instead of tearing down + re-serializing innerHTML on every animation frame (60fps DOM thrashing).
  private lastLeaderboardKey = "";
  private lastCollectionKey = "";

  private castMeter: HTMLDivElement;
  private castMeterFill: HTMLDivElement;

  private fishingModal: HTMLDivElement;
  private fishingModalCanvas: HTMLCanvasElement;
  private fishingModalCanvasCtx: CanvasRenderingContext2D;

  private collectionButton: HTMLButtonElement;
  private collectionCount: HTMLSpanElement;
  private collectionModal: HTMLDivElement;
  private collectionList: HTMLDivElement;

  private catchModal: HTMLDivElement;
  private catchModalCard: HTMLDivElement;
  private catchModalCanvas: HTMLCanvasElement;
  private catchModalCtx: CanvasRenderingContext2D;
  private catchModalName: HTMLDivElement;
  private catchModalWeight: HTMLDivElement;
  private catchModalRarity: HTMLDivElement;
  private catchModalValue: HTMLDivElement;
  private catchModalNew: HTMLDivElement;
  private catchModalTimeout: number | undefined;
  private catchValueAnimFrame: number | undefined;
  private mobileActionBtn: HTMLButtonElement | null = null;

  constructor(container: HTMLElement) {
    initAdSense();
    this.root = document.createElement("div");
    this.root.className = "game-ui";
    container.appendChild(this.root);

    // --- Connection screen ---
    this.connectScreen = document.createElement("div");
    this.connectScreen.className = "connect-screen";
    this.connectScreen.innerHTML = `
      <div class="connect-card-wrapper">
        <div class="connect-card">
          <h1>Where Big Fish</h1>
          <p class="tagline">Multiple lakes, many fishers — cast your line and see what you catch.</p>
          <div class="skin-picker">
            <canvas class="skin-preview" width="90" height="110"></canvas>
            <div class="skin-swatches"></div>
          </div>
          <label for="player-name-input" class="sr-only">Your name</label>
          <input id="player-name-input" type="text" maxlength="16" placeholder="Your name" class="name-input" />
          <div class="connect-actions">
            <button class="play-button" type="button">Play</button>
            <button class="audio-toggle-button wood-button" type="button" title="Mute/Unmute Sound" aria-label="Mute or unmute sound"></button>
          </div>
          <p class="error-text"></p>
        </div>
        <div class="ad-banner panel-cut">
          <div class="ad-banner-label">ADVERTISEMENT</div>
          <div class="ad-banner-content" id="connect-ad-banner">
            <div class="ad-placeholder">
              <span class="ad-placeholder-icon">📢</span>
              <span class="ad-placeholder-text">Support the game by whitelisting ads!</span>
            </div>
          </div>
        </div>
      </div>
    `;
    this.root.appendChild(this.connectScreen);
    loadAdBanner("connect-ad-banner", import.meta.env.VITE_ADSENSE_SLOT_CONNECT);
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
        `<button type="button" class="skin-swatch${skin.id === this.selectedSkinId ? " selected" : ""}" data-skin="${skin.id}" style="background:${skin.bodyColor}" title="${escapeHtml(skin.name)}" aria-label="${escapeHtml(skin.name)} skin" aria-pressed="${skin.id === this.selectedSkinId}"></button>`,
    ).join("");
    this.skinSwatchesEl.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".skin-swatch");
      if (!btn?.dataset.skin) return;
      this.selectedSkinId = btn.dataset.skin;
      localStorage.setItem("bomio.skin", this.selectedSkinId);
      this.skinSwatchesEl.querySelectorAll(".skin-swatch").forEach((el) => {
        el.classList.toggle("selected", el === btn);
        el.setAttribute("aria-pressed", String(el === btn));
      });
    });

    const animateSkinPreview = () => {
      drawSkinPreview(this.skinPreviewCtx, this.skinPreviewCanvas.width, this.skinPreviewCanvas.height, this.selectedSkinId, Date.now());
      this.skinPreviewRaf = requestAnimationFrame(animateSkinPreview);
    };
    this.animateSkinPreview = animateSkinPreview;
    this.skinPreviewRaf = requestAnimationFrame(animateSkinPreview);

    // --- In-game HUD ---
    this.hud = document.createElement("div");
    this.hud.className = "hud hidden";
    this.hud.innerHTML = `
      <div class="hud-banner panel-cut">
        <div class="ad-banner-label">ADVERTISEMENT</div>
        <div class="ad-banner-content" id="hud-ad-banner">
          <div class="ad-placeholder">
            <span class="ad-placeholder-icon">📢</span>
            <span class="ad-placeholder-text">Ad banner placeholder (320x50)</span>
          </div>
        </div>
      </div>
      <div class="leaderboard panel-cut">
        <h2>🏆 Leaderboard</h2>
        <ol class="leaderboard-list"></ol>
      </div>
      <div class="stats-panel panel-cut">
        <div>🎣 Fishing in <span class="stats-current-lake">—</span></div>
        <div>Fish caught <span class="stats-caught-count">0</span></div>
        <div>Total score <span class="stats-caught-value">0</span></div>
        <div class="stats-actions">
          <button type="button" class="collection-button">🐟 Fish Index (<span class="collection-count">0</span>/${FISH_CATALOG.length})</button>
          <button type="button" class="audio-toggle-button wood-button" title="Mute/Unmute Sound" aria-label="Mute or unmute sound"></button>
        </div>
      </div>
      <div class="minimap-frame panel-cut">
        <canvas class="minimap" width="140" height="140"></canvas>
      </div>
      <!-- Mobile controls overlay -->
      <div class="mobile-controls-container">
        <div id="mobile-joystick" class="mobile-joystick">
          <div class="joystick-base">
            <div class="joystick-handle"></div>
          </div>
        </div>
        <button id="mobile-action-btn" class="mobile-action-btn wood-button" type="button">CAST</button>
      </div>
      <div class="cast-meter hidden">
        <div class="cast-meter-track"><div class="cast-meter-fill"></div></div>
        <div class="cast-meter-label">Hold mouse to power cast — release to fish</div>
      </div>
      <div class="fishing-modal hidden">
        <div class="fishing-modal-card">
          <div class="fishing-modal-game-container">
            <canvas class="fishing-modal-canvas" width="200" height="360"></canvas>
          </div>
        </div>
      </div>
      <div class="collection-modal hidden">
        <div class="collection-modal-card panel-cut">
          <div class="collection-modal-header">
            <h2>🐟 Fish Collection</h2>
            <button type="button" class="collection-close" aria-label="Close">×</button>
          </div>
          <div class="collection-list"></div>
          <div class="ad-banner-mini">
            <div class="ad-banner-label">ADVERTISEMENT</div>
            <div class="ad-banner-content" id="collection-ad-banner">
              <div class="ad-placeholder">
                <span class="ad-placeholder-icon">📢</span>
                <span class="ad-placeholder-text">Support the game by whitelisting ads!</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="catch-modal hidden">
        <div class="catch-modal-flash"></div>
        <div class="catch-modal-card panel-cut">
          <div class="catch-modal-rays"></div>
          <div class="catch-modal-burst">
            <span></span><span></span><span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
          <button type="button" class="catch-modal-close" aria-label="Close">×</button>
          <div class="catch-modal-new hidden">New species caught!</div>
          <canvas class="catch-modal-canvas" width="240" height="120"></canvas>
          <div class="catch-modal-name"></div>
          <div class="catch-modal-weight"></div>
          <div class="catch-modal-rarity"></div>
          <div class="catch-modal-value"></div>
        </div>
      </div>
    `;
    this.root.appendChild(this.hud);
    const leaderboardEl = this.hud.querySelector<HTMLDivElement>(".leaderboard")!;
    this.leaderboardList = this.hud.querySelector<HTMLOListElement>(".leaderboard-list")!;
    
    // Toggle leaderboard collapse on mobile
    const leaderboardHeader = leaderboardEl.querySelector("h2");
    if (leaderboardHeader) {
      leaderboardHeader.style.cursor = "pointer";
      leaderboardHeader.addEventListener("click", () => {
        if (document.body.classList.contains("is-mobile")) {
          leaderboardEl.classList.toggle("collapsed");
        }
      });
    }
    // Auto collapse initially on mobile
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isMobile) {
      leaderboardEl.classList.add("collapsed");
    }

    this.caughtCountValue = this.hud.querySelector<HTMLSpanElement>(".stats-caught-count")!;
    this.caughtValue = this.hud.querySelector<HTMLSpanElement>(".stats-caught-value")!;
    this.currentLakeValue = this.hud.querySelector<HTMLSpanElement>(".stats-current-lake")!;
    this.minimapCanvas = this.hud.querySelector<HTMLCanvasElement>(".minimap")!;
    this.minimapCtx = this.minimapCanvas.getContext("2d")!;

    this.castMeter = this.hud.querySelector<HTMLDivElement>(".cast-meter")!;
    this.castMeterFill = this.hud.querySelector<HTMLDivElement>(".cast-meter-fill")!;
    this.mobileActionBtn = this.hud.querySelector<HTMLButtonElement>("#mobile-action-btn");

    this.fishingModal = this.hud.querySelector<HTMLDivElement>(".fishing-modal")!;
    this.fishingModalCanvas = this.hud.querySelector<HTMLCanvasElement>(".fishing-modal-canvas")!;
    this.fishingModalCanvasCtx = this.fishingModalCanvas.getContext("2d")!;

    this.collectionButton = this.hud.querySelector<HTMLButtonElement>(".collection-button")!;
    this.collectionCount = this.hud.querySelector<HTMLSpanElement>(".collection-count")!;
    this.collectionModal = this.hud.querySelector<HTMLDivElement>(".collection-modal")!;
    this.collectionList = this.hud.querySelector<HTMLDivElement>(".collection-list")!;
    this.collectionButton.addEventListener("click", () => {
      this.collectionModal.classList.remove("hidden");
      loadAdBanner("collection-ad-banner", import.meta.env.VITE_ADSENSE_SLOT_COLLECTION);
    });
    this.collectionModal.querySelector(".collection-close")!.addEventListener("click", () => this.collectionModal.classList.add("hidden"));
    this.renderCollectionList([]);

    this.catchModal = this.hud.querySelector<HTMLDivElement>(".catch-modal")!;
    this.catchModalCard = this.hud.querySelector<HTMLDivElement>(".catch-modal-card")!;
    this.catchModalCanvas = this.hud.querySelector<HTMLCanvasElement>(".catch-modal-canvas")!;
    this.catchModalCtx = this.catchModalCanvas.getContext("2d")!;
    this.catchModalName = this.hud.querySelector<HTMLDivElement>(".catch-modal-name")!;
    this.catchModalWeight = this.hud.querySelector<HTMLDivElement>(".catch-modal-weight")!;
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

    // Audio setup and icon syncing
    const updateAudioButtons = () => {
      const isMuted = audioManager.getMuteState();
      const buttons = this.root.querySelectorAll(".audio-toggle-button");
      buttons.forEach((btn) => {
        btn.innerHTML = isMuted ? SPEAKER_OFF_SVG : SPEAKER_ON_SVG;
        btn.setAttribute("aria-label", isMuted ? "Unmute sound" : "Mute sound");
      });
    };
    updateAudioButtons();

    this.root.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(".audio-toggle-button");
      if (btn) {
        audioManager.init(); // Initialize/resume context
        audioManager.toggleMute();
        updateAudioButtons();
      }
    });
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
    // Gates the mobile "rotate device" overlay (see style.css) — only actual gameplay needs landscape,
    // not the connect screen (name entry/skin picker already work fine in portrait).
    document.body.classList.add("in-game");
    // The skin-preview canvas is now hidden — stop its rAF loop so it doesn't keep clearing + redrawing
    // a character every frame behind the game (wasted work while invisible).
    if (this.skinPreviewRaf != null) {
      cancelAnimationFrame(this.skinPreviewRaf);
      this.skinPreviewRaf = undefined;
    }
    loadAdBanner("hud-ad-banner", import.meta.env.VITE_ADSENSE_SLOT_HUD);
  }

  backToConnectScreen() {
    this.connectScreen.classList.remove("hidden");
    this.hud.classList.add("hidden");
    document.body.classList.remove("in-game");
    // Resume the skin-preview animation now that the connect screen is visible again.
    if (this.skinPreviewRaf == null) {
      this.skinPreviewRaf = requestAnimationFrame(this.animateSkinPreview);
    }
    // Force a fresh render of leaderboard/collection on the next session (data is per-session).
    this.lastLeaderboardKey = "";
    this.lastCollectionKey = "";
    this.setConnecting(false);
    loadAdBanner("connect-ad-banner", import.meta.env.VITE_ADSENSE_SLOT_CONNECT);
  }

  updateLeaderboard(entries: LeaderboardEntry[], localPlayerId: string | null) {
    const top = [...entries].sort((a, b) => b.totalValue - a.totalValue).slice(0, 10);
    // Skip the innerHTML rebuild unless the visible content actually changed — this runs every frame but the
    // leaderboard only changes on catch events, so most frames are a no-op.
    const key = `${localPlayerId ?? ""}|${top.map((e) => `${e.playerId}:${Math.round(e.totalValue)}:${e.name}`).join(",")}`;
    if (key === this.lastLeaderboardKey) return;
    this.lastLeaderboardKey = key;
    this.leaderboardList.innerHTML = top
      .map((entry) => {
        const isLocal = entry.playerId === localPlayerId;
        return `<li class="${isLocal ? "me" : ""}">${escapeHtml(entry.name)} — ${Math.round(entry.totalValue)}</li>`;
      })
      .join("");
  }

  /** Bottom-left readout: total fish caught + total value. */
  updateStats(caughtCount: number, totalValue: number) {
    this.caughtCountValue.textContent = String(caughtCount);
    this.caughtValue.textContent = String(Math.round(totalValue));
  }

  /** Name of the lake where the player last successfully cast their line (PlayerState.currentLakeId) — "" if they haven't
   * fished in any lake this session yet. */
  updateCurrentLake(lakeId: string) {
    this.currentLakeValue.textContent = lakeId ? (getLakeById(lakeId)?.name ?? "—") : "—";
  }

  /** Fish collection log — count + the always-available modal list, checked off as species are
   * caught for the first time. `collection` is the local player's list of caught species ids. */
  updateCollection(collection: string[]) {
    // Called every frame from main.ts — but the collection only grows on a (rare) first-catch, so skip the
    // count + full catalog-list DOM rebuild unless it actually changed.
    const key = collection.join(",");
    if (key === this.lastCollectionKey) return;
    this.lastCollectionKey = key;
    this.collectionCount.textContent = String(collection.length);
    this.renderCollectionList(collection);
  }

  private renderCollectionList(collection: string[]) {
    const caught = new Set(collection);
    this.collectionList.innerHTML = FISH_CATALOG.map((fish) => {
      const isCaught = caught.has(fish.id);
      return `
        <div class="collection-item${isCaught ? " caught" : ""}">
          <div class="collection-item-header">
            <span class="collection-item-dot" style="background:${isCaught ? fish.color : "#cfd6c9"}"></span>
            <span class="collection-item-name">${isCaught ? escapeHtml(fish.name) : "???"}</span>
            <span class="collection-item-rarity" style="color:${RARITY_COLOR[fish.rarity]}">${RARITY_LABEL[fish.rarity]}</span>
          </div>
          ${isCaught ? `<div class="collection-item-desc">${escapeHtml(fish.description)}</div>` : ""}
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

  /** Large modal, occupying the center of the screen for the reeling minigame — AUTOMATICALLY opens as soon as a fish bites (now fish
   * biting = directly goes into reeling, no more hooking step) and closes naturally when there is a result
   * (fishState goes back to "idle"). Very different from `showCatchModal`/collection modal: this is NOT a dialog
   * waiting for the user to close — HOLDING/RELEASING the mouse DIRECTLY INSIDE the modal (see `fishingModalInteractiveEl` +
   * `InputController.bindAdditionalTarget` in main.ts) is the way to reel, so the modal always has
   * `pointer-events: auto` to capture that interaction.
   *
   * "1 bar" Redesign: the content is now only a single vertical bar (`drawModalReelScene`) drawing the fish position
   * (`reelFishY`) + the catch zone controlled by the player (`reelZoneY`). The catch zone width is recalculated on the fly
   * using `computeReelZoneSize(species.reelDifficulty)` (no separate synchronization needed, just need to know
   * which species is being reeled via `speciesId`) — using the exact same formula as the backend, see
   * shared/src/constants.ts. `reelProgress` is now the percentage of time the fish has stayed inside the catch zone
   * up to the current moment, displayed as "Chance to catch" since it is also the percentage used to roll the probability
   * when time runs out (see backend/src/systems/fishing.ts#updateReeling). */
  updateFishingModal(
    active: boolean,
    data: { reelProgress?: number; reelFishY?: number; reelZoneY?: number; speciesId?: string; activeFishWeight?: number; nowMs?: number } = {},
  ) {
    this.fishingModal.classList.toggle("hidden", !active);
    if (!active) return;

    const progressPct = Math.max(0, Math.min(100, data.reelProgress ?? 0));

    const species = getFishSpecies(data.speciesId);
    const actualDifficulty = (species && data.activeFishWeight != null)
      ? computeActualDifficulty(species.reelDifficulty, data.activeFishWeight, species.minWeight, species.maxWeight)
      : (species ? species.reelDifficulty : 0.5);
    const zoneSize = species ? computeReelZoneSize(actualDifficulty) : 40;
    // While reeling, do NOT reveal the fish species (Vicent 2026-07-14): draw a dark anonymous fish silhouette (speciesId="" →
    // generic shape, silhouette color). Only when caught (catch modal) will the true species + color be revealed. zoneSize is
    // still calculated using the real species so the difficulty is correct, but the shape doesn't reveal what it is.
    drawModalReelScene(
      this.fishingModalCanvasCtx,
      this.fishingModalCanvas.width,
      this.fishingModalCanvas.height,
      data.reelFishY ?? 50,
      data.reelZoneY ?? 50,
      zoneSize,
      "#33404a", // dark shadow color — mysterious fish
      data.nowMs ?? 0,
      progressPct,
      "", // hide species: use generic silhouette image
    );
  }

  /** DOM region capturing mouse interactions while the fishing modal is open — main.ts calls
   * `InputController.bindAdditionalTarget` with this element so that mousedown/mouseup inside the modal
   * also triggers hook/reel exactly like clicking on the canvas. */
  get fishingModalInteractiveEl(): HTMLDivElement {
    return this.fishingModal;
  }

  /** Celebration modal when the LOCAL player catches a fish — shows a fish icon drawn on canvas (color by
   * species), name/rarity/value, and closes upon clicking × / clicking outside to close early.
   * "Grandeur level" (glow, light rays, particle burst, screen shake) increases based on rarity — intentionally
   * NOT triggering all effects for every catch, so the real "wow" feeling is reserved for rare/legendary
   * fish instead of being diluted and causing eye strain on common catches. See `.rarity-*` in
   * style.css. */
  showCatchModal(speciesId: string, rarity: FishRarity | undefined, value: number, weight: number, isFirstCatch: boolean) {
    const species = getFishSpecies(speciesId);
    if (!species) return;

    this.catchModalCtx.clearRect(0, 0, this.catchModalCanvas.width, this.catchModalCanvas.height);
    drawFishIcon(this.catchModalCtx, this.catchModalCanvas.width / 2, this.catchModalCanvas.height / 2, 130, species.id, species.color);

    this.catchModalName.textContent = species.name;
    this.catchModalWeight.textContent = `Weight: ${weight.toFixed(2)} kg`;
    this.catchModalRarity.textContent = rarity ? RARITY_LABEL[rarity] : "";
    this.catchModalRarity.style.color = rarity ? RARITY_COLOR[rarity] : "";
    this.catchModalNew.classList.toggle("hidden", !isFirstCatch);

    const rarityKey = rarity ?? "common";
    this.catchModalCard.style.setProperty("--rarity-color", RARITY_COLOR[rarityKey]);

    // Force every CSS entrance/glow/burst animation to replay from frame 0 even if a previous catch
    // modal is still mid-animation (rapid consecutive catches) — remove the rarity/flash classes,
    // force a reflow, then re-add. Without the reflow, re-adding an already-present class is a no-op
    // and @keyframes just keep running from wherever they were.
    this.catchModalCard.classList.remove("rarity-common", "rarity-uncommon", "rarity-rare", "rarity-legendary");
    this.catchModal.classList.remove("legendary-flash");
    void this.catchModalCard.offsetWidth; // force reflow
    this.catchModalCard.classList.add(`rarity-${rarityKey}`);
    if (rarityKey === "legendary") this.catchModal.classList.add("legendary-flash");

    this.animateCatchValue(value);

    // No longer auto-closes — modal stays until the player manually closes it (× button or clicking the background,
    // see listener in constructor). Still clears the old timeout in case one remains from a previous version.
    window.clearTimeout(this.catchModalTimeout);
    this.catchModal.classList.remove("hidden");
  }

  /** Counts the score running from 0 to the actual value (ease-out, ~550ms) instead of directly displaying the final number —
   * adding some slot machine "juice" to the scoring moment. Cancels ongoing counting if a new fish is caught
   * while still counting (fast consecutive catches). */
  private animateCatchValue(target: number) {
    if (this.catchValueAnimFrame != null) cancelAnimationFrame(this.catchValueAnimFrame);
    const roundedTarget = Math.round(target);
    const start = performance.now();
    const durationMs = 550;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      this.catchModalValue.textContent = `+${Math.round(roundedTarget * eased)}`;
      if (t < 1) {
        this.catchValueAnimFrame = requestAnimationFrame(tick);
      } else {
        this.catchModalValue.textContent = `+${roundedTarget}`;
        this.catchValueAnimFrame = undefined;
      }
    };
    this.catchValueAnimFrame = requestAnimationFrame(tick);
  }

  /** Bottom-right minimap: each lake is drawn with its actual shape/position (scaled down), each player has a
   * dot scaled from world space, local player highlighted separately. */
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

  updateMobileControls(fishState: string) {
    if (!this.mobileActionBtn) return;
    if (fishState === "reeling") {
      this.mobileActionBtn.textContent = "REEL";
      this.mobileActionBtn.classList.add("danger");
    } else if (fishState === "waiting" || fishState === "bite") {
      this.mobileActionBtn.textContent = "REEL";
      this.mobileActionBtn.classList.remove("danger");
    } else {
      this.mobileActionBtn.textContent = "CAST";
      this.mobileActionBtn.classList.remove("danger");
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
