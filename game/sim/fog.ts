import { BUILDING_STATS, UNIT_STATS } from "./constants";
import { blocksVision, inBounds } from "./grid";
import { GameState, Grid, PlayerId } from "./types";

// Visibility states: 0 hidden (never seen), 1 explored (seen before), 2 visible (current).

// Line-of-sight: true if nothing strictly between source and target tile blocks vision.
// The target tile itself may be a blocker (you see the wall face). (docs/fog-of-war.md)
function losClear(grid: Grid, x0: number, y0: number, x1: number, y1: number): boolean {
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  while (true) {
    if (x === x1 && y === y1) return true;
    if (!(x === x0 && y === y0) && blocksVision(grid, x, y)) return false;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function revealCircle(grid: Grid, vis: Uint8Array, sxf: number, syf: number, radius: number) {
  const sx = Math.floor(sxf);
  const sy = Math.floor(syf);
  const r = Math.ceil(radius);
  const r2 = radius * radius;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const tx = sx + dx;
      const ty = sy + dy;
      if (!inBounds(grid, tx, ty)) continue;
      if (losClear(grid, sx, sy, tx, ty)) vis[ty * grid.width + tx] = 2;
    }
  }
}

// Recompute a player's visibility, preserving explored memory from `prev`.
export function computeVisibility(state: GameState, owner: PlayerId, prev: Uint8Array): Uint8Array {
  const { grid } = state;
  const vis = prev;
  for (let i = 0; i < vis.length; i++) if (vis[i] === 2) vis[i] = 1; // downgrade to explored
  for (const u of state.units) {
    if (u.owner === owner) revealCircle(grid, vis, u.x, u.y, UNIT_STATS[u.type].sight);
  }
  for (const b of state.buildings) {
    if (b.owner === owner) revealCircle(grid, vis, b.tx + b.w / 2, b.ty + b.h / 2, BUILDING_STATS[b.type].sight);
  }
  return vis;
}
