import { Building, Grid, Vec2 } from "./types";
import { idx, inBounds, isWalkable } from "./grid";

// Building footprints block pathing while present (docs/buildings.md). Units don't
// collide with each other in the MVP, so only terrain + buildings block.
function buildBlockedSet(grid: Grid, buildings: Building[]): Set<number> {
  const blocked = new Set<number>();
  for (const b of buildings) {
    for (let yy = b.ty; yy < b.ty + b.h; yy++) {
      for (let xx = b.tx; xx < b.tx + b.w; xx++) {
        if (inBounds(grid, xx, yy)) blocked.add(yy * grid.width + xx);
      }
    }
  }
  return blocked;
}

// Minimal binary min-heap keyed by f-score.
class MinHeap {
  private items: number[] = []; // node index
  private fs: number[] = []; // parallel f-score
  size = 0;

  push(node: number, f: number) {
    this.items.push(node);
    this.fs.push(f);
    this.size++;
    let i = this.size - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.fs[p] <= this.fs[i]) break;
      this.swap(i, p);
      i = p;
    }
  }

  pop(): number {
    const top = this.items[0];
    this.size--;
    if (this.size > 0) {
      this.items[0] = this.items[this.size];
      this.fs[0] = this.fs[this.size];
    }
    this.items.length = this.size;
    this.fs.length = this.size;
    let i = 0;
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let smallest = i;
      if (l < this.size && this.fs[l] < this.fs[smallest]) smallest = l;
      if (r < this.size && this.fs[r] < this.fs[smallest]) smallest = r;
      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }
    return top;
  }

  private swap(a: number, b: number) {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.fs[a], this.fs[b]] = [this.fs[b], this.fs[a]];
  }
}

const SQRT2 = Math.SQRT2;
const DIRS = [
  [0, -1, 1], [0, 1, 1], [-1, 0, 1], [1, 0, 1],
  [-1, -1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [1, 1, SQRT2],
];

function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
}

// A* over FLOOR tiles. start/goal are integer tile coords. Returns waypoints
// (tile coords) from the tile after start through goal, or null if unreachable.
export function findPath(
  grid: Grid,
  buildings: Building[],
  start: Vec2,
  goal: Vec2
): Vec2[] | null {
  const sx = Math.floor(start.x);
  const sy = Math.floor(start.y);
  const gx = Math.floor(goal.x);
  const gy = Math.floor(goal.y);

  if (sx === gx && sy === gy) return [];
  const blocked = buildBlockedSet(grid, buildings);
  const passable = (x: number, y: number) =>
    isWalkable(grid, x, y) && !blocked.has(idx(grid, x, y));
  if (!passable(gx, gy)) return null;

  const W = grid.width;
  const startNode = sy * W + sx;
  const goalNode = gy * W + gx;
  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const open = new MinHeap();

  gScore.set(startNode, 0);
  open.push(startNode, octile(sx, sy, gx, gy));

  while (open.size > 0) {
    const current = open.pop();
    if (current === goalNode) {
      const path: Vec2[] = [];
      let n = current;
      while (n !== startNode) {
        path.push({ x: n % W, y: Math.floor(n / W) });
        n = cameFrom.get(n)!;
      }
      path.reverse();
      return path;
    }
    const cx = current % W;
    const cy = Math.floor(current / W);
    const cg = gScore.get(current)!;

    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!passable(nx, ny)) continue;
      // No corner-cutting through wall/building corners.
      if (dx !== 0 && dy !== 0) {
        if (!passable(cx + dx, cy) || !passable(cx, cy + dy)) continue;
      }
      const node = ny * W + nx;
      const tentative = cg + cost;
      if (tentative < (gScore.get(node) ?? Infinity)) {
        cameFrom.set(node, current);
        gScore.set(node, tentative);
        open.push(node, tentative + octile(nx, ny, gx, gy));
      }
    }
  }
  return null;
}
