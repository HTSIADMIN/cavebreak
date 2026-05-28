import {
  BASE_FOOTPRINT,
  BASE_HP,
  GAS_GEYSER_TOTAL,
  MAP_H,
  MAP_W,
  MINERAL_DEPOSIT_TOTAL,
  STARTING_WORKERS,
  SUPPLY_PER_BASE,
  WORKER_HP,
} from "./constants";
import { createGrid, setTile } from "./grid";
import {
  Building,
  Deposit,
  GameState,
  Player,
  TileType,
  Unit,
  Vec2,
} from "./types";

interface SpawnPlan {
  floors: Vec2[];
  minerals: Vec2[];
  geysers: Vec2[];
  baseTopLeft: Vec2;
  workers: Vec2[];
}

// Player 0's layout, hand-authored in the top-left quadrant. Player 1 mirrors it
// by point symmetry so starting positions are fair (docs/map-terrain.md).
function plan0(): SpawnPlan {
  const floors: Vec2[] = [];
  for (let y = 10; y <= 18; y++) {
    for (let x = 10; x <= 18; x++) floors.push({ x, y });
  }
  const minerals: Vec2[] = [];
  for (let x = 12; x <= 17; x++) minerals.push({ x, y: 9 }); // row just outside the pocket
  return {
    floors,
    minerals,
    geysers: [{ x: 9, y: 14 }],
    baseTopLeft: { x: 13, y: 13 },
    workers: [
      { x: 11, y: 12 },
      { x: 12, y: 11 },
      { x: 11, y: 16 },
      { x: 16, y: 11 },
      { x: 16, y: 16 },
      { x: 12, y: 16 },
    ].slice(0, STARTING_WORKERS),
  };
}

function mirror(v: Vec2): Vec2 {
  return { x: MAP_W - 1 - v.x, y: MAP_H - 1 - v.y };
}

function mirrorPlan(p: SpawnPlan): SpawnPlan {
  return {
    floors: p.floors.map(mirror),
    minerals: p.minerals.map(mirror),
    geysers: p.geysers.map(mirror),
    // The mirrored footprint's top-left is the mirror of its bottom-right corner.
    baseTopLeft: mirror({
      x: p.baseTopLeft.x + BASE_FOOTPRINT - 1,
      y: p.baseTopLeft.y + BASE_FOOTPRINT - 1,
    }),
    workers: p.workers.map(mirror),
  };
}

export function createInitialState(): GameState {
  const grid = createGrid(MAP_W, MAP_H);

  // Boundary ring.
  for (let x = 0; x < MAP_W; x++) {
    setTile(grid, x, 0, TileType.BOUNDARY);
    setTile(grid, x, MAP_H - 1, TileType.BOUNDARY);
  }
  for (let y = 0; y < MAP_H; y++) {
    setTile(grid, 0, y, TileType.BOUNDARY);
    setTile(grid, MAP_W - 1, y, TileType.BOUNDARY);
  }

  const plans = [plan0(), mirrorPlan(plan0())];
  const colors = ["#4aa3ff", "#ff5a4a"];

  const players: Player[] = [];
  const units: Unit[] = [];
  const buildings: Building[] = [];
  const deposits: Deposit[] = [];
  let nextId = 1;

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

    buildings.push({
      id: nextId++,
      owner,
      type: "base",
      tx: plan.baseTopLeft.x,
      ty: plan.baseTopLeft.y,
      w: BASE_FOOTPRINT,
      h: BASE_FOOTPRINT,
      hp: BASE_HP,
      queue: [],
      produceProgress: 0,
      rally: null,
    });

    for (const w of plan.workers) {
      units.push({
        id: nextId++,
        owner,
        type: "worker",
        x: w.x + 0.5,
        y: w.y + 0.5,
        hp: WORKER_HP,
        state: "harvesting", // auto-assigns to the nearest mineral patch on the first tick
        path: null,
        moveGoal: null,
        mineTile: null,
        mineProgress: 0,
        depositId: null,
        carrying: null,
        gatherProgress: 0,
      });
    }

    players.push({
      id: owner,
      color: colors[owner],
      minerals: 50,
      gas: 0,
      supplyUsed: plan.workers.length,
      supplyMax: SUPPLY_PER_BASE,
    });
  });

  return { tick: 0, grid, players, units, buildings, deposits, nextId };
}
