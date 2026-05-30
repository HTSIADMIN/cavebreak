# Buildings

Building roles, costs, and dependencies are modeled on **StarCraft 2** — single faction, **Protoss-style** (Pylons project a power field; most buildings must be placed within power). Exact numbers in [balance-data.md](./balance-data.md).

## Base / Townhall

The most important building (SC2: Command Center / Nexus / Hatchery).

- **Produces workers.**
- **Deposit point** for harvested resources — workers return to the *nearest* friendly base. (See [mining.md](./mining.md).)
- **Raises supply +15.**
- Required to build the first production facility.
- Building additional bases deeper in the cave shortens haul distance (faster mining) and stakes territory — the core expansion hook.
- Must be placed on cleared `FLOOR` (see [map-terrain.md](./map-terrain.md)).

## Supply Structure

(SC2: Supply Depot / Pylon.)

- **Raises supply +8.** Cheap. Build ahead of the cap or production stalls. (See [resources.md](./resources.md).)

## Gas Extractor

(SC2: Refinery / Assimilator / Extractor.)

- Built **on a `GEYSER`** tile. Enables workers to harvest gas (4 per trip).

## Production Buildings

Each tier of unit comes from a dedicated production building. SC2 Terran template:

| Building | Produces | Tech role |
|----------|----------|-----------|
| **Barracks** (tier 1) | basic infantry (Marine/Marauder/Reaper analogs) | First production facility; gateway to tier 2. |
| **Factory** (tier 2) | vehicles/siege (Siege Tank/Hellion analogs) | Requires Barracks. |
| **Starport** (tier 3) | air units (Banshee/Medivac/Battlecruiser analogs) | Requires Factory. |

- All production buildings support **rally points** (SC2 behavior).
- Production queues consume resources up front and take build time per unit.

## Defensive & Support Structures

- **Static defense** (SC2: Bunker / Missile Turret / Photon Cannon / Spine/Spore Crawler analog) — for holding the chokes players carve out by mining. Strongly themed to a cave game (defend your tunnel mouth).
- **Tech/upgrade building** (SC2: Engineering Bay / Armory analog) — researches upgrades. (See [tech-tree.md](./tech-tree.md).)
- Optional **add-ons** (SC2 Tech Lab / Reactor) — defer to post-MVP unless cheap to include.

## Placement Rules

- Buildings occupy a footprint of `FLOOR` tiles and block pathing while present.
- Extractors are the exception — placed on `GEYSER`.
- Workers construct buildings (worker enters `constructing` state); copy SC2's "worker builds it" model rather than instant placement. **Cavebreak deviation:** the builder is **tied up for the whole build** (it can't gather/fight meanwhile), and **assigning multiple workers builds it faster** (their labor stacks, cooperatively, like wall-mining) — see Implementation Notes.

## Related Systems

- [units.md](./units.md) — what each building produces.
- [tech-tree.md](./tech-tree.md) — build dependencies between these buildings.
- [resources.md](./resources.md) — costs and supply contributions.
- [mining.md](./mining.md) — bases as deposit points; extractors on geysers.
- [map-terrain.md](./map-terrain.md) — footprint must be on `FLOOR`.
- [balance-data.md](./balance-data.md) — costs/build times/supply values.

## Implementation Notes

- **2026-05-28** — Implemented Protoss-style in `game/sim` (stats in `constants.ts: BUILDING_STATS`):
  - **Nexus** (townhall) — +15 supply, builds Workers, resource deposit point.
  - **Pylon** — +8 supply and projects a **power field** (`POWER_RADIUS`, see `power.ts`).
  - **Gateway** — builds Zealot/Stalker; **requires power**.
  - **Photon Cannon** — static defense, auto-attacks enemies in range; **requires power**.
  - Powered buildings must be placed inside a Pylon field — validated by `canPlaceBuilding` (`world.ts`).
  - **Construction is Protoss-style**: a worker walks to the site and initiates the warp-in (`started`), then the building self-completes over its build time (`buildProgress`) while the worker frees up. Can't-reach cancels and refunds.
  - Deferred: tech/upgrade building, add-ons, gas Extractor as a separate structure (gas is currently harvested directly from a geyser — see [mining.md](./mining.md)).
- **2026-05-28 (update)** — Added **Cybernetics Core** (requires Gateway; unlocks the Stalker) and **Forge** (researches Ground Weapons/Armor) — both 2×2 and require power. The **Nexus is now buildable** by workers (expansion). All structures have plasma shields. Still deferred: gas Extractor structure, add-ons.
- **2026-05-30 (tied-up + cooperative construction)** — Replaced the hands-free "warp-in" model with an SCV-style one (per owner request): a worker assigned to `build` walks to the site and **stays in `constructing` until the structure completes** — it's fully tied up (can't mine/gather/fight) and then auto-returns to gathering. **Multiple builders stack:** `updateConstruction` advances `buildProgress` by `dt × min(adjacentBuilders, MAX_BUILDERS)` (4), mirroring cooperative wall-mining — 2 workers finish in ≈ half the time. The `build` command now assigns **every selected worker** to the site. Progress only advances while a builder is on site; a misplaced build with no reachable builder and no progress refunds. (`world.ts`, `MAX_BUILDERS` in `constants.ts`.)
- **2026-05-30 (rally for Nexus + Gateway)** — Rally points now route **workers** too, not just army: a Nexus/Gateway rally on (or next to) a mineral/geyser sends new workers straight onto it to auto-harvest; otherwise the unit walks to the rally tile. Set it from the command card's **Set Rally** button or by right-clicking with the building selected; the renderer draws a flag + link line for the selected building. (`spawnUnit` in `world.ts`, [ui.md](./ui.md).)
- **2026-05-30 (resume + demolish)** — Pulling a builder off a site **pauses** the build (progress is kept; nothing advances until a worker is back on it) — partial buildings persist. **Resume** by right-clicking the unfinished building with workers selected (`assistBuild` — also how extra workers pile on to speed any build). **Demolish/Cancel** your own building via the red command-card button (`demolish`): cancelling an under-construction one **refunds** its cost (SC2-style), demolishing a finished one doesn't; tied builders are freed. Display names changed (Nexus→**Base**, Pylon→**Generator**, Gateway→**Barracks**, Cybernetics→**Tech Lab**, Cannon→**Turret**; internal type IDs unchanged).
