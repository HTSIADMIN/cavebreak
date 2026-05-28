import { BUILDING_STATS, POWER_RADIUS } from "./constants";
import { GameState, PlayerId } from "./types";

// A tile is powered if its center lies within POWER_RADIUS of a completed,
// power-providing building (a Pylon) owned by the player. (docs/buildings.md)
export function isTilePowered(state: GameState, owner: PlayerId, tx: number, ty: number): boolean {
  const cx = tx + 0.5;
  const cy = ty + 0.5;
  const r2 = POWER_RADIUS * POWER_RADIUS;
  for (const b of state.buildings) {
    if (b.owner !== owner || !b.built) continue;
    if (!BUILDING_STATS[b.type].providesPower) continue;
    const px = b.tx + b.w / 2;
    const py = b.ty + b.h / 2;
    if ((px - cx) ** 2 + (py - cy) ** 2 <= r2) return true;
  }
  return false;
}

// Powered buildings must be placed with their center inside a power field.
export function isPlacementPowered(
  state: GameState,
  owner: PlayerId,
  tx: number,
  ty: number,
  w: number,
  h: number
): boolean {
  return isTilePowered(state, owner, Math.floor(tx + w / 2), Math.floor(ty + h / 2));
}
