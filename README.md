# Cavebreak — Project Index

> **Working title:** Cavebreak (placeholder — rename freely)
> A real-time strategy game where players start in a tiny pocket of a cave and mine outward to expand territory, gather resources, grow a settlement, and build armies to fight other players. Top-down 2D, fog of war, StarCraft 2–style economy and combat.

---

## ⚠️ READ THIS FIRST — Documentation Rules (for Claude Code)

This project uses a **docs-as-source-of-truth** system. Follow these rules on every session:

1. **The `docs/` folder is the design source of truth.** Before writing or changing code for a system, read its doc file first. Before finishing a change, update the relevant doc(s) to match what you built.
2. **One doc per system.** Each major mechanic/feature has its own file so context stays small. Do not merge them into one giant file.
3. **Keep cross-links current.** Every doc has a `## Related Systems` section listing the other docs it touches. When you change how systems connect (e.g. you wire inventory/resources into the UI), update the `Related Systems` section in *both* files.
4. **Log notable decisions.** When you make an implementation choice that deviates from or extends a doc, add a dated bullet under that doc's `## Implementation Notes` section. This is the running changelog so future sessions don't re-litigate solved problems.
5. **If you add a new system, add a new doc** and register it in the table below.
6. **Numbers come from `docs/balance-data.md`.** Don't hardcode unit/building stats inline — reference the balance file so there's a single place to tune.

---

## Document Map

| Doc | Covers | Touches |
|-----|--------|---------|
| [GAME_DESIGN.md](./GAME_DESIGN.md) | High-level vision, core loop, scope | everything |
| [docs/map-terrain.md](./docs/map-terrain.md) | Grid, tile types, map shape, starting positions | mining, fog-of-war, multiplayer |
| [docs/mining.md](./docs/mining.md) | Wall mining, worker harvest loop, deposit | resources, units, map-terrain |
| [docs/resources.md](./docs/resources.md) | Minerals, gas, supply, saturation | mining, buildings, units, ui |
| [docs/units.md](./docs/units.md) | Workers, combat units, attributes, counters | buildings, resources, tech-tree, combat |
| [docs/buildings.md](./docs/buildings.md) | Bases, production, defense, supply structures | units, resources, tech-tree |
| [docs/tech-tree.md](./docs/tech-tree.md) | Build dependencies, upgrades, progression | buildings, units |
| [docs/combat.md](./docs/combat.md) | Damage, attributes, vision, attack-move | units, fog-of-war |
| [docs/fog-of-war.md](./docs/fog-of-war.md) | Vision, line of sight, reveal/hide | map-terrain, units, combat |
| [docs/ui.md](./docs/ui.md) | Layout, panels, controls, keybinds | resources, units, buildings |
| [docs/multiplayer.md](./docs/multiplayer.md) | Lobby, sync model, server authority | tech-stack, map-terrain |
| [docs/tech-stack.md](./docs/tech-stack.md) | Next.js, Vercel, Supabase Realtime, structure | multiplayer |
| [docs/balance-data.md](./docs/balance-data.md) | All tunable numbers in one place | units, buildings, resources, tech-tree |

---

## Quick Start for Claude Code

1. Read `GAME_DESIGN.md` for the vision.
2. Read `docs/tech-stack.md` for how the app is wired.
3. Pick a system, read its doc, build it, update its doc.
4. Pull all stats from `docs/balance-data.md`.

## Design Stance

- **Borrow StarCraft 2's proven numbers and structures** wherever possible — it's already balanced, so we don't reinvent it. We reskin/theme it for a cave setting.
- **Single faction to start.** The MVP uses one faction modeled on SC2 Terran mechanics (separate supply buildings, straightforward production, add-ons optional). Multiple factions can come later.
- **Private game.** Built for the owner and friends — no anti-cheat hardening, no public launch, no account system beyond what's needed to join a lobby.

---

## Running Locally

```bash
npm install      # first time only
npm run dev      # start the dev server (http://localhost:3000)
```

Then open the home page and click **Play (local)** to launch a single-player local match.

```bash
npm run build    # production build / typecheck
npm run lint     # eslint
```

## Code Layout

```
/app            Next.js app (UI shell, landing, match page)
  /play         the live match view (canvas + HUD panels)
/game
  /sim          authoritative game logic — engine-agnostic, no React/DOM
  /render       canvas renderer for the viewport + minimap
  /net          client networking bindings (placeholder; local for now)
/docs           design docs — the source of truth (see rules at top of this file)
```

> `/game/sim` must stay free of React/DOM imports so the same simulation can run on a server later (see [docs/multiplayer.md](./docs/multiplayer.md)).
