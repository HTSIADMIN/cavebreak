# Balance Data — Single Tuning Surface

> **All tunable numbers live here.** Code should reference these values (load them from a config/constants module), not hardcode them inline, so balancing happens in one place.
>
> Values below are **StarCraft 2 reference numbers** to copy as defaults. SC2 is already balanced, so we start from its values and only tune the **cave-specific** additions (wall mining time, starting pocket, etc.). For any stat not listed, pull the exact figure from **Liquipedia's "Unit/Building Statistics (Legacy of the Void)"** pages — treat those as authoritative.

---

## Resources & Economy (SC2 values)

| Param | Value | Source |
|-------|-------|--------|
| Worker cost | 50 minerals, 1 supply | SC2 |
| Minerals per worker trip | 5 | SC2 |
| Gas per worker trip | 4 | SC2 |
| Saturation per mineral deposit | ~3 workers | SC2 |
| Saturation per gas geyser | ~3 workers | SC2 |
| Full base saturation | ~16 mineral + ~6 gas workers | SC2 |
| Mineral deposit total | ~1,000–1,500 each (pick one) | SC2 (varies by patch) |
| Gas geyser total | ~1,700–2,500 each (pick one) | SC2 (varies by patch) |
| Supply from supply structure | +8 | SC2 (Depot/Pylon) |
| Supply from base/townhall | +15 | SC2 (CC/Nexus) |
| Supply hard cap | 200 | SC2 |

## Cave-Specific (NEW — tune these, no SC2 source)

| Param | Starting value | Notes |
|-------|----------------|-------|
| Wall mine time (per `ROCK` tile) | **30 s** | Core pacing lever. Lower = faster expansion. |
| Wall clear mineral bonus | 0 or small trickle | Design-open; see [mining.md](./mining.md). |
| Workers per wall tile | 1 (MVP) | Optional stacking later. |
| Starting pocket size | 1×1 or 2×2 `FLOOR` | See [map-terrain.md](./map-terrain.md). |
| Starting workers | ~6–12 | Match SC2-ish opening; tune for pacing. |
| Tile size (render) | 32 px | Cosmetic. |
| Tick rate (sim) | 10–20 Hz | See [multiplayer.md](./multiplayer.md). |

## Units (implemented — Protoss-style)

Current roster + stats (mirrors `game/sim/constants.ts: UNIT_STATS`). HP folds shields in; armor and attribute-bonus counters are not modelled yet.

| Unit | Minerals | Gas | Supply | Build time | HP | Attack | Range | Cooldown | Sight | Produced by |
|------|----------|-----|--------|-----------|----|--------|-------|----------|-------|-------------|
| Worker (Probe) | 50 | 0 | 1 | 12 s | 40 | 5 | melee | 1.5 s | 8 | Nexus |
| Zealot | 100 | 0 | 2 | 27 s | 150 | 16 | melee | 1.2 s | 9 | Gateway |
| Stalker | 125 | 50 | 2 | 32 s | 160 | 13 | 6 | 1.4 s | 10 | Gateway |

_Later: air units, support/heal, attribute counters, shields._

## Buildings (implemented — Protoss-style)

Mirrors `game/sim/constants.ts: BUILDING_STATS`. Footprints scaled down from SC2 for the 64×64 grid. Power radius = 6.5 tiles.

| Building | Minerals | Build time | HP | Footprint | Supply | Power | Requires | Produces |
|----------|----------|-----------|----|-----------|--------|-------|----------|----------|
| Nexus | 400 | 60 s | 2000 | 2×2 | +15 | — | — | Worker |
| Pylon | 100 | 18 s | 300 | 1×1 | +8 | **projects** | — | — |
| Gateway | 150 | 30 s | 500 | 2×2 | 0 | needs power | Pylon | Zealot, Stalker |
| Photon Cannon | 150 | 25 s | 300 | 1×1 | 0 | needs power | Pylon | static defense (20 dmg, range 7, 1.25 s) |

## Upgrades (MVP minimal)

| Upgrade | Levels | Cost per level | Time per level | Effect |
|---------|--------|----------------|----------------|--------|
| Weapon attack | +1/+2/+3 | (SC2, increasing) | (SC2, increasing) | +damage |
| Armor | +1/+2/+3 | (SC2, increasing) | (SC2, increasing) | +armor |

## Related Systems

Every gameplay doc references this file:
[resources.md](./resources.md), [units.md](./units.md), [buildings.md](./buildings.md), [tech-tree.md](./tech-tree.md), [combat.md](./combat.md), [mining.md](./mining.md), [map-terrain.md](./map-terrain.md), [multiplayer.md](./multiplayer.md).

## Implementation Notes

- **2026-05-27** — Values now live in `game/sim/constants.ts`. Chosen/tuned for the economy slice:
  - Picked deposit totals: mineral **1500**, geyser **2250** (from the SC2 ranges).
  - Tuned (no SC2 source): `WORKER_SPEED` **3.0** tiles/s, `MINERAL_GATHER_TIME_S` / `GAS_GATHER_TIME_S` **2.0 s**, `WALL_CLEAR_MINERAL_BONUS` **5**, `STARTING_WORKERS` **6**, tick **16 Hz**, map **64×64**.
  - `BASE_FOOTPRINT` scaled to **2×2** (SC2's 5×5 is too large on a 64-grid). Worker HP/cost/build time kept at SC2 values (45 / 50 min / 12 s).
- **2026-05-28** — Pivoted to a **Protoss-style** faction; see the Units/Buildings tables above (Nexus/Pylon/Gateway/Photon Cannon, Zealot/Stalker). Added `POWER_RADIUS` 6.5, `START_POCKET_RADIUS` 3 (tighter start). Worker HP set to 40 (Probe-ish). All values live in `UNIT_STATS` / `BUILDING_STATS` in `game/sim/constants.ts`.
