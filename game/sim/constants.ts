// Single tuning surface — mirrors docs/balance-data.md.
// Protoss-style faction (Pylons + power field, plasma shields). Values adapted from SC2 LotV.

import { Attribute, BuildingType, UnitType } from "./types";

// --- Simulation ---
export const TICK_RATE_HZ = 16;
export const DT = 1 / TICK_RATE_HZ;

// --- Render ---
export const TILE_SIZE_PX = 32;

// --- Resources & economy ---
export const MINERALS_PER_TRIP = 5;
export const GAS_PER_TRIP = 4;
export const MINERAL_DEPOSIT_TOTAL = 1500;
export const GAS_GEYSER_TOTAL = 2250;
export const SUPPLY_CAP = 200;
export const MINERAL_GATHER_TIME_S = 2.0;
export const GAS_GATHER_TIME_S = 2.0;

// --- Cave-specific ---
export const WALL_MINE_TIME_S = 30;
export const WALL_CLEAR_MINERAL_BONUS = 5;
export const STARTING_WORKERS = 6;

// --- Map ---
export const MAP_W = 64;
export const MAP_H = 64;
export const START_POCKET_RADIUS = 3;

// --- Power & shields ---
export const POWER_RADIUS = 6.5;
export const SHIELD_REGEN_DELAY = 5; // seconds after taking damage before shields regen
export const SHIELD_REGEN_RATE = 2; // shields per second

// --- Ground upgrades (Forge) ---
// Index = current level (0,1,2) → researching the next level (1,2,3).
export const UPGRADES: Record<"weapon" | "armor", { minerals: number; time: number }[]> = {
  weapon: [
    { minerals: 100, time: 30 },
    { minerals: 150, time: 45 },
    { minerals: 200, time: 60 },
  ],
  armor: [
    { minerals: 100, time: 30 },
    { minerals: 150, time: 45 },
    { minerals: 200, time: 60 },
  ],
};

export interface UnitStats {
  label: string;
  minerals: number;
  gas: number;
  supply: number;
  hp: number;
  shields: number;
  armor: number;
  attributes: Attribute[];
  buildTime: number;
  speed: number;
  sight: number;
  damage: number;
  range: number; // <= 0.6 is melee
  cooldown: number;
  bonusVsArmored: number;
  bonusVsLight: number;
  producedBy: BuildingType;
  requires: BuildingType | null; // extra tech building needed to train
}

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  worker: {
    label: "Worker", minerals: 50, gas: 0, supply: 1,
    hp: 20, shields: 20, armor: 0, attributes: ["light", "mechanical"],
    buildTime: 12, speed: 3.0, sight: 8,
    damage: 5, range: 0.5, cooldown: 1.5, bonusVsArmored: 0, bonusVsLight: 0,
    producedBy: "nexus", requires: null,
  },
  zealot: {
    label: "Zealot", minerals: 100, gas: 0, supply: 2,
    hp: 100, shields: 50, armor: 1, attributes: ["light", "biological"],
    buildTime: 27, speed: 3.15, sight: 9,
    damage: 16, range: 0.5, cooldown: 1.2, bonusVsArmored: 0, bonusVsLight: 0,
    producedBy: "gateway", requires: null,
  },
  stalker: {
    label: "Stalker", minerals: 125, gas: 50, supply: 2,
    hp: 80, shields: 80, armor: 1, attributes: ["armored", "mechanical"],
    buildTime: 32, speed: 4.0, sight: 10,
    damage: 13, range: 6, cooldown: 1.4, bonusVsArmored: 5, bonusVsLight: 0,
    producedBy: "gateway", requires: "cybernetics",
  },
};

export interface BuildingStats {
  label: string;
  minerals: number;
  gas: number;
  hp: number;
  shields: number;
  armor: number;
  attributes: Attribute[];
  buildTime: number;
  w: number;
  h: number;
  supply: number;
  needsPower: boolean;
  providesPower: boolean;
  researches: boolean;
  requires: BuildingType | null;
  sight: number;
  produces: UnitType[];
  damage: number;
  range: number;
  cooldown: number;
}

const STRUCTURE_ATTRS: Attribute[] = ["armored", "mechanical"];

export const BUILDING_STATS: Record<BuildingType, BuildingStats> = {
  nexus: {
    label: "Nexus", minerals: 400, gas: 0, hp: 1000, shields: 1000, armor: 1, attributes: STRUCTURE_ATTRS,
    buildTime: 60, w: 2, h: 2, supply: 15, needsPower: false, providesPower: false, researches: false,
    requires: null, sight: 11, produces: ["worker"], damage: 0, range: 0, cooldown: 0,
  },
  pylon: {
    label: "Pylon", minerals: 100, gas: 0, hp: 200, shields: 200, armor: 1, attributes: STRUCTURE_ATTRS,
    buildTime: 18, w: 1, h: 1, supply: 8, needsPower: false, providesPower: true, researches: false,
    requires: null, sight: 9, produces: [], damage: 0, range: 0, cooldown: 0,
  },
  gateway: {
    label: "Gateway", minerals: 150, gas: 0, hp: 500, shields: 500, armor: 1, attributes: STRUCTURE_ATTRS,
    buildTime: 30, w: 2, h: 2, supply: 0, needsPower: true, providesPower: false, researches: false,
    requires: null, sight: 9, produces: ["zealot", "stalker"], damage: 0, range: 0, cooldown: 0,
  },
  cybernetics: {
    label: "Cybernetics Core", minerals: 150, gas: 0, hp: 500, shields: 500, armor: 1, attributes: STRUCTURE_ATTRS,
    buildTime: 36, w: 2, h: 2, supply: 0, needsPower: true, providesPower: false, researches: false,
    requires: "gateway", sight: 9, produces: [], damage: 0, range: 0, cooldown: 0,
  },
  forge: {
    label: "Forge", minerals: 150, gas: 0, hp: 400, shields: 400, armor: 1, attributes: STRUCTURE_ATTRS,
    buildTime: 32, w: 2, h: 2, supply: 0, needsPower: true, providesPower: false, researches: true,
    requires: null, sight: 9, produces: [], damage: 0, range: 0, cooldown: 0,
  },
  cannon: {
    label: "Photon Cannon", minerals: 150, gas: 0, hp: 150, shields: 150, armor: 1, attributes: STRUCTURE_ATTRS,
    buildTime: 25, w: 1, h: 1, supply: 0, needsPower: true, providesPower: false, researches: false,
    requires: null, sight: 11, produces: [], damage: 20, range: 7, cooldown: 1.25,
  },
};
