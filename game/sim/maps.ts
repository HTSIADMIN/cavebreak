// Map descriptors. Every map is 64×64 (so the renderer/camera/visibility sizing stays
// constant) but varies its **silhouette** (boundary mask → square / circular), its
// **start layout** (2–4 pockets), and its **features** (resource layout + carved
// corridors). See docs/map-terrain.md. Starts are ordered for fair spread: taking the
// first N gives well-separated seats (e.g. opposite corners for a 2-player game on a
// 4-player map).

import {
  GAS_GEYSER_TOTAL,
  GOLDEN_GAS_TOTAL,
  GOLDEN_MINERAL_TOTAL,
  MAP_H,
  MAP_W,
  MINERAL_DEPOSIT_TOTAL,
  START_POCKET_RADIUS,
  STARTING_WORKERS,
} from "./constants";
import { getTile, setTile } from "./grid";
import { Deposit, Grid, TileType, Vec2 } from "./types";

export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mirror = (v: Vec2): Vec2 => ({ x: MAP_W - 1 - v.x, y: MAP_H - 1 - v.y });

export interface StartPlan {
  nexusTopLeft: Vec2;
  floors: Vec2[];
  workers: Vec2[];
}

// 2×2 Nexus centered in a (START_POCKET_RADIUS)-thick floor ring (a 4×4 pocket at r=1),
// two workers on opposite corners. No starting resources — they must be mined toward.
function pocketPlan(nx: number, ny: number): StartPlan {
  const r = START_POCKET_RADIUS;
  const floors: Vec2[] = [];
  for (let y = ny - r; y <= ny + 1 + r; y++) {
    for (let x = nx - r; x <= nx + 1 + r; x++) floors.push({ x, y });
  }
  return {
    nexusTopLeft: { x: nx, y: ny },
    floors,
    workers: [
      { x: nx - r, y: ny - r },
      { x: nx + 1 + r, y: ny + 1 + r },
    ].slice(0, STARTING_WORKERS),
  };
}

// Context handed to a map's resource/carve steps. `centers`/`starts` are the ACTIVE
// seats only (so resources avoid occupied bases and corridors connect live players).
export interface MapGenCtx {
  grid: Grid;
  deposits: Deposit[];
  rng: () => number;
  starts: StartPlan[];
  centers: Vec2[];
  allocId: () => number;
}

export interface MapDef {
  id: string;
  name: string;
  description: string;
  maxPlayers: number;
  starts: StartPlan[]; // length === maxPlayers, ordered for spread
  shapeMask?: (x: number, y: number) => boolean; // true ⇒ this tile is unmineable BOUNDARY
  placeResources: (ctx: MapGenCtx) => void;
  carve: (ctx: MapGenCtx) => void;
}

const tooClose = (centers: Vec2[], cx: number, cy: number, d = 4.5) =>
  centers.some((c) => (c.x - cx) ** 2 + (c.y - cy) ** 2 < d * d);

// A small mineral cluster (embedded in rock) with one adjacent geyser. Skipped if it
// would land on top of an active start. Golden clusters are higher-yield.
function placeCluster(ctx: MapGenCtx, cx: number, cy: number, size: number, golden: boolean) {
  const { grid, deposits, allocId, centers } = ctx;
  if (tooClose(centers, cx, cy)) return;
  const offs = [
    [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1],
  ];
  let placed = 0;
  for (const [dx, dy] of offs) {
    if (placed >= size) break;
    const x = cx + dx;
    const y = cy + dy;
    if (getTile(grid, x, y) !== TileType.ROCK) continue;
    setTile(grid, x, y, TileType.MINERAL);
    deposits.push({
      id: allocId(), kind: "mineral", tx: x, ty: y,
      remaining: golden ? GOLDEN_MINERAL_TOTAL : MINERAL_DEPOSIT_TOTAL, golden,
    });
    placed++;
  }
  for (const [dx, dy] of [[2, 0], [0, 2], [-2, 0], [0, -2]]) {
    const x = cx + dx;
    const y = cy + dy;
    if (getTile(grid, x, y) === TileType.ROCK) {
      setTile(grid, x, y, TileType.GEYSER);
      deposits.push({
        id: allocId(), kind: "gas", tx: x, ty: y,
        remaining: golden ? GOLDEN_GAS_TOTAL : GAS_GEYSER_TOTAL, golden,
      });
      break;
    }
  }
}

// Carve a straight corridor (ROCK → FLOOR) of half-width `rad`; leaves resource tiles intact.
function carveLine(grid: Grid, ax: number, ay: number, bx: number, by: number, rad: number) {
  const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(ax + ((bx - ax) * i) / steps);
    const y = Math.round(ay + ((by - ay) * i) / steps);
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (getTile(grid, x + dx, y + dy) === TileType.ROCK) setTile(grid, x + dx, y + dy, TileType.FLOOR);
      }
    }
  }
}

// Winding corridor through the contested center, then to the far base (the original 1v1 feel).
function windingCorridor(ctx: MapGenCtx) {
  const mid = { x: MAP_W / 2, y: MAP_H / 2 };
  const c0 = ctx.centers[0];
  const c1 = ctx.centers[ctx.centers.length - 1];
  carveLine(ctx.grid, c0.x, c0.y, mid.x - 6, mid.y + 6, 1);
  carveLine(ctx.grid, mid.x - 6, mid.y + 6, mid.x, mid.y, 1);
  carveLine(ctx.grid, mid.x, mid.y, mid.x + 6, mid.y - 6, 1);
  carveLine(ctx.grid, mid.x + 6, mid.y - 6, c1.x, c1.y, 1);
}

// Hub-and-spoke: every active base gets a corridor to the center, so all players meet there.
function spokesToCenter(ctx: MapGenCtx) {
  const mid = { x: MAP_W / 2, y: MAP_H / 2 };
  for (const c of ctx.centers) carveLine(ctx.grid, c.x, c.y, mid.x, mid.y, 1);
}

// --- Map 1: Cavern Duel (2 players, square) — the classic 1v1. -----------------------
const cavern: MapDef = {
  id: "cavern",
  name: "Cavern Duel",
  description: "Square cavern, two bases on opposite corners linked by a winding central corridor. Best for 1v1.",
  maxPlayers: 2,
  starts: [pocketPlan(11, 11), pocketPlan(MAP_W - 13, MAP_H - 13)],
  placeResources(ctx) {
    for (const a of [{ x: 18, y: 12 }, { x: 12, y: 18 }]) {
      placeCluster(ctx, a.x, a.y, 5, false);
      const m = mirror(a);
      placeCluster(ctx, m.x, m.y, 5, false);
    }
    const normalPairs: [Vec2, Vec2][] = [
      [{ x: 16, y: 32 }, { x: 47, y: 31 }],
      [{ x: 32, y: 16 }, { x: 31, y: 47 }],
      [{ x: 48, y: 32 }, { x: 15, y: 31 }],
      [{ x: 32, y: 48 }, { x: 31, y: 15 }],
    ];
    for (const [a, b] of normalPairs) {
      const size = 4 + Math.floor(ctx.rng() * 3);
      placeCluster(ctx, a.x, a.y, size, false);
      placeCluster(ctx, b.x, b.y, size, false);
    }
    placeCluster(ctx, 32, 32, 6, true);
    for (const [a, b] of [[{ x: 22, y: 42 }, { x: 41, y: 21 }], [{ x: 42, y: 22 }, { x: 21, y: 41 }]] as [Vec2, Vec2][]) {
      placeCluster(ctx, a.x, a.y, 5, true);
      placeCluster(ctx, b.x, b.y, 5, true);
    }
  },
  carve: windingCorridor,
};

// --- Map 2: Four Corners (up to 4 players, square) — contested golden center. ---------
const corners: MapDef = {
  id: "corners",
  name: "Four Corners",
  description: "Square arena with bases in the four corners and a rich golden field at the contested center. 2–4 players.",
  maxPlayers: 4,
  // Ordered TL, BR, TR, BL so 2 players take opposite corners.
  starts: [pocketPlan(11, 11), pocketPlan(51, 51), pocketPlan(51, 11), pocketPlan(11, 51)],
  placeResources(ctx) {
    // A short-dig field for each corner (placed for every corner for symmetry; skipped
    // automatically if it overlaps an active base).
    const near: Vec2[] = [
      { x: 18, y: 12 }, { x: 12, y: 18 }, // TL
      { x: 46, y: 52 }, { x: 52, y: 46 }, // BR
      { x: 46, y: 12 }, { x: 52, y: 18 }, // TR
      { x: 18, y: 52 }, { x: 12, y: 46 }, // BL
    ];
    for (const c of near) placeCluster(ctx, c.x, c.y, 5, false);
    // Mid-edge normal expansions.
    for (const m of [{ x: 32, y: 13 }, { x: 32, y: 50 }, { x: 13, y: 32 }, { x: 50, y: 32 }]) {
      placeCluster(ctx, m.x, m.y, 5, false);
    }
    // Golden core + four golden mid fields between the corners and center.
    placeCluster(ctx, 32, 32, 8, true);
    for (const g of [{ x: 23, y: 23 }, { x: 40, y: 40 }, { x: 40, y: 23 }, { x: 23, y: 40 }]) {
      placeCluster(ctx, g.x, g.y, 5, true);
    }
  },
  carve: spokesToCenter,
};

// --- Map 3: Crater (up to 4 players, circular) — a round cavern around a golden core. -
const crater: MapDef = {
  id: "crater",
  name: "Crater",
  description: "A round cavern: unmineable rim, bases at N/S/E/W, and a golden core in the middle. 2–4 players.",
  maxPlayers: 4,
  // Ordered N, S, E, W so 2 players take opposite poles.
  starts: [pocketPlan(31, 11), pocketPlan(31, 51), pocketPlan(51, 31), pocketPlan(11, 31)],
  shapeMask(x, y) {
    const dx = x - (MAP_W / 2 - 0.5);
    const dy = y - (MAP_H / 2 - 0.5);
    return dx * dx + dy * dy > 30 * 30; // outside the inscribed circle ⇒ solid rim
  },
  placeResources(ctx) {
    // Two near fields per pole, offset inward toward the core.
    const near: Vec2[] = [
      { x: 24, y: 16 }, { x: 38, y: 16 }, // N
      { x: 24, y: 47 }, { x: 38, y: 47 }, // S
      { x: 47, y: 24 }, { x: 47, y: 38 }, // E
      { x: 16, y: 24 }, { x: 16, y: 38 }, // W
    ];
    for (const c of near) placeCluster(ctx, c.x, c.y, 5, false);
    placeCluster(ctx, 32, 32, 8, true); // golden core
    for (const g of [{ x: 23, y: 23 }, { x: 40, y: 40 }, { x: 40, y: 23 }, { x: 23, y: 40 }]) {
      placeCluster(ctx, g.x, g.y, 5, true);
    }
  },
  carve: spokesToCenter,
};

// --- Map 4: Hourglass (2 players, central choke) — top vs bottom, split by an -------
// unmineable wall with one gap. Showcases the "defensible chokepoint" pillar.
const hourglass: MapDef = {
  id: "hourglass",
  name: "Hourglass",
  description: "Top vs bottom, divided by an unmineable wall with a single central gap — a natural defensible choke. 1v1.",
  maxPlayers: 2,
  starts: [pocketPlan(31, 11), pocketPlan(31, 51)],
  // A 2-tile-thick solid wall across the middle, broken only by a 6-wide gap at center.
  shapeMask: (x, y) => (y === 31 || y === 32) && (x < 29 || x > 34),
  placeResources(ctx) {
    const vmir = (v: Vec2): Vec2 => ({ x: v.x, y: MAP_H - 1 - v.y });
    for (const a of [{ x: 24, y: 13 }, { x: 39, y: 14 }, { x: 14, y: 23 }, { x: 50, y: 23 }]) {
      placeCluster(ctx, a.x, a.y, 5, false);
      const m = vmir(a);
      placeCluster(ctx, m.x, m.y, 5, false);
    }
    // Contested golden fields flanking the choke — off the central corridor (minerals
    // are impassable, so a cluster on the centerline would wall the gap shut).
    placeCluster(ctx, 23, 27, 6, true);
    placeCluster(ctx, 40, 36, 6, true);
  },
  carve(ctx) {
    const gap = { x: 31, y: 31 };
    for (const c of ctx.centers) carveLine(ctx.grid, c.x, c.y, gap.x, gap.y, 1);
  },
};

export const MAPS: Record<string, MapDef> = { cavern, hourglass, corners, crater };
export const DEFAULT_MAP_ID = "cavern";

// Lightweight metadata for the setup screen (no generation logic).
export const MAP_LIST = Object.values(MAPS).map((m) => ({
  id: m.id,
  name: m.name,
  description: m.description,
  maxPlayers: m.maxPlayers,
}));
