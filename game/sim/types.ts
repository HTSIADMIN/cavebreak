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

export interface PlayerUpgrades {
  groundWeapons: number; // 0..3
  groundArmor: number; // 0..3
}

// AI strength tiers. Difficulty comes ENTIRELY from decision quality (build order,
// expansion, army size/comp, upgrades, micro, decision cadence) — never from resource,
// vision, or stat bonuses (docs/multiplayer.md).
export type Difficulty = "easy" | "medium" | "hard";

export interface Player {
  id: PlayerId;
  color: string;
  isAI: boolean;
  difficulty?: Difficulty; // set for AI players only
  minerals: number;
  gas: number;
  supplyUsed: number;
  supplyMax: number;
  defeated: boolean;
  upgrades: PlayerUpgrades;
}

// Chosen on the pre-game setup screen and passed to createInitialState.
export interface MatchSetup {
  mapId: string;
  aiDifficulties: Difficulty[]; // one entry per AI opponent; seats 1..N
  seed?: number;
}

export type ResourceKind = "mineral" | "gas";

export interface Deposit {
  id: number;
  kind: ResourceKind;
  tx: number;
  ty: number;
  remaining: number;
  golden: boolean; // high-yield node (bigger payload + larger per-trip load)
}

// Transient events emitted by the sim for the view to animate (drained each frame).
export interface GameEvent {
  kind: "wallBreak" | "hit";
  x: number;
  y: number;
  ex?: number; // for "hit": target point (draws an impact line)
  ey?: number;
}

// Combat attributes drive bonus-damage counters (docs/combat.md).
export type Attribute = "light" | "armored" | "biological" | "mechanical";

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
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shields: number;
  maxShields: number;
  shieldRegenCd: number; // seconds until shields start regenerating again
  state: UnitState;

  path: Vec2[] | null;
  moveGoal: Vec2 | null;

  mineTile: Vec2 | null;

  depositId: number | null;
  carrying: { kind: ResourceKind; amount: number } | null;
  gatherProgress: number;

  buildTargetId: number | null;

  targetId: number | null;
  attackGoal: Vec2 | null;
  attackCd: number;
  repathCd: number;
}

export type BuildingType = "nexus" | "pylon" | "gateway" | "cybernetics" | "forge" | "cannon";

export interface ProductionItem {
  unitType: UnitType;
}

export type UpgradeKind = "weapon" | "armor";

export interface ResearchItem {
  kind: UpgradeKind;
}

export interface Building {
  id: number;
  owner: PlayerId;
  type: BuildingType;
  tx: number;
  ty: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  shields: number;
  maxShields: number;
  shieldRegenCd: number;
  built: boolean;
  started: boolean;
  buildProgress: number;

  queue: ProductionItem[];
  produceProgress: number;
  rally: Vec2 | null;

  researchQueue: ResearchItem[];
  researchProgress: number;

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
  visibility: Uint8Array;
  // Transient per-step events for the view to animate; the view drains them each frame.
  events: GameEvent[];
  // Shared wall-mining progress keyed by tile index (y*w+x), 0..1. Every adjacent
  // miner contributes its rate, so multiple units break a wall faster.
  wallProgress: Map<number, number>;
}

export type Command =
  | { type: "move"; unitIds: number[]; tx: number; ty: number }
  | { type: "attackMove"; unitIds: number[]; tx: number; ty: number }
  | { type: "attack"; unitIds: number[]; targetId: number }
  | { type: "mine"; unitIds: number[]; tx: number; ty: number }
  | { type: "harvest"; unitIds: number[]; depositId: number }
  | { type: "stop"; unitIds: number[] }
  | { type: "build"; unitIds: number[]; buildingType: BuildingType; tx: number; ty: number }
  | { type: "train"; buildingId: number; unitType: UnitType }
  | { type: "research"; buildingId: number; kind: UpgradeKind }
  | { type: "setRally"; buildingId: number; tx: number; ty: number };
