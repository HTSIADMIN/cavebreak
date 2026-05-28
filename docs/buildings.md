# Buildings

Building roles, costs, and dependencies are modeled on **StarCraft 2** (single faction, Terran-style template). Exact numbers in [balance-data.md](./balance-data.md).

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
- Workers construct buildings (worker enters `constructing` state); copy SC2's "worker builds it" model rather than instant placement.

## Related Systems

- [units.md](./units.md) — what each building produces.
- [tech-tree.md](./tech-tree.md) — build dependencies between these buildings.
- [resources.md](./resources.md) — costs and supply contributions.
- [mining.md](./mining.md) — bases as deposit points; extractors on geysers.
- [map-terrain.md](./map-terrain.md) — footprint must be on `FLOOR`.
- [balance-data.md](./balance-data.md) — costs/build times/supply values.

## Implementation Notes

- _(none yet)_
