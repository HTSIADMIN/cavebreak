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
- Multiple workers on the same wall could stack to speed it up (optional; simplest MVP = one worker per wall tile).

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
