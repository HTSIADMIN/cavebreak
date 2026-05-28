@AGENTS.md

# Cavebreak — working rules

This is **Cavebreak**, a top-down 2D RTS ("StarCraft 2 with a pickaxe"). See [README.md](./README.md) and [GAME_DESIGN.md](./GAME_DESIGN.md) for the vision.

## Docs are the source of truth

`docs/` holds one design doc per system and is authoritative. Before building or changing a system, **read its doc first**; after a change, **update the doc** (cross-links in `## Related Systems`, decisions in `## Implementation Notes`). Full rules are at the top of [README.md](./README.md).

- All tunable numbers come from [docs/balance-data.md](./docs/balance-data.md) — reference `game/sim/constants.ts`, don't hardcode stats inline.
- Keep `game/sim/` free of React/DOM imports (it must run server-side too).
