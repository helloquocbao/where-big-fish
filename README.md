# Where Big Fish (wherebigfish.com)

Multiplayer web fishing game — multiple people fishing around a lake in real time. Full spec: `docs/concept_brief.md`. Code collaboration guidelines: `AGENTS.md`. Decision/pivot history: `docs/progress.md`.

## Structure

- `shared/` — shared game rules/constants + types, the single source of truth for FE/BE (`@bomio/shared`)
- `backend/` — Colyseus game server (Node + TypeScript)
- `frontend/` — Vite client + TypeScript + Canvas, connected via `colyseus.js`
- `docs/` — spec, progress log

## Run Local

```bash
npm install          # install all workspaces (shared/backend/frontend)
npm run dev:backend  # run server at ws://localhost:2567
npm run dev:frontend # run client at http://localhost:5173 (check Vite logs for the exact port)
```

Open your browser to the URL printed by Vite, enter a name, and press Play to join a lake.

**How to Play**: WASD or arrow keys to move around the lake, hold the left mouse button to charge power, then release to cast toward the cursor. When a fish bites, it AUTOMATICALLY enters the reeling minigame (no more hooking step using Space) — the reeling modal opens immediately. Hold the mouse to lift the catch zone, release periodically to lower tension to avoid snapping the line, and reel until the progress bar is full.

## Current Status (MVP)

Implemented: walking around the lake, casting (holding mouse to charge), waiting for bite according to fish rarity, hooking window, reeling minigame, fish index/collection catalog, live leaderboard based on total caught value, blank-filler NPC fishers, and automatic lake matchmaking.

Not implemented yet (see roadmap in `docs/concept_brief.md`): multiple different lakes, cross-session accounts/progress save (collection index is currently reset when leaving), economy/upgradable rods and bait, audio/visual polish for fish catching.

All configuration values (bite wait time, minigame difficulty, lake limits, etc.) are loaded from `shared/src/constants.ts` — adjust them there during playtests instead of scattering changes across backend and frontend.

> Note: this project pivoted from a PvP game concept similar to slither.io/agar.io (temporary name "Bomio") to a fishing game — old files in `backend/src/systems/` (`pounce.ts`, `bomb.ts`, etc.) have been deleted or cleaned up.
