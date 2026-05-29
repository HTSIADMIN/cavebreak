# Map & Terrain

## Concept

The map is a **2D grid of tiles**. Unlike StarCraft (where the playable area is pre-carved), Cavebreak's map starts as **mostly solid rock**. Players carve the playable space themselves by mining (see [mining.md](./mining.md)). The grid is the foundation everything else sits on: pathing, fog of war, mining, building placement.

## Map Shape

- Overall boundary is a **square or circle**. Square is simpler to implement first; circular is a stretch (just mask the corners as permanent unmineable boundary rock).
- The outermost ring is **boundary rock** — unmineable, marks the edge of the world.

## Tile Types

Each grid cell stores exactly one terrain type (plus occupancy info — what unit/building is on it).

| Tile Type | Walkable | Mineable | Blocks Vision | Notes |
|-----------|----------|----------|---------------|-------|
| `ROCK` | no | yes | yes | Default fill. Mine through it to create `FLOOR`. |
| `FLOOR` | yes | — | no | Cleared cave space. Units move here, buildings go here. |
| `BOUNDARY` | no | no | yes | Map edge / unmineable rock. |
| `MINERAL` | no | mined as resource | yes (until depleted) | Mineral deposit embedded in rock. Workers harvest, not "mine to clear." |
| `GEYSER` | no (build on it) | — | partial | Gas source; build an extractor on it. See [resources.md](./resources.md). |
| `WATER` (optional) | no | no | no | Impassable but see-through. Stretch feature for natural chokes. |

> Implementation note: store the grid as a flat typed array indexed by `y * width + x` for performance, with a parallel occupancy layer. Avoid per-tile objects for the base terrain.

## Coordinates & Scale

- Tiles are square. Pick a fixed tile size in pixels for rendering (e.g. 32×32) and keep all game logic in **tile/grid units**, not pixels.
- Units may move in sub-tile/continuous space for smooth motion but pathing and mining operate on the grid (StarCraft does roughly this).

## Starting Positions

- Each player gets a pre-cleared **starting pocket** (1×1 or 2×2 `FLOOR` tiles).
- Pockets are **spaced apart / on opposite sides** so players don't start adjacent.
- Each pocket spawns with: a starting **base** building, a handful of starting **workers**, and a nearby **MINERAL** cluster (and ideally a `GEYSER`) reachable with a short amount of mining.
- Symmetry matters for fairness: mirror starting positions and nearby resource layout.

## Map Generation

- **MVP:** hand-authored or simple symmetric procedural layout (place starts, place resource clusters near each start, fill the rest with rock, carve a few pre-existing tunnels/chokes if desired).
- **Later:** richer procedural generation (noise-based resource distribution, guaranteed-fair mirroring).

## Pathing

- Units pathfind only over `FLOOR` tiles. `ROCK`/`BOUNDARY`/`MINERAL`/`GEYSER` block movement.
- Because the walkable space *changes* as players mine, pathing must handle a **mutable grid** — recompute/repath when a wall opens or a building is placed. A* over the floor graph, invalidated on tile changes, is the straightforward approach.

## Related Systems

- [mining.md](./mining.md) — how `ROCK` becomes `FLOOR` and how `MINERAL`/`GEYSER` are harvested.
- [fog-of-war.md](./fog-of-war.md) — which tile types block vision.
- [buildings.md](./buildings.md) — buildings require `FLOOR` footprint.
- [multiplayer.md](./multiplayer.md) — the map/grid state is authoritative server state that must sync.

## Implementation Notes

- **2026-05-28** — `mapgen.ts`: 64×64, point-symmetric 2-player layout. **Start pocket tightened** to 7×7 (`START_POCKET_RADIUS = 3`). Each start has a natural mineral line + a geyser adjacent to the pocket. **Scattered, point-symmetric expansion fields** (seeded RNG) are embedded in the rock away from the starts to reward mining outward. Depleted mineral tiles convert to `FLOOR`.
- **2026-05-28 (depth pass)** — Pocket tightened again to **5×5** (`START_POCKET_RADIUS = 2`) and **starting resources removed** — resources are findable-only: normal fields a short dig from each start, **golden** (high-yield) fields out in contested space, all point-symmetric. A **winding cave corridor** is carved start→center→start so armies can reach each other after breaking out (per the "pre-existing tunnels/chokes" option above). Mineral/geyser tiles are left embedded in rock (mine to reach).
- **2026-05-28 (4×4 start)** — Pocket tightened to a **4×4** (`START_POCKET_RADIUS = 1`) with the **2×2 Nexus centered** inside a 1-tile floor ring (`plan0` in `mapgen.ts`: Nexus top-left `(11,11)`, floors span `(10,10)..(13,13)`). Starting workers reduced **6 → 2**, placed on opposite corners of the ring. Player 1 still mirrors via point symmetry.
