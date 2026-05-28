import {
  BUILDING_STATS,
  GAS_GATHER_TIME_S,
  GAS_PER_TRIP,
  MINERALS_PER_TRIP,
  MINERAL_GATHER_TIME_S,
  SUPPLY_CAP,
  UNIT_STATS,
  WALL_CLEAR_MINERAL_BONUS,
  WALL_MINE_TIME_S,
} from "./constants";
import { computeVisibility } from "./fog";
import {
  getTile,
  inBounds,
  isAdjacentToTile,
  isWalkable,
  nearestAdjacentFloor,
  setTile,
} from "./grid";
import { findPath } from "./pathfinding";
import { isPlacementPowered } from "./power";
import {
  Building,
  BuildingType,
  Command,
  Deposit,
  GameState,
  PlayerId,
  TileType,
  Unit,
  UnitType,
  Vec2,
} from "./types";

export { createInitialState } from "./mapgen";

// --- lookups -------------------------------------------------------------

function getUnit(s: GameState, id: number) {
  return s.units.find((u) => u.id === id);
}
function getBuilding(s: GameState, id: number) {
  return s.buildings.find((b) => b.id === id);
}
function getDeposit(s: GameState, id: number) {
  return s.deposits.find((d) => d.id === id);
}
// A combat target can be a unit or a building.
function getEntity(s: GameState, id: number): Unit | Building | undefined {
  return getUnit(s, id) ?? getBuilding(s, id);
}
function isBuildingEntity(e: Unit | Building): e is Building {
  return (e as Building).tx !== undefined;
}

function buildingCenter(b: Building): Vec2 {
  return { x: b.tx + b.w / 2, y: b.ty + b.h / 2 };
}
function entityCenter(e: Unit | Building): Vec2 {
  return isBuildingEntity(e) ? buildingCenter(e) : { x: e.x, y: e.y };
}
function entityRadius(e: Unit | Building): number {
  return isBuildingEntity(e) ? Math.max(e.w, e.h) / 2 : 0.4;
}

// Distance from a point to the nearest point of a building footprint.
function distPointToBuilding(px: number, py: number, b: Building): number {
  const cx = Math.max(b.tx, Math.min(px, b.tx + b.w));
  const cy = Math.max(b.ty, Math.min(py, b.ty + b.h));
  return Math.hypot(px - cx, py - cy);
}
function distToEntity(u: Unit, e: Unit | Building): number {
  if (isBuildingEntity(e)) return distPointToBuilding(u.x, u.y, e);
  return Math.hypot(u.x - e.x, u.y - e.y);
}

function nearestNexus(s: GameState, owner: PlayerId, from: Vec2): Building | null {
  let best: Building | null = null;
  let bd = Infinity;
  for (const b of s.buildings) {
    if (b.owner !== owner || b.type !== "nexus" || !b.built) continue;
    const c = buildingCenter(b);
    const d = (c.x - from.x) ** 2 + (c.y - from.y) ** 2;
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}

function nearestMineralDeposit(s: GameState, from: Vec2): Deposit | null {
  let best: Deposit | null = null;
  let bd = Infinity;
  for (const d of s.deposits) {
    if (d.kind !== "mineral" || d.remaining <= 0) continue;
    const dist = (d.tx + 0.5 - from.x) ** 2 + (d.ty + 0.5 - from.y) ** 2;
    if (dist < bd) {
      bd = dist;
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

function approachTileForBuilding(s: GameState, b: Building, from: Vec2): Vec2 | null {
  let best: Vec2 | null = null;
  let bd = Infinity;
  for (let y = b.ty - 1; y <= b.ty + b.h; y++) {
    for (let x = b.tx - 1; x <= b.tx + b.w; x++) {
      const border = x === b.tx - 1 || x === b.tx + b.w || y === b.ty - 1 || y === b.ty + b.h;
      if (!border || !isWalkable(s.grid, x, y)) continue;
      const d = (x + 0.5 - from.x) ** 2 + (y + 0.5 - from.y) ** 2;
      if (d < bd) {
        bd = d;
        best = { x, y };
      }
    }
  }
  return best;
}

// --- movement ------------------------------------------------------------

function stepMove(u: Unit, dt: number): boolean {
  if (!u.path || u.path.length === 0) return true;
  let budget = UNIT_STATS[u.type].speed * dt;
  while (budget > 0 && u.path.length > 0) {
    const wp = u.path[0];
    const tx = wp.x + 0.5;
    const ty = wp.y + 0.5;
    const dx = tx - u.x;
    const dy = ty - u.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= budget) {
      u.x = tx;
      u.y = ty;
      budget -= dist;
      u.path.shift();
    } else {
      u.x += (dx / dist) * budget;
      u.y += (dy / dist) * budget;
      budget = 0;
    }
  }
  return u.path.length === 0;
}

type Approach = "arrived" | "moving" | "blocked";
function approach(s: GameState, u: Unit, adjacent: boolean, goal: Vec2 | null, dt: number): Approach {
  if (adjacent) {
    u.path = null;
    return "arrived";
  }
  if (!goal) return "blocked";
  if (u.path === null) {
    const p = findPath(s.grid, s.buildings, u, goal);
    if (p === null) return "blocked";
    u.path = p;
  }
  if (stepMove(u, dt)) u.path = null;
  return "moving";
}

function becomeIdle(u: Unit) {
  u.state = "idle";
  u.path = null;
  u.moveGoal = null;
  u.mineTile = null;
  u.depositId = null;
  u.gatherProgress = 0;
  u.buildTargetId = null;
  u.targetId = null;
  u.attackGoal = null;
}

// --- combat targeting ----------------------------------------------------

function acquireTarget(s: GameState, u: Unit, range: number): number | null {
  let bestUnit: number | null = null;
  let bestUnitD = Infinity;
  for (const e of s.units) {
    if (e.owner === u.owner || e.hp <= 0) continue;
    const d = Math.hypot(u.x - e.x, u.y - e.y);
    if (d <= range && d < bestUnitD) {
      bestUnitD = d;
      bestUnit = e.id;
    }
  }
  if (bestUnit !== null) return bestUnit;
  let bestBld: number | null = null;
  let bestBldD = Infinity;
  for (const b of s.buildings) {
    if (b.owner === u.owner || b.hp <= 0) continue;
    const d = distPointToBuilding(u.x, u.y, b);
    if (d <= range && d < bestBldD) {
      bestBldD = d;
      bestBld = b.id;
    }
  }
  return bestBld;
}

function inWeaponRange(u: Unit, e: Unit | Building, range: number): boolean {
  return distToEntity(u, e) <= range + entityRadius(e);
}

// --- per-unit update -----------------------------------------------------

function updateUnit(s: GameState, u: Unit, dt: number) {
  const stats = UNIT_STATS[u.type];
  u.attackCd = Math.max(0, u.attackCd - dt);
  u.repathCd = Math.max(0, u.repathCd - dt);
  const isCombatant = u.type !== "worker";

  switch (u.state) {
    case "idle": {
      if (isCombatant) {
        const t = acquireTarget(s, u, stats.sight);
        if (t !== null) {
          u.targetId = t;
          u.state = "attacking";
        }
      }
      return;
    }

    case "moving": {
      if (stepMove(u, dt)) becomeIdle(u);
      return;
    }

    case "attack_moving": {
      const t = acquireTarget(s, u, stats.sight);
      if (t !== null) {
        u.targetId = t;
        u.state = "attacking";
        u.path = null;
        return;
      }
      if (!u.attackGoal) {
        becomeIdle(u);
        return;
      }
      if (u.path === null) {
        const p = findPath(s.grid, s.buildings, u, u.attackGoal);
        if (!p) {
          u.attackGoal = null;
          u.state = "idle";
          return;
        }
        u.path = p;
      }
      if (stepMove(u, dt)) {
        u.attackGoal = null;
        u.state = "idle";
        u.path = null;
      }
      return;
    }

    case "attacking": {
      const tgt = u.targetId !== null ? getEntity(s, u.targetId) : undefined;
      if (!tgt || tgt.hp <= 0) {
        u.targetId = null;
        u.path = null;
        u.state = u.attackGoal ? "attack_moving" : "idle";
        return;
      }
      if (inWeaponRange(u, tgt, stats.range)) {
        u.path = null;
        if (u.attackCd <= 0 && stats.damage > 0) {
          tgt.hp -= stats.damage;
          u.attackCd = stats.cooldown;
        }
      } else {
        const c = entityCenter(tgt);
        const goalTile = isBuildingEntity(tgt)
          ? approachTileForBuilding(s, tgt, u)
          : nearestAdjacentFloor(s.grid, Math.floor(c.x), Math.floor(c.y), u) ??
            { x: Math.floor(c.x), y: Math.floor(c.y) };
        if (u.repathCd <= 0 || u.path === null) {
          const p = goalTile ? findPath(s.grid, s.buildings, u, goalTile) : null;
          u.path = p;
          u.repathCd = 0.4;
          if (!p) {
            // Can't reach; give up this target.
            u.targetId = null;
            u.state = u.attackGoal ? "attack_moving" : "idle";
            return;
          }
        }
        stepMove(u, dt);
      }
      return;
    }

    case "mining_wall": {
      const t = u.mineTile;
      if (!t || getTile(s.grid, t.x, t.y) !== TileType.ROCK) {
        becomeIdle(u);
        return;
      }
      const adj = isAdjacentToTile(u.x, u.y, t.x, t.y);
      const res = approach(s, u, adj, nearestAdjacentFloor(s.grid, t.x, t.y, u), dt);
      if (res === "blocked") return becomeIdle(u);
      if (res !== "arrived") return;
      u.mineProgress += dt;
      if (u.mineProgress >= WALL_MINE_TIME_S) {
        setTile(s.grid, t.x, t.y, TileType.FLOOR);
        s.players[u.owner].minerals += WALL_CLEAR_MINERAL_BONUS;
        becomeIdle(u);
      }
      return;
    }

    case "harvesting": {
      let dep = u.depositId !== null ? getDeposit(s, u.depositId) : undefined;
      if (!dep || dep.remaining <= 0) {
        dep = nearestMineralDeposit(s, u) ?? undefined;
        if (!dep) return becomeIdle(u);
        u.depositId = dep.id;
        u.path = null;
      }
      const adj = isAdjacentToTile(u.x, u.y, dep.tx, dep.ty);
      const res = approach(s, u, adj, nearestAdjacentFloor(s.grid, dep.tx, dep.ty, u), dt);
      if (res === "blocked") return becomeIdle(u);
      if (res !== "arrived") return;
      const gatherTime = dep.kind === "gas" ? GAS_GATHER_TIME_S : MINERAL_GATHER_TIME_S;
      u.gatherProgress += dt;
      if (u.gatherProgress >= gatherTime) {
        const load = dep.kind === "gas" ? GAS_PER_TRIP : MINERALS_PER_TRIP;
        const amount = Math.min(load, dep.remaining);
        dep.remaining -= amount;
        u.carrying = { kind: dep.kind, amount };
        u.gatherProgress = 0;
        u.path = null;
        u.state = "returning_resource";
        if (dep.remaining <= 0) depleteDeposit(s, dep);
      }
      return;
    }

    case "returning_resource": {
      const base = nearestNexus(s, u.owner, u);
      if (!base) {
        u.state = "harvesting";
        return;
      }
      const adj = isAdjacentToBuilding(u.x, u.y, base);
      const res = approach(s, u, adj, approachTileForBuilding(s, base, u), dt);
      if (res === "blocked") return becomeIdle(u);
      if (res !== "arrived") return;
      if (u.carrying) {
        const p = s.players[u.owner];
        if (u.carrying.kind === "gas") p.gas += u.carrying.amount;
        else p.minerals += u.carrying.amount;
        u.carrying = null;
      }
      u.path = null;
      u.state = "harvesting";
      return;
    }

    case "constructing": {
      const b = u.buildTargetId !== null ? getBuilding(s, u.buildTargetId) : undefined;
      if (!b || b.built) {
        u.buildTargetId = null;
        u.state = "harvesting";
        u.depositId = null;
        return;
      }
      const adj = isAdjacentToBuilding(u.x, u.y, b);
      const res = approach(s, u, adj, approachTileForBuilding(s, b, u), dt);
      if (res === "blocked") {
        // Can't reach the site — refund and cancel.
        refundBuilding(s, b);
        u.buildTargetId = null;
        becomeIdle(u);
        return;
      }
      if (res !== "arrived") return;
      b.started = true; // warp-in begins; Protoss buildings self-complete
      u.buildTargetId = null;
      u.state = "harvesting";
      u.depositId = null;
      return;
    }
  }
}

function depleteDeposit(s: GameState, dep: Deposit) {
  if (dep.kind === "mineral") setTile(s.grid, dep.tx, dep.ty, TileType.FLOOR);
  s.deposits = s.deposits.filter((d) => d.id !== dep.id);
}

function refundBuilding(s: GameState, b: Building) {
  const st = BUILDING_STATS[b.type];
  const p = s.players[b.owner];
  p.minerals += st.minerals;
  p.gas += st.gas;
  s.buildings = s.buildings.filter((x) => x.id !== b.id);
}

// --- construction, production, building combat ---------------------------

function updateConstruction(s: GameState, dt: number) {
  for (const b of s.buildings) {
    if (b.built || !b.started) continue;
    const st = BUILDING_STATS[b.type];
    b.buildProgress += dt;
    b.hp = Math.max(1, Math.round((b.buildProgress / st.buildTime) * b.maxHp));
    if (b.buildProgress >= st.buildTime) {
      b.built = true;
      b.hp = b.maxHp;
    }
  }
}

function spawnUnit(s: GameState, b: Building, type: UnitType) {
  const st = UNIT_STATS[type];
  const from = buildingCenter(b);
  const tile = approachTileForBuilding(s, b, from) ?? { x: b.tx, y: b.ty + b.h };
  const u: Unit = {
    id: s.nextId++,
    owner: b.owner,
    type,
    x: tile.x + 0.5,
    y: tile.y + 0.5,
    hp: st.hp,
    maxHp: st.hp,
    state: "idle",
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
  };
  s.units.push(u);
  if (type === "worker") {
    u.state = "harvesting"; // auto-mine
  } else if (b.rally) {
    const p = findPath(s.grid, s.buildings, u, b.rally);
    if (p) {
      u.path = p;
      u.moveGoal = { ...b.rally };
      u.state = "moving";
    }
  }
}

function updateProduction(s: GameState, dt: number) {
  for (const b of s.buildings) {
    if (!b.built || b.queue.length === 0) continue;
    b.produceProgress += dt;
    const next = b.queue[0];
    if (b.produceProgress >= UNIT_STATS[next.unitType].buildTime) {
      b.produceProgress = 0;
      b.queue.shift();
      spawnUnit(s, b, next.unitType);
    }
  }
}

function updateBuildingCombat(s: GameState, dt: number) {
  for (const b of s.buildings) {
    if (!b.built) continue;
    const st = BUILDING_STATS[b.type];
    if (st.damage <= 0) continue;
    b.attackCd = Math.max(0, b.attackCd - dt);
    const c = buildingCenter(b);
    // acquire nearest enemy unit in range
    let target: Unit | null = null;
    let bd = Infinity;
    for (const e of s.units) {
      if (e.owner === b.owner || e.hp <= 0) continue;
      const d = distPointToBuilding(e.x, e.y, b);
      if (d <= st.range && d < bd) {
        bd = d;
        target = e;
      }
    }
    if (target && b.attackCd <= 0) {
      target.hp -= st.damage;
      b.attackCd = st.cooldown;
    }
    void c;
  }
}

function cleanupDead(s: GameState) {
  s.units = s.units.filter((u) => u.hp > 0);
  s.buildings = s.buildings.filter((b) => b.hp > 0);
}

function recomputeSupply(s: GameState) {
  for (const p of s.players) {
    let max = 0;
    for (const b of s.buildings) {
      if (b.owner !== p.id || !b.built) continue;
      max += BUILDING_STATS[b.type].supply;
    }
    let used = 0;
    for (const u of s.units) if (u.owner === p.id) used += UNIT_STATS[u.type].supply;
    for (const b of s.buildings) {
      if (b.owner !== p.id) continue;
      for (const item of b.queue) used += UNIT_STATS[item.unitType].supply;
    }
    p.supplyUsed = used;
    p.supplyMax = Math.min(SUPPLY_CAP, max);
  }
}

function checkWinCondition(s: GameState) {
  for (const p of s.players) {
    if (p.defeated) continue;
    const hasBuildings = s.buildings.some((b) => b.owner === p.id);
    if (!hasBuildings) p.defeated = true;
  }
  const alive = s.players.filter((p) => !p.defeated);
  if (alive.length === 1 && s.winner === null) s.winner = alive[0].id;
}

// --- placement & commands ------------------------------------------------

function rectsOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function canPlaceBuilding(s: GameState, owner: PlayerId, type: BuildingType, tx: number, ty: number): boolean {
  const st = BUILDING_STATS[type];
  for (let y = ty; y < ty + st.h; y++) {
    for (let x = tx; x < tx + st.w; x++) {
      if (!inBounds(s.grid, x, y) || getTile(s.grid, x, y) !== TileType.FLOOR) return false;
    }
  }
  for (const b of s.buildings) {
    if (rectsOverlap(tx, ty, st.w, st.h, b.tx, b.ty, b.w, b.h)) return false;
  }
  if (st.needsPower && !isPlacementPowered(s, owner, tx, ty, st.w, st.h)) return false;
  return true;
}

function placeBuilding(s: GameState, owner: PlayerId, type: BuildingType, tx: number, ty: number, worker: Unit | null): boolean {
  const st = BUILDING_STATS[type];
  const p = s.players[owner];
  if (p.minerals < st.minerals || p.gas < st.gas) return false;
  if (!canPlaceBuilding(s, owner, type, tx, ty)) return false;
  p.minerals -= st.minerals;
  p.gas -= st.gas;
  const b: Building = {
    id: s.nextId++,
    owner,
    type,
    tx,
    ty,
    w: st.w,
    h: st.h,
    hp: 1,
    maxHp: st.hp,
    built: false,
    started: false,
    buildProgress: 0,
    queue: [],
    produceProgress: 0,
    rally: null,
    targetId: null,
    attackCd: 0,
  };
  s.buildings.push(b);
  if (worker) {
    worker.state = "constructing";
    worker.buildTargetId = b.id;
    worker.path = null;
    worker.depositId = null;
    worker.carrying = null;
  }
  return true;
}

function enqueueTrain(s: GameState, b: Building, type: UnitType): boolean {
  if (!b.built) return false;
  if (!BUILDING_STATS[b.type].produces.includes(type)) return false;
  const st = UNIT_STATS[type];
  const p = s.players[b.owner];
  if (p.minerals < st.minerals || p.gas < st.gas) return false;
  if (p.supplyUsed + st.supply > p.supplyMax) return false;
  p.minerals -= st.minerals;
  p.gas -= st.gas;
  b.queue.push({ unitType: type });
  return true;
}

function walkableGoal(s: GameState, tx: number, ty: number): Vec2 | null {
  if (isWalkable(s.grid, tx, ty)) return { x: tx, y: ty };
  return nearestAdjacentFloor(s.grid, tx, ty, { x: tx + 0.5, y: ty + 0.5 });
}

export function applyCommand(s: GameState, cmd: Command): void {
  switch (cmd.type) {
    case "move":
    case "attackMove": {
      const goal = walkableGoal(s, cmd.tx, cmd.ty);
      for (const id of cmd.unitIds) {
        const u = getUnit(s, id);
        if (!u) continue;
        u.mineTile = null;
        u.depositId = null;
        u.carrying = null;
        u.gatherProgress = 0;
        u.buildTargetId = null;
        u.targetId = null;
        if (cmd.type === "attackMove" && u.type !== "worker") {
          u.attackGoal = goal;
          u.path = goal ? findPath(s.grid, s.buildings, u, goal) : null;
          u.state = u.path ? "attack_moving" : "idle";
        } else {
          u.attackGoal = null;
          u.moveGoal = goal;
          u.path = goal ? findPath(s.grid, s.buildings, u, goal) : null;
          u.state = u.path ? "moving" : "idle";
        }
      }
      return;
    }

    case "attack": {
      const tgt = getEntity(s, cmd.targetId);
      if (!tgt) return;
      for (const id of cmd.unitIds) {
        const u = getUnit(s, id);
        if (!u || UNIT_STATS[u.type].damage <= 0) continue;
        u.targetId = cmd.targetId;
        u.attackGoal = null;
        u.mineTile = null;
        u.depositId = null;
        u.path = null;
        u.state = "attacking";
      }
      return;
    }

    case "mine": {
      if (getTile(s.grid, cmd.tx, cmd.ty) !== TileType.ROCK) return;
      for (const id of cmd.unitIds) {
        const u = getUnit(s, id);
        if (!u || u.type !== "worker") continue;
        u.state = "mining_wall";
        u.mineTile = { x: cmd.tx, y: cmd.ty };
        u.mineProgress = 0;
        u.depositId = null;
        u.carrying = null;
        u.targetId = null;
        u.path = null;
      }
      return;
    }

    case "harvest": {
      const dep = getDeposit(s, cmd.depositId);
      if (!dep) return;
      for (const id of cmd.unitIds) {
        const u = getUnit(s, id);
        if (!u || u.type !== "worker") continue;
        u.state = "harvesting";
        u.depositId = dep.id;
        u.mineTile = null;
        u.targetId = null;
        u.gatherProgress = 0;
        u.path = null;
      }
      return;
    }

    case "stop": {
      for (const id of cmd.unitIds) {
        const u = getUnit(s, id);
        if (u) becomeIdle(u);
      }
      return;
    }

    case "build": {
      const worker = cmd.unitIds.map((id) => getUnit(s, id)).find((u) => u && u.type === "worker") ?? null;
      if (!worker) return;
      placeBuilding(s, worker.owner, cmd.buildingType, cmd.tx, cmd.ty, worker);
      return;
    }

    case "train": {
      const b = getBuilding(s, cmd.buildingId);
      if (b) enqueueTrain(s, b, cmd.unitType);
      return;
    }

    case "setRally": {
      const b = getBuilding(s, cmd.buildingId);
      if (b) b.rally = { x: cmd.tx, y: cmd.ty };
      return;
    }
  }
}

// --- enemy AI (player 1) -------------------------------------------------

function findPlacementNear(s: GameState, owner: PlayerId, type: BuildingType, near: Vec2): Vec2 | null {
  for (let r = 2; r <= 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = Math.floor(near.x) + dx;
        const ty = Math.floor(near.y) + dy;
        if (canPlaceBuilding(s, owner, type, tx, ty)) return { x: tx, y: ty };
      }
    }
  }
  return null;
}

function freeWorker(s: GameState, owner: PlayerId): Unit | null {
  return (
    s.units.find((u) => u.owner === owner && u.type === "worker" && (u.state === "harvesting" || u.state === "idle")) ??
    null
  );
}

function runAI(s: GameState, _dt: number) {
  if (s.tick % 16 !== 0) return; // ~once per second
  const owner: PlayerId = 1;
  const p = s.players[owner];
  if (p.defeated) return;

  const myUnits = s.units.filter((u) => u.owner === owner);
  const myBuildings = s.buildings.filter((b) => b.owner === owner);
  const nexus = myBuildings.find((b) => b.type === "nexus");
  if (!nexus) return;

  const workers = myUnits.filter((u) => u.type === "worker");
  const army = myUnits.filter((u) => u.type !== "worker");
  const pylons = myBuildings.filter((b) => b.type === "pylon");
  const hasBuiltPylon = pylons.some((b) => b.built);
  const buildingPylon = pylons.some((b) => !b.built);
  const gateways = myBuildings.filter((b) => b.type === "gateway");
  const hasGateway = gateways.some((b) => b.built);
  const buildingGateway = gateways.some((b) => !b.built);

  // Supply ahead of need.
  if (p.supplyMax < SUPPLY_CAP && p.supplyMax - p.supplyUsed <= 2 && p.minerals >= 100 && !buildingPylon) {
    const w = freeWorker(s, owner);
    const spot = findPlacementNear(s, owner, "pylon", buildingCenter(nexus));
    if (w && spot) placeBuilding(s, owner, "pylon", spot.x, spot.y, w);
    return;
  }
  // Workers up to saturation.
  if (workers.length < 16 && nexus.queue.length === 0 && p.minerals >= 50 && p.supplyUsed < p.supplyMax) {
    enqueueTrain(s, nexus, "worker");
    return;
  }
  // First Gateway once powered.
  if (hasBuiltPylon && !hasGateway && !buildingGateway && p.minerals >= 150) {
    const w = freeWorker(s, owner);
    const spot = findPlacementNear(s, owner, "gateway", buildingCenter(pylons[0]));
    if (w && spot) placeBuilding(s, owner, "gateway", spot.x, spot.y, w);
    return;
  }
  // Pump zealots.
  if (hasGateway && p.minerals >= 100 && p.supplyUsed + 2 <= p.supplyMax) {
    const gw = gateways.find((b) => b.built && b.queue.length < 2);
    if (gw) {
      enqueueTrain(s, gw, "zealot");
      return;
    }
  }
  // Attack: every ~40s, send the army at the enemy if it's big enough.
  if (army.length >= 5 && s.tick % (16 * 40) < 16) {
    const enemyNexus = s.buildings.find((b) => b.owner === 0 && b.type === "nexus");
    if (enemyNexus) {
      const goal = approachTileForBuilding(s, enemyNexus, buildingCenter(enemyNexus)) ?? buildingCenter(enemyNexus);
      for (const u of army) {
        u.attackGoal = { x: Math.floor(goal.x), y: Math.floor(goal.y) };
        u.path = null;
        u.targetId = null;
        u.state = "attack_moving";
      }
    }
  }
}

// --- public API ----------------------------------------------------------

export function step(s: GameState, dt: number): void {
  for (const u of s.units) updateUnit(s, u, dt);
  updateConstruction(s, dt);
  updateProduction(s, dt);
  updateBuildingCombat(s, dt);
  cleanupDead(s);
  recomputeSupply(s);
  if (s.tick % 4 === 0) computeVisibility(s, 0, s.visibility);
  checkWinCondition(s);
  runAI(s, dt);
  s.tick++;
}
