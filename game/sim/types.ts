// Core sim data types. Pure data — no React/DOM. See docs/ for the design behind each.

export enum TileType {
  ROCK = 0, // mineable; blocks movement + vision (docs/map-terrain.md)
  FLOOR = 1, // cleared cave space; walkable, see-through
  BOUNDARY = 2, // unmineable world edge
  MINERAL = 3, // mineral deposit embedded in rock
  GEYSER = 4, // gas source
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Grid {
  width: number;
  height: number;
  tiles: Uint8Array; // TileType per cell, indexed y * width + x
}

export type PlayerId = number;

export interface Player {
  id: PlayerId;
  color: string;
  isAI: boolean;
  minerals: number;
  gas: number;
  supplyUsed: number;
  supplyMax: number;
  defeated: boolean;
}

export type ResourceKind = "mineral" | "gas";

export interface Deposit {
  id: number;
  kind: ResourceKind;
  tx: number; // tile coords (integer)
  ty: number;
  remaining: number;
}

// Protoss-style roster (docs/units.md). Internal type keys; UI labels live in the view.
export type UnitType = "worker" | "zealot" | "stalker";

export type UnitState =
  | "idle"
  | "moving"
  | "mining_wall"
  | "harvesting"
  | "returning_resource"
  | "constructing"
  | "attacking"
  | "attack_moving";

export interface Unit {
  id: number;
  owner: PlayerId;
  type: UnitType;
  x: number; // continuous position in tile units (tile center = integer + 0.5)
  y: number;
  hp: number;
  maxHp: number;
  state: UnitState;

  // movement
  path: Vec2[] | null; // remaining waypoints, tile centers
  moveGoal: Vec2 | null;

  // wall mining
  mineTile: Vec2 | null;
  mineProgress: number;

  // resource harvesting
  depositId: number | null;
  carrying: { kind: ResourceKind; amount: number } | null;
  gatherProgress: number;

  // construction (worker initiates a building's warp-in)
  buildTargetId: number | null;

  // combat
  targetId: number | null; // unit or building being attacked
  attackGoal: Vec2 | null; // attack-move destination
  attackCd: number; // seconds until next attack is ready
  repathCd: number; // throttles A* recompute while chasing a moving target
}

export type BuildingType = "nexus" | "pylon" | "gateway" | "cannon";

export interface ProductionItem {
  unitType: UnitType;
}

export interface Building {
  id: number;
  owner: PlayerId;
  type: BuildingType;
  tx: number; // top-left tile of footprint
  ty: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  built: boolean;
  started: boolean; // a worker has initiated the warp-in; it self-completes after
  buildProgress: number; // seconds of warp-in accumulated

  // production
  queue: ProductionItem[];
  produceProgress: number;
  rally: Vec2 | null;

  // static defense (cannon)
  targetId: number | null;
  attackCd: number;
}

export interface GameState {
  tick: number;
  grid: Grid;
  players: Player[];
  units: Unit[];
  buildings: Building[];
  deposits: Deposit[];
  nextId: number;
  winner: PlayerId | null;
  // Local player's (player 0) visibility for rendering: 0 hidden, 1 explored, 2 visible.
  // Single-player shortcut; becomes per-player server state under multiplayer.
  visibility: Uint8Array;
}

// Player intents. Clients emit these; the (local or remote) sim applies them.
export type Command =
  | { type: "move"; unitIds: number[]; tx: number; ty: number }
  | { type: "attackMove"; unitIds: number[]; tx: number; ty: number }
  | { type: "attack"; unitIds: number[]; targetId: number }
  | { type: "mine"; unitIds: number[]; tx: number; ty: number }
  | { type: "harvest"; unitIds: number[]; depositId: number }
  | { type: "stop"; unitIds: number[] }
  | { type: "build"; unitIds: number[]; buildingType: BuildingType; tx: number; ty: number }
  | { type: "train"; buildingId: number; unitType: UnitType }
  | { type: "setRally"; buildingId: number; tx: number; ty: number };
