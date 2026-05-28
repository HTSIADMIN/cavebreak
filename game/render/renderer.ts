import { idx } from "../sim/grid";
import { GameState, TileType } from "../sim/types";
import { Camera } from "./camera";

export interface RenderView {
  selected: Set<number>;
  localPlayer: number;
  dragScreen: { x0: number; y0: number; x1: number; y1: number } | null;
}

const TILE_COLORS: Record<number, string> = {
  [TileType.ROCK]: "#34343c",
  [TileType.FLOOR]: "#6f6f7a",
  [TileType.BOUNDARY]: "#141418",
  [TileType.MINERAL]: "#4fd0e0",
  [TileType.GEYSER]: "#6ad27a",
};

export function renderGame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: GameState,
  cam: Camera,
  view: RenderView
) {
  const { grid } = state;
  const scale = cam.scale;

  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(0, 0, w, h);

  // Visible tile range.
  const x0 = Math.max(0, Math.floor(cam.x));
  const y0 = Math.max(0, Math.floor(cam.y));
  const x1 = Math.min(grid.width - 1, Math.ceil(cam.x + w / scale));
  const y1 = Math.min(grid.height - 1, Math.ceil(cam.y + h / scale));

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = grid.tiles[idx(grid, tx, ty)];
      ctx.fillStyle = TILE_COLORS[t] ?? "#000";
      const sx = cam.worldToScreenX(tx);
      const sy = cam.worldToScreenY(ty);
      ctx.fillRect(sx, sy, scale + 1, scale + 1);
    }
  }

  // Faint grid lines for readability.
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let tx = x0; tx <= x1 + 1; tx++) {
    const sx = Math.round(cam.worldToScreenX(tx)) + 0.5;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, h);
  }
  for (let ty = y0; ty <= y1 + 1; ty++) {
    const sy = Math.round(cam.worldToScreenY(ty)) + 0.5;
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
  }
  ctx.stroke();

  // Buildings.
  for (const b of state.buildings) {
    const sx = cam.worldToScreenX(b.tx);
    const sy = cam.worldToScreenY(b.ty);
    const bw = b.w * scale;
    const bh = b.h * scale;
    ctx.fillStyle = state.players[b.owner].color;
    ctx.fillRect(sx + 2, sy + 2, bw - 4, bh - 4);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 2, sy + 2, bw - 4, bh - 4);
    if (view.selected.has(b.id)) {
      ctx.strokeStyle = "#7CFC7C";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, bw, bh);
    }
    // queue indicator
    if (b.queue.length > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `${Math.max(10, scale * 0.4)}px sans-serif`;
      ctx.fillText(`⚒${b.queue.length}`, sx + 4, sy + bh - 6);
    }
  }

  // Units (workers).
  const r = scale * 0.32;
  for (const u of state.units) {
    const cx = cam.worldToScreenX(u.x);
    const cy = cam.worldToScreenY(u.y);
    if (view.selected.has(u.id)) {
      ctx.strokeStyle = "#7CFC7C";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = state.players[u.owner].color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // carrying indicator
    if (u.carrying) {
      ctx.fillStyle = u.carrying.kind === "gas" ? "#6ad27a" : "#4fd0e0";
      ctx.beginPath();
      ctx.arc(cx, cy - r - 2, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Drag-selection rectangle.
  if (view.dragScreen) {
    const { x0: dx0, y0: dy0, x1: dx1, y1: dy1 } = view.dragScreen;
    const rx = Math.min(dx0, dx1);
    const ry = Math.min(dy0, dy1);
    ctx.strokeStyle = "#7CFC7C";
    ctx.fillStyle = "rgba(124,252,124,0.12)";
    ctx.lineWidth = 1;
    ctx.fillRect(rx, ry, Math.abs(dx1 - dx0), Math.abs(dy1 - dy0));
    ctx.strokeRect(rx, ry, Math.abs(dx1 - dx0), Math.abs(dy1 - dy0));
  }
}

export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: GameState,
  cam: Camera,
  viewW: number,
  viewH: number
) {
  const { grid } = state;
  const sx = w / grid.width;
  const sy = h / grid.height;

  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(0, 0, w, h);

  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = 0; tx < grid.width; tx++) {
      const t = grid.tiles[idx(grid, tx, ty)];
      if (t === TileType.ROCK) continue; // leave rock as background to reduce noise
      ctx.fillStyle = TILE_COLORS[t] ?? "#000";
      ctx.fillRect(tx * sx, ty * sy, sx + 0.5, sy + 0.5);
    }
  }

  for (const b of state.buildings) {
    ctx.fillStyle = state.players[b.owner].color;
    ctx.fillRect(b.tx * sx, b.ty * sy, b.w * sx, b.h * sy);
  }
  for (const u of state.units) {
    ctx.fillStyle = state.players[u.owner].color;
    ctx.fillRect(u.x * sx - 1, u.y * sy - 1, 2, 2);
  }

  // Viewport rectangle.
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1;
  ctx.strokeRect(cam.x * sx, cam.y * sy, (viewW / cam.scale) * sx, (viewH / cam.scale) * sy);
}
