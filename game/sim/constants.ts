// Single tuning surface — mirrors docs/balance-data.md.
// Protoss-style faction (Pylons + power field). Values adapted from SC2 LotV;
// since we don't model shields yet, unit HP folds shields into HP.

import { BuildingType, UnitType } from "./types";

// --- Simulation ---
export const TICK_RATE_HZ = 16; // 10–20 Hz (docs/multiplayer.md)
export const DT = 1 / TICK_RATE_HZ;

// --- Render (cosmetic) ---
export const TILE_SIZE_PX = 32;

// --- Resources & economy (SC2 values) ---
export const MINERALS_PER_TRIP = 5;
export const GAS_PER_TRIP = 4;
export const MINERAL_DEPOSIT_TOTAL = 1500;
export const GAS_GEYSER_TOTAL = 2250;
export const SUPPLY_CAP = 200;
export const MINERAL_GATHER_TIME_S = 2.0;
export const GAS_GATHER_TIME_S = 2.0;

// --- Cave-specific (tune freely) ---
export const WALL_MINE_TIME_S = 30; // per ROCK tile; core pacing lever (docs/mining.md)
export const WALL_CLEAR_MINERAL_BONUS = 5;
export const STARTING_WORKERS = 6;

// --- Map ---
export const MAP_W = 64;
export const MAP_H = 64;
// Starting cleared pocket half-extent from the nexus area. Tightened by one tile.
export const START_POCKET_RADIUS = 3; // was 4 (a 9x9 pocket) → now a 7x7 pocket

// --- Power (Pylon field) ---
export const POWER_RADIUS = 6.5; // tiles, SC2 Pylon

export interface UnitStats {
  label: string;
  minerals: number;
  gas: number;
  supply: number;
  hp: number;
  buildTime: number; // seconds
  speed: number; // tiles/second
  sight: number; // tiles
  damage: number;
  range: number; // tiles; <= 0.6 is melee
  cooldown: number; // seconds between attacks (0 = non-combatant baseline)
  producedBy: BuildingType;
}

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  worker: {
    label: "Worker",
    minerals: 50, gas: 0, supply: 1,
    hp: 40, buildTime: 12, speed: 3.0, sight: 8,
    damage: 5, range: 0.5, cooldown: 1.5,
    producedBy: "nexus",
  },
  zealot: {
    label: "Zealot",
    minerals: 100, gas: 0, supply: 2,
    hp: 150, buildTime: 27, speed: 3.15, sight: 9,
    damage: 16, range: 0.5, cooldown: 1.2,
    producedBy: "gateway",
  },
  stalker: {
    label: "Stalker",
    minerals: 125, gas: 50, supply: 2,
    hp: 160, buildTime: 32, speed: 4.0, sight: 10,
    damage: 13, range: 6, cooldown: 1.4,
    producedBy: "gateway",
  },
};

export interface BuildingStats {
  label: string;
  minerals: number;
  gas: number;
  hp: number;
  buildTime: number; // seconds
  w: number;
  h: number;
  supply: number; // supply provided
  needsPower: boolean;
  providesPower: boolean;
  sight: number;
  produces: UnitType[];
  // static defense (cannon)
  damage: number;
  range: number;
  cooldown: number;
}

export const BUILDING_STATS: Record<BuildingType, BuildingStats> = {
  nexus: {
    label: "Nexus",
    minerals: 400, gas: 0, hp: 2000, buildTime: 60, w: 2, h: 2,
    supply: 15, needsPower: false, providesPower: false, sight: 11,
    produces: ["worker"], damage: 0, range: 0, cooldown: 0,
  },
  pylon: {
    label: "Pylon",
    minerals: 100, gas: 0, hp: 300, buildTime: 18, w: 1, h: 1,
    supply: 8, needsPower: false, providesPower: true, sight: 9,
    produces: [], damage: 0, range: 0, cooldown: 0,
  },
  gateway: {
    label: "Gateway",
    minerals: 150, gas: 0, hp: 500, buildTime: 30, w: 2, h: 2,
    supply: 0, needsPower: true, providesPower: false, sight: 9,
    produces: ["zealot", "stalker"], damage: 0, range: 0, cooldown: 0,
  },
  cannon: {
    label: "Photon Cannon",
    minerals: 150, gas: 0, hp: 300, buildTime: 25, w: 1, h: 1,
    supply: 0, needsPower: true, providesPower: false, sight: 11,
    produces: [], damage: 20, range: 7, cooldown: 1.25,
  },
};
