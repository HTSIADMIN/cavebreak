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
