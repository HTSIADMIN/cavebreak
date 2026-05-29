# Cavebreak — Game Design Overview

## Vision

A real-time strategy game played top-down in 2D. Each player starts confined to a tiny pocket of solid rock and must **mine outward** to claim cave space, gather resources, grow a settlement, and produce workers and armies. Players compete (up to multiple per match) to out-expand and ultimately destroy each other. The feel is **StarCraft 2 with a pickaxe**: heavy micromanagement, an economy/army balancing act, and fog of war hiding what your opponents are up to.

## The Core Loop

1. **Expand** — workers mine adjacent rock walls (takes time) to open up new cave space.
2. **Gather** — workers harvest minerals (from walls/deposits) and gas (from geysers) and auto-haul them back to the nearest friendly base.
3. **Grow** — spend resources on more workers, more bases (deeper = faster mining + more deposit points), production buildings, and supply.
4. **Tech** — climb the tech tree to unlock stronger units and upgrades.
5. **Fight** — scout through the fog, micro your army into the enemy's territory, and win by eliminating opponents.

## Key Pillars

- **Mining *is* map control.** Unlike StarCraft where the map is pre-carved, here the map starts almost entirely solid. The shape of the playable space is created by the players themselves. Where you choose to dig defines your defensible chokes and your reach toward resources/enemies.
- **Real-time micro.** No turns. Everything happens live. Selecting, moving, queuing, fighting — all StarCraft-style.
- **Fog of war.** You only see where your units have line of sight. Solid walls block vision; cleared cave space lets you see across it. (See [fog-of-war.md](./docs/fog-of-war.md).)
- **Borrowed balance.** Unit costs, build times, supply, tech dependencies, and combat numbers are lifted from StarCraft 2 (single faction to start) so the game is fun and balanced from day one. (See [balance-data.md](./docs/balance-data.md).)

## Match Setup (MVP)

- **Players:** 2 to start; architecture should allow more (free-for-all).
- **Start:** Each player spawns in a small cleared pocket (1×1 or 2×2 tiles) at spaced/opposite positions on the map, each with a starting base, a few workers, and an adjacent mineral source.
- **Map shape:** Square or circular boundary, mostly solid rock at start. (See [map-terrain.md](./docs/map-terrain.md).)
- **Win condition (MVP):** Eliminate all enemy structures (or all enemy bases). Last player standing wins.

## Scope Boundaries (MVP vs Later)

**MVP**
- One faction.
- Mining/expansion, economy, supply, ~6–10 unit types, a basic tech tree.
- 2-player real-time match over the network.
- Fog of war, attack-move, basic combat resolution.
- Functional modern-StarCraft UI.

**Later / Stretch**
- Additional factions.
- Upgrades beyond tier-1, advanced abilities/spells.
- More than 2 players, teams.
- Replays, saved games, ranked anything.
- Audio/visual polish, animations.

## Related Systems

This is the hub doc; every system below feeds the loop above.
- Map & terrain → [map-terrain.md](./docs/map-terrain.md)
- Mining → [mining.md](./docs/mining.md)
- Resources → [resources.md](./docs/resources.md)
- Units → [units.md](./docs/units.md)
- Buildings → [buildings.md](./docs/buildings.md)
- Tech tree → [tech-tree.md](./docs/tech-tree.md)
- Combat → [combat.md](./docs/combat.md)
- Fog of war → [fog-of-war.md](./docs/fog-of-war.md)
- UI → [ui.md](./docs/ui.md)
- Multiplayer → [multiplayer.md](./docs/multiplayer.md)
- Tech stack → [tech-stack.md](./docs/tech-stack.md)

## Implementation Notes

_(Running changelog — add dated bullets as decisions are made.)_
- **2026-05-27** — Scaffolded the project (Next.js 16 + Tailwind v4) and built the first playable vertical slice: a single-player **economy loop**. Implemented in `game/sim` (engine-agnostic), `game/render` (canvas), and `app/play`. Working: symmetric 2-player map, worker auto-harvest → deposit, mineral depletion, supply tracking, base worker production, wall mining (ROCK→FLOOR), A* pathing, selection + HUD, camera/minimap. Deferred to later: fog of war, combat, additional buildings/units, gas extractor, multiplayer netcode (sim is structured to move server-side).
- **2026-05-28** — Major expansion to a playable RTS. **Pivoted the faction to Protoss-style** (Pylons + power field) per the owner's request: Nexus / Pylon / Gateway / Photon Cannon, Worker / Zealot / Stalker. Added: **fog of war**, **building construction + placement** (powered placement), **combat** (auto-acquire, attack / attack-move, death, win condition), **a basic enemy AI**, **tighter start pocket**, and **scattered symmetric resource fields** to force expansion. UI gained build/train command cards + placement ghost + win banner. Sim decoupled from rAF onto a fixed-timestep interval. Full match/netcode DB schema written (not yet wired). Still deferred: real multiplayer netcode, upgrades, air units, attribute counters/shields.
- **2026-05-28 (combat & tech depth)** — Added **plasma shields** (regen out of combat), **armor + attribute counters** (Stalker bonus vs Armored), a **Cybernetics Core** (gates the Stalker), a **Forge** with **Ground Weapons/Armor upgrades**, and a **buildable Nexus** (expansion). The **AI** now tech-ups (Cybernetics, Forge, upgrades), gathers gas, builds defensive cannons, and masses a mixed army. Fixed a construction bug (workers picked building-occupied approach tiles). Known limitation: the AI doesn't mine offensive tunnels yet, so on a sealed map neither side can reach the other without digging — you must mine toward the enemy to win.
- **2026-05-28 (polish)** — **Offensive AI mining**: once it has an army, the AI digs a tunnel toward the enemy (frontier-mining via a reachable-floor BFS) until connected, then attacks — so it's now an actual threat (a 6-worker dig crew; full breakthrough is still slow given the 30s wall-mine). UX polish: **control groups** (Ctrl/Shift+1–9), **mouse-wheel zoom**, **command-feedback markers**, and **instant restart**. Fixed a console-spamming React 19 error by dropping the next-themes provider (dark mode pinned on `<html>`).
- **2026-05-28 (depth & polish pass)** — Big feature pass per owner goals:
  - **Resources are findable-only** (no starting minerals/geyser): a 5×5 sealed start pocket; resources scattered in rock, some a short dig away, plus high-yield **golden** mineral/gas nodes out in contested space.
  - **Fast tiered wall-mining** — Worker 10 s · Zealot 5 s · Stalker 3 s; **any unit can mine**, with a wall-break animation + crack progress.
  - **Distinct drawn icons** for every unit (worker/zealot/stalker) and building (nexus/pylon/gateway/cybernetics/forge/cannon), plus action animations (mining cracks, attack-impact lines, wall breaks) via a sim **event queue**.
  - **Pylon power visuals** — hovering a pylon links it to its Nexus and shows its power radius; placing a powered building previews coverage.
  - **shadcn/ui tooltips** on every command-card button (cost, build time, description); **command card compacted so the whole HUD fits on one screen** (no scroll).
  - A **connecting cave corridor** is carved between the two starts so armies can reach each other after breaking out (sealed pockets + findable resources preserved).
  - **SC2 fidelity audit:** economy (50-min worker, 5 min / 4 gas per trip, +8 Pylon / +15 Nexus supply, 200 cap), the Protoss power field, plasma shields, armor + Light/Armored bonus damage, the Nexus→Pylon→Gateway→Cybernetics(→Stalker) tech gate, Forge ground weapon/armor upgrades, and rich/golden minerals all match SC2. **Intentional cave deviations:** wall-mining (SC2 has none), findable/sealed-start economy, snappier build times. **Deferred (don't match SC2 yet):** Chrono Boost + unit abilities, air units, multiple factions, real multiplayer.
  - **Known limitation:** the enemy AI builds a full economy/tech/army/upgrades but is a *weak* opponent — its own buildings fragment its base's floor, which throttles supply expansion and makes cross-map attacks unreliable. Smarter base-layout/pathing is the next AI step.
