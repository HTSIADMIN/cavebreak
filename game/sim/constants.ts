// Single tuning surface — mirrors docs/balance-data.md.
// SC2 reference values are copied as defaults; cave-specific values are tuned here.
// Sim code must read from this module rather than hardcoding stats inline.

// --- Simulation ---
export const TICK_RATE_HZ = 16; // 10–20 Hz (docs/multiplayer.md)
export const DT = 1 / TICK_RATE_HZ; // seconds per sim tick

// --- Render (cosmetic) ---
export const TILE_SIZE_PX = 32;

// --- Resources & economy (SC2 values) ---
export const MINERALS_PER_TRIP = 5;
export const GAS_PER_TRIP = 4;
export const SATURATION_PER_MINERAL = 3;
export const SATURATION_PER_GEYSER = 3;
export const MINERAL_DEPOSIT_TOTAL = 1500;
export const GAS_GEYSER_TOTAL = 2250;
export const SUPPLY_PER_SUPPLY_STRUCTURE = 8;
export const SUPPLY_PER_BASE = 15;
export const SUPPLY_CAP = 200;

// --- Worker (SC2 SCV) ---
export const WORKER_COST_MINERALS = 50;
export const WORKER_SUPPLY = 1;
export const WORKER_HP = 45;
export const WORKER_BUILD_TIME_S = 12;
export const WORKER_SIGHT = 8; // tiles (for fog of war, later)

// Movement speed in tiles/second. SC2 SCV is ~2.8125; rounded for feel. Tunable.
export const WORKER_SPEED = 3.0;

// Time spent gathering at a deposit before a load is full, in seconds. Tuned for pacing.
export const MINERAL_GATHER_TIME_S = 2.0;
export const GAS_GATHER_TIME_S = 2.0;

// --- Cave-specific (NEW — no SC2 source, tune freely) ---
export const WALL_MINE_TIME_S = 30; // per ROCK tile; core pacing lever (docs/mining.md)
export const WALL_CLEAR_MINERAL_BONUS = 5; // small one-time trickle on wall clear (docs/mining.md)
export const WORKERS_PER_WALL = 1;
export const STARTING_WORKERS = 6; // docs say ~6–12

// --- Base / townhall (SC2 Command Center) ---
export const BASE_HP = 1500;
export const BASE_FOOTPRINT = 2; // 2×2 tiles (scaled down from SC2's 5×5 for our grid)

// --- Map ---
export const MAP_W = 64;
export const MAP_H = 64;
