# Resources & Economy

Borrows StarCraft 2's two-resource + supply economy directly.

## The Two Resources

| Resource | Source | Per-trip load | Role |
|----------|--------|---------------|------|
| **Minerals** | `MINERAL` deposits (and optional small trickle from cleared walls) | 5 | The common resource. Most costs are mineral-heavy. Workers, basic units, most buildings. |
| **Gas** | Extractor built on a `GEYSER` | 4 | The specialized resource. Gates higher-tier units, tech, and upgrades. |

(Cave theming: "minerals" can stay literal crystal/ore in walls; "gas" = vents/geysers. Rename cosmetically as desired.)

## Saturation (from SC2)

- Optimal ~**3 workers per mineral deposit** and **3 per gas geyser**.
- A fully saturated base ≈ **16 workers on minerals + 6 on gas** (~22–24 total), beyond which extra workers add little.
- Practical implication: a single base caps your income. To grow income you **expand** (new bases on fresh deposits), which ties directly into [mining.md](./mining.md)'s "build forward bases" hook.

## Supply (Population Cap)

Mirrors StarCraft's supply system:

- Every unit costs **supply**. You cannot produce a unit if it would exceed your available supply.
- Workers cost **1** supply; combat units cost more depending on size (see [balance-data.md](./balance-data.md)).
- Supply is raised by building **supply structures** and **bases**:
  - Supply structure: **+8** (SC2 Supply Depot / Pylon value).
  - Base / townhall: **+15** (SC2 Command Center / Nexus value).
- **Hard cap:** 200 supply total (SC2 value).
- Running into the supply cap with no room = production blocked, so players must build supply *ahead* of need.

## Resource Totals & Depletion

- Deposits hold finite amounts and deplete as workers harvest (use SC2-style totals in [balance-data.md](./balance-data.md), e.g. ~1,000–1,500 per mineral patch, ~1,700–2,500 per geyser depending on the version we copy).
- When a base's local deposits run dry, that base's income falls — another pressure to expand.

## Spending

Resources are spent on: workers, combat units, buildings, supply structures, and tech/upgrades. All exact costs live in [balance-data.md](./balance-data.md) so there is one tuning surface.

## Related Systems

- [mining.md](./mining.md) — how resources are gathered and deposited.
- [units.md](./units.md) — units cost minerals/gas/supply.
- [buildings.md](./buildings.md) — buildings and supply structures cost resources and raise supply.
- [tech-tree.md](./tech-tree.md) — upgrades cost resources.
- [ui.md](./ui.md) — the resource/supply counters in the top bar read from this system.
- [balance-data.md](./balance-data.md) — all the numbers.

## Implementation Notes

- _(none yet)_
