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

// Guarantee one near mineral field per active start so nobody is starved by the RNG.
function placeNearCluster(ctx: MapGenCtx, c: Vec2) {
  for (let tries = 0; tries < 60; tries++) {
    const ang = ctx.rng() * Math.PI * 2;
    const dist = 5 + ctx.rng() * 4; // 5–9 tiles: a short dig out of the pocket
    const x = Math.round(c.x + Math.cos(ang) * dist);
    const y = Math.round(c.y + Math.sin(ang) * dist);
    if (getTile(ctx.grid, x, y) === TileType.ROCK && !tooClose(ctx.centers, x, y, 4)) {
      placeCluster(ctx, x, y, 5, false);
      return;
    }
  }
}

// Randomized resource layout (seeded): each start gets one guaranteed near field, then mineral
// + gas clusters (some golden) are scattered at random across the cave. No symmetry — every
// match is a fresh prospect, and you must mine your own way to everything.
function randomResources(ctx: MapGenCtx) {
  const { rng, grid, centers } = ctx;
  for (const c of centers) placeNearCluster(ctx, c);
  const target = 16;
  let placed = 0;
  for (let attempts = 0; placed < target && attempts < 600; attempts++) {
    const x = 4 + Math.floor(rng() * (MAP_W - 8));
    const y = 4 + Math.floor(rng() * (MAP_H - 8));
    if (getTile(grid, x, y) !== TileType.ROCK) continue;
    if (tooClose(centers, x, y, 7)) continue; // not right on top of a base
    if (ctx.deposits.some((d) => (d.tx - x) ** 2 + (d.ty - y) ** 2 < 5 * 5)) continue; // keep spread out
    placeCluster(ctx, x, y, 4 + Math.floor(rng() * 3), rng() < 0.22);
    placed++;
  }
}

// Maps no longer pre-carve corridors — you start sealed and must mine your own way out.
const noCarve = () => { /* sealed start: dig your own tunnels */ };

// --- Map 1: Cavern Duel (2 players, square) — the classic 1v1. -----------------------
const cavern: MapDef = {
  id: "cavern",
  name: "Cavern Duel",
  description: "Square cavern, two bases on opposite corners. Sealed start — mine your own way to randomized resource fields. Best for 1v1.",
  maxPlayers: 2,
  starts: [pocketPlan(11, 11), pocketPlan(MAP_W - 13, MAP_H - 13)],
  placeResources: randomResources,
  carve: noCarve,
};

// --- Map 2: Four Corners (up to 4 players, square) — contested golden center. ---------
const corners: MapDef = {
  id: "corners",
  name: "Four Corners",
  description: "Square arena with bases in the four corners. Sealed start — mine out to randomized resource fields. 2–4 players.",
  maxPlayers: 4,
  // Ordered TL, BR, TR, BL so 2 players take opposite corners.
  starts: [pocketPlan(11, 11), pocketPlan(51, 51), pocketPlan(51, 11), pocketPlan(11, 51)],
  placeResources: randomResources,
  carve: noCarve,
};

// --- Map 3: Crater (up to 4 players, circular) — a round cavern around a golden core. -
const crater: MapDef = {
  id: "crater",
  name: "Crater",
  description: "A round cavern with an unmineable rim and bases at N/S/E/W. Sealed start — dig to randomized resources. 2–4 players.",
  maxPlayers: 4,
  // Ordered N, S, E, W so 2 players take opposite poles.
  starts: [pocketPlan(31, 11), pocketPlan(31, 51), pocketPlan(51, 31), pocketPlan(11, 31)],
  shapeMask(x, y) {
    const dx = x - (MAP_W / 2 - 0.5);
    const dy = y - (MAP_H / 2 - 0.5);
    return dx * dx + dy * dy > 30 * 30; // outside the inscribed circle ⇒ solid rim
  },
  placeResources: randomResources,
  carve: noCarve,
};

// --- Map 4: Hourglass (2 players, central choke) — top vs bottom, split by an -------
// unmineable wall with one gap. Showcases the "defensible chokepoint" pillar.
const hourglass: MapDef = {
  id: "hourglass",
  name: "Hourglass",
  description: "Top vs bottom, divided by an unmineable wall with a single central gap — a natural defensible choke. Sealed start — dig to the gap. 1v1.",
  maxPlayers: 2,
  starts: [pocketPlan(31, 11), pocketPlan(31, 51)],
  // A 2-tile-thick solid wall across the middle, broken only by a 6-wide gap at center.
  shapeMask: (x, y) => (y === 31 || y === 32) && (x < 29 || x > 34),
  placeResources: randomResources,
  carve: noCarve,
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
