# Fog of War

Kept deliberately simple: visibility is driven by where your units are and what they can see.

## Rules

- **You see where your units have line of sight.** Each unit (and building) has a **sight radius** that reveals fog around it.
- **Walls block vision.** `ROCK` and `BOUNDARY` tiles block line of sight — you cannot see through solid rock. Cleared `FLOOR` lets vision pass, so once you mine a tunnel you can see down it. This makes the *shape of the cave you carve* directly determine what you can scout. (Tile types: [map-terrain.md](./map-terrain.md).)
- **Cleared space is see-through.** Open cave (`FLOOR`) does not block vision; `WATER` (optional) is impassable but see-through.

## Visibility States (SC2-style, simplified)

Two-or-three-state model:

1. **Hidden (black):** never seen — fully fogged.
2. **Explored (dim):** previously seen; terrain remembered, but **units/changes there are not visible** until you have current vision again.
3. **Visible (lit):** currently in a friendly unit's sight radius — you see everything happening.

MVP can ship with just **Hidden** + **Visible** if the dim "explored memory" layer is extra work; add the explored layer for the proper RTS feel.

## Implications

- **Scouting matters.** Fast units (Reaper analog) sent down mined tunnels reveal enemy expansion and army movements.
- **You can only attack what you can see.** Targeting requires current vision on the target. (See [combat.md](./combat.md).)
- **No shared global view.** Each player's fog is computed from *their own* units only. In multiplayer this is per-player state derived from authoritative unit positions (see [multiplayer.md](./multiplayer.md)).

## Implementation Sketch

- Maintain a per-player visibility grid, recomputed when units move (or on a fixed tick).
- Line of sight: for each friendly unit, reveal tiles within sight radius using a LOS check that stops at vision-blocking tiles (`ROCK`/`BOUNDARY`). A simple ray-cast or shadowcasting over the grid works.
- Because walls change as players mine, vision through newly opened tunnels updates automatically since it's recomputed from current terrain.

## Related Systems

- [map-terrain.md](./map-terrain.md) — which tiles block vision.
- [units.md](./units.md) — sight radius per unit.
- [combat.md](./combat.md) — can't target what you can't see.
- [multiplayer.md](./multiplayer.md) — fog is per-player, derived from synced state; never send a player full map state.

## Implementation Notes

- **2026-05-28** — Implemented in `fog.ts`: per-player visibility grid (0 hidden / 1 explored / 2 visible), recomputed every 4 ticks from unit + building sight radii with a Bresenham LOS that's blocked by `ROCK`/`BOUNDARY`/`MINERAL`. The renderer blacks out hidden tiles, dims explored ones, and hides enemy entities outside current vision (also on the minimap). Currently computed only for the local player (player 0) and stored on `GameState.visibility`; becomes per-player server state under multiplayer.
