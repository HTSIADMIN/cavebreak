# Tech Tree

Models StarCraft 2's dependency-based progression: you unlock units and upgrades by constructing prerequisite buildings in sequence. Copy SC2's structure (Terran template for MVP).

## How It Works

- At the start you can only produce **workers** (from your base).
- Building the **first production facility** (Barracks-equivalent) requires a base and unlocks tier-1 combat units.
- Each higher-tier production building **requires the one below it**, unlocking stronger units. Branches let players choose what to invest in.

## MVP Dependency Chain (Terran-style)

```
Base (townhall)
 ├─ Supply Structure (+8 supply)
 ├─ Gas Extractor (on geyser)
 └─ Barracks  ── unlocks tier-1 infantry
      └─ Factory  ── unlocks vehicles/siege   (requires Barracks)
           └─ Starport  ── unlocks air units  (requires Factory)
 └─ Engineering Bay/Armory ── unlocks upgrades
```

> This mirrors the SC2 Terran flow: Command Center → Barracks → Factory → Starport, with Engineering Bay/Armory off to the side for upgrades. We copy it because it's already balanced and intuitive.

## Upgrades

- Researched from the tech/upgrade building (Engineering Bay/Armory analog).
- Classic SC2 upgrade categories: **weapon attack +1/+2/+3**, **armor +1/+2/+3**, plus unit-specific upgrades (e.g. infantry stim, siege mode) added as needed.
- Each upgrade level costs more and takes longer (use SC2 values in [balance-data.md](./balance-data.md)).
- Keep MVP upgrades minimal: a single attack and a single armor upgrade line is enough to make tech feel meaningful.

## Reference

A complete SC2 tech-tree cheat sheet exists (Liquipedia "Tech Tree (Legacy of the Void)" pages, and a community GitHub cheat sheet) — use those as the authoritative source when filling in exact prerequisites and upgrade chains.

## Related Systems

- [buildings.md](./buildings.md) — the buildings that form the tree.
- [units.md](./units.md) — what each tier unlocks.
- [resources.md](./resources.md) — research costs.
- [balance-data.md](./balance-data.md) — exact prerequisites, upgrade costs, and times.

## Implementation Notes

- _(none yet)_
