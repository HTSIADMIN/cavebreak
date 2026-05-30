import { BUILDING_STATS, MAP_H, MAP_W, UNIT_STATS } from "./constants";
import { createGrid, setTile } from "./grid";
import { DEFAULT_MAP_ID, MapDef, MapGenCtx, MAPS, mulberry32, StartPlan } from "./maps";
import { Building, Deposit, Difficulty, GameState, MatchSetup, Player, TileType, Unit, Vec2 } from "./types";

// Seat colors: player 0 (human) is blue; AI seats get red / green / gold.
const COLORS = ["#4aa3ff", "#ff5a4a", "#46d17f", "#e0b341"];

// Builds a fresh match. `setup` chooses the map and the AI opponents (one difficulty per
// opponent, seats 1..N). Defaults to a 1v1 Medium game on Cavern Duel — the old behavior.
export function createInitialState(setup?: Partial<MatchSetup>): GameState {
  const mapDef: MapDef = (setup?.mapId && MAPS[setup.mapId]) || MAPS[DEFAULT_MAP_ID];
  const aiDifficulties: Difficulty[] = (setup?.aiDifficulties ?? ["medium"]).slice(0, mapDef.maxPlayers - 1);
  const numPlayers = Math.min(mapDef.maxPlayers, 1 + aiDifficulties.length);
  const seed = setup?.seed ?? 1337;

  const grid = createGrid(MAP_W, MAP_H);
  // Outer border + the map's silhouette (e.g. a circular rim) are unmineable BOUNDARY.
  for (let x = 0; x < MAP_W; x++) {
    setTile(grid, x, 0, TileType.BOUNDARY);
    setTile(grid, x, MAP_H - 1, TileType.BOUNDARY);
  }
  for (let y = 0; y < MAP_H; y++) {
    setTile(grid, 0, y, TileType.BOUNDARY);
    setTile(grid, MAP_W - 1, y, TileType.BOUNDARY);
  }
  if (mapDef.shapeMask) {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (mapDef.shapeMask(x, y)) setTile(grid, x, y, TileType.BOUNDARY);
      }
    }
  }

  const players: Player[] = [];
  const units: Unit[] = [];
  const buildings: Building[] = [];
  const deposits: Deposit[] = [];
  let nextId = 1;
  const allocId = () => nextId++;

  const activeStarts: StartPlan[] = mapDef.starts.slice(0, numPlayers);
  const centers: Vec2[] = [];

  activeStarts.forEach((plan, owner) => {
    for (const f of plan.floors) setTile(grid, f.x, f.y, TileType.FLOOR);

    const ns = BUILDING_STATS.nexus;
    buildings.push({
      id: allocId(), owner, type: "nexus",
      tx: plan.nexusTopLeft.x, ty: plan.nexusTopLeft.y, w: ns.w, h: ns.h,
      hp: ns.hp, maxHp: ns.hp, shields: ns.shields, maxShields: ns.shields, shieldRegenCd: 0,
      built: true, started: true, buildProgress: ns.buildTime,
      queue: [], produceProgress: 0, rally: null, researchQueue: [], researchProgress: 0,
      targetId: null, attackCd: 0,
    });
    centers.push({ x: plan.nexusTopLeft.x + ns.w / 2, y: plan.nexusTopLeft.y + ns.h / 2 });

    for (const w of plan.workers) {
      const ws = UNIT_STATS.worker;
      units.push({
        id: allocId(), owner, type: "worker",
        x: w.x + 0.5, y: w.y + 0.5,
        hp: ws.hp, maxHp: ws.hp, shields: ws.shields, maxShields: ws.shields, shieldRegenCd: 0,
        state: "idle", // nothing reachable yet — mine out to find resources
        facing: -Math.PI / 2, stance: "aggressive",
        path: null, moveGoal: null, mineTile: null, mineQueue: null, depositId: null, carrying: null, gatherProgress: 0,
        buildTargetId: null, targetId: null, autoTarget: false, attackGoal: null, attackCd: 0, repathCd: 0,
      });
    }

    const isAI = owner !== 0;
    players.push({
      id: owner,
      color: COLORS[owner % COLORS.length],
      isAI,
      difficulty: isAI ? aiDifficulties[owner - 1] ?? "medium" : undefined,
      minerals: 50, gas: 0, supplyUsed: plan.workers.length, supplyMax: ns.supply, defeated: false,
      upgrades: { groundWeapons: 0, groundArmor: 0 },
    });
  });

  // Findable resources + connecting corridors (map-specific, symmetric, seeded).
  const rng = mulberry32(seed);
  const ctx: MapGenCtx = { grid, deposits, rng, starts: activeStarts, centers, allocId };
  mapDef.placeResources(ctx);
  mapDef.carve(ctx);

  // Per-player stat tallies seed with the starting state (their initial workers + Nexus).
  const stats = players.map((p) => {
    const startWorkers = units.filter((u) => u.owner === p.id).length;
    return {
      unitsProduced: startWorkers, unitsLost: 0, unitsKilled: 0,
      buildingsConstructed: 1, buildingsLost: 0, buildingsDestroyed: 0,
      mineralsGathered: 0, gasGathered: 0, peakSupply: p.supplyUsed,
    };
  });

  return {
    tick: 0, grid, players, units, buildings, deposits, nextId,
    winner: null, stats, endedTick: null,
    visibility: new Uint8Array(MAP_W * MAP_H), events: [], wallProgress: new Map(),
  };
}
