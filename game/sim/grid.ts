import { Grid, TileType, Vec2 } from "./types";

export function createGrid(width: number, height: number): Grid {
  return { width, height, tiles: new Uint8Array(width * height).fill(TileType.ROCK) };
}

export function idx(grid: Grid, x: number, y: number): number {
  return y * grid.width + x;
}

export function inBounds(grid: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

export function getTile(grid: Grid, x: number, y: number): TileType {
  if (!inBounds(grid, x, y)) return TileType.BOUNDARY;
  return grid.tiles[idx(grid, x, y)] as TileType;
}

export function setTile(grid: Grid, x: number, y: number, t: TileType): void {
  if (inBounds(grid, x, y)) grid.tiles[idx(grid, x, y)] = t;
}

// Only cleared cave floor is walkable (docs/map-terrain.md).
export function isWalkable(grid: Grid, x: number, y: number): boolean {
  return getTile(grid, x, y) === TileType.FLOOR;
}

// ROCK / BOUNDARY / MINERAL block line of sight; FLOOR and GEYSER do not (docs/fog-of-war.md).
export function blocksVision(grid: Grid, x: number, y: number): boolean {
  const t = getTile(grid, x, y);
  return t === TileType.ROCK || t === TileType.BOUNDARY || t === TileType.MINERAL;
}

export function tileCenter(tx: number, ty: number): Vec2 {
  return { x: tx + 0.5, y: ty + 0.5 };
}

const NEIGHBORS_8 = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

// Walkable floor tile adjacent (8-dir) to (tx,ty), nearest to `from`. Used to
// approach a wall/deposit that isn't itself walkable. Returns null if none.
export function nearestAdjacentFloor(
  grid: Grid,
  tx: number,
  ty: number,
  from: Vec2
): Vec2 | null {
  let best: Vec2 | null = null;
  let bestDist = Infinity;
  for (const [dx, dy] of NEIGHBORS_8) {
    const nx = tx + dx;
    const ny = ty + dy;
    if (!isWalkable(grid, nx, ny)) continue;
    const d = (nx + 0.5 - from.x) ** 2 + (ny + 0.5 - from.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = { x: nx, y: ny };
    }
  }
  return best;
}

// True if (tx,ty) is within the 8-neighborhood of the unit's current tile.
export function isAdjacentToTile(unitX: number, unitY: number, tx: number, ty: number): boolean {
  return Math.abs(Math.floor(unitX) - tx) <= 1 && Math.abs(Math.floor(unitY) - ty) <= 1;
}
