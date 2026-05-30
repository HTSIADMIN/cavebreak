# Mining & Expansion

## Two Distinct Actions

There are **two things workers do to rock**, and they must not be confused:

1. **Wall mining (expansion)** — clearing a `ROCK` tile into walkable `FLOOR`. This is how the map opens up. The tile is *destroyed*, yielding little or no resource (design choice below), and becomes permanent floor.
2. **Resource harvesting** — gathering from a `MINERAL` deposit or `GEYSER`. This works like StarCraft: the worker harvests, carries a load back to a base, deposits, repeats. The deposit slowly depletes but the tile is **not** cleared into floor.

## Wall Mining (Expansion)

- A worker is issued a **mine** command on an **adjacent** `ROCK` tile.
- Mining takes **time** — target ~**30 seconds** per wall tile as a starting value (tune in [balance-data.md](./balance-data.md)). This is deliberately slow to create the micromanagement/pacing the game is built around.
- On completion the `ROCK` tile becomes `FLOOR`.
- **Design decision (open):** does clearing a wall yield a small mineral bonus, or nothing? Recommendation: a *small* one-time mineral trickle to make early expansion feel rewarding, but keep the main economy on dedicated `MINERAL` deposits so players don't just strip-mine the whole map for income.
- Multiple miners on the same wall **stack to speed it up** (implemented): progress is shared per tile and every adjacent miner contributes its own rate, so two workers clear a wall in ~half the time, and faster combat units stack their rates too.
- **Area mining (implemented):** instead of clicking walls one at a time, select workers, use the **Area Mine** command, and drag a box over a region of rock. Every `ROCK` tile in the box is queued to all selected workers; each picks the nearest *reachable* wall and the cooperative progress above does the rest, so a crew chews a region from its edges inward. (See [ui.md](./ui.md).)

## Resource Harvesting (StarCraft-style)

Mirrors StarCraft 2 exactly:

- Worker walks to a `MINERAL` deposit (or `GEYSER`-extractor), harvests for a moment, then **auto-returns** the load to the **nearest friendly base** and deposits it, then loops automatically. The player does not micromanage each trip.
- **Minerals:** carried in loads of **5 per trip** (SC2 value).
- **Gas:** carried in loads of **4 per trip**, gathered from an extractor built on a `GEYSER`.
- **Saturation:** ~**3 workers per deposit / per geyser** is optimal (SC2 value). More than that gives diminishing returns. Full base saturation in SC2 is ~16 on minerals + ~6 on gas. (See [resources.md](./resources.md).)
- Deposits hold a finite amount and deplete (use SC2-ish totals from [balance-data.md](./balance-data.md)); when empty the deposit is gone.

## Why Build Forward Bases

This is a core strategic hook unique to Cavebreak:

- Workers deposit at the **nearest** friendly base. Building **additional bases deeper into the cave** (closer to deposits / mining frontier) **shortens haul distance → faster effective mining**.
- Extra bases also act as additional **worker production** points and resource sinks, and stake out territory.
- This rewards mining outward and committing to the map, not just turtling in the start pocket.

## Worker Logic Summary

A worker can be in one of these states: `idle`, `moving`, `mining_wall` (expansion), `harvesting`, `returning_resource`, `constructing`. Keep this as a clean state machine — the UI selected-unit panel and combat all read from it.

## Related Systems

- [map-terrain.md](./map-terrain.md) — tile types `ROCK`/`FLOOR`/`MINERAL`/`GEYSER`.
- [resources.md](./resources.md) — what harvested loads turn into, supply, saturation.
- [units.md](./units.md) — the worker unit and its state machine.
- [buildings.md](./buildings.md) — bases as deposit points and worker producers; extractors on geysers.

## Implementation Notes

- **2026-05-27** — Implemented in `game/sim/world.ts` (worker state machine) + `pathfinding.ts`.
  - **Wall-clear trickle:** resolved the open question — clearing a wall yields a small **+5** mineral bonus (`WALL_CLEAR_MINERAL_BONUS`), keeping the main economy on deposits.
  - **Depleted mineral tile becomes `FLOOR`** (the deposit was embedded in rock, so clearing it opens cave); depleted geysers leave the tile as `GEYSER`.
  - **Gas (temporary MVP simplification):** workers can harvest a `GEYSER` directly; the extractor building is deferred. Starting workers auto-assign to the nearest mineral patch on spawn.
- **2026-05-28 (depth pass)** — **Wall-mining is now fast and tiered, and any unit can do it**: per-unit `UNIT_STATS.wallMineTime` — Worker **10 s**, Zealot **5 s**, Stalker **3 s** (combat units carve faster). A `wallBreak` event drives a break animation; crack intensity tracks progress. **Golden** deposits yield more per trip (8 min / 6 gas) and hold more. No starting resources — workers begin idle and must dig out to find deposits (see [map-terrain.md](./map-terrain.md)).
- **2026-05-28 (cooperative mining)** — Resolved the "multiple workers stack" open item. Wall progress is now **shared per tile**, not per unit: `GameState.wallProgress` is a `Map<tileIndex, number>` (0..1). Each tick, every miner adjacent to a tile adds `dt / wallMineTime` to that tile's entry; the wall breaks when the shared total reaches 1 and the entry is deleted. Two workers therefore clear a 10 s wall in ~5 s, and mixed crews sum their differing rates. The renderer reads `wallProgress` directly to draw cracks. Removed the per-unit `Unit.mineProgress` field.
- **2026-05-30 (area mining)** — Added a region-mine order. New `Unit.mineQueue: Vec2[] | null` holds the remaining target rocks; the `mineArea` command seeds every selected worker with the box's `ROCK` tiles. In the `mining_wall` state a worker mines its current tile, then `pickNextMineTile` chooses the nearest queued rock that is **still rock and currently reachable** (has an open adjacent floor), so crews peel a region from the outside in and never deadlock on walled-in interiors. A plain single `mine` clears the queue (one-off). UI: an **Area Mine (M)** command-card action + drag rectangle, with the enclosed rock highlighted (`Match.tsx`, renderer `mineArea`).
