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
  minerals: number;
  gas: number;
  supplyUsed: number;
  supplyMax: number;
}

export type ResourceKind = "mineral" | "gas";

export interface Deposit {
  id: number;
  kind: ResourceKind;
  tx: number; // tile coords (integer)
  ty: number;
  remaining: number;
}

// Worker state machine (docs/mining.md, docs/units.md).
export type WorkerState =
  | "idle"
  | "moving"
  | "mining_wall"
  | "harvesting"
  | "returning_resource"
  | "constructing";

export interface Unit {
  id: number;
  owner: PlayerId;
  type: "worker";
  x: number; // continuous position in tile units (tile center = integer + 0.5)
  y: number;
  hp: number;
  state: WorkerState;

  // movement
  path: Vec2[] | null; // remaining waypoints, tile centers
  moveGoal: Vec2 | null; // destination tile for a plain move order

  // wall mining
  mineTile: Vec2 | null; // ROCK tile being cleared
  mineProgress: number; // seconds accumulated

  // resource harvesting
  depositId: number | null; // deposit currently assigned
  carrying: { kind: ResourceKind; amount: number } | null;
  gatherProgress: number; // seconds accumulated at the deposit
}

export type BuildingType = "base";

export interface ProductionItem {
  kind: "worker";
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
  queue: ProductionItem[];
  produceProgress: number; // seconds into the current queue item
  rally: Vec2 | null;
}

export interface GameState {
  tick: number;
  grid: Grid;
  players: Player[];
  units: Unit[];
  buildings: Building[];
  deposits: Deposit[];
  nextId: number;
}

// Player intents. Clients emit these; the (local or remote) sim applies them.
export type Command =
  | { type: "move"; unitIds: number[]; tx: number; ty: number }
  | { type: "attackMove"; unitIds: number[]; tx: number; ty: number }
  | { type: "mine"; unitIds: number[]; tx: number; ty: number }
  | { type: "harvest"; unitIds: number[]; depositId: number }
  | { type: "stop"; unitIds: number[] }
  | { type: "buildWorker"; baseId: number }
  | { type: "setRally"; baseId: number; tx: number; ty: number };
