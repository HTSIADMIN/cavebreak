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

## Units (fill from Liquipedia LotV stats)

Template — copy SC2 numbers into each row as units are implemented:

| Unit | Minerals | Gas | Supply | Build time | HP | Armor | Attack | Range | Cooldown | Attributes | Targets | Produced by |
|------|----------|-----|--------|-----------|----|----|--------|-------|----------|-----------|---------|-------------|
| Worker | 50 | 0 | 1 | (SC2) | (SC2) | 0 | (SC2) | melee | — | Light, Bio | ground | Base |
| Basic infantry (Marine) | (SC2) | (SC2) | 1 | (SC2) | (SC2) | (SC2) | (SC2) | (SC2) | (SC2) | Light, Bio | grnd+air | Barracks |
| Anti-armor inf (Marauder) | (SC2) | (SC2) | 2 | (SC2) | (SC2) | (SC2) | +vs Armored | (SC2) | (SC2) | Armored, Bio | ground | Barracks |
| Scout (Reaper) | (SC2) | (SC2) | 1 | (SC2) | (SC2) | (SC2) | (SC2) | (SC2) | (SC2) | Light, Bio | ground | Barracks |
| Siege (Siege Tank) | (SC2) | (SC2) | 3 | (SC2) | (SC2) | (SC2) | splash | (SC2) | (SC2) | Armored, Mech | ground | Factory |
| Light vehicle (Hellion) | (SC2) | (SC2) | 2 | (SC2) | (SC2) | (SC2) | +vs Light, splash | (SC2) | (SC2) | Light, Mech | ground | Factory |
| Air harasser (Banshee) | (SC2) | (SC2) | 3 | (SC2) | (SC2) | (SC2) | (SC2) | (SC2) | (SC2) | Light, Mech | ground | Starport |
| Support (Medivac) | (SC2) | (SC2) | 2 | (SC2) | (SC2) | (SC2) | heal | — | — | Armored, Mech | — | Starport |
| Capital (Battlecruiser) | (SC2) | (SC2) | 6 | (SC2) | (SC2) | (SC2) | (SC2) | (SC2) | (SC2) | Armored, Massive, Mech | grnd+air | Starport |

## Buildings (fill from Liquipedia LotV building stats)

| Building | Minerals | Gas | Build time | HP | Supply provided | Requires | Produces |
|----------|----------|-----|-----------|----|-----|----------|----------|
| Base/Townhall | (SC2) | 0 | (SC2) | (SC2) | +15 | — | Workers |
| Supply structure | (SC2) | 0 | (SC2) | (SC2) | +8 | — | — |
| Gas extractor | (SC2) | 0 | (SC2) | (SC2) | 0 | geyser | — |
| Barracks | (SC2) | 0 | (SC2) | (SC2) | 0 | Base | tier-1 infantry |
| Factory | (SC2) | (SC2) | (SC2) | (SC2) | 0 | Barracks | vehicles/siege |
| Starport | (SC2) | (SC2) | (SC2) | (SC2) | 0 | Factory | air |
| Tech/upgrade bldg | (SC2) | 0 | (SC2) | (SC2) | 0 | Base | upgrades |
| Static defense | (SC2) | (SC2) | (SC2) | (SC2) | 0 | (varies) | — |

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
