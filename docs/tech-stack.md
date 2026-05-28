# Tech Stack

Chosen to match the owner's existing familiarity (same stack as the Campaign Trail project) and to keep a private, friends-only game cheap and easy to iterate on.

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend framework | **Next.js** | Already known from prior project; good DX, easy deploy. |
| Hosting (frontend) | **Vercel** | Already known; zero-config deploys, free tier fine for private use. |
| Realtime / state | **Supabase Realtime** (with Socket.io as fallback if needed) | Already in the toolkit; free tier comfortably covers a few friends. |
| Persistence (optional) | **Supabase Postgres** | For lobbies, match records if wanted. Not required for MVP play. |
| Rendering | **HTML5 Canvas** (or WebGL via PixiJS) for the 2D top-down grid | Canvas is simplest; PixiJS if performance with many units demands it. React handles the surrounding UI panels. |

## Cost

- **Supabase Realtime is included in the free tier** — concurrent connections and message throughput on the free plan are well beyond what a handful of friends need. Paid tiers exist if it ever scales, but that's not expected here.
- Vercel free tier covers a private app.

## Architecture Decision to Lock Early

A real-time tick loop doesn't map cleanly onto Vercel's serverless functions (they're short-lived). Decide up front (see [multiplayer.md](./multiplayer.md)):

- **Option A:** Frontend on Vercel + a small dedicated **Node game-server process** (e.g. a cheap VPS / Fly.io / Railway) running the authoritative simulation over WebSockets.
- **Option B:** Lean on **Supabase Realtime + Postgres + a server-side worker** to drive the tick and hold shared state.

> Recommendation: prototype with Option B (stays inside the known stack) and move to Option A only if tick performance/latency demands a dedicated process.

## Rendering Notes

- Keep **game logic in grid/tile units**, rendering in pixels (see [map-terrain.md](./map-terrain.md)).
- Separate the **simulation** (authoritative, server) from the **view** (client canvas) cleanly so netcode and rendering don't tangle.
- React for UI chrome (panels, buttons, menus per [ui.md](./ui.md)); Canvas/Pixi for the live battlefield viewport and minimap.

## Suggested Repo Structure (starting point)

```
/app            Next.js app (UI shell, lobby, match page)
/game
  /sim          authoritative game logic (grid, units, economy, combat) — engine-agnostic
  /render       canvas/pixi renderer for the viewport + minimap
  /net          client networking (WebSocket/Supabase Realtime bindings)
/server         authoritative tick loop + command handling (Option A) 
/docs           THESE DESIGN DOCS — keep updated (see README rules)
```

> Keep `/game/sim` free of rendering/React so it can run on the server too (shared sim code).

## Related Systems

- [multiplayer.md](./multiplayer.md) — how this stack hosts the netcode.
- [ui.md](./ui.md) — React UI layer.
- [map-terrain.md](./map-terrain.md) — grid logic in tile units.

## Implementation Notes

- **2026-05-27** — Scaffolded with `create-next-app`: **Next.js 16 (App Router, Turbopack)** + **React 19** + **Tailwind v4** (CSS-based config). Created the prescribed layout: `game/sim` (engine-agnostic, no React/DOM), `game/render` (canvas), `game/net` (placeholder `NetClient` interface), `app/play` (match view).
  - **Sim runs locally in the browser for now** (single player). Player intents go through `applyCommand(state, cmd)` and the loop calls `step(state, dt)` at a fixed 16 Hz with rAF rendering — so the same sim can move server-side later (Option A/B still open).
- **2026-05-28** — UI stack: **shadcn/ui** (`radix-nova` style, `neutral` base) on the unified **`radix-ui`** package, OKLCH tokens with **dark default** via `next-themes`, **Geist** Sans/Mono, **lucide** icons, **Motion v12**, **Sonner** toasts, **cmdk** (⌘K palette), **Vaul** drawers. `turbopack.root` is pinned to the cavebreak dir because the parent folder has its own lockfile. Repo pushed to GitHub `HTSIADMIN/cavebreak` (`main`).
