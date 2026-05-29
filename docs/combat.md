# Combat

Combat resolution copies StarCraft 2's model: real-time, attribute-based damage with bonus-damage counters. Numbers in [balance-data.md](./balance-data.md).

## Core Damage Model (from SC2)

- Each attack has a **base damage** value, an **attack cooldown** (→ DPS), and a **range**.
- Damage is reduced by the target's **armor** (flat reduction per hit, like SC2). Armor is raised by upgrades (see [tech-tree.md](./tech-tree.md)).
- Many weapons deal **bonus damage vs an attribute** (e.g. +X vs Armored, +X vs Light) — this is the counter system. (See attributes in [units.md](./units.md).)
- Shields (if a faction uses them, SC2 Protoss-style) absorb before health — *defer unless we add that faction.*

## Targeting Rules

- **Ground vs Air:** a weapon may hit ground only, air only, or both. Units with no anti-air can't touch flyers — classic SC2 constraint that drives composition.
- Units auto-acquire targets in range when on attack-move or when an enemy enters range while idle (copy SC2 acquisition behavior).

## Player Commands

- **Move** — go to a point, ignore enemies.
- **Attack-move (A-move)** — move toward a point but engage any enemy encountered en route. The bread-and-butter RTS command.
- **Attack target** — focus-fire a specific unit/building.
- **Stop / Hold position.**
- Selection: single click, drag-box, double-click-to-select-type, control groups (number keys) — all copy SC2. (Keybinds live in [ui.md](./ui.md).)

## Vision in Combat

- Units can only attack what their side can **see**. You need vision (a unit with line of sight) on a target to fire on it. Flyers and units in fog you have no vision on cannot be targeted. (See [fog-of-war.md](./fog-of-war.md).)

## Buildings in Combat

- Buildings have health and can be attacked/destroyed.
- Static defense structures attack automatically within range (see [buildings.md](./buildings.md)) — key for defending mined chokes.
- Mechanical units/buildings can be **repaired by workers**; biological units **healed** by support units.

## Win Condition (MVP)

- Eliminate all of an opponent's bases/structures. Last player standing wins. (Restated from [GAME_DESIGN.md](../GAME_DESIGN.md).)

## Related Systems

- [units.md](./units.md) — attributes, stats, roles that feed counters.
- [fog-of-war.md](./fog-of-war.md) — you can only hit what you can see.
- [tech-tree.md](./tech-tree.md) — attack/armor upgrades modify combat.
- [buildings.md](./buildings.md) — static defense and repairable structures.
- [balance-data.md](./balance-data.md) — damage, armor, range, cooldown values.

## Implementation Notes

- **2026-05-28** — Implemented in `world.ts`: HP-only damage (no armor/shield yet), attack cooldown → DPS, range (melee ≤ 0.6 vs ranged). Units auto-acquire the nearest enemy within **sight**, chase into range (A* repath throttled by `repathCd`), and fire on cooldown; `attack` (focus-fire) and `attackMove` commands. Photon Cannons auto-fire. **Win condition**: a player with no buildings is defeated; last standing wins (`checkWinCondition`). Deferred: bonus-vs-attribute counters, strict vision-gated targeting (acquisition is sight-bounded, a close approximation).
- **2026-05-28 (update)** — Added **plasma shields** (absorb before HP, regen out of combat via `updateShields`), **flat armor** per-hit reduction, and **attribute bonus damage** (Stalker +5 vs Armored). **Ground Weapons / Armor upgrades** (Forge) now add to damage / armor in `dealDamage`. Supersedes the "no armor/shield" note above.
- **2026-05-28 (depth pass)** — Attacks now emit a `hit` event so the view draws an **impact line/flash** at the target (fog-gated). SC2-fidelity audit recorded in [GAME_DESIGN.md](../GAME_DESIGN.md): core combat (cooldown→DPS, armor, shields, Light/Armored bonus, ground upgrades) matches SC2; unit abilities (Blink, etc.) and air remain deferred.
- **2026-05-28 (melee + approach fixes)** — Fixed two combat-blocking bugs found while verifying the AI:
  - **Melee couldn't connect with units.** Units snap to tile centers, so the closest a melee attacker can stand to a stationary enemy is one tile away — center-distance **1.0** (orthogonal) or **~1.41** (diagonal), both beyond the 0.5 melee reach (`range + targetRadius` ≈ 0.9). So melee units could only ever hit *buildings* (radius 1.0 → reach 1.5). `inWeaponRange` now has a **tile-adjacency fallback** for melee (range ≤ 0.6): an attacker on a tile bordering the target's tile/footprint is in range. Melee vs units now works.
  - **Approach tiles resolved under buildings.** `nearestAdjacentFloor` (terrain-only) could pick a tile that is grid-FLOOR but sits *under a building* (terrain stays floor beneath structures). The pathfinder blocks building footprints, so `findPath` to that tile returned null and the attacker **froze**, oscillating `attacking↔attack_moving` forever (it bit an army assaulting an enemy worker hugging its Nexus). New `freeAdjacentTile` (in `world.ts`) excludes building-occupied tiles; combat/harvest/mine approaches and the move command's `walkableGoal` now use it.
