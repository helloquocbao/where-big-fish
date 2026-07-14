# Progress Log

## 2026-07-14 - Integrated Google AdSense Banners

Integrated real Google AdSense advertisements, replacing static lobby, HUD, and collection panel placeholders.

- `frontend/.env.example`, `frontend/.env.production`: Documented and set up environment variables for the Publisher ID (`VITE_ADSENSE_CLIENT_ID`) and specific slot IDs (`VITE_ADSENSE_SLOT_CONNECT`, `VITE_ADSENSE_SLOT_HUD`, `VITE_ADSENSE_SLOT_COLLECTION`).
- `frontend/src/ads.ts`: Created helper functions to inject the Google AdSense client script dynamically into the document `<head>` and load specific ad slots by targeting container IDs.
- `frontend/src/ui.ts`: Integrated the ad helpers to initialize AdSense on boot, load the lobby banner, load the in-game HUD banner when entering the game, load the collection modal banner when opened, and reload the lobby banner when returning to the lobby.

## 2026-07-13 - Added BGM and SFX Synthesizer (Web Audio API)

Created a fully synthesized audio system in the browser using the native Web Audio API, matching the cozy Stardew Valley theme with zero static asset dependencies.

- `frontend/src/audio.ts`: Created `AudioManager` synthesizing cozy ambient chord progressions (Cmaj9 - Fmaj7 - Am7 - G6), dreamy delay effects, pentatonic melodies, and game SFXs (casting sweeps, splash plops, fish bite alerts, walking footsteps, mechanical reel ticks, tension alarms, snap/escape cues, detuned buzzer rejections, and custom rarity fanfares).
- `frontend/src/ui.ts`: Inserted speaker icon buttons (🔊/🔇) to the connection card and stats panel to support master mute toggles.
- `frontend/src/main.ts`: Setup user interaction initializers for AudioContext (satisfying browser autoplay policy), integrated audio triggers in network callbacks, and tracked frame loop states for movement, reeling, and tension.
- `frontend/src/input.ts`: Exposed a public `isReelHeld` getter.
- `frontend/src/style.css`: Added styles for audio action controls matching the wood/parchment color schemes.

## 2026-07-06 - Character redesigned again: bean/droplet blob -> round Kirby-style ball

Direct feedback from Vicent: the bean/droplet blob shape (previous redesign) "looks gross" - most
likely the asymmetric trailing lobe at the back, which read as slug/leech-like rather than cute.
Presented 3 alternative directions (round ball, animal-with-ears, egg/candy shape); picked "round
ball, Kirby-style."

- `shared/src/constants.ts`: `BLOB_RADIUS_Y_RATIO`/`BLOB_RADIUS_X_RATIO` (asymmetric long/short
  axis) replaced with a single `BALL_RADIUS_RATIO` (perfect circle, no axis distinction);
  `BLOB_FOOT_RADIUS_RATIO` renamed `BALL_FOOT_RADIUS_RATIO`. `computeCharacterExtent` updated to
  the new single-radius geometry.
- `frontend/src/render.ts`: `drawCharacter` now draws one plain circle (no second trailing lobe).
  Eyes upgraded from flat black dots to Kirby-style sclera + pupil + glint (flat dots were part of
  what read as lifeless/creepy); added pink cheek blush, Kirby's signature cute cue. Body still
  rotates to face movement (eyes/blush/feet are not circularly symmetric even though the body
  outline itself doesn't visibly change under rotation). Squash-and-stretch on the pounce leap,
  walk bounce, idle bob, and topper accessories all carried over unchanged in spirit, retuned to
  the new proportions.
- `frontend/src/config.ts`: re-exports updated to the renamed constants.

### Verification performed

`npm run typecheck` clean across all three workspaces, backend restarted cleanly. Visual check via
the running preview: skin picker preview and in-game rendering both show a clean round ball with
proper eyes/blush per skin, multiple bots on screen read distinctly and don't look blob-like
anymore, pounce squash-stretch still animates correctly (stretches into a rugby-ball shape
mid-air, as expected for a round body). No console/network errors.

## 2026-07-05 - Food now has 7 colors/types worth 1-4 points each (was a flat 1 point, one color)

Direct request from Vicent: energy particles should come in multiple colors with different point
values, max 4, about 7 color types.

- `shared/src/constants.ts`: new `FOOD_TYPES` catalog (7 entries: id, color, value 1-4, spawn
  `weight`) + `pickRandomFoodType()` (weighted random) and `getFoodType(id)` (safe lookup,
  fallback to the first entry - same pattern as `getSkinDefinition`). Higher-value types are much
  rarer (`gem`, value 4, weight 1 vs `berry`, value 1, weight 30), matching the usual
  rare-loot-is-valuable convention. Removed `FOOD_SIZE_VALUE` (the old flat-value constant) since
  value now comes from whichever type was rolled.
- `shared/src/types.ts` + `backend/src/schema/State.ts`: `FoodState`/`FoodSchema` gained a
  `typeId` field (which of the 7 types this particle is - value alone doesn't uniquely determine
  color since two types can share a value, e.g. `berry` and `orange` are both worth 1).
- `backend/src/systems/food.ts`: `replenishFood` and `dropFoodBurst` both roll a
  `pickRandomFoodType()` per particle instead of a fixed value; `dropFoodBurst` (death drops) now
  greedily spends down the total value with randomly-typed particles instead of N identical ones.
- `frontend/src/render.ts`: `drawFood` colors each particle from `getFoodType(f.typeId).color`
  instead of one hardcoded coral color; the rarest/highest-value type gets an extra shadow-blur
  shimmer so it visibly stands out as worth going for.

### Verification performed

`npm run typecheck` clean across all three workspaces, backend restarted cleanly. Verified live
against the real backend: sampled the room's 287 spawned food particles and got all 7 types
(berry/orange/lemon/lime/blueberry/grape/gem) with values exactly {1,2,2,3,3,1,4} as configured,
and counts matching the weighting (berry 82, orange 70 vs. gem 1, grape 8) - confirms both the
type variety and the rarity skew work as intended. Visual check in the running preview shows
distinctly colored particles (red, orange, green, purple) scattered on the field.

## 2026-07-05 - Bomb redesigned as a size-independent equalizer (skill counter to veterans)

Direct design gap flagged by Vicent: in slither.io, a skillful new/small player can cut off a much
bigger veteran's head and kill them - pure skill beats size. Bomb Tag had no equivalent: both
nhảy đè and ném bomb resolved via the same size-ratio table (`resolvePounceOutcome`), so a much
smaller player attacking a much bigger one always lost (`attacker_dies`), regardless of skill.
Since this game has no long snake body to "cut off," the chosen equivalent: keep nhảy đè exactly
as the size-ratio duel it already is, but make ném bomb a true equalizer - it now kills whoever it
hits unconditionally, no matter their size. The "skill" lives in landing the shot (aim + predict
movement) and in having earned `BOMB_UNLOCK_SCORE` (200) through good play - not in being big. The
long 45s cooldown and score gate are the cost of that power.

- `backend/src/systems/bomb.ts`: `tryThrowBomb` no longer calls `resolvePounceOutcome`/
  `applySizeDuelOutcome` on a hit - a hit is now an unconditional kill (`ctx.onDeath` + absorb the
  target's score/size, capped at `PLAYER_MAX_SIZE` as usual). A miss (`targetId: null`) still does
  nothing to either side.
- `shared/src/types.ts`: `bomb_exploded`'s `outcome: PounceOutcome | null` field removed entirely
  - with only "hit = kill" or "miss = nothing" possible now, `targetId != null` alone fully
    describes the result; keeping a 3-way `PounceOutcome` field would have been misleading dead
    weight.
- `frontend/src/main.ts`: removed the now-impossible "attacker_shrinks" bomb toast branch (bomb
  can never produce that outcome anymore); added a "trúng đích — hạ gục đối thủ!" toast for the
  thrower on a successful kill, since every hit is now unambiguously a clean kill worth calling out.

### Verification performed

`npm run typecheck` clean across all three workspaces, backend restarted cleanly. Verified
directly against the production `tryThrowBomb`: a size-25 player at the just-unlocked 200 score
successfully kills a size-300 (12x bigger) target with a bomb, absorbing their score/size -
confirms size no longer gates the outcome at all for this mechanic.

## 2026-07-05 - Added a max size cap (PLAYER_MAX_SIZE = 400)

Direct feedback from Vicent: size had no upper bound - eating food and absorbing a killed
opponent's size on a successful pounce/bomb could grow a player indefinitely. Added
`PLAYER_MAX_SIZE = 400` (20x starting size, playtest-tunable like the other size/speed
constants) to `shared/src/constants.ts`, and clamped both places size increases:
`GameRoom.ts#checkFoodConsumption` (eating) and `combatOutcome.ts#applySizeDuelOutcome`
(`target_dies` absorb). `score` is intentionally NOT capped - it's a ranking stat, not a physical
dimension, so it keeps accumulating even after size maxes out.

### Verification performed

`npm run typecheck` clean, backend restarted cleanly. Verified directly against the production
`applySizeDuelOutcome`: an attacker already near the cap absorbing a target that would push them
past it (380 + 100 = 480) correctly clamps to 400, while score still accumulates uncapped (700).

## 2026-07-05 - Character redesigned from stick figure to a single blob ("hạt đậu")

Direct feedback from Vicent with a screenshot: the stick-figure + cartoon eyes combo looked ugly
and visually cluttered, especially with many characters on screen/at a distance (thin limbs
fragmenting into messy lines). Presented 3 shape alternatives; picked "rounded bean/droplet blob,
no stick limbs" as the replacement.

- `shared/src/constants.ts`: renamed `STICK_FIGURE_HEAD_RATIO`/`STICK_FIGURE_LIMB_RATIO` ->
  `BLOB_RADIUS_Y_RATIO`/`BLOB_RADIUS_X_RATIO` (+ new `BLOB_FOOT_RADIUS_RATIO`), and
  `computeStickFigureExtent` -> `computeCharacterExtent`, matching the new geometry. Character is
  now noticeably more compact (total height ~1.49x size vs ~3.06x for the old stick figure), so
  `computePounceHitRadius` (derived from this) and the food-eating segment shrink correspondingly
  - an intentional side effect of the hitbox matching the new, smaller visual footprint, not a
    separate balance change.
- `frontend/src/render.ts`: `drawStickFigure` replaced with `drawCharacter` - a single oval body
  (plus a smaller trailing bump for a bean-shaped silhouette) that rotates to lean into the facing
  direction, with small foot nubs stepping while moving instead of stick legs, no arms. Eyes and
  blink logic kept (now drawn in the body's local rotated space instead of world space). Topper
  accessories and name tags stay upright in screen space regardless of body rotation (like a name
  tag normally would). Squash-and-stretch on the pounce leap and the walk bounce/idle bob carried
  over from the previous animation work, retuned to the new (shorter) proportions.
- Also retuned the invulnerability shield ring, pounce attacker halo, and name-tag vertical offset
  - all were sized/positioned assuming the old, much taller stick figure and looked disconnected
    (floating too high, ring off-center) against the new compact blob.

### Verification performed

`npm run typecheck` clean across all three workspaces. Verified `computeCharacterExtent(20)` by
hand (topOffset -2, bottomOffset 28.64, half-height/pounce radius 15.32). Visual check via the
running preview: skin picker preview and in-game rendering both show the new bean shape correctly
per-skin (color + topper), multiple bots on screen at once read cleanly without limb clutter,
pounce squash-stretch still animates correctly on the new shape. No console/network errors.

## 2026-07-05 - Growth-too-fast regression from the whole-body eating fix, tuned down

Direct feedback from Vicent right after the whole-body food-eating fix (previous log entry):
size increases noticeably faster now. Root cause: switching the eat check from a circle around
one point to a capsule spanning the whole head-to-toe segment, while keeping `EAT_RADIUS_FACTOR`
at its old value (1.5), increased the total catch area by ~2.24x at starting size (2827 -> 6327
sq. units) - the whole-body coverage was correct, but the leftover per-point radius from the old
point-based check made the capsule much thicker than needed.

- `EAT_RADIUS_FACTOR`: 1.5 -> 0.85. Chosen to bring total catch area back to ~parity with the
  original point-based check (2670 sq. units at size 20, ~0.94x of the original) while keeping
  correct whole-body coverage (head/torso/feet all still catch food at the same tolerance).

### Verification performed

`npm run typecheck` clean, backend restarted cleanly. Recomputed the capsule-area math by hand for
factors 0.75-1.5 to pick 0.85, then re-ran the same `distanceToVerticalSegment`-based checks used
in the previous fix's verification (head/torso/feet food all still correctly caught at the new,
smaller radius; food genuinely outside the body still isn't).

## 2026-07-05 - Pounce hit radius now uses real body geometry; food-eating covers whole body

Two related fixes to `shared/src/constants.ts`, both stemming from the same root cause: game
logic was using `size` (an abstract number) as a stand-in for the stick figure's actual on-screen
dimensions, when the real geometry (STICK_FIGURE_HEAD_RATIO/LIMB_RATIO, previously
frontend-only in `config.ts`) was available and more accurate.

- Moved `STICK_FIGURE_HEAD_RATIO`/`STICK_FIGURE_LIMB_RATIO` from `frontend/src/config.ts` into
  `shared/src/constants.ts` (re-exported from `config.ts` for callers), since they now affect
  actual hit-detection, not just rendering. Added `computeStickFigureExtent(size)` returning the
  real head-to-toe span using the exact geometry `render.ts#drawStickFigure` draws with.
- `computePounceHitRadius`: was `size / 2`; now `computeStickFigureExtent(size).totalHeight / 2`
  (half the real head-to-toe height) per Vicent's request. At starting size 20 this is ~29 world
  units vs the old ~10 - the landing-zone circle (and bomb blast radius, which reuses the same
  function) is correspondingly bigger and easier to see. Also restyled the telegraph circle in
  `render.ts` (dashed full-size guide drawn immediately + glow + center dot) since it was reported
  hard to see even before the radius change.
- Food-eating (`GameRoom.ts#checkFoodConsumption`) switched from a circle around the player's
  single anchor point (`player.x, player.y` - which is the top of the head, not the body center)
  to a distance check against the whole head-to-toe vertical segment
  (`utils.ts#distanceToVerticalSegment`), using `EAT_RADIUS_FACTOR` as the segment's thickness
  instead of one big circle's radius. Previously food overlapping the torso/legs visually but far
  from the head anchor wasn't eaten - verified via a script directly exercising the new distance
  function that a food particle at the character's feet (49 units from the anchor, "eaten=false"
  under the old point check) is now correctly caught ("eaten=true").

### Verification performed

`npm run typecheck` clean across all three workspaces, backend restarted cleanly under `tsx
watch`. Verified `computeStickFigureExtent(20)` math by hand (topOffset -7, bottomOffset ~51.3,
half-height ~29.16). Verified the food-eating fix with a standalone script constructing a real
`PlayerSchema` and calling the actual `distanceToVerticalSegment` used in production: food near
the head, mid-torso, and feet are all now caught; food genuinely outside the body is still not.

## 2026-07-05 - Bomb mechanic redesigned: score-gated ranged skill, no longer forced-pass

Direct decision with Vicent: "nhảy đè" (pounce) is the game's core PvP mechanic. The original
bomb design (population-scaled bomb count, forced random assignment, holder-explodes-if-not-
passed-in-7s, auto-target-nearest-in-cone) is removed entirely and replaced with a score-gated
ranged skill: throw in the mouse direction, explodes at a fixed point (like pounce's landing
spot), same size-ratio outcome table as pounce (`resolvePounceOutcome`), 45s cooldown, unlocked
at 200 score. Updated `docs/concept_brief.md` section 3 (and USP/assumptions sections) to match —
per AGENTS.md, code follows the brief, not the other way around.

### shared/ changes

- Removed `PLAYERS_PER_BOMB`, `computeBombCount`, `BOMB_TIMER_SECONDS`, `BOMB_THROW_CONE_DEGREES`.
- `BOMB_THROW_COOLDOWN_MS`: 9000 -> 45000.
- Added `BOMB_UNLOCK_SCORE = 200`.
- Kept `BOMB_THROW_RANGE` (400) - now the distance from thrower to the fixed explosion point.
- `types.ts`: removed `BombState`, removed `holdingBombId` from `PlayerState`, removed `bombs`
  from `RoomSnapshot`. `ServerEvent`'s `bomb_exploded` restructured to
  `{ throwerId, x, y, targetId, outcome }` (no more `bombId`/`holderId` - there's no persisted
  bomb entity anymore, it resolves instantly); removed `bomb_passed`.

### Backend changes

- `schema/State.ts`: removed `BombSchema`, `bombs` field on `RoomState`, `holdingBombId` on
  `PlayerSchema`.
- `systems/bomb.ts`: rewritten. `rebalanceBombCount`/`resolveExpiredBombs` deleted.
  `tryThrowBomb(ctx, thrower)` now: checks `score >= BOMB_UNLOCK_SCORE` + cooldown, resolves
  instantly against a fixed point (`thrower.angle` + `BOMB_THROW_RANGE`, clamped to world bounds),
  blast radius = `computePounceHitRadius(thrower.size)` (same size-scaled radius as pounce),
  outcome via `resolvePounceOutcome` + the new shared `applySizeDuelOutcome` helper.
- Added `systems/combatOutcome.ts`: `applySizeDuelOutcome` factors out the score/size transfer
  logic (target dies / attacker shrinks / attacker dies) that pounce and bomb now both use, so a
  future rule change can't drift between the two.
- Moved `findNearestOpponentInRange` from `pounce.ts` (private) to `utils.ts` (exported) since
  bomb.ts needed the identical spatial query.
- `GameRoom.ts`: removed bomb-rebalance tick, expired-bomb tick, `bombs` state wiring, and the
  `onLeave`/`handleDeath` bomb-cleanup branches (nothing to clean up anymore - no persisted bomb).
- `utils.ts`: removed now-unused `pickRandom` (was only used by the deleted rebalance logic).

### Frontend changes

- `render.ts`: removed `drawBombIndicator` (holder countdown badge) and `drawThrowCone` (cone
  preview tied to "currently holding a bomb", a state that no longer exists). Added
  `drawExplosion`/`ExplosionVfx` - a one-shot expanding/fading flash at the blast point, since
  there's no persisted bomb entity to read a position from every frame; `main.ts` pushes one from
  each `bomb_exploded` event and prunes it after `EXPLOSION_VFX_DURATION_MS`.
- `ui.ts`: `.bomb-hint` ("Bạn đang cầm bomb!") removed. Throw cooldown ring now shows a `.locked`
  state (greyed out) when the local player's score is under `BOMB_UNLOCK_SCORE`, instead of
  reflecting a "currently holding" boolean.
- `main.ts`/`state.ts`/`net.ts`: removed all `BombState`/`bombs` plumbing; `onGameEvent` handles
  the new `bomb_exploded` shape (push VFX, toast on the thrower's own `attacker_shrinks`).

### Verification performed

`npm run typecheck` clean across all three workspaces after each file group. Backend restarted
cleanly under `tsx watch` with no runtime errors.



## 2026-07-05 - Backend agent: initial GameRoom implementation

Status: Backend MVP complete - Colyseus room, movement, food, pounce, bomb, death/respawn,
leaderboard all implemented and verified (typecheck + integration tests passing).

### shared/ changes (backend agent, needed before coding)

- Added WORLD_WIDTH = 4000, WORLD_HEIGHT = 4000 to shared/src/constants.ts - map bounds were not
  previously defined anywhere in shared/, but are required for server-side spawn placement
  (food/players) and position clamping, and for BOMB_THROW_RANGE (400) / POUNCE_RANGE (150) to
  make sense relative to the play field. Frontend should use these same bounds for camera/world
  rendering.
- Added LEADERBOARD_SIZE = 10 - top-N size for the per-room leaderboard (spec section 5),
  previously unspecified.
- Added SERVER_TICK_RATE = 30 - server simulation loop rate (ticks/sec). Documented as
  performance-tuning, not a hard game rule, but centralized so FE prediction code (if any) can
  reference the same cadence instead of guessing.

No other constants were touched. All existing bomb/pounce/speed/food formulas are used as-is
from shared/src/constants.ts - no rule numbers were reinterpreted.

### Backend files added (backend/src/)

- index.ts - Colyseus server bootstrap, registers GameRoom under name "game".
- rooms/GameRoom.ts - room lifecycle (onCreate/onJoin/onLeave), message handlers
  (move/pounce/throw_bomb), main tick loop wiring all systems together.
- schema/State.ts - @colyseus/schema classes: PlayerSchema, FoodSchema, BombSchema,
  LeaderboardEntrySchema, RoomState (network-synced state tree).
- systems/movement.ts - per-tick position update using computeSpeed(size).
- systems/food.ts - spawn/replenish to FOOD_SPAWN_TARGET_DENSITY, death-burst drop.
- systems/pounce.ts - windup/telegraph + resolution against nearest opponent at target point,
  using resolvePounceOutcome.
- systems/bomb.ts - bomb count rebalancing via computeBombCount, cone/fallback targeting
  (distance/direction only, no size weighting per spec), throw cooldown, timeout explosion.
- systems/death.ts - full reset + respawn on death.
- systems/leaderboard.ts - periodic top-N recompute.
- systems/utils.ts - id gen, world-space RNG helpers, distance/angle math.

Also updated backend/tsconfig.json: added experimentalDecorators: true and
useDefineForClassFields: false, required for @colyseus/schema's @type() decorators to compile
under this TS/target combination. This is a build-tooling requirement, not a game-rule change.

### Ambiguity encountered and resolution

concept_brief.md doesn't specify a map/world size number (only relative ranges like
BOMB_THROW_RANGE). Resolved by picking a 4000x4000 world-space square (documented above) - large
enough that a 120-player room doesn't feel instantly cramped relative to a 400-unit throw range,
but not so large that food density feels sparse. Flagged as a playtest-tunable value, same spirit
as the other "chosen midpoint, tune later" constants already in the file.

### Verification performed

npx tsc -p tsconfig.json (zero errors) plus a real Colyseus server boot via colyseus.js client
integration tests exercising joinOrCreate matchmaking (2 clients land in same room), movement,
food-eating, pounce windup/resolve/cooldown, and a 22-player scenario proving computeBombCount
rebalancing, bomb timeout -> death -> respawn -> bomb reassignment all fire exactly once per real
event (no duplicate-broadcast bugs). Also unit-tested bomb cone vs. fallback targeting and all
three pounce outcome branches (target_dies / attacker_shrinks / attacker_dies) directly against
schema instances.

## 2026-07-05 - Frontend agent: initial game client

Status: Frontend MVP complete - Colyseus connection, canvas rendering, input, HUD all
implemented and verified (typecheck + build passing).

### Files added (frontend/src/)

- main.ts - entry point, wires canvas/UI/net/input/render loop.
- net.ts - Colyseus client wrapper (connect/joinOrCreate, snapshot getter, send, connection
  status callback with graceful error handling if backend unreachable).
- state.ts - defensive normalizer from raw room.state into the shared RoomSnapshot shape.
- render.ts - stick-figure players scaled by size, food dots, bomb glow + live countdown, pounce
  telegraph (attacker highlight + landing circle, visible to all clients), throw-direction cone.
- input.ts - mouse-direction movement, Space/right-click pounce, E to throw bomb.
- ui.ts - connect screen, leaderboard, cooldown rings driven by each action's cooldown constant.
- config.ts - frontend-only rendering config (server URL, stick-figure proportions, move-send
  interval).

Removed unused Vite scaffold leftovers (counter.ts, template svg/png assets) that weren't wired
into main.ts - dead code cleanup, no behavior change.

### Reconciliation (main/orchestrating agent, after both sub-agents finished)

Frontend and backend agents ran in parallel and couldn't see each other's shared/ edits in
real time. Frontend agent, finding no world-size constant available yet, added its own local
WORLD_SIZE = 4000 guess in frontend/src/config.ts. Backend agent, independently, added
WORLD_WIDTH/WORLD_HEIGHT = 4000/4000 to shared/src/constants.ts. Fixed by re-pointing
frontend's WORLD_SIZE to import WORLD_WIDTH from @bomio/shared instead of keeping a local
duplicate - both agents happened to guess the same value (4000), so this was a de-duplication
fix, not a behavior change. Re-verified: frontend tsc --noEmit and vite build both still pass.

### Verification performed

npx tsc --noEmit (zero errors), npx vite build (succeeds). Manually confirmed npm run dev serves
all modules with HTTP 200 and no console errors. End-to-end integration test (main/orchestrating
agent): booted the real backend and used a scripted colyseus.js client (mirroring exactly what
frontend/src/net.ts does) to joinOrCreate "game", confirmed player state fields match what
render.ts expects (id/x/y/size/score/alive), confirmed movement updates position over time, and
confirmed sending pounce/throw_bomb messages doesn't crash the server.

## 2026-07-05 - Independent audit + bug fixes (main/orchestrating agent)

Ran a full independent audit (fresh-context sub-agent, code review + live build/boot/integration
testing) against docs/concept_brief.md. Full report shared with Vicent in chat; fixed all
Critical findings and the Moderate findings with real gameplay/security impact. Not fixed (noted
as follow-up, lower priority for MVP): M5 (no brief invulnerability window after respawn), M6
(food-collision check is O(players x food) per tick — fine at current scale, needs a spatial
grid before pushing toward 150-player rooms), and the pure code-quality "Minor" items (a couple
of unused exports, one type-duplication nit).

### Critical fixes

- **C1 - `angle: Infinity` teleport exploit** (backend/src/rooms/GameRoom.ts): the `move` handler
  only rejected `NaN` via `Number.isNaN`, which does not catch `Infinity`/`-Infinity`. Those
  values propagated into `Math.cos`/`Math.sin` as `NaN`, and colyseus serializes `NaN` as `0`,
  teleporting the player to the origin. Changed the guard to `Number.isFinite`, which rejects
  `NaN` and both infinities. Verified live: sending `{angle: Infinity}` after a valid move no
  longer resets position.
- **C2 - world bounds mismatch between backend and frontend** (frontend/src/config.ts,
  render.ts, main.ts): backend centers the world on the origin
  (`[-WORLD_WIDTH/2, WORLD_WIDTH/2] x [-WORLD_HEIGHT/2, WORLD_HEIGHT/2]`), but frontend assumed
  an origin-anchored `[0, WORLD_SIZE]` square (used only `WORLD_WIDTH` for both axes, too).
  Re-exported `WORLD_WIDTH`/`WORLD_HEIGHT` directly from `@bomio/shared` instead of a derived
  `WORLD_SIZE`, fixed `drawWorldBounds` to draw the centered rectangle, and fixed the camera's
  initial position to `(0,0)` instead of `(WORLD_SIZE/2, WORLD_SIZE/2)`.
- **C3 - bomb "orphaned" on disconnect undercounts room's bomb total**
  (backend/src/rooms/GameRoom.ts `onLeave`): previously left a disconnected holder's bomb armed
  in state until its own countdown expired, during which `rebalanceBombCount` still counted it as
  active and refused to spawn a replacement — the room silently ran under the spec'd bomb count
  for up to `BOMB_TIMER_SECONDS` after any holder disconnected. Now deletes the bomb immediately
  on `onLeave` so the next rebalance pass (up to `BOMB_REBALANCE_INTERVAL_MS` = 1s later) spawns a
  fresh one on someone still present. Verified live with 22 simulated clients: bomb count recovers
  in ~1-1.7s instead of leaving a gap for up to 7s.

### Moderate fixes

- **M1 - frontend ignored all `ServerEvent` broadcasts**: backend was already broadcasting
  `player_died`/`pounce_resolved`/`bomb_passed`/`bomb_exploded`, but nothing on the client
  listened. Added a wildcard `room.onMessage("*", ...)` in `net.ts` (`onGameEvent` callback) and a
  toast notification in `ui.ts`/`main.ts`: local player now sees "Bạn đã bị nổ bomb!" / "Bạn đã bị
  ăn thịt!" on death, "Bạn vừa nhận bomb!" when a bomb is thrown to them, and a failed-pounce
  notice.
- **M2 - pounce hit radius didn't match the telegraph circle drawn on screen**: server was
  reusing `POUNCE_RANGE` (150, the distance the landing point is placed ahead of the attacker) as
  the hit-check radius around that landing point too, while the frontend telegraph circle was
  sized off `player.size` — unrelated numbers, so dodging the visible circle didn't reliably mean
  dodging the real attack. Added a dedicated `POUNCE_HIT_RADIUS` (70) constant to `shared/`, used
  by both the server's resolve-time nearest-opponent search and the frontend's telegraph circle
  radius, so what's drawn is what actually hits.
- **M3 - food-eating radius smaller than the visual stick figure**: eat radius was a bare
  `player.size`, noticeably smaller than the rendered stick figure's footprint. Added
  `EAT_RADIUS_FACTOR` (1.5) to `shared/`, applied server-side.
- **M4 - `PLAYER_MIN_SIZE` declared but never used**: failed-pounce shrink was floored at
  `PLAYER_START_SIZE`, meaning a failed pounce could never bring you below your starting size —
  softer than the "vừa lợi vừa hại" (real risk) intent in concept_brief.md section 2. Floor
  changed to `PLAYER_MIN_SIZE` (10).
- **M7 - no rate limiting on `move` messages**: added `MIN_MOVE_MESSAGE_INTERVAL_MS` (20ms, ~50
  msg/s cap) to `shared/`, enforced server-side per player via a new non-synced
  `lastMoveMessageAt` field on `PlayerSchema`. Verified live: sending 50 `move` messages back to
  back doesn't crash or misbehave the server.

### Verification performed

`npx tsc` clean on all three packages (shared/backend/frontend), `npx vite build` clean. Live
re-tests against the real backend: Infinity-angle no longer teleports (position keeps advancing
along the last valid angle instead), 22-simulated-client bomb-disconnect scenario recovers bomb
count within ~1.7s instead of leaving up to a 7s gap, move-spam (50 messages) doesn't crash.

## 2026-07-05 - Remaining audit items fixed (M5, M6, all Minor findings)

Vicent asked to fix everything left from the audit report. Added root `npm run typecheck` /
`npm run build` scripts spanning all three workspaces (m10) - used those below to verify.

- **M5 - no invulnerability after respawn**: added `RESPAWN_INVULNERABILITY_MS` (1500ms) to
  `shared/`, a new synced `invulnerableUntil` field on `PlayerSchema`, set on every respawn in
  `death.ts`. Invulnerable players are excluded from pounce targeting (`pounce.ts`) and from
  being handed a fresh bomb (`bomb.ts` rebalance + throw-target selection) - they still count
  toward `computeBombCount`'s population number, just can't be the one holding it. Frontend draws
  a dashed blue shield ring while active. Verified live: forced a bomb to explode on a real
  client, confirmed `invulnerableUntil` is a live future timestamp immediately on respawn.
- **M6 - food-collision was O(players x food) per tick**: added `backend/src/systems/
  spatialGrid.ts` (uniform grid, 200-unit cells, rebuilt once per tick from `state.food`).
  `checkFoodConsumption` now queries only nearby cells per player instead of the full food set.
  Verified live: steered a client straight at the nearest known food particle and confirmed it
  still gets eaten (size increased, food count decremented then topped back up by the normal
  replenish cycle) - same exact-distance check as before, just a narrower candidate set.
- **m1/m2 - dead code removed**: unused `alivePlayers()` (`backend/src/systems/utils.ts`) and
  unused `Vector2` interface (`shared/src/types.ts`) deleted.
- **m3 - `PounceOutcome` duplication**: `shared/src/types.ts`'s `ServerEvent` now imports and
  reuses `PounceOutcome` from `constants.ts` instead of re-declaring the same string union
  separately (the two could have silently drifted apart).
- **m4/m5 (minor) - telegraph animation wasn't tied to the real windup countdown**:
  `pounceResolveAt` is now a synced field on `PlayerSchema` (was server-internal only). Frontend's
  telegraph circle growth is now computed from the real `pounceResolveAt - now` remaining time
  instead of `nowMs % POUNCE_WINDUP_MS`, so the circle finishes growing exactly when the server
  will actually resolve the attack.
- **m6 (minor) - `holdingBombId` wire-type mismatch**: documented in both `shared/src/types.ts`
  and `schema/State.ts` that `@colyseus/schema` has no true "null" wire value for string fields
  (client may see `undefined` where server set `null`) - widened the shared type to
  `string | null | undefined` to match reality instead of silently relying on JS falsy-checks
  being "close enough."
- **m7 - already resolved** as part of the earlier C2 fix (frontend now imports both
  `WORLD_WIDTH`/`WORLD_HEIGHT` from `@bomio/shared` instead of a single derived `WORLD_SIZE`).
- **m8 - tick loop had no error isolation**: `GameRoom.update()` now wraps the actual per-tick
  logic (renamed to `tick()`) in try/catch, logging and skipping a bad tick instead of letting an
  uncaught exception potentially kill the room's whole simulation interval.
- **m9 - misleading comment on `generateId`**: corrected the comment - the id counter is
  module/process-global, not per-room-scoped as previously (harmlessly) implied.
- **m10 - no top-level typecheck/build**: added `npm run typecheck` and `npm run build` at the
  repo root, chaining shared -> backend -> frontend.

### Verification performed

`npm run typecheck` and `npm run build` both clean across all three workspaces. Live integration
tests against the real backend for each behavioral change: food-eating via spatial grid still
works, pounce windup timestamp syncs and is a real future epoch value, forced bomb explosion
confirms the respawned player gets an active invulnerability window.

## 2026-07-07 - Pre-deploy audit (security, performance, config)

Vicent asked for a full project audit before deploying. Ran parallel audits (security/input
validation, performance/scalability at 120 players, config/deployment infra) plus manual checks.
Full findings summarized to Vicent directly; fixed the two actionable ones found:

- **Bot AI rebuilt the food spatial grid once PER BOT per tick** (`backend/src/systems/bots.ts`) -
  `findNearestFood` used to call `buildFoodGrid(food)` internally, so with
  `BOT_TARGET_POPULATION=60` that was 60 redundant grid rebuilds/tick (~2.16M wasted bucket
  assignments/sec) even though the food map doesn't change mid-tick. Fixed: `updateBotAI` now
  builds the grid once and passes it into `findNearestFood`.
- **`pounce`/`throw_bomb` messages had no message-level rate limit** (`backend/src/rooms/
  GameRoom.ts`), unlike `move` (`MIN_MOVE_MESSAGE_INTERVAL_MS`) - a modified client could spam
  either message type indefinitely; each one still gets parsed/dispatched even though the
  game-logic cooldown inside `tryStartPounce`/`tryThrowBomb` rejects it. Added a new shared
  `MIN_ACTION_MESSAGE_INTERVAL_MS` (100ms) and a `lastActionMessageAt` field on `PlayerSchema`,
  checked before either handler does any work.

Findings NOT auto-fixed (flagged to Vicent for a decision, since fixing them blind could break
his actual deploy target or isn't a real launch blocker):
- `app.use(cors())` in `backend/src/index.ts` has no origin restriction - fine for a public game
  if intentional, but worth being explicit about rather than leaving unstated.
- `npm audit` surfaces moderate CVEs several levels deep in Colyseus's own dependency chain
  (elliptic/nanoid/uuid via `@colyseus/auth`) - not exploitable in this app's actual usage (no
  auth/crypto features are used), fixing requires a colyseus major-version bump that needs its
  own testing pass, not something to do reflexively during an audit.
- `@colyseus/ws-transport` is imported directly in `backend/src/index.ts` but only resolves today
  because it's a transitive dependency of `colyseus` itself, not declared directly in
  `backend/package.json` - works now, but is a phantom-dependency risk if colyseus's own
  dependency tree ever changes.
- No `SIGTERM` handler in `backend/src/index.ts` for graceful shutdown - a PaaS/Docker redeploy
  would hard-kill the process mid-game rather than letting Colyseus close rooms/connections
  cleanly first.
- Frontend `tsconfig.json` doesn't set `"strict": true` (backend/shared both do) - inconsistent
  type-safety level between packages.

### Verification performed

`npm run typecheck` clean. Standalone script re-verified `updateBotAI` still steers a bot toward
nearby food correctly after the grid-reuse refactor. Live retest against the real backend/frontend
confirmed pounce still fires normally (cooldown ring engages) with the new message throttle in
place, no regressions, no console/server errors.

## 2026-07-07 - Pre-deploy audit follow-up: fixed the remaining risk items

Vicent asked to fix everything left from the audit that was safe to fix. Went through the 6
flagged items:

- **`@colyseus/ws-transport` phantom dependency**: added it explicitly to `backend/package.json`
  (was only resolving via colyseus's own transitive dependency before).
- **CORS wide open**: added `CORS_ORIGIN` env var (comma-separated origin allowlist,
  `backend/src/index.ts`). Default (unset) behavior is unchanged - still allows any origin, so this
  doesn't break the current deploy. **Important finding while implementing this**: `app.use(cors())`
  on the Express app does NOT actually cover Colyseus's own `/matchmake/*` HTTP endpoint (the one
  `colyseus.js`'s `joinOrCreate` actually calls first) - Colyseus's `Server.attachMatchMakingRoutes`
  strips all existing `request` listeners off the raw `httpServer` and installs its own that
  intercepts `/matchmake` before Express ever sees it, using a hardcoded
  `Access-Control-Allow-Origin: <echo the request's Origin>` regardless of what Express-level CORS
  config says. Had to also override `matchMaker.controller.getCorsHeaders` directly to actually
  restrict that endpoint - the plain Express-level fix alone would have been a no-op for the traffic
  that matters. Verified with real `curl -X OPTIONS` requests against the built server: allowed
  origin gets echoed back, disallowed origin gets a blank header (browser will reject it), and the
  default (`CORS_ORIGIN` unset) still allows anything.
- **No SIGTERM handling** - investigated and this was a **false positive** in the original audit.
  Colyseus's `Server` constructor already calls `registerGracefulShutdown` by default
  (`gracefullyShutdown: true` is the default, not overridden here), which registers `SIGINT`,
  `SIGTERM`, and `SIGUSR2` handlers that cleanly dispose all rooms before exit. Verified by actually
  sending `SIGTERM` to a running built server - it exits cleanly on its own. Didn't add a redundant
  handler (would risk double-shutdown races with Colyseus's own).
- **Frontend `tsconfig.json` missing `"strict": true"`**: enabled it and re-ran typecheck - zero new
  errors surfaced, so the codebase was already strict-compliant in practice. Safe, kept enabled.
- **No `.env.example`**: added one each to `backend/` and `frontend/` documenting `PORT`,
  `CORS_ORIGIN`, `NODE_ENV`, and `VITE_SERVER_URL` respectively.
- **`npm audit` moderate CVEs in colyseus's own dependency chain** (elliptic/nanoid/uuid via
  `@colyseus/auth`, which this app doesn't use) - deliberately NOT auto-fixed. `npm audit fix
  --force` would bump colyseus to a new major version, which is a breaking-change risk to the
  entire game's networking layer that needs its own dedicated testing pass, not something to do
  reflexively during a hardening pass. Left as a documented, accepted risk (not exploitable via
  this app's actual feature surface).

### Verification performed

`npm run typecheck` clean, full clean `npm run build` (rm -rf all dist/ first) succeeds end to end.
Built backend actually started and listened correctly (`node backend/dist/index.js`). Real
`curl -X OPTIONS` tests against the running built server confirmed CORS_ORIGIN allowlist behavior
(both matchmake-endpoint and default-open cases). Sent real SIGTERM to a running built server and
confirmed clean exit. Live retest in the browser preview after all changes: connects, plays, no
console/server errors.

## 2026-07-07 - Nhảy đè redesigned to % damage; collision knockback boosted under the cap

Two decisions from Vicent in one message:

- **"Nhảy đè bằng 50% điểm nhân vật"**: nhảy đè bỏ HOÀN TOÀN luật đấu theo tỷ lệ kích thước
  (`POUNCE_SIZE_RATIO_KILL`/`POUNCE_SIZE_RATIO_SHRINK_MIN`/`POUNCE_FAIL_SHRINK_RATIO`/
  `resolvePounceOutcome`/`PounceOutcome` - all deleted from `shared/src/constants.ts`, along with
  `backend/src/systems/combatOutcome.ts` in its entirety, since it existed solely for this and bomb
  already stopped using it a while back). New model, confirmed directly with Vicent: mỗi cú đè
  trúng gây sát thương = 50% điểm HIỆN CÓ của người bị đè (`POUNCE_DAMAGE_PERCENT`,
  `computePounceDamage` in `shared/`, same shape as `computeBulletDamage` just a different %) -
  người nhảy KHÔNG BAO GIỜ mất size/điểm dù đè trúng ai, kể cả 1 người to hơn rất nhiều. Nếu cú đè
  là đòn kết liễu (điểm mục tiêu tụt dưới 1), người nhảy hấp thụ toàn bộ size/điểm mục tiêu như mọi
  cơ chế giết khác. Kéo theo: bot AI (`bots.ts`) bỏ luôn điều kiện `bot.size/target.size >=
  POUNCE_SIZE_RATIO_KILL` trước khi thử nhảy đè - không còn khái niệm "nhảy hớ" nữa nên bot có thể
  nhảy vào bất kỳ ai trong tầm. Frontend (`main.ts`) sửa toast: bỏ nhánh `attacker_shrinks` (không
  còn tồn tại), thêm toast mừng khi người chơi tự mình hạ gục ai đó bằng nhảy đè.
- **Va chạm vật lý dưới ngưỡng 4x**: giữ nguyên luật cũ (≥4x bên to đứng im hoàn toàn, bên nhỏ lãnh
  trọn cú văng), nhưng dưới 4x giờ nhân thêm `COLLISION_KNOCKBACK_UNDER_CAP_BOOST` (1.5) vào riêng
  phần văng của bên nhỏ hơn - bên to giữ nguyên. Audit fix phát hiện khi viết test: 2 người bằng
  size hệt nhau (ratio đúng bằng 1) trước đây vô tình được xử lý bất đối xứng (một bên luôn bị gán
  nhãn "nhỏ hơn" theo tie-break `sizeA <= sizeB` dù thực ra bằng nhau, nên chỉ bên đó được nhân
  boost) - sửa: khi `sizeA === sizeB`, cả 2 bên nhận đúng cùng 1 giá trị đã boost, không còn thiên
  vị theo thứ tự tham số nữa.

### Verification performed

`npm run typecheck` clean toàn bộ 3 workspace. Grep xác nhận không còn chỗ nào trong code (ngoài
comment giải thích lịch sử) tham chiếu tới các hằng số/type đã xoá. Script test riêng cho từng thay
đổi: nhảy đè xác nhận người nhảy không mất gì dù đè hụt hay đè trúng người to hơn rất nhiều, đòn kết
liễu hấp thụ đúng toàn bộ size/điểm (có tính luôn trần `PLAYER_MAX_SIZE` mới 180); va chạm xác nhận
đúng ratio-cap giữ nguyên 100/0, ratio giữa được boost đúng công thức, và bên to hoàn toàn không đổi
- đặc biệt test lại phát hiện + sửa đúng bug bất đối xứng lúc 2 bên bằng size. Live retest trên
trình duyệt: bot pounce nhau tự do không cần chênh size, nhảy đè của người chơi thật vẫn kích hoạt
cooldown bình thường, không lỗi console/server.

## 2026-07-07 - Vạch bảo hiểm: thiết kế lại thành khiên chặn HOÀN TOÀN, mốc 300/600, vẽ vòng tròn trong thân

Redesign lớn thứ hai trong cùng ngày, theo yêu cầu trực tiếp của Vicent (3 phần trong 1 tin nhắn +
2 lần làm rõ bằng AskUserQuestion):

- **Mốc điểm đổi từ 200/300 thành 300/600**: `EXTRA_LIFE_FIRST_THRESHOLD` = 300,
  `EXTRA_LIFE_SUBSEQUENT_THRESHOLD` = 600 trong `shared/src/constants.ts`. Công thức
  `extraLifeScoreOffset(index)` giữ nguyên hình dạng (`FIRST + SUBSEQUENT * index`, tích luỹ từ
  mốc trần `sizeCapReachedAtScore`), chỉ đổi 2 hằng số đầu vào.
- **Cơ chế tiêu vạch đổi hẳn từ "giữ lại 50% size/điểm rồi vẫn respawn" sang "chặn đứng HOÀN TOÀN,
  không mất gì cả, không respawn"**: làm rõ qua AskUserQuestion - vạch CHỈ kích hoạt khi đòn đó
  đáng lẽ GIẾT CHẾT (không phải mọi cú trúng gây sát thương thường), và khi kích hoạt thì chặn
  100% (không còn tỷ lệ giữ lại nào), người chơi đứng nguyên tại chỗ, KHÔNG bị relocate/respawn.
  `EXTRA_LIFE_RETAIN_RATIO` xoá hoàn toàn khỏi `constants.ts`. `backend/src/systems/death.ts`:
  xoá `consumeExtraLifeOnDeath`, thay bằng `blockLethalHitWithExtraLife(player)` chỉ làm đúng 2
  việc - trừ 1 vạch, và **dời mốc `sizeCapReachedAtScore` về ĐIỂM HIỆN TẠI** (không cần leo lại
  trần size mới tích được vạch tiếp theo - đúng theo ví dụ Vicent đưa ra: 10000 điểm, mất 2 vạch,
  thì 10300 được vạch 1, 10900 được vạch 2, tính từ mốc mới = điểm lúc mất). `GameRoom.handleDeath`
  viết lại: nếu `cause !== "bullet" && player.extraLives > 0` thì gọi
  `blockLethalHitWithExtraLife` rồi return sớm (không đụng tới `killAndRespawn`), ngược lại đi
  theo nhánh chết bình thường như cũ.
- **Đạn KHÔNG nằm trong phạm vi bảo vệ của vạch** (làm rõ qua AskUserQuestion thứ 2) - dù còn bao
  nhiêu vạch, trúng đạn chí mạng vẫn chết bình thường. Đây là lý do điều kiện trên có
  `cause !== "bullet"` thay vì check `extraLives > 0` một mình.
  `shared/src/types.ts`: comment của `player_died` viết lại cho đúng nghĩa mới (`usedExtraLife:
  true` = "chặn đứng, không hề chết" chứ không còn là "chết nhẹ hơn").
- **Vẽ vạch chuyển từ chấm tròn dưới tên sang vòng tròn nhỏ NGAY TRONG THÂN nhân vật**:
  `frontend/src/render.ts` thêm tham số `extraLives` cuối cùng cho `drawCharacter`, thêm hàm
  `drawExtraLivesRings` vẽ 1-2 vòng tròn xanh nhỏ xếp cạnh nhau bên trong thân (gọi trong khối vẽ ở
  hệ toạ độ local đã xoay, sau `drawEyes`). Xoá hẳn code chấm tròn cũ dưới tên trong
  `drawNameAndScore`. `drawSkinPreview`/`drawDissolvingGhost` truyền `extraLives=0` (preview
  skin/ghost dissolve không cần thể hiện state gameplay này).

### Verification performed

`npm run typecheck` clean toàn bộ 3 workspace. Grep xác nhận không còn chỗ nào tham chiếu
`EXTRA_LIFE_RETAIN_RATIO`/`consumeExtraLifeOnDeath` (ngoài đã sửa xong 1 comment cũ trong
`types.ts`). Script test riêng xác nhận đúng ví dụ số của Vicent: baseline 10000 → 10300 được vạch
1 → 10900 được vạch 2; `blockLethalHitWithExtraLife` trừ đúng 1 vạch, không đụng size/score/vị trí,
dời mốc về điểm hiện tại; mốc mới áp dụng đúng công thức cũ (không có ngoại lệ rút gọn cho trường
hợp mất 1 vạch). Live retest trên trình duyệt: 2 server (backend/frontend) khởi động sạch không lỗi
log, vào game chơi được bình thường. Vì việc leo tới hàng chục nghìn điểm để tự nhiên thấy vòng
tròn trong lúc chơi thật là không khả thi để test nhanh, đã gọi thẳng hàm `render()` đã export với
snapshot giả lập 3 người chơi (0/1/2 vạch) ngay trong console trình duyệt đang chạy thật (dùng
`import()` động module `render.ts` đã build bởi Vite) - screenshot xác nhận đúng 0/1/2 vòng tròn
xanh nhỏ vẽ đúng vị trí bên trong thân từng nhân vật.

## 2026-07-07 - Trúng đạn/nhảy đè không chí mạng giờ cũng teo size, không chỉ trừ điểm

Phát hiện qua câu hỏi trực tiếp của Vicent ("sao size to hơn mà điểm ít hơn?") - lý do là từ đầu
session, đạn/nhảy đè không chí mạng chỉ trừ `score`, hoàn toàn không đụng tới `size` (điểm được coi
là "máu" tách biệt khỏi kích thước vật lý). Vicent xác nhận muốn đổi: **trúng đòn cũng giảm size**.

Thêm `applyDamageSizeShrink(currentSize, scoreBeforeDamage, damage)` trong `shared/src/constants.ts`
- teo size theo đúng % THỰC TẾ đã mất (`damage / scoreBeforeDamage`), không phải hằng số % riêng,
để nhất quán ngay cả khi damage bị đôn lên bởi `BULLET_DAMAGE_MIN`/`POUNCE_DAMAGE_MIN` lúc điểm mục
tiêu đã thấp (ví dụ điểm=2, đạn đáng lẽ 20%=0.4 nhưng bị đôn lên 1, tức đã mất 50% thực tế - size
phải teo đúng 50% chứ không phải 20%). Sàn ở `PLAYER_MIN_SIZE` (10, hằng số có sẵn nhưng trước đó là
dead code từ luật nhảy đè cũ đã xoá) để không bao giờ teo về 0/âm dù trúng liên tiếp nhiều phát.
Gọi ở nhánh không chí mạng của cả `bullets.ts` (`applyBulletDamage`) và `pounce.ts`
(`resolvePendingPounces`) - nhánh chí mạng không cần vì `killAndRespawn`/vạch đã xử lý toàn bộ
size/score rồi. Bomb không cần đụng tới vì bomb luôn giết chết ngay, không có nhánh sát thương một
phần.

### Verification performed

`npm run typecheck` clean toàn bộ 3 workspace. Script test riêng xác nhận: đạn 20% dame thì size
cũng teo đúng 20% (180→144), nhảy đè 50% dame thì size teo đúng 50% (180→90), size không bao giờ
tụt dưới `PLAYER_MIN_SIZE` dù trúng liên tiếp nhiều phát ở điểm thấp, và trường hợp damage bị đôn
lên bởi *_DAMAGE_MIN thì size teo theo đúng % thực tế đã mất chứ không phải % danh nghĩa. Restart
lại backend preview (rebuild `shared/dist`), reload frontend, vào game chơi được bình thường, không
lỗi console/server.

## 2026-07-07 - Sửa lỗi hiểu nhầm: sát thương đạn/nhảy đè tính theo điểm NGƯỜI TẤN CÔNG, không phải mục tiêu

Bug thực sự (không phải hiểu lầm của Vicent) do chính tôi hiểu sai yêu cầu gốc lúc redesign nhảy đè
trước đó trong ngày: Vicent xác nhận lại rõ ràng - "20%, 50% đều là điểm cá nhân, không phải điểm
của người chơi khác". Đối chiếu lại đúng ví dụ gốc Vicent từng đưa ("tôi có 1000 điểm, tôi nhảy thì
cú nhảy đó có 500 dame") thì đúng là % điểm của NGƯỜI TẤN CÔNG (nhảy/bắn), không phải % điểm mục
tiêu như code đã lỡ implement. Sửa cả 2 công thức:

- `computeBulletDamage(attackerScore)` - đổi từ `target.score` sang điểm của người bắn
  (`shooter.score`, lấy từ `ctx.players.get(bullet.ownerId)` ngay đầu `applyBulletDamage` trong
  `backend/src/systems/bullets.ts` - trước đây chỉ fetch shooter ở nhánh chí mạng để cộng điểm, giờ
  cần fetch sớm hơn để tính damage). Người bắn đã rời phòng giữa lúc đạn bay thì coi điểm = 0 (damage
  về đúng floor `BULLET_DAMAGE_MIN`).
- `computePounceDamage(attackerScore)` - đổi từ `nearest.score` (mục tiêu) sang `attacker.score`
  trong `backend/src/systems/pounce.ts` - đơn giản hơn vì `attacker` đã có sẵn trong scope.
- `applyDamageSizeShrink` (thêm ở thay đổi trước đó trong ngày) không cần sửa - vẫn nhận đúng
  `(targetSize, targetScoreBeforeDamage, damage)` bất kể damage tính từ điểm ai, chỉ là % hao hụt so
  với chính điểm mục tiêu trước khi trúng đòn.
- Cập nhật lại toàn bộ docstring liên quan trong `constants.ts`/`types.ts`/`bullets.ts`/`pounce.ts`
  ghi rõ "sửa lại theo đúng ý Vicent, bản trước đó hiểu nhầm % điểm mục tiêu" để tránh lặp lại nhầm
  lẫn này lần sau.

Hệ quả game-design: người mạnh (điểm cao) giờ đánh rất đau bất kể mục tiêu yếu hay mạnh, người yếu
(điểm thấp) đánh rất nhẹ bất kể mục tiêu là ai - đúng tinh thần "sát thương phản ánh sức mạnh người
tấn công" mà Vicent mô tả, khác hẳn thiết kế cũ (sát thương phản ánh độ yếu của mục tiêu).

### Verification performed

`npm run typecheck` clean toàn bộ 3 workspace. Script test riêng xác nhận đúng cả 2 ví dụ gốc của
Vicent: người bắn 100 điểm → dame 20; người nhảy 1000 điểm → dame 500. Test tích hợp dùng thẳng
`updateBullets`/`resolvePendingPounces` với `PlayerSchema`/`MapSchema` thật: người bắn mạnh (100
điểm) one-shot được mục tiêu yếu (7 điểm, dame 20 > 7) và hấp thụ đúng điểm mục tiêu khi giết; người
bắn yếu (7 điểm) bắn trúng mục tiêu rất mạnh (1000 điểm) chỉ trừ đúng 1.4 điểm (20% của 7), không hề
liên quan gì tới 1000 điểm của mục tiêu; điểm người bắn/nhảy hoàn toàn không đổi sau khi tấn công dù
trúng hay trượt. Restart lại backend preview (rebuild `shared/dist`), reload frontend, vào game chơi
được bình thường, không lỗi console/server.

## 2026-07-11 - PIVOT: game PvP "nhảy đè/bomb" -> game câu cá multiplayer nhiều hồ

Quyết định trực tiếp với Vicent (domain sẵn có `whereigfish.com`): đổi hẳn concept game, giữ lại hạ
tầng Colyseus (room-based realtime) và phong cách nhân vật quả bóng Kirby-style, bỏ hoàn toàn cơ
chế PvP (nhảy đè, bomb, đạn, va chạm/knockback, hạt năng lượng, "vạch" bảo hiểm, chết/hồi sinh).

### Bàn bạc trước khi code (tóm tắt)

- Tông game: kết hợp casual (hồ thường, ai câu cũng có phần) + competitive nhẹ qua bảng xếp hạng
  theo tổng giá trị cá + sưu tầm cá hiếm (Pokedex-style), KHÔNG dùng cơ chế "hồ sự kiện giành cá
  hiếm real-time" (đã bàn rồi bỏ theo yêu cầu Vicent — đơn giản hoá, tránh race-condition phức tạp).
- Giữ kiến trúc room = hồ, real-time multiplayer (thấy người khác câu cùng hồ) dù không còn bắt
  buộc về mặt kỹ thuật (không có giành giật) — vẫn giữ vì đây là điểm khác biệt so với game câu cá
  solo thông thường.
- Core loop 4 bước đã thống nhất: thả cần (giữ chuột tích lực, thả ra quăng) -> chờ cắn câu (random
  theo độ hiếm/loài) -> móc câu (bấm Space đúng khung ~0.9s) -> kéo cá (minigame giữ Space đưa vùng
  bắt trùng vị trí cá vùng vẫy, khó dần theo độ hiếm).

### Thay đổi chính

- `shared/`: `constants.ts`/`types.ts` viết lại hoàn toàn — bỏ mọi hằng số PvP/food (pounce, bomb,
  bullet, food, extra lives, collision knockback, size-speed tradeoff). Thêm `FISH_CATALOG` (8 loài,
  4 mốc độ hiếm: common/uncommon/rare/legendary), hằng số cast/hook/reel minigame,
  `FishingState`/`PlayerState`/`ClientMessage`/`ServerEvent` mới cho vòng lặp câu cá.
- `backend/`: `schema/State.ts` cập nhật field câu cá (fishState, bobber, reelProgress, collection
  sổ sưu tập...). Logic PvP cũ (`pounce.ts`, `bomb.ts`, `bullets.ts`, `collision.ts`,
  `extraLives.ts`, `death.ts`, `food.ts`, `spatialGrid.ts`, `bots.ts`) đã ngừng dùng — **không xoá
  được file do giới hạn quyền xoá trong thư mục workspace, đã thay nội dung bằng stub rỗng
  `export {}` + ghi chú deprecated**, có thể xoá tay nếu muốn dọn sạch. Logic mới nằm ở
  `systems/fishing.ts` (cast/hook/reel + tick) và `systems/npcFishers.ts` (NPC câu cá thuần cosmetic
  lấp chỗ trống, tái sử dụng đúng state machine thật). `movement.ts` đơn giản hoá (tốc độ cố định,
  đứng yên khi đang câu). `leaderboard.ts` xếp theo tổng giá trị cá.
- `frontend/`: `input.ts` đổi sang giữ chuột trái = tích lực quăng cần, Space = móc câu/giữ kéo cần.
  `render.ts` thay bãi cỏ+hồ cho map PvP cũ, vẽ cần câu/phao/chỉ báo cắn câu, giữ nguyên nhân vật
  quả bóng Kirby (bỏ khẩu súng, bỏ vòng "vạch" bảo hiểm). `ui.ts`/`main.ts` thay HUD pounce/bomb
  bằng thanh tích lực quăng cần, overlay minigame kéo cá, sổ sưu tập cá, toast kết quả câu cá.

### Verification performed

`npm run build:shared` sạch. `npx tsc --noEmit` sạch cho cả backend và frontend. `npm run build`
full thất bại ở bước `vite build` do lỗi native binding (`@rolldown/binding-linux-arm64-gnu` thiếu)
— xác nhận đây là vấn đề môi trường sandbox Linux chạy trên `node_modules` cài từ máy Mac của
Vicent (kể cả `tsx`/esbuild cũng báo lỗi tương tự "installed for another platform"), không phải lỗi
code — trên máy thật của Vicent (đã từng chạy `npm install` đúng nền tảng) sẽ không gặp vấn đề này.
Để xác nhận logic thật sự chạy đúng, build backend bằng `tsc` rồi chạy thẳng bằng `node` (không qua
esbuild) và dùng 1 script `colyseus.js` client thật kết nối vào room: xác nhận thả cần -> nhận event
`fish_bite` -> gửi `hook` -> vào `reeling` -> gửi `reel` theo vị trí cá -> nhận `catch_result` thành
công, `caughtCount`/`totalValue`/`collection` cập nhật đúng, NPC câu cá trong hồ cũng tự thả
cần/móc câu/câu được cá độc lập, không có lỗi runtime nào trong toàn bộ vòng lặp.

### Còn lại cần làm (không chặn việc chơi thử ngay)

1. Chưa làm nhiều hồ (mới có 1 hồ/room theo địa hình hình ellipse cố định) — Next: thêm chọn hồ
   (nhiều `RoomState` với catalog cá/độ khó khác nhau theo tên hồ).
2. Chưa có ràng buộc "không đi được xuống nước" — người chơi hiện đi lại tự do khắp world rectangle,
   hồ chỉ là hình vẽ trang trí ở giữa map (đơn giản hoá có chủ đích cho MVP, xem lý do trong
   constants.ts).
3. Chưa có kinh tế/nâng cấp cần câu-mồi (mua bằng totalValue) — sổ sưu tập hiện chỉ lưu trong phiên
   chơi hiện tại (không có tài khoản/DB, mất khi rời phòng) — cần Phase 2 nếu muốn giữ tiến trình
   xuyên suốt các lần chơi.
4. Chưa polish animation/hiệu ứng bắt cá (hiện chỉ có toast text), chưa có âm thanh.

## 2026-07-11 - Nhiều hồ trong 1 map + di chuyển bằng WASD/mũi tên (giải quyết Next Steps #1 ở trên)

Yêu cầu trực tiếp từ Vicent: thay vì 1 hồ ellipse cố định (thuần cosmetic, backend không biết hồ ở
đâu), đổi sang nhiều hồ hình dạng/kích thước khác nhau (méo mó, không phải ellipse đều) rải rác
trên 1 map lớn, người chơi đi bộ bằng WASD/mũi tên tới từng hồ để câu — làm rõ qua AskUserQuestion:
di chuyển dùng cả WASD lẫn mũi tên, các hồ khác nhau cả hình dạng lẫn loại cá, kiến trúc vẫn 1
room/server chứa toàn bộ map (không phải mỗi hồ 1 room như bản nháp Next Steps cũ đã đề xuất).

### shared/ changes

- File mới `shared/src/lakes.ts`: `LakeDefinition` (id, name, center, baseRadiusX/Y, vertexCount,
  jitter, fishWeights), `generateBlobPolygon` sinh polygon méo mó XÁC ĐỊNH (seeded hash theo
  `lake.id` + chỉ số đỉnh, không dùng `Math.random`) — đảm bảo frontend và backend (2 process riêng
  biệt) luôn tính ra đúng 1 hình y hệt nhau mà không cần truyền polygon qua network. 6 hồ author tay
  (Ao Làng, Hồ Gương, Hồ Rắn, Đầm Sen, Vịnh Băng, Hồ Rồng) — kích thước/độ méo/tập cá khác nhau, hồ
  nhỏ gần điểm xuất phát chỉ có cá thường, hồ lớn/xa thiên về hiếm-huyền thoại; đảm bảo cả 8 loài
  `FISH_CATALOG` đều xuất hiện ở ít nhất 1 hồ. Thêm hình học dùng chung `isPointInPolygon`/
  `distanceToPolygon`/`distanceToPolygonBoundary` (ray-casting + point-to-segment), `findNearestLake`,
  `LAKE_CAST_RANGE` (220), `pickRandomFishSpeciesForLake`.
- File mới `shared/src/hash.ts`: `hash01`/`hashString` (seeded, không dùng `Math.random`) tách ra từ
  `lakes.ts` để dùng lại được nếu cần chỗ khác.
- `constants.ts`: `WORLD_WIDTH`/`WORLD_HEIGHT` 3000x2000 -> 8000x7000 (đủ chỗ cho 6 hồ + khoảng đi
  bộ giữa chúng). `NPC_FISHER_TARGET_POPULATION` đổi nghĩa từ "tổng NPC toàn room" thành "mục tiêu
  MỖI HỒ" (8 -> 3/hồ, ~18 NPC tổng cộng với 6 hồ). Xoá `pickRandomFishSpecies` (không còn ai gọi,
  thay hẳn bằng bản theo-hồ).
- `types.ts`: `PlayerState` thêm `currentLakeId` (hồ vừa thả cần thành công lần gần nhất, "" nếu
  chưa câu ở hồ nào phiên này — chỉ cập nhật lúc cast, không phải "hồ đang đứng gần" theo thời gian
  thực). `InputMoveMessage` thêm `moving: boolean` — trước đây nhân vật luôn đi liên tục theo hướng
  chuột nên chỉ cần góc, giờ cần biết rõ có đang giữ phím di chuyển hay không.

### Backend changes

- `schema/State.ts`: `PlayerSchema` thêm `currentLakeId` (synced) + `desiredMoving` (server-internal,
  như `desiredAngle`).
- `systems/fishing.ts#tryCast`: thêm gate `findNearestLake` + `LAKE_CAST_RANGE` — đứng giữa đồng
  trống xa hồ thì bị từ chối hoàn toàn (không đổi state). Roll cá bằng `pickRandomFishSpeciesForLake`
  theo đúng hồ đang đứng, set `currentLakeId`. Bobber rớt ra ngoài polygon hồ (dễ xảy ra với hồ hẹp/
  méo) thì fallback về tâm hồ thay vì nổi trên bờ.
- `systems/movement.ts#stepPlayerMovement`: chỉ advance x/y khi `player.desiredMoving === true`
  (trước đây luôn advance theo `desiredAngle`) — đứng yên khi không giữ phím, giữ nguyên góc mặt
  hướng cuối cùng.
- `rooms/GameRoom.ts`: message "move" đọc thêm `moving: boolean`, validate rồi gán
  `desiredMoving`.
- `systems/utils.ts`: xoá `randomSpawnX`/`randomSpawnY` (spawn bất kỳ đâu trong world), thay bằng
  `spawnPointNearLake(lake)` + `randomSpawnPoint()` (chọn 1 hồ ngẫu nhiên, spawn ngay mép hồ đó) —
  người chơi vào game thấy hồ ngay thay vì phải đi bộ mù giữa map lớn hơn nhiều so với trước.
- `systems/npcFishers.ts`: mỗi NPC gán cố định 1 hồ lúc tạo (`createNpc(lake)`, spawn ngay mép hồ
  đó, NPC không di chuyển nên luôn ở đúng hồ được gán). `rebalanceNpcFishers` đổi từ đếm 1 số toàn
  room sang bucket riêng từng hồ (dùng `findNearestLake` theo vị trí mỗi người chơi/NPC để xác định
  "thuộc hồ nào") — nếu không, NPC dồn ngẫu nhiên thay vì rải đều 6 hồ.

### Frontend changes

- `input.ts`: viết lại hoàn toàn phần di chuyển — thêm bắt phím WASD + mũi tên (`MOVE_KEY_VECTORS`,
  8 hướng cộng vector), gửi `{type:"move", angle, moving}` thay vì luôn gửi theo `pointerAngle`.
  Hướng chuột (`pointerAngle`) GIỮ NGUYÊN không đổi — giờ chỉ dùng để nhắm hướng thả cần (tách biệt
  đi bộ khỏi nhắm, kiểu twin-stick), không còn điều khiển di chuyển.
- `render.ts`: xoá hẳn `LAKE_RADIUS_X/Y` cứng + `drawLake`/`isInsideLake`/`isNearLakeEdge` bản 1 hồ,
  thay bằng lặp `LAKE_DEFINITIONS`, vẽ polygon "mềm" bằng `quadraticCurveTo` từ trung điểm-tới-trung
  điểm (blob bo tròn tự nhiên từ chính các đỉnh polygon, không cần thêm điểm), có cull off-screen
  theo bounding circle. Thêm tên hồ hiện phía trên khối nước.
- `ui.ts`: HUD thêm dòng "Đang câu ở: <tên hồ>" (theo `currentLakeId`). Minimap vẽ đúng hình
  dạng/vị trí từng hồ (trước đây vẽ cứng 1 ellipse ở giữa bằng composite trick) thay vì scale cả map
  vào 1 hồ tưởng tượng.

### Bug phát hiện + sửa lúc verify trực tiếp

`spawnPointNearLake` bản đầu đặt điểm spawn theo bán kính ELLIPSE CƠ SỞ (`baseRadiusX/Y`) + margin
cố định tại 1 góc ngẫu nhiên — không tính jitter thực tế của polygon. Với hồ jitter cao (Đầm Sen,
Vịnh Băng, jitter 0.4), có góc mà biên polygon thật lõm vào gần tâm hơn base ellipse giả định, khiến
điểm spawn ước lượng đứng xa hơn `LAKE_CAST_RANGE` (220) so với biên thật — thả cần ngay lúc vừa vào
game bị từ chối âm thầm (không lỗi, không toast, chỉ đơn giản là không có gì xảy ra). Phát hiện khi
verify trực tiếp qua Browser pane (cast ngay sau khi spawn, HUD "Đang câu ở" không cập nhật). Sửa:
`spawnPointNearLake` giờ chọn 1 ĐỈNH THẬT của `lake.polygon` rồi đẩy ra ngoài dọc theo đúng hướng
bán kính của đỉnh đó 1 khoảng cố định (`SPAWN_SHORE_MARGIN`, 120 world units) — đảm bảo luôn cách 1
điểm biên THẬT đúng 120 units bất kể hồ méo cỡ nào, thay vì suy luận gián tiếp qua ellipse cơ sở.

### Verification performed

`npm run typecheck` sạch cả 3 workspace sau mỗi nhóm thay đổi lớn. Verify trực tiếp qua Browser pane
(backend + frontend preview thật, không phải chỉ đọc code): xác nhận WASD di chuyển được (dispatch
KeyboardEvent thật, quan sát world dịch chuyển quanh nhân vật + world-bounds hiện đúng vị trí sau khi
đi được quãng đường tương ứng `BASE_SPEED`), chuột vẫn nhắm/thả cần độc lập với việc đi bộ (không
đụng phím nào, WebSocket send-count = 0 khi đứng yên — trước đây bản mouse-direction cũ sẽ gửi liên
tục), đứng giữa đồng trống xa hồ thả cần bị từ chối hoàn toàn (HUD "Đang câu ở" không đổi, không có
phao/dây câu hiện ra), đứng gần hồ thả cần thành công + HUD hiện đúng tên hồ, nhiều loài cá từ common
tới legendary xuất hiện qua các lượt câu của NPC ở các hồ khác nhau (Cá Mương, Cá Trê, Cá Chép Bạc,
Cá Koi, Cá Rồng Vàng), minimap vẽ đúng hình dạng/vị trí 6 hồ rải rác. Không có lỗi console/server
trong suốt quá trình test. Lưu ý môi trường: Browser pane tự động throttle mạnh
`requestAnimationFrame` khi tab ở nền (không phải tab đang active của hệ điều hành) — khiến việc gửi
message di chuyển bị trễ/thưa trong lúc test tự động, nhưng hoàn toàn không ảnh hưởng gameplay thật
(người chơi thật luôn ở tab foreground, rAF chạy đúng 60fps).

## 2026-07-11 - Minigame kéo cá đổi sang mô hình độ căng dây (tension), điều khiển bằng chuột

Yêu cầu trực tiếp từ Vicent: minigame kéo cá cần trực quan hơn — hiện cần câu + hình cá vùng vẫy,
điều khiển bằng cách giữ chuột kéo xuống (tăng tiến độ) rồi thả ra để "điều chỉnh lại không bị đứt
dây", và khi bắt được cá phải hiện modal tên + hình con cá. Làm rõ qua AskUserQuestion: giữ chuột =
kéo/thả ra = ngưng (không cần theo dõi khoảng cách rê chuột thực tế); Space vẫn dùng được cho móc
câu (hook) nhưng KHÔNG còn dùng cho kéo cá (chỉ chuột); hình cá trong modal vẽ bằng canvas theo màu
loài (không có ảnh minh hoạ thật, mọi thứ trong game đều vẽ bằng canvas).

### Thiết kế mới: tiến độ + độ căng dây (thay hẳn minigame "đưa vùng bắt trùng vị trí cá dao động")

- Bỏ hoàn toàn cơ chế cũ: `fishBarPos`/`playerBarPos` (vị trí cá dao động + vùng bắt người chơi) và
  toàn bộ vật lý đi kèm (`REEL_PULL_ACCEL`, `REEL_GRAVITY_ACCEL`, `REEL_PLAYER_DAMPING_PER_SECOND`,
  `computeFishJitterAccel`, `computeFishMaxSpeed`, `computeReelZoneHalfWidth`, `REEL_ZONE_HALF_WIDTH_BASE`,
  `REEL_BAR_MAX`) — thay bằng 2 thang đo: `reelProgress` (giữ nguyên, đầy 100% bắt được, tụt 0% cá
  thoát) và **`reelTension`** (mới, 0..100). Giữ chuột kéo (`reelPulling`): `reelProgress` tăng theo
  `REEL_PROGRESS_FILL_RATE` (không đổi) NHƯNG `reelTension` cũng tăng theo `computeTensionRiseRate
  (reelDifficulty)` (35 + reelDifficulty*70 — loài khó căng nhanh hơn nhiều). Thả chuột ra:
  `reelTension` giảm theo `REEL_TENSION_FALL_RATE` cố định (70/s, KHÔNG đổi theo độ khó — độ khó chỉ
  nằm ở tốc độ TĂNG căng lúc kéo, để loài nào cũng "gỡ căng" được nếu thả kịp), `reelProgress` tụt
  theo `computeReelResistance(reelDifficulty)` (cá giằng dây, loài khó giằng mạnh hơn). Chạm
  `REEL_TENSION_MAX` (100) bất kể `reelProgress` đang bao nhiêu = **đứt dây, mất cá** (reason mới
  `"line_snapped"` trong `ServerEvent`).
- `shared/src/constants.ts`: xoá hằng số/hàm bar-matching cũ (liệt kê trên), thêm `REEL_TENSION_MAX`,
  `REEL_TENSION_FALL_RATE`, `computeTensionRiseRate`, `computeReelResistance`.
- `shared/src/types.ts`: `PlayerState` bỏ `fishBarPos`/`playerBarPos`, thêm `reelTension`.
- `backend/src/schema/State.ts`: `PlayerSchema` tương ứng, bỏ luôn `fishBarVelocity`/
  `playerBarVelocity` (server-internal, không còn cần).
- `backend/src/systems/fishing.ts#updateReeling`: viết lại hoàn toàn theo model tension ở trên;
  `tryHook`/`resetToIdle` khởi tạo/reset `reelTension` thay vì các field cũ.
- `backend/src/systems/npcFishers.ts`: AI kéo cá của NPC đổi từ so sánh vị trí bar sang hysteresis
  theo tension — kéo tới khi `reelTension >= 75` thì thả, thả tới khi `reelTension <= 20` thì kéo
  lại (mô phỏng người chơi biết xen kẽ, không phải bot hoàn hảo).

### Input: chuột điều khiển kéo cá, tách khỏi Space

- `frontend/src/input.ts`: thêm `getFishState` callback (đọc `fishState` hiện tại của local player,
  do `main.ts` cung cấp) để `onMouseDown`/`onMouseUp` phân nhánh đúng hành động theo trạng thái câu
  cá — **idle**: chuột vẫn là tích lực quăng cần như cũ (không đổi); **biting**: bấm chuột = móc câu
  (giống Space); **reeling**: GIỮ chuột = kéo dây (gửi `reel pulling:true`), THẢ = ngưng kéo. Rời
  canvas lúc đang giữ (`mouseleave`) cũng tự ngưng kéo, tránh kẹt trạng thái "đang kéo" mãi mãi.
  Space giờ CHỈ còn là input phụ cho hook (bấm 1 phát), không còn tự động giữ kéo như bản cũ.
- `frontend/src/main.ts`: thêm `latestLocalFishState` (mutated mỗi frame, cùng pattern với
  `localPlayerScreenOrigin`) truyền vào `InputController`. Thanh tích lực quăng cần (`updateCastMeter`)
  giờ chỉ hiện khi `fishState === "idle"` (trước đây hiện bất kể trạng thái, chồng chéo hình với
  overlay kéo cá nếu giữ chuột lúc đang câu). Toast lỗi (`missed_hook`/`fish_escaped`/mới
  `line_snapped`) giờ CHỈ hiện cho ĐÚNG người chơi vừa trải qua nó (so `event.playerId ===
  net.sessionId`) — sửa luôn 1 bug có sẵn từ trước: trước đây hiện toast "bạn..." cho MỌI người
  chơi/NPC bất kể ai, dù text luôn nói "bạn". Người chơi khác bắt được cá vẫn hiện toast ambient
  (thêm tiền tố "Ai đó vừa câu được..." để không lẫn với modal của chính mình).

### Hình ảnh: cần câu cong + cá vùng vẫy hoạt hình, modal kết quả

- `frontend/src/render.ts`: thêm `drawFishIcon` (export, thân+đuôi+vây+mắt vẽ bằng canvas, tô theo
  màu loài trong `FISH_CATALOG`, tham số `tailWiggle` cho hiệu ứng vẫy) và `drawBentRod` (cần câu
  cong dần theo `reelTension`, trả về toạ độ ngọn cần để vẽ dây tiếp từ đó). `drawFishingLineAndBobber`
  nhánh riêng cho `fishState === "reeling"`: vẽ cần cong + dây (chùng khi căng thấp, thẳng+rung khi
  căng cao) + `drawFishIcon` tại vị trí phao, tốc độ/biên độ vẫy tăng theo `reelTension` (căng càng
  cao cá càng vùng vẫy dữ) — thay cho phao tĩnh lúc trước.
- `frontend/src/ui.ts`: overlay kéo cá đổi 2 thanh riêng (tiến độ + độ căng, thanh căng đổi màu
  xanh->vàng->đỏ theo mức nguy hiểm), bỏ hẳn `.reel-player-zone`/`.reel-fish-dot`. Thêm
  `showCatchModal(speciesId, rarity, value, isFirstCatch)` — modal mới hiện icon cá (dùng lại
  `drawFishIcon`), tên, độ hiếm, giá trị, nhãn "loài mới" nếu lần đầu; tự đóng sau 3.2s hoặc bấm ×/
  bấm ra ngoài. Chỉ hiện cho catch THÀNH CÔNG của chính local player (người khác vẫn dùng toast
  ambient như trên).
- `frontend/src/style.css`: CSS mới cho 2 thanh reel + modal kết quả (animation pop-in nhẹ).

### Verification performed

`npm run typecheck` sạch cả 3 workspace sau mỗi nhóm thay đổi. Verify trực tiếp bằng 2 cách:
1. **Script kết nối colyseus.js thật** (như các lần audit trước) — cast thành công gần hồ, chờ cắn
   câu, móc câu, kéo cá bằng chiến lược kéo-tới-tension-70%-rồi-thả-tới-20%-rồi-kéo-lại (giống hệt
   heuristic NPC mới): `reelProgress` tăng dần 34 -> 100 trong khi `reelTension` tăng chậm hơn (0 ->
   57 khi bắt được), `catch_result` thành công đúng, `collection` cập nhật đúng loài lần đầu.
2. **Script gọi thẳng `updateReeling`** với `PlayerSchema` thật: (a) giữ kéo liên tục KHÔNG BAO GIỜ
   thả với loài khó nhất (`golden_dragonfish`, reelDifficulty 0.9) — xác nhận `reelTension` vượt
   `reelProgress` và đứt dây (`line_snapped`) ở tick 30 trước khi kịp đầy 100%, đúng thiết kế "loài
   khó phải xen kẽ kéo/thả, không thể chỉ giữ suốt"; (b) thả tay 10 tick liên tục từ tension=80/
   progress=50 — xác nhận cả 2 đều giảm đúng hướng (tension 80->56.7, progress 50->40.5, cá giằng
   dây khi không kéo).
3. **Browser pane thật** (backend+frontend preview): xác nhận toast lỗi giờ đúng là CHỦ NGỮ đúng
   người (chỉ hiện "Trễ nhịp — cá đã bỏ đi trước khi BẠN kịp móc câu!" cho chính mình, không còn
   hiện lây cho catch của NPC/người khác — xác nhận qua toast "Ai đó vừa câu được..." xuất hiện
   riêng biệt cho các lượt câu KHÔNG phải của mình), overlay kéo cá (2 thanh tiến độ/căng dây) hiện
   đúng lúc đang reeling, cast/hook qua chuột hoạt động, không có lỗi console/server trong suốt quá
   trình test. Không chụp được rõ khung hình animation cần cong/cá vẫy hay modal kết quả do
   `requestAnimationFrame` bị browser tự throttle mạnh khi tab chạy nền trong môi trường tự động hoá
   (đã ghi nhận cùng hạn chế ở lần verify trước) — bù lại bằng cách xác nhận logic vẽ (drawFishIcon/
   drawBentRod) qua type-check + tái sử dụng đúng pattern canvas đã chứng minh hoạt động ở
   drawCharacter/drawSkinPreview.

## 2026-07-11 - Bỏ toast "ai đó câu được cá"; thêm phản hồi khi thả cần bị từ chối vì quá xa hồ

Vicent yêu cầu 2 việc: (1) chỉ đứng gần hồ mới được ném câu — đã có sẵn từ lần đổi "nhiều hồ"
(`LAKE_CAST_RANGE` trong `backend/src/systems/fishing.ts#tryCast`), verify lại bằng script
colyseus.js thật (đi bộ 928 world units ra xa mọi hồ rồi thả cần) xác nhận gate vẫn hoạt động đúng —
không phải bug, nhưng server từ chối HOÀN TOÀN IM LẶNG (không có phản hồi gì), dễ khiến người chơi
tưởng là lỗi; (2) bỏ hẳn toast ambient "Ai đó vừa câu được..." cho catch của người chơi khác (thêm ở
lần đổi minigame kéo cá trước đó, không phải yêu cầu ban đầu — giờ bỏ theo đúng ý Vicent).

### Thay đổi

- `shared/src/types.ts`: `ServerEvent` thêm biến thể `{ type: "cast_rejected"; reason:
  "too_far_from_lake" }` — gửi RIÊNG cho đúng client vừa bị từ chối (không broadcast cả phòng).
- `backend/src/systems/fishing.ts#tryCast`: đổi kiểu trả về từ `void` sang `CastResult` ("ok" |
  "not_idle" | "too_far") thay vì âm thầm `return`, để caller biết đường phản hồi đúng lúc. Không
  cần phân biệt "not_idle" ở tầng phản hồi (chỉ là 2 message chồng lấn vô hại, xem docstring
  `tryCast`) — chỉ "too_far" mới cần báo cho người chơi.
- `backend/src/rooms/GameRoom.ts`: message handler "cast" đọc `CastResult`, nếu `"too_far"` thì
  `client.send("cast_rejected", {...})` — dùng `client.send` (targeted) thay vì `this.broadcast`
  (cả phòng) vì chỉ người đó cần biết.
- `frontend/src/main.ts`: `onGameEvent` xử lý `cast_rejected` -> toast "Bạn cần đứng gần 1 hồ mới
  thả cần được — đi tới hồ gần nhất trước đã!". Đồng thời bỏ hẳn nhánh toast ambient cho
  `catch_result` của người chơi khác (giờ `if (event.playerId !== net.sessionId) return;` ngay đầu —
  chỉ còn xử lý catch_result của chính local player, y hệt logic trước đó nhưng gọn hơn). Xoá
  `getFishSpecies`/`RARITY_LABEL` import không còn dùng tới trong file này.

### Verification performed

`npm run typecheck` sạch cả 3 workspace. Verify bằng 2 script colyseus.js thật (backend đang chạy
live, không phải chỉ đọc code):
1. Đi bộ 928 world units ra xa mọi hồ (gửi `move {angle:0, moving:true}` 6s rồi `moving:false`),
   thả cần — xác nhận `fishState` vẫn `idle` (bị từ chối đúng như thiết kế, không phải bug).
2. Lặp lại kịch bản trên, lắng nghe message `cast_rejected` — xác nhận nhận đúng
   `{"type":"cast_rejected","reason":"too_far_from_lake"}` ngay sau khi gửi cast bị từ chối, xác
   nhận cơ chế phản hồi mới hoạt động đúng.
Live retest qua Browser pane: xác nhận NPC vẫn bắt cá liên tục (leaderboard tăng điểm) nhưng không
còn toast "Ai đó vừa câu được..." nào xuất hiện — xác nhận đã bỏ đúng theo yêu cầu. Không lỗi
console/server trong suốt quá trình test.

## 2026-07-11 - UI kéo cá đổi thành thanh dọc cạnh nhân vật (kiểu Stardew Valley), sau đó phóng to

Vicent gửi 2 link tham khảo liên tiếp: (1) GIF minigame câu cá Stardew Valley gốc — làm rõ qua
AskUserQuestion rằng chỉ muốn đổi HÌNH THỨC hiển thị (thanh dọc đứng cạnh nhân vật) chứ không quay
lại cơ chế "đưa vùng bắt trùng vị trí cá" đã bỏ tuần trước, vẫn giữ nguyên cơ chế kéo/thả tension;
(2) mod CurseForge "Full Fishing Bar" (phóng to vùng bắt trong Stardew gốc cho dễ chơi hơn) — làm
rõ tiếp qua AskUserQuestion rằng chỉ muốn thanh to/rõ hơn để dễ đọc tiến độ/độ căng từ xa, KHÔNG
đổi độ khó hay quay lại cơ chế vùng bắt.

### Thay đổi

- `frontend/src/render.ts`: thêm `tracePillPath` (path bo tròn viên thuốc, dùng chung nền/viền/clip)
  và `drawReelBar(ctx, sx, sy, size, reelProgress, reelTension)` — thanh dọc vẽ NGAY CẠNH nhân vật
  trên canvas (không còn là DOM panel nổi giữa màn hình), đầy dần từ dưới lên theo `reelProgress`
  (xanh dương), viền đổi màu xanh lá -> vàng -> đỏ theo `reelTension` để báo nguy cơ đứt dây ngay
  tại chỗ đang nhìn. Gọi trong nhánh `fishState === "reeling"` của `drawFishingLineAndBobber`, cho
  MỌI người chơi đang kéo cá (không chỉ local) — thấy người khác vật lộn câu cá cũng là 1 phần trải
  nghiệm "có bạn câu cùng hồ" của game. Kích thước ban đầu `size*0.5 x size*2.4`, sau khi xem mod
  "Full Fishing Bar" tăng lên `size*0.8 x size*3.5` cho dễ đọc từ xa hơn (không đổi công thức
  tension/progress, chỉ đổi kích thước hiển thị).
- `frontend/src/ui.ts`: bỏ hẳn 2 thanh HTML (`reel-progress-fill`/`reel-tension-fill`) và
  `reelProgressFill`/`reelTensionFill` fields — `updateReelOverlay` giờ chỉ nhận `reeling: boolean`,
  panel HUD chỉ còn 1 dòng text gợi ý điều khiển. Xoá `clampPercent` (không còn nơi nào dùng).
- `frontend/src/main.ts`: cập nhật lời gọi `updateReelOverlay` theo signature mới (bỏ 2 tham số
  progress/tension).
- `frontend/src/style.css`: đơn giản hoá CSS `.reel-overlay` thành 1 pill text nhỏ (bỏ
  `.reel-bar-row`/`.reel-progress-track`/`.reel-tension-track`/`.reel-tension-fill` không còn dùng).

### Verification performed

`npm run typecheck` sạch cả 3 workspace sau mỗi thay đổi. Không lỗi console khi chạy thử qua Browser
pane. Không chụp được đúng khung hình lúc đang kéo cá để xác nhận trực quan thanh mới do
`requestAnimationFrame` bị browser tự throttle mạnh khi tab chạy nền trong môi trường tự động hoá
(cùng hạn chế đã ghi nhận ở các lần verify trước) — bù lại bằng type-check sạch + tái sử dụng đúng
pattern canvas (path bo tròn, fillRect, clip) đã chứng minh hoạt động ở các hàm vẽ khác trong cùng
file (`drawFishIcon`, `drawCharacter`).

## 2026-07-11 - Chặn đi xuyên qua mặt nước (đã ghi nhận là đơn giản hoá tạm thời từ bản MVP đầu)

Vicent yêu cầu bỏ đơn giản hoá đã ghi trong concept_brief.md ("người chơi có thể đi lại tự do khắp
map kể cả vào nước") — giờ chỉ đi được trên bờ.

- `shared/src/lakes.ts`: thêm `isInsideAnyLake(worldX, worldY)` — kiểm tra 1 điểm có nằm trong BẤT
  KỲ hồ nào không (dùng chung backend/frontend). `frontend/src/render.ts` trước đó có 1 bản y hệt
  cục bộ (chỉ dùng để bỏ qua trang trí trên mặt nước) — dedupe lại, giờ import từ shared thay vì
  định nghĩa riêng.
- `backend/src/systems/movement.ts#stepPlayerMovement`: sau khi tính vị trí mới theo hướng di
  chuyển, nếu điểm đó rơi vào trong hồ (`isInsideAnyLake`) thì thử lần lượt: giữ nguyên trục Y chỉ
  đi trục X, rồi giữ nguyên trục X chỉ đi trục Y — cho cảm giác "trượt dọc theo bờ" khi đi chéo vào
  mép hồ thay vì khựng cứng lại ngay lập tức (chỉ dừng hẳn khi CẢ 2 trục đơn lẻ đều rơi vào nước,
  ví dụ đi thẳng vuông góc vào bờ).
- `docs/concept_brief.md` mục 3 (playtest notes): xoá dòng "đơn giản hoá có chủ đích... không chặn
  di chuyển vào vùng nước", thay bằng mô tả cơ chế chặn + trượt mới.

### Verification performed

`npm run typecheck` sạch cả 3 workspace. Verify bằng script colyseus.js thật: spawn cách biên 1 hồ
(Hồ Rắn) 56 units, gửi `move` nhắm thẳng vào tâm hồ trong 6s — xác nhận nhân vật di chuyển thật
(~117 units từ vị trí spawn, đo bằng toạ độ chụp trước/sau) nhưng `isInsideLake`/`isInsideAnyLake`
luôn `false` trong suốt quá trình VÀ ở vị trí cuối cùng — không bao giờ lọt được vào vùng nước, đúng
thiết kế chặn + trượt dọc bờ.

## 2026-07-11 - UI minigame kéo cá chỉ hiện cho chính mình; status bar nâng cấp rõ/nổi bật hơn

Vicent gửi ảnh tham khảo (view câu cá 3D thực, cần cong + dây căng) kèm 2 yêu cầu: (1) chỉ hiện UI
minigame (cần cong + status bar) khi CHÍNH MÌNH câu được cá cắn câu, không hiện của người chơi
khác; (2) nâng cấp status bar cho rõ/nổi bật hơn. Làm rõ qua AskUserQuestion: giữ nguyên art style
top-down 2D hiện tại (không vẽ lại theo ảnh 3D vì khác hẳn phong cách), chỉ nâng cấp thanh status
đang có cho đẹp/rõ hơn — không cần thêm gì mới ngoài phạm vi đó.

### Thay đổi

- `frontend/src/render.ts#drawFishingLineAndBobber`: thêm tham số `isLocal`. Nhánh `reeling` giờ
  chỉ vẽ đầy đủ (cần cong + dây rung/chùng + cá vùng vẫy + status bar) khi `isReeling && isLocal`;
  người chơi khác đang reeling giờ chỉ hiện phao lặng lẽ như đang chờ (dùng lại animation bob nhẹ có
  sẵn của trạng thái "waiting", không ripple) — không lộ UI cá nhân của người khác ra màn hình mình.
  Call site trong `render()` truyền thêm `isLocal` (đã có sẵn biến này tại đó).
- `drawReelBar` viết lại hoàn toàn thành panel status 2 thanh riêng biệt trong 1 khung nền tối bo
  tròn (kiểu status bar game thật): thanh TIẾN ĐỘ (trái, gradient xanh dương sáng->đậm) và thanh ĐỘ
  CĂNG DÂY (phải, đổi màu xanh lá->vàng->đỏ ngay khi chạm ngưỡng nguy hiểm). Thêm hàm dùng chung
  `drawStatusBarMeter` (track mờ + fill gradient trái-phải cho cảm giác bóng nhẹ + viền sáng mảnh) —
  tách khỏi `drawReelBar` để dễ tái dùng cho cả 2 thanh.

### Verification performed

`npm run typecheck` sạch cả 3 workspace. Verify trực quan bằng cách gọi thẳng hàm `render()` đã
export qua `import()` động module `render.ts` thật ngay trong console trình duyệt đang chạy (cùng kỹ
thuật đã dùng ở lần verify vòng tròn bảo hiểm trước đây trong lịch sử dự án) — dựng snapshot giả lập
2 người chơi cùng đang reeling (1 local, 1 không phải local) và chụp lại canvas debug:
- Local player ("TestLocal", reelProgress=62, reelTension=78): hiện đầy đủ cần cong + dây + cá vàng
  (đúng màu `golden_dragonfish`) + panel status 2 thanh, thanh căng đúng màu cam/vàng (ngưỡng
  warning 55-80%).
- Remote player ("TestRemote", reeling nhưng không phải local): KHÔNG hiện panel status/cần cong gì
  cả, chỉ có dây/phao đơn giản — xác nhận đúng yêu cầu "chỉ hiện UI của chính mình".
- Test riêng reelTension=92: xác nhận thanh căng chuyển đúng màu đỏ (ngưỡng danger >=80%), thanh
  tiến độ 90% gần đầy đúng tỉ lệ.

## 2026-07-11 - Banner to giữa màn hình khi cá cắn câu (tăng cảm giác hồi hộp)

Vicent yêu cầu refactor: hiện modal/banner to khi cá cắn câu để tăng trải nghiệm, thay vì chỉ có
dấu "!" nhỏ trên phao. Ràng buộc quan trọng tự đặt ra khi thiết kế: banner này KHÔNG được là 1 dialog
chặn thao tác thật sự — người chơi chỉ có `HOOK_WINDOW_MS` (0.9s) để bấm móc câu, nên banner phải
để lọt click/phím xuống dưới, không phải thứ cần đóng trước khi thao tác tiếp (khác hẳn
catch-modal/collection-modal vốn chặn click vì không có ràng buộc thời gian phản ứng).

- `frontend/src/ui.ts`: thêm markup `.bite-alert` (tiêu đề "CÁ CẮN CÂU RỒI!", phụ đề nhắc bấm
  chuột/Space, thanh đếm ngược đỏ) + method `updateBiteAlert(active, remainingFraction)` — hiện
  hay ẩn theo `fishState === "biting"` của LOCAL player, thanh đếm ngược đổ dần theo thời gian còn
  lại trước khi lỡ nhịp móc câu.
- `frontend/src/style.css`: `.bite-alert` có `pointer-events: none` (mấu chốt kỹ thuật của tính
  năng này) — banner nổi to giữa màn hình (card vàng, viền đỏ, animation pop-in + rung nhẹ liên tục
  để tăng cảm giác gấp gáp) nhưng KHÔNG chặn click/Space xuống canvas bên dưới.
- `frontend/src/main.ts`: `frame()` tính `remainingFraction` từ `localPlayer.biteExpiresAt` và
  `HOOK_WINDOW_MS` (import mới từ `@bomio/shared`), gọi `ui.updateBiteAlert` mỗi frame giống pattern
  `updateReelOverlay`/`updateCastMeter` đã có (state-driven theo snapshot, không qua event riêng).
  Dấu "!" nhỏ trên phao (`render.ts#drawBiteIndicator`) giữ nguyên không đổi — vẫn cần thiết để biết
  chính xác vị trí phao, banner chỉ bổ sung thêm sự chú ý/kịch tính chứ không thay thế.

### Verification performed

`npm run typecheck` sạch cả 3 workspace. Verify trực tiếp qua Browser pane bằng cách dựng 1 instance
`UI` test (qua `import()` động module `ui.ts` thật) và gọi `updateBiteAlert(true, 0.85)` — chụp màn
hình xác nhận banner hiện đúng như thiết kế (card vàng, viền đỏ, thanh đếm ngược ở ~85%). Quan trọng
nhất: verify riêng `pointer-events: none` bằng `document.elementFromPoint` ngay tại toạ độ tâm
banner đang hiển thị — xác nhận phần tử nhận được click là phần tử NẰM DƯỚI banner (không phải
chính banner), chứng minh banner không chặn thao tác móc câu dù đang hiển thị full-size giữa màn
hình. Không lỗi console trong suốt quá trình test.

## 2026-07-11 - Banner cá cắn câu đổi thành modal thật sự, chơi cả minigame ngay trong modal

Vicent yêu cầu tiếp: hiện modal (không phải banner chỉ để nhìn) ngay lúc cá cắn câu để chơi cả
minigame câu cá trong đó. Làm rõ qua AskUserQuestion — chọn phương án rủi ro hơn: modal xuất hiện
NGAY lúc biting (không phải đợi tới lúc reeling), nghĩa là modal phải tự xử lý được cả bước móc câu
trong khung `HOOK_WINDOW_MS` (0.9s) lẫn bước kéo cá sau đó, không được làm chậm/chặn thao tác bấm.

### Thiết kế: 1 modal xuyên suốt biting -> reeling, tự bắt input thay vì đứng ngoài nhìn

Khác hẳn banner tuần trước (`pointer-events: none`, chỉ để xem): modal mới có `pointer-events:
auto` ở mọi lớp — chính click/giữ chuột NGAY TRONG modal là cách móc câu/kéo cần, không phải dialog
chờ đóng. Modal có 2 "phase" con chuyển đổi theo `fishState`:
- **biting**: tiêu đề đỏ rung nhẹ "CÁ CẮN CÂU RỒI!", phụ đề nhắc bấm, thanh đếm ngược đỏ.
- **reeling**: tiêu đề "ĐANG KÉO CÁ...", 2 thanh Tiến độ (xanh dương) + Độ căng dây (đổi màu xanh
  lá -> vàng -> đỏ theo ngưỡng nguy hiểm) — y hệt số liệu trước đây vẽ cạnh nhân vật trên canvas
  (`drawReelBar`, đã xoá hẳn vì giờ trùng lặp với modal).
Modal tự đóng khi `fishState` quay về `"idle"` (móc hụt/bắt được/cá thoát/đứt dây) — không có nút
đóng thủ công vì không cần, vòng đời hoàn toàn theo state.

### Thay đổi

- `frontend/src/ui.ts`: `.bite-alert` (chỉ 1 phase, pointer-events none) đổi thành `.fishing-modal`
  (2 phase con `biting`/`reeling`, pointer-events auto). Gộp `updateReelOverlay` +
  `updateBiteAlert` cũ thành 1 method `updateFishingModal(phase, data)` duy nhất. Thêm getter
  `fishingModalInteractiveEl` expose phần tử DOM cần bắt thao tác chuột cho main.ts wiring.
- `frontend/src/input.ts`: thêm `InputController.bindAdditionalTarget(el)` — gắn lại ĐÚNG 3 handler
  đã bind sẵn cho canvas (`onMouseDown`/`onMouseUp`/`onMouseLeave`, vốn là arrow-function class
  field nên tái dùng được nguyên vẹn) lên 1 phần tử DOM khác. Tránh phải copy/duplicate lại logic
  hook/reel riêng cho modal — 1 nguồn sự thật duy nhất cho "chuột trái làm gì tuỳ theo fishState".
- `frontend/src/main.ts`: gọi `input.bindAdditionalTarget(ui.fishingModalInteractiveEl)` ngay sau
  khi tạo `input`. `frame()` gọi `ui.updateFishingModal("biting"|"reeling"|"hidden", data)` theo
  `fishState` mỗi frame (thay 2 lệnh gọi riêng biệt trước đó).
- `frontend/src/render.ts`: xoá hẳn `drawReelBar`/`drawStatusBarMeter`/`tracePillPath` (dead code,
  chức năng chuyển hết vào modal) — nhánh reeling của LOCAL player trong `drawFishingLineAndBobber`
  giờ chỉ còn giữ cần cong + cá vùng vẫy làm hiệu ứng khí quyển trong world, không còn vẽ số liệu.
- `frontend/src/style.css`: thay toàn bộ CSS `.bite-alert*`/`.reel-overlay*` bằng `.fishing-modal*`
  (backdrop mờ + card `panel-cut` quen thuộc + style riêng cho từng phase).

### Verification performed

`npm run typecheck` sạch cả 3 workspace. Verify bằng 2 cách trực tiếp qua Browser pane (không phải
chỉ đọc code):
1. **Wiring click->message**: dựng 1 `InputController` + `UI` test qua `import()` động (module thật,
   không phải bản giả lập), gọi `bindAdditionalTarget` lên `fishingModalInteractiveEl`, rồi
   `dispatchEvent` mousedown/mouseup thẳng lên phần tử đó với `getFishState` giả lập lần lượt
   "biting" rồi "reeling" — xác nhận đúng message gửi đi: `{type:"hook"}` lúc biting,
   `{type:"reel",pulling:true}` lúc mousedown khi reeling, `{type:"reel",pulling:false}` lúc
   mouseup — chứng minh click trong modal thật sự kích hoạt móc câu/kéo cần, không chỉ là UI tĩnh.
2. **Visual**: gọi `updateFishingModal("biting", {remainingFraction:0.55})` và
   `updateFishingModal("reeling", {reelProgress:68, reelTension:82})` trên 1 instance UI thật, chụp
   màn hình xác nhận cả 2 phase hiện đúng thiết kế (backdrop mờ nền, card cream quen thuộc, tiêu đề
   đỏ rung + đếm ngược lúc biting; 2 thanh Tiến độ/Độ căng đúng màu — căng 82% đúng ngưỡng đỏ lúc
   reeling). Không lỗi console trong suốt quá trình test.

## 2026-07-11 - Thêm hình cần câu + cá ngay trong modal câu cá (thay vì chỉ chữ/thanh số)

Vicent phản hồi modal mới thiếu hẳn hình cần câu — chỉ có chữ + 2 thanh tiến độ/căng dây, không
thấy cần/cá đâu (trước đó cần cong + cá vùng vẫy vẫn vẽ ngoài world, đằng sau modal, bị backdrop
che mờ gần như không thấy). Làm rõ qua AskUserQuestion: thêm hẳn 1 canvas vẽ cần cong + cá vùng vẫy
NGAY TRONG modal, phía trên 2 thanh tiến độ/căng dây (không làm bố cục đối đầu 2 bên phức tạp hơn).

### Thay đổi

- `frontend/src/render.ts`: thêm hàm export `drawModalReelScene(ctx, width, height, reelTension,
  fishColor, nowMs)` — vẽ cần cong (tái dùng `drawBentRod` có sẵn) + dây (chùng/rung theo độ căng,
  y hệt công thức cũ) + cá vùng vẫy (tái dùng `drawFishIcon`) trên 1 canvas ĐỘC LẬP không neo theo
  world/camera (cần cong góc dưới-trái, cá cố định góc phải khung canvas riêng của modal) — khác
  hẳn bản world-space cũ vốn phải tính toạ độ theo vị trí nhân vật/phao trên map.
  `drawFishingLineAndBobber` đơn giản hoá lại: bỏ hẳn nhánh đặc biệt cho local player lúc reeling
  (cần cong/cá vẽ ngoài world), giờ MỌI người chơi lúc reeling chỉ hiện phao lặng lẽ như đang chờ —
  tránh vẽ trùng 2 nơi (world lẫn modal) cùng lúc. Bỏ tham số `isLocal` không còn cần ở hàm này.
- `frontend/src/ui.ts`: thêm `<canvas class="fishing-modal-canvas">` trong phase reeling của
  modal, field + wiring tương ứng. `updateFishingModal` phase "reeling" giờ nhận thêm `speciesId`
  (tra màu qua `getFishSpecies`, đã import sẵn) + `nowMs` (cho animation vẫy cá theo thời gian
  thực), gọi `drawModalReelScene` mỗi lần cập nhật.
- `frontend/src/main.ts`: truyền thêm `speciesId: localPlayer.activeFishSpeciesId` và `nowMs` vào
  lệnh gọi `updateFishingModal("reeling", ...)`.
- `frontend/src/style.css`: thêm `.fishing-modal-canvas` (bo góc, viền xanh lá quen thuộc, canh
  giữa phía trên 2 thanh trạng thái).

### Verification performed

`npm run typecheck` sạch cả 3 workspace. Verify trực quan qua Browser pane: gọi
`updateFishingModal("reeling", {reelProgress:55, reelTension:65, speciesId:"golden_dragonfish",
nowMs:1234})` trên 1 instance UI thật (qua `import()` động module thật) — chụp màn hình xác nhận
canvas trong modal vẽ đúng cần câu cong màu nâu + cá màu vàng (đúng màu `golden_dragonfish` trong
FISH_CATALOG) nối bằng dây câu, nền nước xanh nhạt, nằm gọn phía trên 2 thanh Tiến độ (55%, xanh
dương)/Độ căng dây (65%, cam đúng ngưỡng warning) bên dưới. Không lỗi console trong suốt quá trình
test.

## 2026-07-11 - Bỏ hẳn bước móc câu (auto-hook); đại trùng tu UI/UX theo phong cách cozy Stardew

Vicent yêu cầu 2 việc lớn cùng lúc: (1) cá cắn câu là TỰ ĐỘNG vào minigame kéo cá luôn, không cần
bấm-kịp-0.9s như trước; (2) "đại trùng tu" toàn bộ giao diện vì "hiện tại nhìn xấu quá". Làm rõ qua
AskUserQuestion: bỏ hẳn bước móc câu (không phải chỉ đảm bảo modal tự mở đúng lúc — core loop rút
từ 4 bước xuống 3: thả cần -> chờ cắn -> kéo cá); art direction chọn "cozy pixel-art / Stardew
style" (khung gỗ, nền giấy da, nút bấm dày 3D); phạm vi trùng tu đợt này là HUD trong game (các đợt
trước đã làm modal câu cá + màn connect screen).

### Bỏ bước móc câu (auto-hook) — core loop 4 bước -> 3 bước

- `shared/src/types.ts`: `FishingState` bỏ hẳn `"biting"` (còn `"idle" | "casting" | "waiting" |
  "reeling"`). `PlayerState` bỏ `biteExpiresAt`. Bỏ `InputHookMessage`/`"hook"` khỏi `ClientMessage`.
  `ServerEvent`'s `catch_result` bỏ `reason: "missed_hook"` (không còn tình huống này nữa — cá cắn
  là chắc chắn vào reeling, không có "lỡ nhịp" nào để mất).
- `shared/src/constants.ts`: xoá `HOOK_WINDOW_MS` (không còn khung thời gian phản ứng nào cần đo).
- `backend/src/schema/State.ts`: `PlayerSchema` bỏ field `biteExpiresAt` tương ứng.
- `backend/src/systems/fishing.ts`: xoá hẳn `tryHook` (không còn hàm móc câu riêng) —
  `updateBiteScheduling` giờ khi tới giờ cá cắn (`biteAt`) thì làm LUÔN việc mà `tryHook` từng làm
  (set `fishState = "reeling"`, `activeFishSpeciesId`, khởi tạo `reelProgress`/`reelTension`) ngay
  trong nhánh xử lý, không cần đợi client gửi message "hook" nữa. Event `fish_bite` vẫn broadcast y
  hệt (client dùng để biết lúc nào modal cần mở).
- `backend/src/rooms/GameRoom.ts`: xoá message handler `"hook"`.
- `backend/src/systems/npcFishers.ts`: xoá nhánh `fishState === "biting"` (NPC không còn cần "phản
  ứng" gì khi cắn câu nữa — tự động vào reeling y hệt người chơi thật).
- `frontend/src/input.ts`: `onMouseDown` bỏ nhánh `state === "biting"` (gửi hook) — giờ chỉ còn
  phân nhánh `idle` (tích lực cast) vs `reeling` (giữ kéo). `onKeyDown` bỏ hẳn xử lý phím Space
  (không còn hành động câu cá nào gắn với Space nữa).
- `frontend/src/render.ts`: xoá `drawBiteIndicator` (dấu "!" đếm ngược trên phao) và biến `isBiting`
  — bobber giờ chỉ có 2 kiểu chuyển động: bập bềnh nhẹ (waiting) hoặc giật nhanh (reeling, cá đang
  vùng vẫy dưới nước).
- `frontend/src/ui.ts`: `.fishing-modal` bỏ hẳn khái niệm "phase" (trước có phase con
  `biting`/`reeling` chuyển đổi qua lại) — giờ chỉ có 1 nội dung duy nhất (cảnh cần+cá, 2 thanh
  trạng thái), hiện/ẩn theo đúng 1 điều kiện `fishState === "reeling"`. `updateFishingModal` đổi
  chữ ký từ `(phase, data)` sang `(active: boolean, data)` cho khớp.
- `frontend/src/main.ts`: bỏ hẳn nhánh xử lý `"biting"` trong `frame()` và toast `"missed_hook"`.
  Xoá import `HOOK_WINDOW_MS` không còn dùng.

### Đại trùng tu UI: cozy Stardew (khung gỗ nâu + nền giấy da)

- `frontend/src/style.css`: viết lại gần như toàn bộ theme — palette đổi hẳn từ "playful bright
  green/candy" sang "wood & parchment" (biến CSS mới: `--c-outline`, `--c-wood`, `--c-wood-light`,
  `--c-wood-shadow`, `--c-parchment`, `--c-parchment-deep`, `--c-gold`, `--c-amber`). `.panel-cut`
  (dùng chung mọi panel: leaderboard, stats, minimap frame, các modal) đổi từ viền đơn cream/xanh lá
  sang khung gỗ 2 lớp inset-shadow (`inset 0 0 0 3px wood-light, inset 0 0 0 6px wood`) trên nền
  gradient giấy da, đổ bóng cứng không blur kiểu pixel-art (không dùng `filter: blur` hay
  box-shadow mềm). Thêm class dùng chung `.wood-button` cho các nút bấm dày kiểu 3D
  (gradient vàng->hổ phách, đổ bóng cứng, nhấn xuống khi `:active`). Leaderboard top 3 đổi từ chữ số
  màu sang icon 🥇🥈🥉. Toàn bộ modal con (catch modal, collection modal, fishing modal, connect
  screen) đều ăn theo palette mới.
- `frontend/src/ui.ts`: thêm icon nhỏ (🏆🎣🐟) vào tiêu đề leaderboard/stats/nút sổ cá cho đúng tinh
  thần game câu cá, không đổi cấu trúc DOM nào khác ngoài text/icon.

### Verification performed

`npm run typecheck` sạch cả 3 workspace sau mỗi nhóm thay đổi. Verify bằng 2 cách trực tiếp:
1. **Script colyseus.js thật** (không phải chỉ đọc code): cast thành công, chờ cá cắn, log lại toàn
   bộ tập `fishState` quan sát được trong suốt vòng đời — xác nhận đúng `{waiting, reeling, idle}`,
   **không hề có `"biting"` xuất hiện** — chứng minh state cũ đã biến mất hoàn toàn khỏi runtime
   thật, không chỉ khỏi type. Log cũng xác nhận "entered reeling AUTOMATICALLY (no hook message
   sent)" và `catch_result` thành công cuối cùng.
2. **Browser pane thật** (backend+frontend preview đang chạy): connect screen + HUD hiện đúng theme
   gỗ/giấy da mới (khung nâu viền đậm, nút Play gradient vàng-hổ phách, panel leaderboard/stats có
   icon 🏆🎣🐟). Cast thật qua canvas rồi chờ cá cắn — xác nhận modal TỰ MỞ ngay khi cắn câu (không
   cần bấm gì để "móc câu" trước), hiện đúng cảnh cần cong + cá + 2 thanh trạng thái theo đúng theme
   mới, và sau khi kéo xong quay lại trạng thái rảnh tay với chỉ số "Đã câu được"/"Tổng giá trị" cập
   nhật đúng. Không lỗi console trong suốt quá trình test.

## 2026-07-13 - Minigame kéo cá gộp về "1 thanh duy nhất" kiểu Stardew Valley (roll xác suất cuối phiên)

Vicent gửi 2 ảnh phác thảo tay (1 thanh dọc có 1 "khoảng cho phép" — ảnh 1 khoảng rộng, ảnh 2 khoảng
hẹp gần đỉnh) kèm yêu cầu: gộp 2 thanh progress/tension cũ thành 1 thanh, có 1 "vùng bắt" mà người
chơi chỉ cần giữ chuột sao cho "mực yêu cầu" (con cá) nằm trong đó; cá càng dễ vùng bắt càng rộng, cá
càng hiếm/khó vùng bắt càng hẹp; sau 1 khoảng thời gian cố định, thời gian nằm trong vùng đó nhiều
hay ít quyết định TỶ LỆ bắt được cá. Làm rõ qua AskUserQuestion: cá di chuyển kiểu Stardew Valley (tự
bơi lang thang thất thường, người chơi chỉ điều khiển vùng bắt — giữ chuột đẩy lên, thả ra rơi xuống
theo trọng lực); kết quả là XÁC SUẤT — hết thời gian cố định mới roll 1 lần duy nhất dựa trên % thời
gian đã ở trong vùng bắt, KHÔNG phải kiểu đổ đầy 100% là thắng ngay.

Bỏ hẳn khái niệm "độ căng dây câu" (tension)/đứt dây/chùng dây — không còn điều kiện thất bại tức
thời nào cả, người chơi luôn chơi đủ hết `REEL_DURATION_MS` rồi mới biết kết quả.

- `shared/src/constants.ts`: xoá `REEL_PROGRESS_FILL_RATE/DRAIN_RATE/START`, `REEL_TENSION_MAX`,
  `REEL_TENSION_FALL_RATE`, `REEL_DIFFICULTY_MULTIPLIER`, `computeTensionRiseRate`,
  `computeReelResistance`. Thêm `REEL_DURATION_MS` (8000ms, cố định mọi loài), `REEL_ZONE_MAX_SIZE`
  (62, cho loài dễ nhất) / `REEL_ZONE_MIN_SIZE` (16, cho loài khó/hiếm nhất) + `computeReelZoneSize`
  (nội suy tuyến tính theo `reelDifficulty`), `REEL_ZONE_RISE_ACCEL`/`GRAVITY`/`MAX_SPEED` (vật lý
  vùng bắt), `REEL_FISH_BASE_SPEED`/`DIFFICULTY_SPEED_BONUS` + `computeReelFishSpeed` (tốc độ cá bơi
  lang thang), `REEL_FISH_RETARGET_MIN/MAX_MS` + `REEL_FISH_TARGET_MARGIN` (nhịp chọn điểm đích ngẫu
  nhiên mới, tạo cảm giác "thất thường").
- `shared/src/types.ts`: `PlayerState` bỏ `reelTension`, thêm `reelFishY`/`reelZoneY` (0..100, vị trí
  cá / tâm vùng bắt). `reelProgress` đổi ý nghĩa: giờ là % thời gian cá nằm trong vùng bắt TÍNH TỚI
  HIỆN TẠI của phiên đang diễn ra (cũng là % sẽ dùng để roll xác suất lúc hết giờ). `ServerEvent`'s
  `catch_result` bỏ `reason: "line_snapped"` (không còn đứt dây), chỉ còn `"fish_escaped"` (roll
  không trúng lúc hết giờ).
- `backend/src/schema/State.ts`: `PlayerSchema` bỏ `@type reelTension`, thêm `@type
  reelFishY`/`reelZoneY`. Thêm bookkeeping thuần server (không đồng bộ, giống pattern
  `desiredAngle`/`biteAt`): `reelZoneVelocity`, `reelFishTargetY`, `reelFishNextRetargetAt`,
  `reelStartedAtMs`, `reelTimeInZoneMs`.
- `backend/src/systems/fishing.ts`: xoá hẳn WeakMap `reelSlackState`/`ReelSlackState` (không còn cần
  — không còn luật chùng dây). Viết lại `updateReeling()`: (1) cá bơi lang thang — tới giờ thì chọn
  điểm đích ngẫu nhiên mới (`reelFishNextRetargetAt`), luôn bơi thẳng tới đó với tốc độ
  `computeReelFishSpeed`; (2) vùng bắt — giữ chuột thì tăng vận tốc đẩy lên
  (`REEL_ZONE_RISE_ACCEL`), thả ra thì rơi theo trọng lực (`REEL_ZONE_GRAVITY`), vận tốc luôn chặn
  trần `REEL_ZONE_MAX_SPEED`; (3) mỗi tick cộng dồn `reelTimeInZoneMs` nếu cá đang nằm trong vùng bắt
  (`computeReelZoneSize`), cập nhật `reelProgress` = % thời gian trong vùng tính tới hiện tại; (4) hết
  `REEL_DURATION_MS` thì roll xác suất DUY NHẤT 1 LẦN = `reelTimeInZoneMs / REEL_DURATION_MS`, quyết
  định thành/bại ngay. `resetToIdle`/`updateBiteScheduling` cập nhật theo field mới (cá và vùng bắt
  đều bắt đầu ở giữa thanh, `reelStartedAtMs`/`reelTimeInZoneMs` reset về 0/`now`).
- `backend/src/systems/npcFishers.ts`: bỏ hysteresis theo tension
  (`NPC_REEL_RELEASE/RESUME_TENSION`), thay bằng AI đuổi theo vị trí cá: cá ở trên vùng bắt quá
  ngưỡng đệm (`NPC_REEL_TOLERANCE = 4`) thì giữ chuột, ở dưới quá ngưỡng thì thả ra.
- `frontend/src/render.ts`: xoá hẳn `drawBentRod` + cảnh cần cong/hồ nước cũ trong
  `drawModalReelScene`. Viết lại thành vẽ 1 thanh dọc duy nhất (khung gỗ, có vạch chia nhỏ giống ảnh
  phác thảo), 1 dải màu là vùng bắt (xanh lá khi cá đang trong, vàng khi cá ở ngoài), và biểu tượng
  cá (`drawFishIcon`, tái sử dụng) tại vị trí `fishY` — không còn cần câu/hồ nước nào trong cảnh này.
- `frontend/src/ui.ts`: bỏ hẳn 2 thanh DOM progress/tension
  (`.fishing-modal-vertical-bar-wrapper`), canvas đổi sang khổ dọc (200x360) khớp cảnh mới, thêm
  dòng chữ "Chance to catch: NN%" (đổi màu xanh lá/vàng/đỏ theo mức) đọc thẳng từ `reelProgress`.
  `updateFishingModal` đổi chữ ký: nhận `reelFishY`/`reelZoneY` thay vì `reelTension`, tự tính lại
  bề rộng vùng bắt qua `computeReelZoneSize(species.reelDifficulty)` (import từ `@bomio/shared`,
  không cần đồng bộ riêng).
- `frontend/src/style.css`: xoá toàn bộ `.fishing-modal-vertical-bar-*`, `.fishing-modal-canvas` đổi
  bố cục sang khổ dọc, thêm `.fishing-modal-chance(-value)` với 3 màu trạng thái.
- `frontend/src/main.ts`: bỏ hẳn nhánh cảnh báo "tension cao" (biến `lastTensionAlarmTime`,
  `audioManager.playTensionAlarm()`) và toast/`playSnap()` cho `reason === "line_snapped"` (không
  còn tình huống này). Cập nhật lời gọi `ui.updateFishingModal()` truyền `reelFishY`/`reelZoneY`
  thay vì `reelTension`. Giữ nguyên tiếng "click" khi giữ chuột kéo (`playReelClick`).
  `audio.ts`'s `playSnap()`/`playTensionAlarm()` cố tình GIỮ NGUYÊN định nghĩa (không xoá) dù không
  còn call site nào — vô hại, đỡ phải động vào audio.ts không cần thiết.

### Verification performed

`npm run typecheck` sạch cả 3 workspace (shared build + backend/frontend `tsc --noEmit`), không lỗi
nào sau khi rewrite toàn bộ chuỗi shared -> backend schema/systems -> frontend render/ui/main.
