# Agent Collaboration Guidelines for the Project

Purpose: allows multiple agents (or people) to work concurrently on `frontend/`, `backend/`, and `shared/` without stepping on each other's toes or overwriting each other's work.

## Directory Structure

| Directory | Role | Who can modify |
|---|---|---|
| `docs/` | Spec, concept brief, design decision documents, progress log | All agents, **add/update only**, do not delete finalized decision history |
| `frontend/` | Entire client code (render, input, UI) | Frontend agent only |
| `backend/` | Entire server code (game loop, room, matchmaking, fishing logic) | Backend agent only |
| `shared/` | Shared contract between FE-BE: game constants, realtime message schema, type definitions | Both agents can modify, but must follow the procedure below |

## Core Rules

1. **Do not modify files outside your designated directories.** The frontend agent must not modify code in `backend/` and vice versa. If you find an issue on the other side, note it in `docs/progress.md` instead of fixing it yourself.
2. **`shared/` is the single source of truth** for all game values and rules that both sides need to know identically — e.g. fish species catalog + rarities (`FISH_CATALOG`), bite wait/hook window times (`HOOK_WINDOW_MS`), reel minigame difficulty, cast range, player/lake capacity limits. **Do not hardcode these numbers separately in frontend or backend** — always import or reference them from `shared/`.
3. **Changes to `shared/` must be documented** in `docs/progress.md` (what was changed, why, and by whom) before the other agent writes code relying on the new values — preventing mismatch in client/server calculations.
4. **Read `docs/concept_brief.md` before coding** — this is the source specification for all game rules. If game rules need to be changed from the brief, update the brief first instead of interpreting it differently.
5. **Log progress in `docs/progress.md`** whenever starting or completing a significant task — other agents need to know the current status to avoid duplicate work or incorrect assumptions.

## In Case of Conflicts

If both agents need to modify `shared/` at the same time, priority goes to: BE proposes first (as authoritative game logic lives on the server), and FE follows. If unsure, stop and ask the user instead of deciding on your own.

## References

- `docs/concept_brief.md` — game rules / feature spec (primary source)
- `docs/progress.md` — progress log, decisions, ongoing/completed tasks
