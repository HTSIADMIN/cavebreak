import {
  GAS_GATHER_TIME_S,
  GAS_PER_TRIP,
  MINERALS_PER_TRIP,
  MINERAL_GATHER_TIME_S,
  SUPPLY_CAP,
  SUPPLY_PER_BASE,
  SUPPLY_PER_SUPPLY_STRUCTURE,
  WALL_CLEAR_MINERAL_BONUS,
  WALL_MINE_TIME_S,
  WORKER_BUILD_TIME_S,
  WORKER_COST_MINERALS,
  WORKER_HP,
  WORKER_SPEED,
} from "./constants";
import {
  getTile,
  isAdjacentToTile,
  isWalkable,
  nearestAdjacentFloor,
  setTile,
} from "./grid";
import { findPath } from "./pathfinding";
import {
  Building,
  Command,
  Deposit,
  GameState,
  TileType,
  Unit,
  Vec2,
} from "./types";

export { createInitialState } from "./mapgen";

// --- lookups -------------------------------------------------------------

function getUnit(state: GameState, id: number): Unit | undefined {
  return state.units.find((u) => u.id === id);
}
function getBuilding(state: GameState, id: number): Building | undefined {
  return state.buildings.find((b) => b.id === id);
}
function getDeposit(state: GameState, id: number): Deposit | undefined {
  return state.deposits.find((d) => d.id === id);
}

function baseCenter(b: Building): Vec2 {
  return { x: b.tx + b.w / 2, y: b.ty + b.h / 2 };
}

function nearestBase(state: GameState, owner: number, from: Vec2): Building | null {
  let best: Building | null = null;
  let bestD = Infinity;
  for (const b of state.buildings) {
    if (b.owner !== owner || b.type !== "base") continue;
    const c = baseCenter(b);
    const d = (c.x - from.x) ** 2 + (c.y - from.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

function nearestMineralDeposit(state: GameState, from: Vec2): Deposit | null {
  let best: Deposit | null = null;
  let bestD = Infinity;
  for (const d of state.deposits) {
    if (d.kind !== "mineral" || d.remaining <= 0) continue;
    const dist = (d.tx + 0.5 - from.x) ** 2 + (d.ty + 0.5 - from.y) ** 2;
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}

function isAdjacentToBuilding(ux: number, uy: number, b: Building): boolean {
  const fx = Math.floor(ux);
  const fy = Math.floor(uy);
  return fx >= b.tx - 1 && fx <= b.tx + b.w && fy >= b.ty - 1 && fy <= b.ty + b.h;
}

// A walkable floor tile bordering a building footprint, nearest to `from`.
function approachTileForBuilding(state: GameState, b: Building, from: Vec2): Vec2 | null {
  let best: Vec2 | null = null;
  let bestD = Infinity;
  for (let y = b.ty - 1; y <= b.ty + b.h; y++) {
    for (let x = b.tx - 1; x <= b.tx + b.w; x++) {
      const border = x === b.tx - 1 || x === b.tx + b.w || y === b.ty - 1 || y === b.ty + b.h;
      if (!border || !isWalkable(state.grid, x, y)) continue;
      const d = (x + 0.5 - from.x) ** 2 + (y + 0.5 - from.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  }
  return best;
}

// --- movement ------------------------------------------------------------

// Advance a unit along its path. Returns true when the path is exhausted.
function stepMove(unit: Unit, dt: number): boolean {
  if (!unit.path || unit.path.length === 0) return true;
  let budget = WORKER_SPEED * dt;
  while (budget > 0 && unit.path.length > 0) {
    const wp = unit.path[0];
    const tx = wp.x + 0.5;
    const ty = wp.y + 0.5;
    const dx = tx - unit.x;
    const dy = ty - unit.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= budget) {
      unit.x = tx;
      unit.y = ty;
      budget -= dist;
      unit.path.shift();
    } else {
      unit.x += (dx / dist) * budget;
      unit.y += (dy / dist) * budget;
      budget = 0;
    }
  }
  return unit.path.length === 0;
}

type Approach = "arrived" | "moving" | "blocked";

// Walk toward a goal tile until adjacent. Lazily computes a path; returns
// "blocked" if no path exists so the caller can abandon the job.
function approach(state: GameState, unit: Unit, adjacent: boolean, goal: Vec2 | null, dt: number): Approach {
  if (adjacent) {
    unit.path = null;
    return "arrived";
  }
  if (!goal) return "blocked";
  if (unit.path === null) {
    const p = findPath(state.grid, state.buildings, unit, goal);
    if (p === null) return "blocked";
    unit.path = p;
  }
  const done = stepMove(unit, dt);
  if (done) unit.path = null; // re-evaluate adjacency next tick
  return "moving";
}

function becomeIdle(unit: Unit) {
  unit.state = "idle";
  unit.path = null;
  unit.moveGoal = null;
  unit.mineTile = null;
  unit.depositId = null;
  unit.gatherProgress = 0;
}

// --- per-unit update -----------------------------------------------------

function updateWorker(state: GameState, unit: Unit, dt: number) {
  switch (unit.state) {
    case "idle":
      return;

    case "moving": {
      if (stepMove(unit, dt)) {
        unit.state = "idle";
        unit.moveGoal = null;
        unit.path = null;
      }
      return;
    }

    case "mining_wall": {
      const t = unit.mineTile;
      if (!t || getTile(state.grid, t.x, t.y) !== TileType.ROCK) {
        becomeIdle(unit);
        return;
      }
      const adj = isAdjacentToTile(unit.x, unit.y, t.x, t.y);
      const res = approach(state, unit, adj, nearestAdjacentFloor(state.grid, t.x, t.y, unit), dt);
      if (res === "blocked") {
        becomeIdle(unit);
        return;
      }
      if (res !== "arrived") return;
      unit.mineProgress += dt;
      if (unit.mineProgress >= WALL_MINE_TIME_S) {
        setTile(state.grid, t.x, t.y, TileType.FLOOR);
        state.players[unit.owner].minerals += WALL_CLEAR_MINERAL_BONUS;
        becomeIdle(unit);
      }
      return;
    }

    case "harvesting": {
      let dep = unit.depositId !== null ? getDeposit(state, unit.depositId) : undefined;
      if (!dep || dep.remaining <= 0) {
        dep = nearestMineralDeposit(state, unit) ?? undefined;
        if (!dep) {
          becomeIdle(unit);
          return;
        }
        unit.depositId = dep.id;
        unit.path = null;
      }
      const adj = isAdjacentToTile(unit.x, unit.y, dep.tx, dep.ty);
      const res = approach(state, unit, adj, nearestAdjacentFloor(state.grid, dep.tx, dep.ty, unit), dt);
      if (res === "blocked") {
        becomeIdle(unit);
        return;
      }
      if (res !== "arrived") return;

      const gatherTime = dep.kind === "gas" ? GAS_GATHER_TIME_S : MINERAL_GATHER_TIME_S;
      unit.gatherProgress += dt;
      if (unit.gatherProgress >= gatherTime) {
        const load = dep.kind === "gas" ? GAS_PER_TRIP : MINERALS_PER_TRIP;
        const amount = Math.min(load, dep.remaining);
        dep.remaining -= amount;
        unit.carrying = { kind: dep.kind, amount };
        unit.gatherProgress = 0;
        unit.path = null;
        unit.state = "returning_resource";
        if (dep.remaining <= 0) depleteDeposit(state, dep);
      }
      return;
    }

    case "returning_resource": {
      const base = nearestBase(state, unit.owner, unit);
      if (!base) {
        unit.state = "harvesting";
        return;
      }
      const adj = isAdjacentToBuilding(unit.x, unit.y, base);
      const res = approach(state, unit, adj, approachTileForBuilding(state, base, unit), dt);
      if (res === "blocked") {
        becomeIdle(unit);
        return;
      }
      if (res !== "arrived") return;

      if (unit.carrying) {
        const p = state.players[unit.owner];
        if (unit.carrying.kind === "gas") p.gas += unit.carrying.amount;
        else p.minerals += unit.carrying.amount;
        unit.carrying = null;
      }
      unit.path = null;
      unit.state = "harvesting"; // loop back to the same deposit
      return;
    }

    case "constructing":
      // deferred (docs/buildings.md)
      return;
  }
}

function depleteDeposit(state: GameState, dep: Deposit) {
  if (dep.kind === "mineral") setTile(state.grid, dep.tx, dep.ty, TileType.FLOOR);
  state.deposits = state.deposits.filter((d) => d.id !== dep.id);
}

// --- supply & production -------------------------------------------------

function recomputeSupply(state: GameState) {
  for (const p of state.players) {
    let bases = 0;
    let queued = 0;
    for (const b of state.buildings) {
      if (b.owner !== p.id) continue;
      if (b.type === "base") bases++;
      queued += b.queue.length;
    }
    const units = state.units.filter((u) => u.owner === p.id).length;
    p.supplyUsed = units + queued;
    p.supplyMax = Math.min(SUPPLY_CAP, bases * SUPPLY_PER_BASE + 0 * SUPPLY_PER_SUPPLY_STRUCTURE);
  }
}

function spawnWorkerAt(state: GameState, b: Building) {
  const from = baseCenter(b);
  const tile = approachTileForBuilding(state, b, from) ?? { x: b.tx, y: b.ty + b.h };
  const unit: Unit = {
    id: state.nextId++,
    owner: b.owner,
    type: "worker",
    x: tile.x + 0.5,
    y: tile.y + 0.5,
    hp: WORKER_HP,
    state: "idle",
    path: null,
    moveGoal: null,
    mineTile: null,
    mineProgress: 0,
    depositId: null,
    carrying: null,
    gatherProgress: 0,
  };
  state.units.push(unit);
  // Send to rally point if set (auto-harvest if it's near a deposit handled by harvest command later).
  if (b.rally) {
    const path = findPath(state.grid, state.buildings, unit, b.rally);
    if (path) {
      unit.path = path;
      unit.moveGoal = { ...b.rally };
      unit.state = "moving";
    }
  } else {
    // Default: send the new worker to harvest the nearest mineral patch (SC2-like convenience).
    const dep = nearestMineralDeposit(state, unit);
    if (dep) {
      unit.depositId = dep.id;
      unit.state = "harvesting";
    }
  }
}

function updateProduction(state: GameState, dt: number) {
  for (const b of state.buildings) {
    if (b.queue.length === 0) continue;
    b.produceProgress += dt;
    if (b.produceProgress >= WORKER_BUILD_TIME_S) {
      b.produceProgress -= WORKER_BUILD_TIME_S;
      b.queue.shift();
      spawnWorkerAt(state, b);
    }
  }
}

// --- public API ----------------------------------------------------------

export function step(state: GameState, dt: number): void {
  for (const u of state.units) updateWorker(state, u, dt);
  updateProduction(state, dt);
  recomputeSupply(state);
  state.tick++;
}

export function applyCommand(state: GameState, cmd: Command): void {
  switch (cmd.type) {
    case "move":
    case "attackMove": {
      const goal = walkableGoal(state, cmd.tx, cmd.ty);
      for (const id of cmd.unitIds) {
        const u = getUnit(state, id);
        if (!u) continue;
        u.mineTile = null;
        u.depositId = null;
        u.carrying = null;
        u.gatherProgress = 0;
        u.moveGoal = goal;
        u.path = goal ? findPath(state.grid, state.buildings, u, goal) : null;
        u.state = u.path ? "moving" : "idle";
      }
      return;
    }

    case "mine": {
      if (getTile(state.grid, cmd.tx, cmd.ty) !== TileType.ROCK) return;
      for (const id of cmd.unitIds) {
        const u = getUnit(state, id);
        if (!u) continue;
        u.state = "mining_wall";
        u.mineTile = { x: cmd.tx, y: cmd.ty };
        u.mineProgress = 0;
        u.depositId = null;
        u.carrying = null;
        u.path = null;
      }
      return;
    }

    case "harvest": {
      const dep = getDeposit(state, cmd.depositId);
      if (!dep) return;
      for (const id of cmd.unitIds) {
        const u = getUnit(state, id);
        if (!u) continue;
        u.state = "harvesting";
        u.depositId = dep.id;
        u.mineTile = null;
        u.gatherProgress = 0;
        u.path = null;
      }
      return;
    }

    case "stop": {
      for (const id of cmd.unitIds) {
        const u = getUnit(state, id);
        if (u) becomeIdle(u);
      }
      return;
    }

    case "buildWorker": {
      const b = getBuilding(state, cmd.baseId);
      if (!b || b.type !== "base") return;
      const p = state.players[b.owner];
      if (p.minerals < WORKER_COST_MINERALS) return;
      if (p.supplyUsed >= p.supplyMax) return;
      p.minerals -= WORKER_COST_MINERALS;
      b.queue.push({ kind: "worker" });
      return;
    }

    case "setRally": {
      const b = getBuilding(state, cmd.baseId);
      if (b) b.rally = { x: cmd.tx, y: cmd.ty };
      return;
    }
  }
}

// If the clicked tile isn't walkable, fall back to the nearest adjacent floor.
function walkableGoal(state: GameState, tx: number, ty: number): Vec2 | null {
  if (isWalkable(state.grid, tx, ty)) return { x: tx, y: ty };
  return nearestAdjacentFloor(state.grid, tx, ty, { x: tx + 0.5, y: ty + 0.5 });
}
