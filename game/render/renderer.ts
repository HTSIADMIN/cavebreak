import { BUILDING_STATS, POWER_RADIUS } from "../sim/constants";
import { idx } from "../sim/grid";
import { BuildingType, GameState, TileType } from "../sim/types";
import { Camera } from "./camera";

export interface RenderView {
  selected: Set<number>;
  localPlayer: number;
  dragScreen: { x0: number; y0: number; x1: number; y1: number } | null;
  placement: { type: BuildingType; tx: number; ty: number; valid: boolean } | null;
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
  const { grid, visibility } = state;
  const scale = cam.scale;
  const local = view.localPlayer;

  ctx.fillStyle = "#050507";
  ctx.fillRect(0, 0, w, h);

  const x0 = Math.max(0, Math.floor(cam.x));
  const y0 = Math.max(0, Math.floor(cam.y));
  const x1 = Math.min(grid.width - 1, Math.ceil(cam.x + w / scale));
  const y1 = Math.min(grid.height - 1, Math.ceil(cam.y + h / scale));

  // Local pylon centers for the power overlay.
  const pylons: { x: number; y: number }[] = [];
  for (const b of state.buildings) {
    if (b.owner === local && b.built && BUILDING_STATS[b.type].providesPower) {
      pylons.push({ x: b.tx + b.w / 2, y: b.ty + b.h / 2 });
    }
  }
  const pr2 = POWER_RADIUS * POWER_RADIUS;
  const powered = (tx: number, ty: number) =>
    pylons.some((p) => (p.x - (tx + 0.5)) ** 2 + (p.y - (ty + 0.5)) ** 2 <= pr2);

  // Terrain + fog.
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const i = idx(grid, tx, ty);
      const vis = visibility[i];
      const sx = cam.worldToScreenX(tx);
      const sy = cam.worldToScreenY(ty);
      if (vis === 0) {
        ctx.fillStyle = "#050507";
        ctx.fillRect(sx, sy, scale + 1, scale + 1);
        continue;
      }
      const t = grid.tiles[i];
      ctx.fillStyle = TILE_COLORS[t] ?? "#000";
      ctx.fillRect(sx, sy, scale + 1, scale + 1);
      if (t === TileType.FLOOR && pylons.length && powered(tx, ty)) {
        ctx.fillStyle = "rgba(120,170,255,0.14)";
        ctx.fillRect(sx, sy, scale + 1, scale + 1);
      }
      if (vis === 1) {
        ctx.fillStyle = "rgba(0,0,0,0.45)"; // explored, not currently visible
        ctx.fillRect(sx, sy, scale + 1, scale + 1);
      }
    }
  }

  // Faint grid lines.
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

  const tileVisible = (tx: number, ty: number) =>
    tx >= 0 && ty >= 0 && tx < grid.width && ty < grid.height && visibility[idx(grid, tx, ty)] === 2;

  // Buildings.
  for (const b of state.buildings) {
    const cxT = Math.floor(b.tx + b.w / 2);
    const cyT = Math.floor(b.ty + b.h / 2);
    if (b.owner !== local && !tileVisible(cxT, cyT)) continue;
    const sx = cam.worldToScreenX(b.tx);
    const sy = cam.worldToScreenY(b.ty);
    const bw = b.w * scale;
    const bh = b.h * scale;
    const color = state.players[b.owner].color;
    ctx.globalAlpha = b.built ? 1 : 0.45;
    ctx.fillStyle = color;
    ctx.fillRect(sx + 2, sy + 2, bw - 4, bh - 4);
    ctx.globalAlpha = 1;
    // type marker
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = `${Math.max(9, scale * 0.5)}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(BUILDING_STATS[b.type].label[0], sx + bw / 2, sy + bh / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    if (view.selected.has(b.id)) {
      ctx.strokeStyle = "#7CFC7C";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, bw, bh);
    }
    if (!b.built) {
      drawBar(ctx, sx + 2, sy + bh - 4, bw - 4, b.buildProgress / BUILDING_STATS[b.type].buildTime, "#ffd24a");
    } else if (b.hp < b.maxHp || b.shields < b.maxShields) {
      drawBar(ctx, sx + 2, sy - 4, bw - 4, b.hp / b.maxHp, "#5ad15a");
      if (b.maxShields > 0) drawBar(ctx, sx + 2, sy - 8, bw - 4, b.shields / b.maxShields, "#6bc5ff");
    }
    if (b.queue.length > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `${Math.max(9, scale * 0.35)}px sans-serif`;
      ctx.fillText(`▸${b.queue.length}`, sx + 4, sy + bh - 6);
    }
  }

  // Units.
  for (const u of state.units) {
    if (u.owner !== local && !tileVisible(Math.floor(u.x), Math.floor(u.y))) continue;
    const cx = cam.worldToScreenX(u.x);
    const cy = cam.worldToScreenY(u.y);
    const isCombat = u.type !== "worker";
    const r = scale * (u.type === "worker" ? 0.26 : 0.33);
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
    if (isCombat) {
      // inner marker: stalker (ranged) hollow, zealot (melee) solid dot
      ctx.fillStyle = u.type === "stalker" ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (u.carrying) {
      ctx.fillStyle = u.carrying.kind === "gas" ? "#6ad27a" : "#4fd0e0";
      ctx.beginPath();
      ctx.arc(cx, cy - r - 2, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (u.hp < u.maxHp || u.shields < u.maxShields) {
      drawBar(ctx, cx - r, cy - r - 6, r * 2, u.hp / u.maxHp, "#5ad15a");
      if (u.maxShields > 0) drawBar(ctx, cx - r, cy - r - 10, r * 2, u.shields / u.maxShields, "#6bc5ff");
    }
  }

  // Placement ghost.
  if (view.placement) {
    const st = BUILDING_STATS[view.placement.type];
    const sx = cam.worldToScreenX(view.placement.tx);
    const sy = cam.worldToScreenY(view.placement.ty);
    ctx.fillStyle = view.placement.valid ? "rgba(124,252,124,0.3)" : "rgba(255,80,80,0.3)";
    ctx.fillRect(sx, sy, st.w * scale, st.h * scale);
    ctx.strokeStyle = view.placement.valid ? "#7CFC7C" : "#ff5050";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, st.w * scale, st.h * scale);
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

function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, frac: number, color: string) {
  const f = Math.max(0, Math.min(1, frac));
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x, y, width, 3);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width * f, 3);
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
  const { grid, visibility } = state;
  const sx = w / grid.width;
  const sy = h / grid.height;
  const local = 0;

  ctx.fillStyle = "#050507";
  ctx.fillRect(0, 0, w, h);

  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = 0; tx < grid.width; tx++) {
      const i = idx(grid, tx, ty);
      if (visibility[i] === 0) continue;
      const t = grid.tiles[i];
      if (t === TileType.ROCK) continue;
      ctx.fillStyle = TILE_COLORS[t] ?? "#000";
      ctx.globalAlpha = visibility[i] === 2 ? 1 : 0.5;
      ctx.fillRect(tx * sx, ty * sy, sx + 0.5, sy + 0.5);
    }
  }
  ctx.globalAlpha = 1;

  for (const b of state.buildings) {
    if (b.owner !== local && visibility[idx(grid, Math.floor(b.tx + b.w / 2), Math.floor(b.ty + b.h / 2))] !== 2) continue;
    ctx.fillStyle = state.players[b.owner].color;
    ctx.fillRect(b.tx * sx, b.ty * sy, b.w * sx, b.h * sy);
  }
  for (const u of state.units) {
    if (u.owner !== local && visibility[idx(grid, Math.floor(u.x), Math.floor(u.y))] !== 2) continue;
    ctx.fillStyle = state.players[u.owner].color;
    ctx.fillRect(u.x * sx - 1, u.y * sy - 1, 2, 2);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1;
  ctx.strokeRect(cam.x * sx, cam.y * sy, (viewW / cam.scale) * sx, (viewH / cam.scale) * sy);
}
