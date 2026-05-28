import {
  BUILDING_STATS,
  GAS_GEYSER_TOTAL,
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
  minerals: Vec2[];
  geysers: Vec2[];
  nexusTopLeft: Vec2;
  workers: Vec2[];
}

// Player 0's start, hand-authored in the top-left. Player 1 mirrors it (point symmetry).
function plan0(): StartPlan {
  const cx = 12;
  const cy = 12;
  const r = START_POCKET_RADIUS;
  const floors: Vec2[] = [];
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) floors.push({ x, y });
  }
  const minerals: Vec2[] = [];
  for (let x = cx - 2; x <= cx + 2; x++) minerals.push({ x, y: cy - r - 1 }); // row just outside pocket
  return {
    floors,
    minerals,
    geysers: [{ x: cx - r - 1, y: cy }],
    nexusTopLeft: { x: cx - 1, y: cy - 1 },
    workers: [
      { x: cx - 3, y: cy - 2 },
      { x: cx - 2, y: cy - 3 },
      { x: cx - 3, y: cy + 2 },
      { x: cx + 2, y: cy - 3 },
      { x: cx + 2, y: cy + 2 },
      { x: cx - 2, y: cy + 2 },
    ].slice(0, STARTING_WORKERS),
  };
}

function mirrorPlan(p: StartPlan): StartPlan {
  return {
    floors: p.floors.map(mirror),
    minerals: p.minerals.map(mirror),
    geysers: p.geysers.map(mirror),
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
    for (const m of plan.minerals) {
      setTile(grid, m.x, m.y, TileType.MINERAL);
      deposits.push({ id: nextId++, kind: "mineral", tx: m.x, ty: m.y, remaining: MINERAL_DEPOSIT_TOTAL });
    }
    for (const g of plan.geysers) {
      setTile(grid, g.x, g.y, TileType.GEYSER);
      deposits.push({ id: nextId++, kind: "gas", tx: g.x, ty: g.y, remaining: GAS_GEYSER_TOTAL });
    }

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
      built: true,
      started: true,
      buildProgress: ns.buildTime,
      queue: [],
      produceProgress: 0,
      rally: null,
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
        state: "harvesting", // auto-assigns to the nearest mineral patch on the first tick
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
    });
  });

  // Scattered, point-symmetric expansion fields to reward mining outward (docs/map-terrain.md).
  const rng = mulberry32(seed);
  const nearStart = (cx: number, cy: number) =>
    nexusCenters.some((c) => (c.x - cx) ** 2 + (c.y - cy) ** 2 < 8 * 8);

  const placeCluster = (cx: number, cy: number, size: number) => {
    if (nearStart(cx, cy)) return;
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
      deposits.push({ id: nextId++, kind: "mineral", tx: x, ty: y, remaining: MINERAL_DEPOSIT_TOTAL });
      placed++;
    }
    for (const [dx, dy] of [[2, 0], [0, 2], [-2, 0], [0, -2]]) {
      const x = cx + dx;
      const y = cy + dy;
      if (getTile(grid, x, y) === TileType.ROCK) {
        setTile(grid, x, y, TileType.GEYSER);
        deposits.push({ id: nextId++, kind: "gas", tx: x, ty: y, remaining: GAS_GEYSER_TOTAL });
        break;
      }
    }
  };

  // Symmetric anchor pairs (each is the point-mirror of its partner) + a contested center.
  const pairs: [Vec2, Vec2][] = [
    [{ x: 16, y: 32 }, { x: 47, y: 31 }],
    [{ x: 32, y: 16 }, { x: 31, y: 47 }],
    [{ x: 48, y: 32 }, { x: 15, y: 31 }],
    [{ x: 32, y: 48 }, { x: 31, y: 15 }],
  ];
  for (const [a, b] of pairs) {
    const size = 4 + Math.floor(rng() * 3); // 4–6, applied to both sides for fairness
    placeCluster(a.x, a.y, size);
    placeCluster(b.x, b.y, size);
  }
  placeCluster(32, 32, 6);

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
  };
}
