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
- **Command card (bottom-right):** context buttons for the selection — for a worker: build/area-mine; for combat units: a stance toggle; for a base/production building: the unit it can produce + the queue + Set Rally; build buttons gated by the [tech-tree.md](./tech-tree.md).
- **Quick-select bar (bottom strip):** one chip per unit type you own (with live counts); click to select all units of that type across the map.
- **End-game stats:** when the match resolves, the Victory/Defeat overlay shows a per-player summary table (units built/killed/lost, buildings built/razed, minerals/gas gathered, peak supply) + match duration.
- **Cursors:** the OS cursor changes with the action under it / the active mode — pickaxe over rock, hammer in build mode, target over enemies, boot for move, etc.

Style: keep it clean/modern (flat panels, good contrast, readable type) but functionally identical to the StarCraft arrangement people already know.

## Controls / Keybinds (copy StarCraft)

| Action | Input |
|--------|-------|
| Select unit | Left click |
| Box select | Left-drag |
| Select all of type | Click its chip in the **quick-select bar** |
| Add to selection | Shift + click |
| Move | Right click on floor |
| Attack-move | `E` then click |
| Stop | `Q` |
| Build (worker) | number `1`–`6` (Base / Generator / Barracks / Tech Lab / Forge / Turret) |
| Cycle stance (combat) | `Y` (Aggressive → Stand Ground → Hold Fire) |
| Area mine (workers) | `M` then drag a box over rock |
| Create control group | Ctrl/Shift + number `1–9` |
| Recall control group | number `1–9` (when no build is bound to that number) |
| Set rally point | **Set Rally** button (Base/Barracks) then click, or right-click with the building selected |
| Camera pan | `WASD` / arrow keys / middle-click drag / minimap |
| Jump to base | (hotkey, e.g. backspace cycles bases) |
| Production hotkeys | letter shown on each command-card button |

> Use SC2's "command card button = a letter hotkey" convention so building/producing is keyboard-fast.

## Selection & Production Behavior

- Drag-box selects units in the rectangle (units only, not buildings, when mixed — copy SC2 priority).
- Production buildings queue units; queued items show in the command card with progress; queuing reserves resources.
- Rally points: new units auto-move to the rally location (can be a point or a resource for auto-harvest) — applies to **workers from a Nexus** and army from a Gateway.

## Related Systems

- [resources.md](./resources.md) — top bar counters.
- [units.md](./units.md) — selected-unit info, states, stances, sprites + facing.
- [buildings.md](./buildings.md) — production queue + rally points (Nexus/Gateway).
- [combat.md](./combat.md) — stance toggle drives auto-acquisition.
- [mining.md](./mining.md) — the Area Mine drag tool.
- [tech-tree.md](./tech-tree.md) — which build buttons are enabled.
- [fog-of-war.md](./fog-of-war.md) — minimap rendering + the flashlight vision-cone visual.

## Implementation Notes

- **2026-05-27** — Built in `app/play` (`Match.tsx` + `Hud.tsx`). Top bar, minimap (click/drag to pan), selection panel, and command card are wired and read from the live sim.
  - **Camera pan is on the arrow keys** (plus minimap), **not WASD**: `A`/`S`/`H`/`B` are reserved as command hotkeys (attack-move / stop / hold / build), matching SC2's command-card letters. Edge-scroll deferred.
  - Implemented: left-click select, drag-box select (units only), right-click context order (mine rock / gather mineral / move floor), `A` attack-move, `S` stop, `B` build worker.
- **2026-05-28** — Command card is now **action-driven** (`computeSelection` in `Match.tsx`): a Nexus shows Build Worker; a Gateway shows Train Zealot/Stalker; selected Workers show Build **Pylon (E) / Gateway (R) / Cannon (T)**. Build enters a **placement mode** with a ghost footprint (green valid / red invalid, requires power for powered buildings); left-click places, right-click/Esc cancels. Right-click an enemy = attack. Buttons gray out when unaffordable; hotkeys come from the action list. Added a win/defeat banner.
- **2026-05-28 (update)** — Worker build menu adds **Nexus (N)**, **Cybernetics Core (C)**, **Forge (F)**; Gateway gates the Stalker behind a Cybernetics Core (button shows why when disabled); a selected **Forge** shows **Weapons (Q) / Armor (W)** research with current levels. Units/buildings render a **shield bar** above the HP bar.
- **2026-05-28 (polish)** — **Control groups** (`Ctrl`/`Shift`+`1`–`9` to set, `1`–`9` to recall), **mouse-wheel zoom** (zooms toward the cursor, 0.5×–2.5×), **command-feedback markers** (a green ring on move orders, red on attack), and **instant restart** (the Victory/Defeat banner's "Play again" remounts a fresh match via a React key — no reload).
- **2026-05-28 (depth pass)** — **shadcn/ui `Tooltip` on every command-card button** (full name, cost, build time, description via `HudAction.tooltip`). **Command card compacted** (3-col grid of short fixed-height buttons) so minimap + selection panel + command card **all fit the bottom bar with no scrolling**. Renderer now draws **distinct icons per unit & building**, mining cracks, wall-break bursts, attack-impact lines, golden-node colors, and (on hover) a **Pylon→Nexus power link + coverage radius**; powered placement previews its radius.
- **2026-05-30 (controls + UI pass)** — Big control/UX additions (`Match.tsx` + `Hud.tsx`):
  - **Unit stances** — combat selections get a stance toggle (`stance:cycle`, key `Y`) that highlights the current stance; see [combat.md](./combat.md).
  - **Area Mine** — workers get an `areaMine` action (key `M`) that enters a drag-rectangle mode; the enclosed rock is highlighted and queued (see [mining.md](./mining.md)).
  - **Set Rally** — Nexus/Gateway get a `rally` action (key `R`); a click sets the point (right-click still works), drawn as a flag + link line.
  - **Quick-select bar** — `QuickSelectBar` strip above the bottom panel; one chip per owned unit type (live counts), click → `selectAllOfType`.
  - **End-game stats** — `WinnerBanner` now renders a per-player stats table + match duration from `GameState.stats` / `endedTick`.
  - **Action cursors** — `computeCursor()` sets the canvas CSS cursor from the cursor pack per mode/hover (pickaxe/hammer/target/boot/…).
- **2026-05-30 (art overhaul)** — Swapped the hand-drawn vector icons for the Kenney CC0 packs via a new browser-only `game/render/sprites.ts` (lazy image cache + `ready()` fallback to the old vectors): workers = space-shooter ships, Zealot/Stalker = top-down tanks (turretless / barreled, per-player color variant), buildings = sci-fi-RTS structures, plus a per-unit **flashlight vision cone** (light-mask, rotated to `facing`), an **animated "working" badge** over busy units, and explosion sprites on hits. See [fog-of-war.md](./fog-of-war.md), [units.md](./units.md).
- **2026-05-30 (controls + naming)** — **Middle-click drag** pans the camera (`midPanRef`, grab-drag). Dropped the **boot/move cursor** (plain floor uses the default cursor; pickaxe/hammer/target kept). Selection panel shows a clearer **active state** (Idle / Moving / Mining / Gathering / Building / Returning cargo / Attacking). Unit/building **display names** changed (Worker/Zealot/Stalker → Miner/Brawler/Gunner; Nexus/Pylon/Gateway/Cybernetics/Cannon → Base/Generator/Barracks/Tech Lab/Turret). **Demolish/Cancel** + **resume/assist build** added to the building/worker command flows (see [buildings.md](./buildings.md)). **Removed the flashlight** ([fog-of-war.md](./fog-of-war.md)).
- **2026-05-30 (ghost sprite + map border)** — The building **placement ghost** now draws the real structure **sprite** (green/red tinted for valid/invalid) instead of the old vector icon. Added an **always-visible map border** — a cave-rim frame around the whole 64×64 play area, drawn on top of fog so the world edges read even where unexplored (`renderer.ts`).
- **2026-05-30 (WASD + keybind overhaul + glass HUD)** — **Full WASD pan** (held, like the arrows). Build hotkeys moved to **numbers `1`–`6`** (a numbered build action takes priority over control-group recall while a worker is selected — known tradeoff: you can't recall groups 1–6 with a worker selected). Remapped the clashing commands off WASD: **attack-move `A`→`E`**, **stop `S`→`Q`**, **train Gunner / research Armor `W`→`E`**. **HUD is now floating glass** over a full-screen battlefield: KPIs top-left, **selected info bottom-left**, **action card bottom-center** (with the worker **Build** menu split from its other **Commands** via `HudAction.group`), **minimap bottom-right**; canvas input is gated by `e.target === canvas` so clicks on panels don't fall through. `QuickSelectBar`/`TopBar`/`SelectionPanel`/`CommandCard` share a glass style.
