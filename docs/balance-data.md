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
| Wall mine time (per `ROCK` tile) | **Worker 10 s · Zealot 5 s · Stalker 3 s** | Per-unit `UNIT_STATS.wallMineTime`; combat units dig faster. |
| Wall clear mineral bonus | **5** | Trickle on clearing a wall (`WALL_CLEAR_MINERAL_BONUS`). |
| Starting pocket | **5×5** (`START_POCKET_RADIUS` 2) | Tight, nearly walled in. |
| Starting resources | **none — findable only** | Scattered in rock; some a short dig from each base, golden further out. |
| Golden minerals | 8 / trip · 2,500 total | High-yield (SC2 "rich minerals"). Normal: 5/trip · 1,500. |
| Golden gas | 6 / trip · 3,500 total | High-yield geyser. Normal: 4/trip · 2,250. |
| Starting workers | 6 | |
| Tile size (render) | 32 px | Cosmetic. |
| Tick rate (sim) | 10–20 Hz | See [multiplayer.md](./multiplayer.md). |

## Units (implemented — Protoss-style)

Current roster + stats (mirrors `game/sim/constants.ts: UNIT_STATS`). Plasma shields absorb before HP and regen out of combat; armor is flat per-hit reduction; bonus damage applies vs the listed attributes.

| Unit | Min | Gas | Sup | Build | HP | Shields | Armor | Attack | Range | CD | Attributes | From |
|------|-----|-----|-----|-------|----|---------|-------|--------|-------|----|-----------|------|
| Worker (Probe) | 50 | 0 | 1 | 12 s | 20 | 20 | 0 | 5 | melee | 1.5 s | Light, Mech | Nexus |
| Zealot | 100 | 0 | 2 | 27 s | 100 | 50 | 1 | 16 | melee | 1.2 s | Light, Bio | Gateway |
| Stalker | 125 | 50 | 2 | 32 s | 80 | 80 | 1 | 13 (+5 vs Armored) | 6 | 1.4 s | Armored, Mech | Gateway (needs Cybernetics) |

_Later: air units, support/heal._

## Buildings (implemented — Protoss-style)

Mirrors `game/sim/constants.ts: BUILDING_STATS`. Footprints scaled down from SC2 for the 64×64 grid. Power radius = 6.5 tiles.

| Building | Min | Build | HP | Shields | Footprint | Supply | Power | Requires | Role |
|----------|-----|-------|----|---------|-----------|--------|-------|----------|------|
| Nexus | 400 | 60 s | 1000 | 1000 | 2×2 | +15 | — | — | builds Workers; resource drop-off |
| Pylon | 100 | 18 s | 200 | 200 | 1×1 | +8 | **projects** | — | supply + power field |
| Gateway | 150 | 30 s | 500 | 500 | 2×2 | 0 | needs power | Pylon | builds Zealot/Stalker |
| Cybernetics Core | 150 | 36 s | 500 | 500 | 2×2 | 0 | needs power | Gateway | unlocks the Stalker |
| Forge | 150 | 32 s | 400 | 400 | 2×2 | 0 | needs power | Pylon | ground weapon/armor upgrades |
| Photon Cannon | 150 | 25 s | 150 | 150 | 1×1 | 0 | needs power | Pylon | static defense (20 dmg, range 7, 1.25 s) |

## Upgrades (implemented — researched at the Forge)

| Upgrade | Levels | Cost per level | Time per level | Effect |
|---------|--------|----------------|----------------|--------|
| Ground Weapons | +1/+2/+3 | 100 / 150 / 200 | 30 / 45 / 60 s | +1 attack damage per level |
| Ground Armor | +1/+2/+3 | 100 / 150 / 200 | 30 / 45 / 60 s | +1 armor (damage reduction) per level |

Plasma shields: regen **2/s** starting **5 s** after last taking damage (`SHIELD_REGEN_*`).

## Related Systems

Every gameplay doc references this file:
[resources.md](./resources.md), [units.md](./units.md), [buildings.md](./buildings.md), [tech-tree.md](./tech-tree.md), [combat.md](./combat.md), [mining.md](./mining.md), [map-terrain.md](./map-terrain.md), [multiplayer.md](./multiplayer.md).

## Implementation Notes

- **2026-05-27** — Values now live in `game/sim/constants.ts`. Chosen/tuned for the economy slice:
  - Picked deposit totals: mineral **1500**, geyser **2250** (from the SC2 ranges).
  - Tuned (no SC2 source): `WORKER_SPEED` **3.0** tiles/s, `MINERAL_GATHER_TIME_S` / `GAS_GATHER_TIME_S` **2.0 s**, `WALL_CLEAR_MINERAL_BONUS` **5**, `STARTING_WORKERS` **6**, tick **16 Hz**, map **64×64**.
  - `BASE_FOOTPRINT` scaled to **2×2** (SC2's 5×5 is too large on a 64-grid). Worker HP/cost/build time kept at SC2 values (45 / 50 min / 12 s).
- **2026-05-28** — Pivoted to a **Protoss-style** faction; see the Units/Buildings tables above (Nexus/Pylon/Gateway/Photon Cannon, Zealot/Stalker). Added `POWER_RADIUS` 6.5, `START_POCKET_RADIUS` 3 (tighter start). Worker HP set to 40 (Probe-ish). All values live in `UNIT_STATS` / `BUILDING_STATS` in `game/sim/constants.ts`.
- **2026-05-28 (update)** — Added **plasma shields** (HP split into hp+shields; `SHIELD_REGEN_DELAY` 5 s, `SHIELD_REGEN_RATE` 2/s), **armor** + **attributes** with bonus damage (Stalker +5 vs Armored), **Cybernetics Core** + **Forge**, and the `UPGRADES` table (Ground Weapons/Armor, 100/150/200 min · 30/45/60 s). See the updated tables above.
- **2026-05-28 (depth pass)** — **Per-unit wall-mine times** `UNIT_STATS.wallMineTime` (Worker 10 / Zealot 5 / Stalker 3 s); any unit can mine. **`START_POCKET_RADIUS` 2** (5×5, no starting resources). **Golden** resource constants (`GOLDEN_*`: 8 min / 6 gas per trip, 2,500 / 3,500 totals). Removed `WALL_MINE_TIME_S`. See the Cave-Specific table.
