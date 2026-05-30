import {
  BUILDING_STATS,
  COLLISION_RADIUS,
  GAS_GATHER_TIME_S,
  GAS_PER_TRIP,
  GOLDEN_GAS_PER_TRIP,
  GOLDEN_MINERALS_PER_TRIP,
  MAX_BUILDERS,
  MINERALS_PER_TRIP,
  MINERAL_GATHER_TIME_S,
  SHIELD_REGEN_DELAY,
  SHIELD_REGEN_RATE,
  SUPPLY_CAP,
  UNIT_STATS,
  UPGRADES,
  WALL_CLEAR_MINERAL_BONUS,
} from "./constants";
import { computeVisibility } from "./fog";
import { getTile, inBounds, isAdjacentToTile, isWalkable, setTile } from "./grid";
import { findPath } from "./pathfinding";
import { isPlacementPowered } from "./power";
import {
  Attribute,
  Building,
  BuildingType,
  Command,
  Deposit,
  Difficulty,
  GameEvent,
  GameState,
  PlayerId,
  TileType,
  Unit,
  UnitType,
  UpgradeKind,
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
function getEntity(s: GameState, id: number): Unit | Building | undefined {
  return getUnit(s, id) ?? getBuilding(s, id);
}
function isBuildingEntity(e: Unit | Building): e is Building {
  return (e as Building).tx !== undefined;
}

function pushEvent(s: GameState, e: GameEvent) {
  s.events.push(e);
  if (s.events.length > 300) s.events.shift();
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
function entityAttrs(e: Unit | Building): Attribute[] {
  return isBuildingEntity(e) ? BUILDING_STATS[e.type].attributes : UNIT_STATS[e.type].attributes;
}
function entityArmor(e: Unit | Building): number {
  return isBuildingEntity(e) ? BUILDING_STATS[e.type].armor : UNIT_STATS[e.type].armor;
}

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

function nearestDeposit(s: GameState, kind: "mineral" | "gas", from: Vec2): Deposit | null {
  let best: Deposit | null = null;
  let bd = Infinity;
  for (const d of s.deposits) {
    if (d.kind !== kind || d.remaining <= 0) continue;
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

function tileOccupiedByBuilding(s: GameState, x: number, y: number): boolean {
  for (const b of s.buildings) {
    if (x >= b.tx && x < b.tx + b.w && y >= b.ty && y < b.ty + b.h) return true;
  }
  return false;
}

// Nearest standable tile adjacent (8-dir) to (tx,ty). Unlike grid's nearestAdjacentFloor,
// this also rejects tiles sitting *under a building*: terrain stays FLOOR beneath a
// building, but the pathfinder blocks those footprints — so picking one as an approach
// goal makes findPath return null and the unit freezes. This bit melee units approaching
// an enemy that hugs a building (the approach tile resolved onto the building itself).
function freeAdjacentTile(s: GameState, tx: number, ty: number, from: Vec2): Vec2 | null {
  let best: Vec2 | null = null;
  let bd = Infinity;
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
    const nx = tx + dx;
    const ny = ty + dy;
    if (!isWalkable(s.grid, nx, ny) || tileOccupiedByBuilding(s, nx, ny)) continue;
    const d = (nx + 0.5 - from.x) ** 2 + (ny + 0.5 - from.y) ** 2;
    if (d < bd) {
      bd = d;
      best = { x: nx, y: ny };
    }
  }
  return best;
}

function approachTileForBuilding(s: GameState, b: Building, from: Vec2): Vec2 | null {
  let best: Vec2 | null = null;
  let bd = Infinity;
  for (let y = b.ty - 1; y <= b.ty + b.h; y++) {
    for (let x = b.tx - 1; x <= b.tx + b.w; x++) {
      const border = x === b.tx - 1 || x === b.tx + b.w || y === b.ty - 1 || y === b.ty + b.h;
      // Must be a free, walkable floor tile (not under another building).
      if (!border || !isWalkable(s.grid, x, y) || tileOccupiedByBuilding(s, x, y)) continue;
      const d = (x + 0.5 - from.x) ** 2 + (y + 0.5 - from.y) ** 2;
      if (d < bd) {
        bd = d;
        best = { x, y };
      }
    }
  }
  return best;
}

// --- combat math ---------------------------------------------------------

function dealDamage(
  s: GameState,
  attackerOwner: PlayerId,
  base: number,
  bonusVsArmored: number,
  bonusVsLight: number,
  applyWeaponUpgrade: boolean,
  target: Unit | Building
) {
  const attrs = entityAttrs(target);
  let dmg = base + (applyWeaponUpgrade ? s.players[attackerOwner].upgrades.groundWeapons : 0);
  if (attrs.includes("armored")) dmg += bonusVsArmored;
  if (attrs.includes("light")) dmg += bonusVsLight;
  let armor = entityArmor(target);
  if (!isBuildingEntity(target)) armor += s.players[target.owner].upgrades.groundArmor;
  dmg = Math.max(0.5, dmg - armor);
  const wasAlive = target.hp > 0;
  if (target.shields > 0) {
    const absorbed = Math.min(target.shields, dmg);
    target.shields -= absorbed;
    dmg -= absorbed;
  }
  if (dmg > 0) target.hp -= dmg;
  target.shieldRegenCd = SHIELD_REGEN_DELAY;
  // Credit the kill the instant this hit drops the target (cleanupDead removes it later).
  if (wasAlive && target.hp <= 0) {
    const st = s.stats[attackerOwner];
    if (st) {
      if (isBuildingEntity(target)) st.buildingsDestroyed++;
      else st.unitsKilled++;
    }
  }
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
    if (dist > 1e-4) u.facing = Math.atan2(dy, dx); // face travel direction (sprite + cone)
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
  u.mineQueue = null;
  u.depositId = null;
  u.gatherProgress = 0;
  u.buildTargetId = null;
  u.targetId = null;
  u.autoTarget = false;
  u.attackGoal = null;
  // stance + facing intentionally persist across orders.
}

function faceToward(u: Unit, x: number, y: number) {
  const dx = x - u.x;
  const dy = y - u.y;
  if (dx !== 0 || dy !== 0) u.facing = Math.atan2(dy, dx);
}

// For an area-mine order: choose this unit's next rock from its queue — the nearest one that
// is still ROCK and reachable right now (has an open adjacent floor tile). Returns null when
// nothing is currently mineable, which peels an area from its edges inward as walls fall.
function pickNextMineTile(s: GameState, u: Unit): Vec2 | null {
  if (!u.mineQueue) return null;
  u.mineQueue = u.mineQueue.filter((q) => getTile(s.grid, q.x, q.y) === TileType.ROCK);
  let best: Vec2 | null = null;
  let bd = Infinity;
  for (const q of u.mineQueue) {
    if (!freeAdjacentTile(s, q.x, q.y, u)) continue; // not mineable yet (walled in)
    const d = (q.x + 0.5 - u.x) ** 2 + (q.y + 0.5 - u.y) ** 2;
    if (d < bd) { bd = d; best = { x: q.x, y: q.y }; }
  }
  u.mineTile = best;
  return best;
}

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

// Auto target acquisition, gated by the unit's stance (docs/combat.md). holdFire never
// acquires; standGround only locks onto enemies already in weapon range (so it defends in
// place without chasing); aggressive sweeps its full sight radius.
function acquireAuto(s: GameState, u: Unit): number | null {
  const stats = UNIT_STATS[u.type];
  if (u.stance === "holdFire") return null;
  if (u.stance === "standGround") {
    let best: number | null = null;
    let bestD = Infinity;
    for (const e of s.units) {
      if (e.owner === u.owner || e.hp <= 0) continue;
      if (!inWeaponRange(u, e, stats.range)) continue;
      const d = Math.hypot(u.x - e.x, u.y - e.y);
      if (d < bestD) { bestD = d; best = e.id; }
    }
    if (best !== null) return best;
    for (const b of s.buildings) {
      if (b.owner === u.owner || b.hp <= 0) continue;
      if (!inWeaponRange(u, b, stats.range)) continue;
      const d = distPointToBuilding(u.x, u.y, b);
      if (d < bestD) { bestD = d; best = b.id; }
    }
    return best;
  }
  return acquireTarget(s, u, stats.sight);
}

function inWeaponRange(u: Unit, e: Unit | Building, range: number): boolean {
  if (distToEntity(u, e) <= range + entityRadius(e)) return true;
  // Units snap to tile centers, so the closest a melee attacker can stand to a
  // stationary target is one tile away — center-distance 1.0 (orthogonal) or ~1.41
  // (diagonal), both beyond a 0.5 melee range. So a melee unit would never connect
  // with an idle enemy. Treat a melee attacker on a tile bordering the target's
  // tile/footprint as in range, matching the discrete movement grid.
  if (range <= 0.6) {
    const ux = Math.floor(u.x);
    const uy = Math.floor(u.y);
    if (isBuildingEntity(e)) {
      return ux >= e.tx - 1 && ux <= e.tx + e.w && uy >= e.ty - 1 && uy <= e.ty + e.h;
    }
    return Math.abs(ux - Math.floor(e.x)) <= 1 && Math.abs(uy - Math.floor(e.y)) <= 1;
  }
  return false;
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
        const t = acquireAuto(s, u);
        if (t !== null) {
          u.targetId = t;
          u.autoTarget = true;
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
      // Attack-move is an explicit aggressive order, so it acquires regardless of stance.
      const t = acquireTarget(s, u, stats.sight);
      if (t !== null) {
        u.targetId = t;
        u.autoTarget = true;
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
      faceToward(u, entityCenter(tgt).x, entityCenter(tgt).y);
      if (inWeaponRange(u, tgt, stats.range)) {
        u.path = null;
        if (u.attackCd <= 0 && stats.damage > 0) {
          dealDamage(s, u.owner, stats.damage, stats.bonusVsArmored, stats.bonusVsLight, true, tgt);
          u.attackCd = stats.cooldown;
          const tc = entityCenter(tgt);
          pushEvent(s, { kind: "hit", x: u.x, y: u.y, ex: tc.x, ey: tc.y });
        }
      } else {
        // Stand Ground: defend in place — never chase an auto-acquired target out of range.
        if (u.stance === "standGround" && u.autoTarget) {
          u.targetId = null;
          u.path = null;
          u.state = u.attackGoal ? "attack_moving" : "idle";
          return;
        }
        const c = entityCenter(tgt);
        const goalTile = isBuildingEntity(tgt)
          ? approachTileForBuilding(s, tgt, u)
          : freeAdjacentTile(s,Math.floor(c.x), Math.floor(c.y), u) ?? { x: Math.floor(c.x), y: Math.floor(c.y) };
        if (u.repathCd <= 0 || u.path === null || u.path.length === 0) {
          const p = goalTile ? findPath(s.grid, s.buildings, u, goalTile) : null;
          u.path = p;
          u.repathCd = 0.4;
          if (!p) {
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
      let t = u.mineTile;
      if (!t || getTile(s.grid, t.x, t.y) !== TileType.ROCK) {
        // Current target gone (cleared/invalid) — pull the next from an area-mine queue.
        t = pickNextMineTile(s, u);
        if (!t) return becomeIdle(u);
      }
      faceToward(u, t.x + 0.5, t.y + 0.5);
      const adj = isAdjacentToTile(u.x, u.y, t.x, t.y);
      const res = approach(s, u, adj, freeAdjacentTile(s, t.x, t.y, u), dt);
      if (res === "blocked") {
        // Can't path to this rock. For an area order, drop it and try the next; else idle.
        if (u.mineQueue) {
          u.mineQueue = u.mineQueue.filter((q) => !(q.x === t!.x && q.y === t!.y));
          u.mineTile = null;
          return;
        }
        return becomeIdle(u);
      }
      if (res !== "arrived") return;
      // Cooperative: every adjacent miner adds its rate to the shared tile progress.
      const key = t.y * s.grid.width + t.x;
      const prog = (s.wallProgress.get(key) ?? 0) + dt / UNIT_STATS[u.type].wallMineTime;
      if (prog >= 1) {
        s.wallProgress.delete(key);
        setTile(s.grid, t.x, t.y, TileType.FLOOR);
        s.players[u.owner].minerals += WALL_CLEAR_MINERAL_BONUS;
        if (s.stats[u.owner]) s.stats[u.owner].mineralsGathered += WALL_CLEAR_MINERAL_BONUS;
        pushEvent(s, { kind: "wallBreak", x: t.x + 0.5, y: t.y + 0.5 });
        u.mineTile = null;
        if (!pickNextMineTile(s, u)) becomeIdle(u); // area order? continue, else done
      } else {
        s.wallProgress.set(key, prog);
      }
      return;
    }
    case "harvesting": {
      let dep = u.depositId !== null ? getDeposit(s, u.depositId) : undefined;
      if (!dep || dep.remaining <= 0) {
        dep = nearestDeposit(s, "mineral", u) ?? undefined;
        if (!dep) return becomeIdle(u);
        u.depositId = dep.id;
        u.path = null;
      }
      faceToward(u, dep.tx + 0.5, dep.ty + 0.5);
      const adj = isAdjacentToTile(u.x, u.y, dep.tx, dep.ty);
      const res = approach(s, u, adj, freeAdjacentTile(s,dep.tx, dep.ty, u), dt);
      if (res === "blocked") return becomeIdle(u);
      if (res !== "arrived") return;
      const gatherTime = dep.kind === "gas" ? GAS_GATHER_TIME_S : MINERAL_GATHER_TIME_S;
      u.gatherProgress += dt;
      if (u.gatherProgress >= gatherTime) {
        const load =
          dep.kind === "gas"
            ? dep.golden ? GOLDEN_GAS_PER_TRIP : GAS_PER_TRIP
            : dep.golden ? GOLDEN_MINERALS_PER_TRIP : MINERALS_PER_TRIP;
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
        const st = s.stats[u.owner];
        if (u.carrying.kind === "gas") {
          p.gas += u.carrying.amount;
          if (st) st.gasGathered += u.carrying.amount;
        } else {
          p.minerals += u.carrying.amount;
          if (st) st.mineralsGathered += u.carrying.amount;
        }
        u.carrying = null;
      }
      u.path = null;
      u.state = "harvesting";
      return;
    }
    case "constructing": {
      const b = u.buildTargetId !== null ? getBuilding(s, u.buildTargetId) : undefined;
      if (!b || b.built) {
        // Building gone or already finished — release this worker (completion frees builders
        // in updateConstruction; this also covers a build that was destroyed mid-construction).
        u.buildTargetId = null;
        becomeIdle(u);
        return;
      }
      const adj = isAdjacentToBuilding(u.x, u.y, b);
      const res = approach(s, u, adj, approachTileForBuilding(s, b, u), dt);
      if (res === "blocked") {
        // This builder can't reach the site. If it's the last builder and nothing's been
        // done yet, refund the misplaced structure; otherwise just free this one worker.
        const others = s.units.some(
          (o) => o !== u && o.buildTargetId === b.id && o.state === "constructing"
        );
        if (!others && !b.started && b.buildProgress === 0) refundBuilding(s, b);
        u.buildTargetId = null;
        becomeIdle(u);
        return;
      }
      if (res !== "arrived") return;
      // Arrived — lock on. The worker is now TIED UP here (can't gather/fight) and contributes
      // build progress every tick; updateConstruction sums all adjacent builders and releases
      // them when the structure completes. It stays put until then (or a new order pulls it).
      u.path = null;
      faceToward(u, b.tx + b.w / 2, b.ty + b.h / 2);
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

// --- shields, construction, production, research, building combat --------

function updateShields(s: GameState, dt: number) {
  for (const u of s.units) {
    u.shieldRegenCd = Math.max(0, u.shieldRegenCd - dt);
    if (u.shieldRegenCd <= 0 && u.shields < u.maxShields) {
      u.shields = Math.min(u.maxShields, u.shields + SHIELD_REGEN_RATE * dt);
    }
  }
  for (const b of s.buildings) {
    if (!b.built) continue;
    b.shieldRegenCd = Math.max(0, b.shieldRegenCd - dt);
    if (b.shieldRegenCd <= 0 && b.shields < b.maxShields) {
      b.shields = Math.min(b.maxShields, b.shields + SHIELD_REGEN_RATE * dt);
    }
  }
}

function updateConstruction(s: GameState, dt: number) {
  for (const b of s.buildings) {
    if (b.built) continue;
    const st = BUILDING_STATS[b.type];
    // Tied-up, cooperative construction: progress only advances while workers are on site,
    // and each adjacent builder adds its own `dt` (so N builders ≈ N× speed, capped).
    let builders = 0;
    for (const u of s.units) {
      if (u.buildTargetId === b.id && u.state === "constructing" && isAdjacentToBuilding(u.x, u.y, b)) {
        builders++;
      }
    }
    if (builders === 0) continue; // no progress with nobody building it
    b.started = true;
    b.buildProgress += dt * Math.min(builders, MAX_BUILDERS);
    b.hp = Math.max(1, Math.round((b.buildProgress / st.buildTime) * b.maxHp));
    if (b.buildProgress >= st.buildTime) {
      b.built = true;
      b.hp = b.maxHp;
      b.shields = b.maxShields;
      if (s.stats[b.owner]) s.stats[b.owner].buildingsConstructed++;
      // Release every builder back to gathering.
      for (const u of s.units) {
        if (u.buildTargetId === b.id && u.state === "constructing") {
          u.buildTargetId = null;
          u.state = "harvesting"; // resume economy (auto-picks the nearest patch)
          u.depositId = null;
          u.path = null;
        }
      }
    }
  }
}

// A deposit (with ore left) sitting on or 8-adjacent to a tile — used to auto-harvest when a
// rally point is dropped on/next to a resource.
function depositNearTile(s: GameState, tile: Vec2): Deposit | null {
  let best: Deposit | null = null;
  let bd = Infinity;
  for (const d of s.deposits) {
    if (d.remaining <= 0) continue;
    const dx = d.tx - tile.x;
    const dy = d.ty - tile.y;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) continue;
    const dist = dx * dx + dy * dy;
    if (dist < bd) { bd = dist; best = d; }
  }
  return best;
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
    shields: st.shields,
    maxShields: st.shields,
    shieldRegenCd: 0,
    state: "idle",
    facing: Math.atan2(tile.y + 0.5 - from.y, tile.x + 0.5 - from.x), // face out of the building
    stance: "aggressive",
    path: null,
    moveGoal: null,
    mineTile: null,
    mineQueue: null,
    depositId: null,
    carrying: null,
    gatherProgress: 0,
    buildTargetId: null,
    targetId: null,
    autoTarget: false,
    attackGoal: null,
    attackCd: 0,
    repathCd: 0,
  };
  s.units.push(u);
  if (s.stats[b.owner]) s.stats[b.owner].unitsProduced++;

  // Rally: send the new unit to the set spawn point. A rally on/next to a mineral or geyser
  // puts workers straight onto it (auto-harvest); otherwise the unit just walks there.
  if (b.rally) {
    const dep = type === "worker" ? depositNearTile(s, b.rally) : null;
    if (dep) {
      u.state = "harvesting";
      u.depositId = dep.id;
      return;
    }
    const p = findPath(s.grid, s.buildings, u, b.rally);
    if (p) {
      u.path = p;
      u.moveGoal = { ...b.rally };
      u.state = "moving";
      return;
    }
  }
  if (type === "worker") u.state = "harvesting"; // no rally → auto-gather the nearest patch
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

function updateResearch(s: GameState, dt: number) {
  for (const b of s.buildings) {
    if (!b.built || b.researchQueue.length === 0) continue;
    const item = b.researchQueue[0];
    const p = s.players[b.owner];
    const level = item.kind === "weapon" ? p.upgrades.groundWeapons : p.upgrades.groundArmor;
    b.researchProgress += dt;
    if (b.researchProgress >= UPGRADES[item.kind][Math.min(level, 2)].time) {
      b.researchProgress = 0;
      b.researchQueue.shift();
      if (item.kind === "weapon") p.upgrades.groundWeapons += 1;
      else p.upgrades.groundArmor += 1;
    }
  }
}

function updateBuildingCombat(s: GameState, dt: number) {
  for (const b of s.buildings) {
    if (!b.built) continue;
    const st = BUILDING_STATS[b.type];
    if (st.damage <= 0) continue;
    b.attackCd = Math.max(0, b.attackCd - dt);
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
      dealDamage(s, b.owner, st.damage, 0, 0, false, target);
      b.attackCd = st.cooldown;
      pushEvent(s, { kind: "hit", x: b.tx + b.w / 2, y: b.ty + b.h / 2, ex: target.x, ey: target.y });
    }
  }
}

function cleanupDead(s: GameState) {
  for (const u of s.units) if (u.hp <= 0 && s.stats[u.owner]) s.stats[u.owner].unitsLost++;
  for (const b of s.buildings) if (b.hp <= 0 && s.stats[b.owner]) s.stats[b.owner].buildingsLost++;
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
    const st = s.stats[p.id];
    if (st && used > st.peakSupply) st.peakSupply = used;
  }
}

function checkWinCondition(s: GameState) {
  for (const p of s.players) {
    if (p.defeated) continue;
    if (!s.buildings.some((b) => b.owner === p.id)) p.defeated = true;
  }
  const alive = s.players.filter((p) => !p.defeated);
  if (alive.length === 1 && s.winner === null) {
    s.winner = alive[0].id;
    if (s.endedTick === null) s.endedTick = s.tick;
  }
}

// --- placement & commands ------------------------------------------------

function rectsOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function hasBuilt(s: GameState, owner: PlayerId, type: BuildingType): boolean {
  return s.buildings.some((b) => b.owner === owner && b.type === type && b.built);
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
  if (st.requires && !hasBuilt(s, owner, st.requires)) return false;
  if (st.needsPower && !isPlacementPowered(s, owner, tx, ty, st.w, st.h)) return false;
  return true;
}

function placeBuilding(s: GameState, owner: PlayerId, type: BuildingType, tx: number, ty: number, worker: Unit | null): Building | null {
  const st = BUILDING_STATS[type];
  const p = s.players[owner];
  if (p.minerals < st.minerals || p.gas < st.gas) return null;
  if (!canPlaceBuilding(s, owner, type, tx, ty)) return null;
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
    shields: 0,
    maxShields: st.shields,
    shieldRegenCd: 0,
    built: false,
    started: false,
    buildProgress: 0,
    queue: [],
    produceProgress: 0,
    rally: null,
    researchQueue: [],
    researchProgress: 0,
    targetId: null,
    attackCd: 0,
  };
  s.buildings.push(b);
  if (worker) assignBuilder(worker, b);
  return b;
}

// Tie a worker to a build site: it heads there and stays building until done.
function assignBuilder(worker: Unit, b: Building) {
  worker.state = "constructing";
  worker.buildTargetId = b.id;
  worker.path = null;
  worker.mineTile = null;
  worker.mineQueue = null;
  worker.depositId = null;
  worker.carrying = null;
  worker.targetId = null;
}

function enqueueTrain(s: GameState, b: Building, type: UnitType): boolean {
  if (!b.built) return false;
  if (!BUILDING_STATS[b.type].produces.includes(type)) return false;
  const st = UNIT_STATS[type];
  if (st.requires && !hasBuilt(s, b.owner, st.requires)) return false;
  const p = s.players[b.owner];
  if (p.minerals < st.minerals || p.gas < st.gas) return false;
  if (p.supplyUsed + st.supply > p.supplyMax) return false;
  p.minerals -= st.minerals;
  p.gas -= st.gas;
  b.queue.push({ unitType: type });
  return true;
}

function enqueueResearch(s: GameState, b: Building, kind: UpgradeKind): boolean {
  if (!b.built || !BUILDING_STATS[b.type].researches) return false;
  const p = s.players[b.owner];
  const level = kind === "weapon" ? p.upgrades.groundWeapons : p.upgrades.groundArmor;
  if (level >= 3) return false;
  if (b.researchQueue.some((r) => r.kind === kind)) return false;
  const cost = UPGRADES[kind][level];
  if (p.minerals < cost.minerals) return false;
  p.minerals -= cost.minerals;
  b.researchQueue.push({ kind });
  return true;
}

function walkableGoal(s: GameState, tx: number, ty: number): Vec2 | null {
  if (isWalkable(s.grid, tx, ty)) return { x: tx, y: ty };
  return freeAdjacentTile(s,tx, ty, { x: tx + 0.5, y: ty + 0.5 });
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
        u.mineQueue = null;
        u.depositId = null;
        u.carrying = null;
        u.gatherProgress = 0;
        u.buildTargetId = null;
        u.targetId = null;
        u.autoTarget = false;
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
        u.autoTarget = false; // explicit order — always chase, regardless of stance
        u.attackGoal = null;
        u.mineTile = null;
        u.mineQueue = null;
        u.depositId = null;
        u.buildTargetId = null;
        u.path = null;
        u.state = "attacking";
      }
      return;
    }
    case "mine": {
      if (getTile(s.grid, cmd.tx, cmd.ty) !== TileType.ROCK) return;
      for (const id of cmd.unitIds) {
        const u = getUnit(s, id);
        if (!u) continue; // any unit can mine walls (combat units faster)
        u.state = "mining_wall";
        u.mineTile = { x: cmd.tx, y: cmd.ty };
        u.mineQueue = null; // single-tile order
        u.depositId = null;
        u.carrying = null;
        u.targetId = null;
        u.buildTargetId = null;
        u.path = null;
      }
      return;
    }
    case "mineArea": {
      // Queue an entire selected region of rock to every chosen worker; each picks the
      // nearest reachable wall and the shared cooperative-mining progress does the rest.
      const tiles = cmd.tiles.filter((t) => getTile(s.grid, t.x, t.y) === TileType.ROCK);
      if (tiles.length === 0) return;
      for (const id of cmd.unitIds) {
        const u = getUnit(s, id);
        if (!u) continue;
        u.state = "mining_wall";
        u.mineQueue = tiles.map((t) => ({ x: t.x, y: t.y }));
        u.mineTile = null; // pickNextMineTile chooses on the first tick
        u.depositId = null;
        u.carrying = null;
        u.targetId = null;
        u.buildTargetId = null;
        u.path = null;
      }
      return;
    }
    case "setStance": {
      for (const id of cmd.unitIds) {
        const u = getUnit(s, id);
        if (u) u.stance = cmd.stance;
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
      const workers = cmd.unitIds
        .map((id) => getUnit(s, id))
        .filter((u): u is Unit => !!u && u.type === "worker");
      if (workers.length === 0) return;
      const b = placeBuilding(s, workers[0].owner, cmd.buildingType, cmd.tx, cmd.ty, workers[0]);
      if (!b) return;
      // Extra selected workers pile on for a faster (co-op) build.
      for (let i = 1; i < workers.length; i++) assignBuilder(workers[i], b);
      return;
    }
    case "assistBuild": {
      // Send more workers to help finish an already-placed building (speeds it up).
      const b = getBuilding(s, cmd.buildingId);
      if (!b || b.built) return;
      for (const id of cmd.unitIds) {
        const u = getUnit(s, id);
        if (u && u.type === "worker") assignBuilder(u, b);
      }
      return;
    }
    case "demolish": {
      // Destroy your own building. Cancelling one still under construction refunds its cost
      // (SC2-style); demolishing a finished one does not. Any tied builders are freed.
      const b = getBuilding(s, cmd.buildingId);
      if (!b) return;
      for (const u of s.units) if (u.buildTargetId === b.id) becomeIdle(u);
      if (!b.built) refundBuilding(s, b);
      else s.buildings = s.buildings.filter((x) => x.id !== b.id);
      return;
    }
    case "train": {
      const b = getBuilding(s, cmd.buildingId);
      if (b) enqueueTrain(s, b, cmd.unitType);
      return;
    }
    case "research": {
      const b = getBuilding(s, cmd.buildingId);
      if (b) enqueueResearch(s, b, cmd.kind);
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

// Would planting `type` at (tx,ty) wall off any floor the AI currently relies on?
// The AI must never seal in its own workers or its digging frontier, so we require:
//   1. the whole footprint sits on the AI's connected floor (`reach`), and
//   2. removing the footprint leaves every other reachable tile still reachable.
// This is what keeps the AI from cramming buildings into 1-wide tunnels.
function aiPlacementOk(s: GameState, type: BuildingType, tx: number, ty: number, reach: Set<number>): boolean {
  const st = BUILDING_STATS[type];
  const W = s.grid.width;
  const footprint = new Set<number>();
  for (let y = ty; y < ty + st.h; y++) {
    for (let x = tx; x < tx + st.w; x++) {
      const i = y * W + x;
      if (!reach.has(i)) return false; // build only on the connected base
      footprint.add(i);
    }
  }
  // Anchor the connectivity test on a reachable tile that isn't part of the footprint.
  let anchor = -1;
  for (const t of reach) {
    if (!footprint.has(t)) {
      anchor = t;
      break;
    }
  }
  if (anchor < 0) return false;
  const newReach = aiReachableFloor(s, { x: anchor % W, y: (anchor / W) | 0 }, footprint);
  for (const t of reach) {
    if (!footprint.has(t) && !newReach.has(t)) return false; // would sever this tile
  }
  return true;
}

function findPlacementNear(
  s: GameState,
  owner: PlayerId,
  type: BuildingType,
  near: Vec2,
  reach: Set<number>,
): Vec2 | null {
  for (let r = 1; r <= 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = Math.floor(near.x) + dx;
        const ty = Math.floor(near.y) + dy;
        if (canPlaceBuilding(s, owner, type, tx, ty) && aiPlacementOk(s, type, tx, ty, reach)) {
          return { x: tx, y: ty };
        }
      }
    }
  }
  return null;
}

// Nearest mineral deposit (with ore left) the AI can't yet reach — i.e. none of its
// floor-adjacent tiles are on the connected base. Diggers head here to open new patches.
function nearestUnreachedMineral(s: GameState, reach: Set<number>, from: Vec2): Deposit | null {
  const W = s.grid.width;
  let best: Deposit | null = null;
  let bd = Infinity;
  for (const d of s.deposits) {
    if (d.kind !== "mineral" || d.remaining <= 0) continue;
    let reached = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = d.tx + dx;
      const ny = d.ty + dy;
      if (isWalkable(s.grid, nx, ny) && reach.has(ny * W + nx)) {
        reached = true;
        break;
      }
    }
    if (reached) continue;
    const dist = (d.tx + 0.5 - from.x) ** 2 + (d.ty + 0.5 - from.y) ** 2;
    if (dist < bd) {
      bd = dist;
      best = d;
    }
  }
  return best;
}

function freeWorker(s: GameState, owner: PlayerId): Unit | null {
  return (
    s.units.find((u) => u.owner === owner && u.type === "worker" && (u.state === "harvesting" || u.state === "idle")) ?? null
  );
}

type BuildResult = "built" | "saving" | "cannot";
// Tries to build `type` near `near`. Returns "saving" when a spot exists but we
// can't afford it yet (caller should stop and accumulate), "cannot" when no
// placement is possible (caller should fall through), "built" on success.
function aiTryBuild(
  s: GameState,
  owner: PlayerId,
  type: BuildingType,
  near: Vec2,
  reach: Set<number>,
): BuildResult {
  const st = BUILDING_STATS[type];
  const p = s.players[owner];
  const spot = findPlacementNear(s, owner, type, near, reach);
  if (!spot) return "cannot";
  if (p.minerals < st.minerals || p.gas < st.gas) return "saving";
  const w = freeWorker(s, owner);
  if (!w) return "saving";
  placeBuilding(s, owner, type, spot.x, spot.y, w);
  return "built";
}

// Floor tiles reachable from `start` for the AI (4-connected, blocked by non-floor
// and by building footprints). Used to find the AI's own digging frontier.
// `extraBlocked` lets callers virtually wall off tiles (e.g. test a building footprint).
function aiReachableFloor(s: GameState, start: Vec2, extraBlocked?: Set<number>): Set<number> {
  const { grid } = s;
  const W = grid.width;
  const seen = new Set<number>();
  const blocked = (x: number, y: number) =>
    !isWalkable(grid, x, y) || tileOccupiedByBuilding(s, x, y) || (!!extraBlocked && extraBlocked.has(y * W + x));
  if (blocked(start.x, start.y)) return seen;
  const q = [start.y * W + start.x];
  seen.add(q[0]);
  while (q.length) {
    const i = q.pop()!;
    const x = i % W;
    const y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(grid, nx, ny)) continue;
      const ni = ny * W + nx;
      if (seen.has(ni) || blocked(nx, ny)) continue;
      seen.add(ni);
      q.push(ni);
    }
  }
  return seen;
}

// The ROCK tile on the AI's frontier (adjacent to its reachable floor) closest to
// `target` — i.e. the next tile to mine to advance a tunnel toward the enemy.
function bestDigTile(s: GameState, reach: Set<number>, target: Vec2, exclude: Set<number>): Vec2 | null {
  const { grid } = s;
  const W = grid.width;
  let best: Vec2 | null = null;
  let bd = Infinity;
  for (const i of reach) {
    const x = i % W;
    const y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(grid, nx, ny) || getTile(grid, nx, ny) !== TileType.ROCK) continue;
      const ni = ny * W + nx;
      if (exclude.has(ni)) continue;
      const d = (nx + 0.5 - target.x) ** 2 + (ny + 0.5 - target.y) ** 2;
      if (d < bd) {
        bd = d;
        best = { x: nx, y: ny };
      }
    }
  }
  return best;
}

// Assign up to `crew` free workers to mine the frontier tiles closest to `target`,
// extending a tunnel that direction. Shared by economy + offensive digging.
function digToward(s: GameState, units: Unit[], start: Vec2, target: Vec2, crew: number) {
  const reach = aiReachableFloor(s, start);
  const W = s.grid.width;
  // Only units standing in the same reachable region can actually get to the frontier.
  const inReach = (u: Unit) => reach.has(Math.floor(u.y) * W + Math.floor(u.x));
  const beingMined = new Set(
    units.filter((u) => u.state === "mining_wall" && u.mineTile).map((u) => u.mineTile!.y * W + u.mineTile!.x)
  );
  const diggers = units.filter((u) => u.state === "mining_wall" && inReach(u)).length;
  for (let i = 0; i < crew - diggers; i++) {
    const tile = bestDigTile(s, reach, target, beingMined);
    if (!tile) break;
    const w = units.find(
      (u) => inReach(u) && (u.state === "harvesting" || u.state === "idle" || u.state === "attack_moving" || u.state === "moving")
    );
    if (!w) break;
    w.state = "mining_wall";
    w.mineTile = { x: tile.x, y: tile.y };
    w.depositId = null;
    w.carrying = null;
    w.targetId = null;
    w.path = null;
    beingMined.add(tile.y * W + tile.x);
  }
}

// Difficulty is decision quality ONLY — no resource/vision/stat bonuses (docs/multiplayer.md).
// Easy: slow cadence, few workers, one Gateway, no tech/micro, big late clumsy push.
// Hard: fast cadence, heavy worker + Gateway count, full tech, gas/Stalkers, focus-fire,
// early continuous pressure. Medium sits between.
interface AIProfile {
  cadence: number; // ticks between macro decisions (16 = 1/s); lower = quicker reactions
  workerCap: number;
  gasWorkers: number;
  gatewayCap: number;
  buildForge: boolean;
  buildCannons: number;
  useStalkers: boolean;
  attackArmy: number; // army size before pushing out
  micro: boolean; // focus-fire the lowest-HP enemy in range
}
const AI_PROFILES: Record<Difficulty, AIProfile> = {
  // Strength is set by army quality/quantity + reaction speed, not bonuses. Crucially the
  // attacker must MASS before committing (small dribbles die against a defended base), so
  // attackArmy rises with difficulty: harder AIs hit later but with an overwhelming force.
  easy: { cadence: 28, workerCap: 11, gasWorkers: 0, gatewayCap: 1, buildForge: false, buildCannons: 0, useStalkers: false, attackArmy: 10, micro: false },
  medium: { cadence: 14, workerCap: 16, gasWorkers: 2, gatewayCap: 2, buildForge: true, buildCannons: 1, useStalkers: true, attackArmy: 13, micro: false },
  hard: { cadence: 8, workerCap: 20, gasWorkers: 4, gatewayCap: 4, buildForge: true, buildCannons: 1, useStalkers: true, attackArmy: 17, micro: true },
};

// Nearest enemy structure to `from` (prefers a Nexus), skipping defeated players. Used to
// pick a target main in free-for-alls — the AI attacks whoever is closest.
function nearestEnemyBuilding(s: GameState, owner: PlayerId, from: Vec2): Building | null {
  const pick = (pred: (b: Building) => boolean): Building | null => {
    let best: Building | null = null;
    let bd = Infinity;
    for (const b of s.buildings) {
      if (b.owner === owner || s.players[b.owner].defeated || !pred(b)) continue;
      const c = buildingCenter(b);
      const d = (c.x - from.x) ** 2 + (c.y - from.y) ** 2;
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  };
  return pick((b) => b.type === "nexus") ?? pick(() => true);
}

// Focus fire: each engaged combat unit retargets the lowest-HP enemy unit in its range,
// so the army kills things faster (and thus takes less return fire). Hard AI only.
function aiMicro(s: GameState, owner: PlayerId) {
  for (const u of s.units) {
    if (u.owner !== owner || u.type === "worker" || u.state !== "attacking") continue;
    const range = UNIT_STATS[u.type].range;
    let best: number | null = null;
    let bestHp = Infinity;
    for (const e of s.units) {
      if (e.owner === owner || e.hp <= 0 || !inWeaponRange(u, e, range)) continue;
      const hp = e.hp + e.shields;
      if (hp < bestHp) {
        bestHp = hp;
        best = e.id;
      }
    }
    if (best !== null && best !== u.targetId) u.targetId = best;
  }
}

function runAI(s: GameState, owner: PlayerId, _dt: number) {
  const p = s.players[owner];
  if (p.defeated) return;
  const prof = AI_PROFILES[p.difficulty ?? "medium"];
  if (prof.micro && s.tick % 2 === 0) aiMicro(s, owner); // responsive focus-fire
  if (s.tick % prof.cadence !== 0) return; // macro on the difficulty's decision cadence

  const myUnits = s.units.filter((u) => u.owner === owner);
  const myBuildings = s.buildings.filter((b) => b.owner === owner);
  const nexus = myBuildings.find((b) => b.type === "nexus" && b.built) ?? myBuildings.find((b) => b.type === "nexus");
  if (!nexus) return;
  const nc = buildingCenter(nexus);

  const workers = myUnits.filter((u) => u.type === "worker");
  const army = myUnits.filter((u) => u.type !== "worker");
  const pylons = myBuildings.filter((b) => b.type === "pylon");
  const builtPylon = pylons.find((b) => b.built);
  const hasPylon = !!builtPylon;
  const buildingPylon = pylons.some((b) => !b.built);
  const pc = builtPylon ? buildingCenter(builtPylon) : nc;
  const gateways = myBuildings.filter((b) => b.type === "gateway");
  const builtGateways = gateways.filter((b) => b.built);
  const cannons = myBuildings.filter((b) => b.type === "cannon");
  const margin = p.supplyMax - p.supplyUsed;
  const gatewayBuilt = builtGateways.length > 0;
  const cyber = myBuildings.find((b) => b.type === "cybernetics");
  const cyberBuilt = !!cyber && cyber.built;
  const forge = myBuildings.find((b) => b.type === "forge");
  const forgeBuilt = !!forge && forge.built;

  // --- Economy (minerals first; cap gas at 2; expand patches; excavate build room). ---
  // Anchor everything at a worker's tile (always on reachable floor) rather than the
  // Nexus border, which can be fully walled off by the AI's own buildings.
  const start: Vec2 | null =
    workers.length > 0
      ? { x: Math.floor(workers[0].x), y: Math.floor(workers[0].y) }
      : approachTileForBuilding(s, nexus, nc);
  // The AI's connected floor — its build space and digging frontier (computed once).
  const reach = start ? aiReachableFloor(s, start) : new Set<number>();
  const isGasWorker = (w: Unit) => {
    const d = w.depositId != null ? getDeposit(s, w.depositId) : undefined;
    return !!d && d.kind === "gas";
  };

  // Reachable mineral patches: those with an adjacent floor tile on the connected base.
  // (4-connected reach ⊆ the pathfinder's 8-connected reach, so these are always pathable.)
  const reachW = s.grid.width;
  const reachAdj = (d: Deposit) => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = d.tx + dx;
      const ny = d.ty + dy;
      if (isWalkable(s.grid, nx, ny) && reach.has(ny * reachW + nx)) return true;
    }
    return false;
  };
  const reachedMin = s.deposits.filter((d) => d.kind === "mineral" && d.remaining > 0 && reachAdj(d));
  const minAssigned = new Map<number, number>();
  for (const w of workers) {
    if (!isGasWorker(w) && w.depositId != null) minAssigned.set(w.depositId, (minAssigned.get(w.depositId) ?? 0) + 1);
  }
  const anyUnreachedMin = nearestUnreachedMineral(s, reach, nc) != null;
  // Nearest reachable patch that still has room (<3 workers) — the SC2 saturation target.
  const pickUndersaturated = (from: Vec2): Deposit | null => {
    let best: Deposit | null = null;
    let bestKey = Infinity;
    for (const d of reachedMin) {
      const sat = minAssigned.get(d.id) ?? 0;
      if (sat >= 3) continue;
      const key = sat * 64 + (d.tx + 0.5 - from.x) ** 2 + (d.ty + 0.5 - from.y) ** 2;
      if (key < bestKey) {
        bestKey = key;
        best = d;
      }
    }
    return best;
  };
  const nearestReached = (from: Vec2): Deposit | null => {
    let best: Deposit | null = null;
    let bd = Infinity;
    for (const d of reachedMin) {
      const dist = (d.tx + 0.5 - from.x) ** 2 + (d.ty + 0.5 - from.y) ** 2;
      if (dist < bd) {
        bd = dist;
        best = d;
      }
    }
    return best;
  };
  // Re-task idle / depleted / stranded / over-saturated workers. We assign a *reachable*
  // patch explicitly (never the generic nearest, which may be unreachable and bounce the
  // worker back to idle). Workers beyond 3-per-patch are freed to dig open a fresh patch.
  for (const w of workers) {
    if (w.state === "mining_wall" || w.state === "constructing" || w.state === "returning_resource") continue;
    if (isGasWorker(w)) continue;
    const dep = w.depositId != null ? getDeposit(s, w.depositId) : undefined;
    const depOk = !!dep && dep.remaining > 0 && reachAdj(dep);
    const sat = depOk ? minAssigned.get(dep!.id) ?? 0 : 0;
    if (w.state === "harvesting" && depOk && sat <= 3) continue; // happily mining, not crowded
    const leave = () => {
      if (w.depositId != null) minAssigned.set(w.depositId, (minAssigned.get(w.depositId) ?? 1) - 1);
    };
    const assign = (d: Deposit) => {
      leave();
      w.depositId = d.id;
      w.state = "harvesting";
      w.path = null;
      minAssigned.set(d.id, (minAssigned.get(d.id) ?? 0) + 1);
    };
    const under = pickUndersaturated(w);
    if (under) {
      assign(under);
    } else if (anyUnreachedMin) {
      leave();
      w.state = "idle"; // all reachable patches full → go dig a fresh one
      w.depositId = null;
    } else {
      const np = nearestReached(w);
      if (np) assign(np); // nowhere to expand → overflow onto the nearest patch
      else {
        leave();
        w.state = "idle";
        w.depositId = null;
      }
    }
  }
  // Gas workers per difficulty (minerals stay the priority; easy skips gas entirely).
  let gasCount = workers.filter(isGasWorker).length;
  for (const w of workers) {
    if (gasCount <= prof.gasWorkers) break;
    if (isGasWorker(w)) {
      w.depositId = null;
      w.state = "harvesting";
      gasCount--;
    }
  }
  const gasDep = nearestDeposit(s, "gas", nc);
  if (gasDep && gasCount < prof.gasWorkers && workers.length >= 8 && start) {
    const adj = freeAdjacentTile(s,gasDep.tx, gasDep.ty, nc);
    const gasReachable = !!adj && findPath(s.grid, s.buildings, { x: start.x + 0.5, y: start.y + 0.5 }, adj) !== null;
    if (gasReachable) {
      const cand = workers.find((w) => w.state === "harvesting" && !isGasWorker(w));
      if (cand) {
        cand.depositId = gasDep.id;
        cand.state = "harvesting";
        cand.path = null;
      }
    }
  }

  // Expansion & build space. An idle worker means its mineral patch is saturated,
  // depleted, or unreachable — so put idle workers to work digging:
  //   • toward the nearest UNREACHED mineral patch (grows the economy), or
  //   • failing that, excavating a compact build room around the Nexus so tech has
  //     somewhere to go (a 4×4 start can't even fit a 2×2 Gateway until we dig).
  // We also keep the room growing once buildings start eating the floor.
  // Build room scales with how much the AI wants to build (each 2×2 needs space + a
  // walkable lane) — but kept modest so digging doesn't starve mining and army.
  const ROOM_TARGET = 24 + prof.gatewayCap * 4 + (prof.buildForge ? 6 : 0);
  const idleWorkers = workers.filter((w) => w.state === "idle");
  if (start && reach.size > 0) {
    const newMin = nearestUnreachedMineral(s, reach, nc);
    if (idleWorkers.length > 0 && newMin) {
      digToward(s, workers, start, { x: newMin.tx + 0.5, y: newMin.ty + 0.5 }, Math.min(3, idleWorkers.length + 1));
    } else if (reach.size < ROOM_TARGET) {
      // Grow the room compactly (frontier nearest the Nexus), pulling a worker or two.
      digToward(s, workers, start, nc, idleWorkers.length > 0 ? Math.min(3, idleWorkers.length) : 2);
    }
  }

  // === Build order. Spend across many actions per cadence, but reserve the next
  //     building's cost so army training never starves the tech that needs it. ===
  // 0. Workers up to the difficulty's cap.
  if (workers.length < prof.workerCap && nexus.built && nexus.queue.length < 1 && margin >= 1) {
    enqueueTrain(s, nexus, "worker");
  }
  // 1. Pylons — for supply AND to extend the power field. Production buildings (Gateway,
  //    Cybernetics, Forge, Cannon) must sit in a power field, so a single pylon quickly
  //    caps how much the AI can build; adding pylons (placed in rings out from the Nexus,
  //    so they reach into the dug room) is what unlocks more production. Without this the
  //    AI banks huge unused resources, stuck on one Gateway.
  const wantsMoreProd =
    gateways.length < prof.gatewayCap ||
    (prof.useStalkers && !cyber) ||
    (prof.buildForge && !forge) ||
    (cannons.length < prof.buildCannons && cyberBuilt);
  const supplyBuffer = prof.gatewayCap >= 3 ? 6 : 3;
  const supplyLow = p.supplyMax < SUPPLY_CAP && margin <= supplyBuffer;
  if (!buildingPylon && (supplyLow || (wantsMoreProd && p.minerals >= 175 && pylons.length < 7))) {
    aiTryBuild(s, owner, "pylon", nc, reach);
  }
  // 2. Next tech / production building; if we can't afford a needed one yet, reserve its
  //    cost so the army budget below leaves the savings alone. Anchored at the Nexus so
  //    rings expand into the excavated room.
  let reserve = 0;
  const tryBuild = (t: BuildingType) => {
    if (aiTryBuild(s, owner, t, nc, reach) === "saving") reserve = Math.max(reserve, BUILDING_STATS[t].minerals);
  };
  if (!hasPylon && !buildingPylon) tryBuild("pylon");
  else if (gateways.length === 0) tryBuild("gateway");
  else {
    // A 2nd Gateway early for army throughput (Zealots are the backbone), then tech.
    if (gateways.length < Math.min(2, prof.gatewayCap)) tryBuild("gateway");
    if (prof.useStalkers && !cyber) tryBuild("cybernetics");
    if (prof.buildForge && !forge) tryBuild("forge");
    if (gateways.length < prof.gatewayCap) tryBuild("gateway"); // ramp production
    if (cannons.length < prof.buildCannons && cyberBuilt) tryBuild("cannon");
  }
  // 3. Forge research, alternating weapons/armor.
  if (forgeBuilt && forge!.researchQueue.length === 0) {
    if (p.upgrades.groundWeapons <= p.upgrades.groundArmor) enqueueResearch(s, forge!, "weapon");
    else enqueueResearch(s, forge!, "armor");
  }
  // 4. Train army from every idle Gateway, keeping the reserve for the next building.
  //    Aim for roughly half Stalkers once the tech + gas allow it.
  for (const gw of builtGateways) {
    if (gw.queue.length >= 2 || margin < 2) continue;
    const stalkers = army.filter((u) => u.type === "stalker").length;
    const wantStalker =
      prof.useStalkers && cyberBuilt && p.gas >= 50 && p.minerals >= 125 + reserve && stalkers * 2 < army.length;
    if (wantStalker) enqueueTrain(s, gw, "stalker");
    else if (p.minerals >= 100 + reserve) enqueueTrain(s, gw, "zealot");
  }
  // 5. Defend first, then attack.
  // Defense: if any live enemy is near one of our buildings, recall the army to fight it
  // off (attack-move onto the threatened spot — units auto-acquire the raiders). This
  // stops the AI losing its base to a counter while its army is away. Units already
  // locked in melee/fire ("attacking") keep fighting wherever they are.
  let threat: Vec2 | null = null;
  for (const b of myBuildings) {
    const hit = s.units.some(
      (e) => e.owner !== owner && e.hp > 0 && !s.players[e.owner].defeated && distPointToBuilding(e.x, e.y, b) < 11
    );
    if (hit) {
      threat = buildingCenter(b);
      break;
    }
  }
  if (threat) {
    const g = { x: Math.floor(threat.x), y: Math.floor(threat.y) };
    for (const u of army) {
      if (u.state !== "attacking") {
        u.attackGoal = g;
        u.path = null;
        u.targetId = null;
        u.state = "attack_moving";
      }
    }
  } else if (start && army.length >= prof.attackArmy) {
    // Push out: tunnel toward the nearest enemy main if not yet connected, else feed
    // idle fighters in to attack-move.
    const enemyMain = nearestEnemyBuilding(s, owner, nc);
    if (enemyMain) {
      const goal = approachTileForBuilding(s, enemyMain, buildingCenter(enemyMain));
      const connected = !!goal && findPath(s.grid, s.buildings, { x: start.x + 0.5, y: start.y + 0.5 }, goal) !== null;
      if (!connected) {
        digToward(s, army.concat(workers), start, buildingCenter(enemyMain), army.length >= 8 ? 5 : 3);
      } else if (goal) {
        const g = { x: Math.floor(goal.x), y: Math.floor(goal.y) };
        for (const u of army) {
          if (u.state === "idle") {
            u.attackGoal = g;
            u.path = null;
            u.targetId = null;
            u.state = "attack_moving";
          }
        }
      }
    }
  }
}

// --- collision -----------------------------------------------------------

// Per-state collision radius (docs/combat.md): workers are tiny (mining crews pass through),
// fighters shrink to ~half a tile (slip past in a 1-wide tunnel), other combat units space out.
function collisionRadius(u: Unit): number {
  if (u.type === "worker") return COLLISION_RADIUS.worker;
  if (u.state === "attacking" || u.state === "attack_moving") return COLLISION_RADIUS.fighting;
  return COLLISION_RADIUS.combat;
}

// A unit's center may only sit on walkable floor that isn't under a building (hard collision).
function posWalkable(s: GameState, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  return isWalkable(s.grid, tx, ty) && !tileOccupiedByBuilding(s, tx, ty);
}

// Apply a separation nudge per-axis, rejecting any component that would cross into a wall or a
// building footprint — so units slide along solid edges instead of phasing through them.
function nudge(s: GameState, u: Unit, dx: number, dy: number) {
  if (dx !== 0 && posWalkable(s, u.x + dx, u.y)) u.x += dx;
  if (dy !== 0 && posWalkable(s, u.x, u.y + dy)) u.y += dy;
}

// Soft unit-vs-unit separation: overlapping pairs push apart (half each), clamped to floor.
// One relaxation pass per tick is enough — crowds settle over a few ticks.
function resolveCollisions(s: GameState) {
  const us = s.units;
  for (let i = 0; i < us.length; i++) {
    const a = us[i];
    const ra = collisionRadius(a);
    for (let j = i + 1; j < us.length; j++) {
      const b = us[j];
      const minD = ra + collisionRadius(b);
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 >= minD * minD) continue;
      if (d2 < 1e-6) {
        // Exactly stacked — separate deterministically (stable across clients).
        dx = a.id < b.id ? 0.01 : -0.01;
        dy = 0;
        d2 = dx * dx + dy * dy;
      }
      const d = Math.sqrt(d2);
      const push = (minD - d) * 0.5;
      const nx = (dx / d) * push;
      const ny = (dy / d) * push;
      nudge(s, a, -nx, -ny);
      nudge(s, b, nx, ny);
    }
  }
}

// --- public API ----------------------------------------------------------

export function step(s: GameState, dt: number): void {
  for (const u of s.units) updateUnit(s, u, dt);
  resolveCollisions(s);
  updateConstruction(s, dt);
  updateProduction(s, dt);
  updateResearch(s, dt);
  updateBuildingCombat(s, dt);
  updateShields(s, dt);
  cleanupDead(s);
  recomputeSupply(s);
  if (s.tick % 4 === 0) computeVisibility(s, 0, s.visibility);
  checkWinCondition(s);
  for (const p of s.players) if (p.isAI && !p.defeated) runAI(s, p.id, dt);
  s.tick++;
}
