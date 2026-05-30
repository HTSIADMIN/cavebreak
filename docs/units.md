# Units

The unit roster, stats, costs, and counters are **lifted from StarCraft 2** (single faction, modeled on **SC2 Protoss**: Probe / Zealot / Stalker, with Pylon-powered production). Exact numbers live in [balance-data.md](./balance-data.md).

## Worker

- The economic backbone. **Cost: 50 minerals, 1 supply** (SC2 value).
- Built from a **base** (townhall).
- Capabilities: mine walls (expansion, incl. area-mining a region), harvest minerals/gas, construct buildings. **While constructing it is fully tied up** (can't gather/fight); several workers on one site build it faster (see [buildings.md](./buildings.md)).
- State machine: `idle | moving | mining_wall | harvesting | returning_resource | constructing`. (See [mining.md](./mining.md).)

## Combat Unit Roles (SC2-modeled, single faction MVP)

Keep the MVP roster small (~6–10 units) but covering the classic role spread. Suggested template based on SC2 Terran:

| Role | SC2 analog | Produced from | Notes |
|------|-----------|---------------|-------|
| Basic ranged infantry | Marine | Barracks-equivalent | Cheap, all-purpose, anti-air capable. |
| Anti-armor infantry | Marauder | Barracks-equivalent | Bonus vs armored, tanky. |
| Scout / raider | Reaper | Barracks-equivalent | Fast, harass; good for scouting through cleared tunnels. |
| Siege / artillery | Siege Tank | Factory-equivalent | High ground damage, splash, deploy mode. Strong holding chokes you mined. |
| Light vehicle | Hellion | Factory-equivalent | Fast, anti-light splash. |
| Air harasser | Banshee | Starport-equivalent | Hits ground; needs vision. |
| Support / heal | Medivac | Starport-equivalent | Heals biological, transport. |
| Capital air | Battlecruiser | Starport-equivalent | Late-game heavy. |

> Trim this list for MVP if needed — even 3 units (basic infantry, siege, one air) makes a playable game. Add the rest as tech-tree tiers fill in.

## Unit Attributes (from SC2)

Attributes drive combat counters (see [combat.md](./combat.md)). Copy SC2's tagging:

- **Biological vs Mechanical** — biological can be healed (e.g. Medivac); mechanical can be repaired by workers.
- **Light vs Armored** — many weapons do **bonus damage** vs one type.
- **Ground vs Air** — some weapons can only hit one domain.
- **Melee vs Ranged.**
- Special tags (Massive, Psionic, etc.) — optional, add only if a unit needs them.

## Production

- Combat units are produced from their respective production buildings (see [buildings.md](./buildings.md)), which must exist and be unlocked via the [tech-tree.md](./tech-tree.md).
- Production consumes minerals + gas + supply and takes build time (queue supported). All values in [balance-data.md](./balance-data.md).
- Production buildings support **rally points** (where new units gather) — copy SC2 behavior.

## Vision

- Every unit has a **sight radius** that reveals fog. Workers and scouts typically see less/more respectively. (See [fog-of-war.md](./fog-of-war.md).)

## Related Systems

- [buildings.md](./buildings.md) — what produces each unit.
- [tech-tree.md](./tech-tree.md) — what unlocks each unit.
- [resources.md](./resources.md) — costs and supply.
- [combat.md](./combat.md) — how attributes resolve into damage/counters.
- [mining.md](./mining.md) — worker behavior.
- [balance-data.md](./balance-data.md) — every stat.

## Implementation Notes

- **2026-05-28** — Implemented in `game/sim` (stats in `constants.ts: UNIT_STATS`):
  - **Worker** (Probe) — mines walls, harvests, constructs; weak melee for self-defense.
  - **Zealot** — melee, tanky; from Gateway.
  - **Stalker** — ranged (range 6), costs gas; from Gateway.
  - Unit state machine extended with `attacking` / `attack_moving`. Combat units auto-acquire the nearest enemy within their **sight radius**, move into weapon range, and fire on cooldown.
  - Not yet modelled: shields (folded into HP), attribute counters (Light/Armored bonus damage), air units. These are the natural next additions.
- **2026-05-28 (update)** — Shields/armor/attributes now modelled (supersedes above): Worker `Light, Mech` (20 hp + 20 shields), Zealot `Light, Bio` (100+50, armor 1), Stalker `Armored, Mech` (80+80, armor 1, +5 vs Armored). The **Stalker now requires a Cybernetics Core**. See [balance-data.md](./balance-data.md).
- **2026-05-30 (stances, facing, sprites, animation)** — Units gained: `Unit.stance` (combat auto-engage policy — see [combat.md](./combat.md)); `Unit.facing` (radians, updated as the unit moves/attacks/works) which rotates its sprite and aims its vision cone; and `Unit.mineQueue` for area-mining ([mining.md](./mining.md)). Rendering moved to sprites (workers = space-shooter ships, Zealot/Stalker = top-down tanks) with an **animated "working" badge** so it's obvious when a unit is mining/gathering/building vs idle. Sprites + cone defined in `game/render/sprites.ts`; all degrade to the old vector icons until art loads.
