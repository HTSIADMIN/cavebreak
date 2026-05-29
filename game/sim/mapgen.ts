import {
  BUILDING_STATS,
  GAS_GEYSER_TOTAL,
  GOLDEN_GAS_TOTAL,
  GOLDEN_MINERAL_TOTAL,
  MAP_H,
  MAP_W,
  MINERAL_DEPOSIT_TOTAL,
  STARTING_WORKERS,
  START_POCKET_RADIUS,
  UNIT_STATS,
} from "./constants";
import { createGrid, getTile, setTile } from "./grid";
import { Building, Deposit, GameState, Player, TileType, Unit, Vec2 } from "./types";

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mirror = (v: Vec2): Vec2 => ({ x: MAP_W - 1 - v.x, y: MAP_H - 1 - v.y });

interface StartPlan {
  floors: Vec2[];
  nexusTopLeft: Vec2;
  workers: Vec2[];
}

// Player 0's start, hand-authored in the top-left. Player 1 mirrors it (point symmetry).
// No starting resources — they must be mined toward and found (docs/map-terrain.md).
function plan0(): StartPlan {
  const cx = 12;
  const cy = 12;
  const r = START_POCKET_RADIUS;
  const floors: Vec2[] = [];
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) floors.push({ x, y });
  }
  return {
    floors,
    nexusTopLeft: { x: cx - 1, y: cy - 1 },
    workers: [
      { x: cx - 2, y: cy - 2 },
      { x: cx + 2, y: cy - 2 },
      { x: cx - 2, y: cy + 2 },
      { x: cx + 2, y: cy + 2 },
      { x: cx - 2, y: cy },
      { x: cx + 2, y: cy },
    ].slice(0, STARTING_WORKERS),
  };
}

function mirrorPlan(p: StartPlan): StartPlan {
  return {
    floors: p.floors.map(mirror),
    nexusTopLeft: mirror({ x: p.nexusTopLeft.x + 1, y: p.nexusTopLeft.y + 1 }),
    workers: p.workers.map(mirror),
  };
}

export function createInitialState(seed = 1337): GameState {
  const grid = createGrid(MAP_W, MAP_H);

  for (let x = 0; x < MAP_W; x++) {
    setTile(grid, x, 0, TileType.BOUNDARY);
    setTile(grid, x, MAP_H - 1, TileType.BOUNDARY);
  }
  for (let y = 0; y < MAP_H; y++) {
    setTile(grid, 0, y, TileType.BOUNDARY);
    setTile(grid, MAP_W - 1, y, TileType.BOUNDARY);
  }

  const players: Player[] = [];
  const units: Unit[] = [];
  const buildings: Building[] = [];
  const deposits: Deposit[] = [];
  let nextId = 1;
  const colors = ["#4aa3ff", "#ff5a4a"];

  const plans = [plan0(), mirrorPlan(plan0())];
  const nexusCenters: Vec2[] = [];

  plans.forEach((plan, owner) => {
    for (const f of plan.floors) setTile(grid, f.x, f.y, TileType.FLOOR);

    const ns = BUILDING_STATS.nexus;
    buildings.push({
      id: nextId++,
      owner,
      type: "nexus",
      tx: plan.nexusTopLeft.x,
      ty: plan.nexusTopLeft.y,
      w: ns.w,
      h: ns.h,
      hp: ns.hp,
      maxHp: ns.hp,
      shields: ns.shields,
      maxShields: ns.shields,
      shieldRegenCd: 0,
      built: true,
      started: true,
      buildProgress: ns.buildTime,
      queue: [],
      produceProgress: 0,
      rally: null,
      researchQueue: [],
      researchProgress: 0,
      targetId: null,
      attackCd: 0,
    });
    nexusCenters.push({ x: plan.nexusTopLeft.x + ns.w / 2, y: plan.nexusTopLeft.y + ns.h / 2 });

    for (const w of plan.workers) {
      const ws = UNIT_STATS.worker;
      units.push({
        id: nextId++,
        owner,
        type: "worker",
        x: w.x + 0.5,
        y: w.y + 0.5,
        hp: ws.hp,
        maxHp: ws.hp,
        shields: ws.shields,
        maxShields: ws.shields,
        shieldRegenCd: 0,
        state: "idle", // nothing reachable yet — mine out to find resources
        path: null,
        moveGoal: null,
        mineTile: null,
        mineProgress: 0,
        depositId: null,
        carrying: null,
        gatherProgress: 0,
        buildTargetId: null,
        targetId: null,
        attackGoal: null,
        attackCd: 0,
        repathCd: 0,
      });
    }

    players.push({
      id: owner,
      color: colors[owner],
      isAI: owner !== 0,
      minerals: 50,
      gas: 0,
      supplyUsed: plan.workers.length,
      supplyMax: ns.supply,
      defeated: false,
      upgrades: { groundWeapons: 0, groundArmor: 0 },
    });
  });

  // --- Resource fields (all findable, embedded in rock) ---
  const rng = mulberry32(seed);
  const tooCloseToStart = (cx: number, cy: number) =>
    nexusCenters.some((c) => (c.x - cx) ** 2 + (c.y - cy) ** 2 < 4.5 * 4.5);

  const placeCluster = (cx: number, cy: number, size: number, golden: boolean) => {
    if (tooCloseToStart(cx, cy)) return;
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
        id: nextId++, kind: "mineral", tx: x, ty: y,
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
          id: nextId++, kind: "gas", tx: x, ty: y,
          remaining: golden ? GOLDEN_GAS_TOTAL : GAS_GEYSER_TOTAL, golden,
        });
        break;
      }
    }
  };

  // A couple of normal fields close to each start (a short dig away), mirrored for fairness.
  for (const a of [{ x: 18, y: 12 }, { x: 12, y: 18 }]) {
    placeCluster(a.x, a.y, 5, false);
    const m = mirror(a);
    placeCluster(m.x, m.y, 5, false);
  }
  // Mid-map normal expansions (symmetric pairs).
  const normalPairs: [Vec2, Vec2][] = [
    [{ x: 16, y: 32 }, { x: 47, y: 31 }],
    [{ x: 32, y: 16 }, { x: 31, y: 47 }],
    [{ x: 48, y: 32 }, { x: 15, y: 31 }],
    [{ x: 32, y: 48 }, { x: 31, y: 15 }],
  ];
  for (const [a, b] of normalPairs) {
    const size = 4 + Math.floor(rng() * 3);
    placeCluster(a.x, a.y, size, false);
    placeCluster(b.x, b.y, size, false);
  }
  // Golden fields — high yield, out in contested space (reward for expanding).
  placeCluster(32, 32, 6, true); // dead center, contested
  for (const [a, b] of [[{ x: 22, y: 42 }, { x: 41, y: 21 }], [{ x: 42, y: 22 }, { x: 21, y: 41 }]] as [Vec2, Vec2][]) {
    placeCluster(a.x, a.y, 5, true);
    placeCluster(b.x, b.y, 5, true);
  }

  // Carve a winding cave corridor connecting the two starts through the contested
  // center, so armies can reach each other after breaking out (docs/map-terrain.md).
  // Resources stay embedded in rock (mineral/geyser tiles are left intact).
  const carve = (ax: number, ay: number, bx: number, by: number, rad: number) => {
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
  };
  const c0 = nexusCenters[0];
  const c1 = nexusCenters[1];
  const mid = { x: MAP_W / 2, y: MAP_H / 2 };
  carve(c0.x, c0.y, mid.x - 6, mid.y + 6, 1);
  carve(mid.x - 6, mid.y + 6, mid.x, mid.y, 1);
  carve(mid.x, mid.y, mid.x + 6, mid.y - 6, 1);
  carve(mid.x + 6, mid.y - 6, c1.x, c1.y, 1);

  return {
    tick: 0,
    grid,
    players,
    units,
    buildings,
    deposits,
    nextId,
    winner: null,
    visibility: new Uint8Array(MAP_W * MAP_H),
    events: [],
  };
}
