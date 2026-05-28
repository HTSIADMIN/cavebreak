# UI & Controls

Modern, clean visual treatment but laid out like StarCraft so the controls are instantly familiar.

## Screen Layout (modernized StarCraft)

```
┌─────────────────────────────────────────────────────────┐
│ [Top-left/Top bar] Resources: Minerals | Gas | Supply x/y │
│                                                           │
│                                                           │
│                    MAIN VIEWPORT                          │
│              (top-down 2D cave, scrollable)               │
│                                                           │
│                                                           │
├──────────────┬───────────────────────────┬───────────────┤
│  [Minimap]   │  Selected unit/building    │  Command card │
│  fog of war  │  info: portrait, health,   │  / production │
│  + viewport  │  state, stats              │  queue + build│
│  rectangle   │                            │  buttons      │
└──────────────┴───────────────────────────┴───────────────┘
```

- **Resources (top):** live minerals, gas, and supply `used/total` — reads from [resources.md](./resources.md).
- **Minimap (bottom-left):** shows explored/visible terrain with fog ([fog-of-war.md](./fog-of-war.md)), unit blips, and a rectangle for the current viewport. Click to jump the camera; right-click to issue minimap move/attack.
- **Selected info (bottom-center):** portrait, health/shield bar, current state (idle/mining/harvesting/etc. from [units.md](./units.md)), and stats. For multi-select, show the group.
- **Command card (bottom-right):** context buttons for the selection — for a worker: mine/build/gather; for a base/production building: the unit it can produce + the queue; build buttons gated by the [tech-tree.md](./tech-tree.md).

Style: keep it clean/modern (flat panels, good contrast, readable type) but functionally identical to the StarCraft arrangement people already know.

## Controls / Keybinds (copy StarCraft)

| Action | Input |
|--------|-------|
| Select unit | Left click |
| Box select | Left-drag |
| Select all of type | Double-click unit |
| Add to selection | Shift + click |
| Move | Right click on floor |
| Attack-move | `A` then click |
| Stop | `S` |
| Hold position | `H` |
| Patrol | `P` |
| Create control group | Ctrl + number `1–9` |
| Recall control group | number `1–9` |
| Set rally point | Right-click with production building selected |
| Camera pan | Edge scroll / WASD / arrow keys |
| Jump to base | (hotkey, e.g. backspace cycles bases) |
| Production hotkeys | letter shown on each command-card button |

> Use SC2's "command card button = a letter hotkey" convention so building/producing is keyboard-fast.

## Selection & Production Behavior

- Drag-box selects units in the rectangle (units only, not buildings, when mixed — copy SC2 priority).
- Production buildings queue units; queued items show in the command card with progress; queuing reserves resources.
- Rally points: new units auto-move to the rally location (can be a point or a resource for auto-harvest).

## Related Systems

- [resources.md](./resources.md) — top bar counters.
- [units.md](./units.md) — selected-unit info and states.
- [buildings.md](./buildings.md) — production queue + rally points.
- [tech-tree.md](./tech-tree.md) — which build buttons are enabled.
- [fog-of-war.md](./fog-of-war.md) — minimap rendering.

## Implementation Notes

- **2026-05-27** — Built in `app/play` (`Match.tsx` + `Hud.tsx`). Top bar, minimap (click/drag to pan), selection panel, and command card are wired and read from the live sim.
  - **Camera pan is on the arrow keys** (plus minimap), **not WASD**: `A`/`S`/`H`/`B` are reserved as command hotkeys (attack-move / stop / hold / build), matching SC2's command-card letters. Edge-scroll deferred.
  - Implemented: left-click select, drag-box select (units only), right-click context order (mine rock / gather mineral / move floor), `A` attack-move, `S` stop, `B` build worker.
