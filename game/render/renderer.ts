import { BUILDING_STATS, POWER_RADIUS } from "../sim/constants";
import { idx } from "../sim/grid";
import { BuildingType, GameState, TileType, UnitType } from "../sim/types";
import { Camera } from "./camera";

export interface RenderEffect {
  kind: "wallBreak" | "hit";
  x: number;
  y: number;
  ex?: number;
  ey?: number;
  t: number; // 1 → 0 lifetime
}

export interface RenderView {
  selected: Set<number>;
  hovered: number | null;
  localPlayer: number;
  dragScreen: { x0: number; y0: number; x1: number; y1: number } | null;
  placement: { type: BuildingType; tx: number; ty: number; valid: boolean } | null;
  markers: { x: number; y: number; kind: "move" | "attack"; t: number }[];
  effects: RenderEffect[];
}

const TILE_COLORS: Record<number, string> = {
  [TileType.ROCK]: "#34343c",
  [TileType.FLOOR]: "#6f6f7a",
  [TileType.BOUNDARY]: "#141418",
  [TileType.MINERAL]: "#4fd0e0",
  [TileType.GEYSER]: "#6ad27a",
};
const GOLDEN_MINERAL = "#ffcf4a";
const GOLDEN_GAS = "#cfe05a";

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

  const tileVisible = (tx: number, ty: number) =>
    tx >= 0 && ty >= 0 && tx < grid.width && ty < grid.height && visibility[idx(grid, tx, ty)] === 2;

  // Golden deposit tiles (for distinct colouring).
  const golden = new Set<number>();
  for (const d of state.deposits) if (d.golden) golden.add(d.ty * grid.width + d.tx);

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
      let color = TILE_COLORS[t] ?? "#000";
      if (golden.has(i)) color = t === TileType.GEYSER ? GOLDEN_GAS : GOLDEN_MINERAL;
      ctx.fillStyle = color;
      ctx.fillRect(sx, sy, scale + 1, scale + 1);
      if (t === TileType.FLOOR && pylons.length && powered(tx, ty)) {
        ctx.fillStyle = "rgba(120,170,255,0.14)";
        ctx.fillRect(sx, sy, scale + 1, scale + 1);
      }
      if (vis === 1) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
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

  // Power-radius preview: hovered pylon (+ link to nearest Nexus) or pylon placement ghost.
  const drawPowerCircle = (wx: number, wy: number) => {
    ctx.fillStyle = "rgba(120,170,255,0.08)";
    ctx.strokeStyle = "rgba(120,170,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cam.worldToScreenX(wx), cam.worldToScreenY(wy), POWER_RADIUS * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  const hov = view.hovered != null ? state.buildings.find((b) => b.id === view.hovered) : null;
  if (hov && BUILDING_STATS[hov.type].providesPower) {
    const hx = hov.tx + hov.w / 2;
    const hy = hov.ty + hov.h / 2;
    drawPowerCircle(hx, hy);
    // small link line to the nearest friendly Nexus
    let nx: { x: number; y: number } | null = null;
    let nd = Infinity;
    for (const b of state.buildings) {
      if (b.owner !== hov.owner || b.type !== "nexus") continue;
      const c = { x: b.tx + b.w / 2, y: b.ty + b.h / 2 };
      const d = (c.x - hx) ** 2 + (c.y - hy) ** 2;
      if (d < nd) { nd = d; nx = c; }
    }
    if (nx) {
      ctx.strokeStyle = "rgba(120,170,255,0.7)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(cam.worldToScreenX(hx), cam.worldToScreenY(hy));
      ctx.lineTo(cam.worldToScreenX(nx.x), cam.worldToScreenY(nx.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (view.placement && BUILDING_STATS[view.placement.type].providesPower) {
    const st = BUILDING_STATS[view.placement.type];
    drawPowerCircle(view.placement.tx + st.w / 2, view.placement.ty + st.h / 2);
  }

  // Buildings (distinct icon per type).
  for (const b of state.buildings) {
    const cxT = Math.floor(b.tx + b.w / 2);
    const cyT = Math.floor(b.ty + b.h / 2);
    if (b.owner !== local && !tileVisible(cxT, cyT)) continue;
    const sx = cam.worldToScreenX(b.tx);
    const sy = cam.worldToScreenY(b.ty);
    const bw = b.w * scale;
    const bh = b.h * scale;
    ctx.globalAlpha = b.built ? 1 : 0.45;
    ctx.fillStyle = state.players[b.owner].color;
    ctx.fillRect(sx + 2, sy + 2, bw - 4, bh - 4);
    ctx.globalAlpha = 1;
    drawBuildingIcon(ctx, b.type, sx + bw / 2, sy + bh / 2, Math.min(bw, bh) * 0.7);
    if (view.hovered === b.id) {
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx + 1, sy + 1, bw - 2, bh - 2);
    }
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

  // Mining cracks on walls being dug (action animation).
  for (const u of state.units) {
    if (u.state !== "mining_wall" || !u.mineTile) continue;
    if (!tileVisible(u.mineTile.x, u.mineTile.y)) continue;
    const frac = Math.min(1, u.mineProgress / 10);
    const cx = cam.worldToScreenX(u.mineTile.x + 0.5);
    const cy = cam.worldToScreenY(u.mineTile.y + 0.5);
    ctx.strokeStyle = `rgba(255,228,180,${0.3 + 0.5 * frac})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const n = 2 + Math.floor(frac * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + frac * 2;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * scale * 0.4 * (0.4 + frac), cy + Math.sin(a) * scale * 0.4 * (0.4 + frac));
    }
    ctx.stroke();
  }

  // Units (distinct icon per type).
  for (const u of state.units) {
    if (u.owner !== local && !tileVisible(Math.floor(u.x), Math.floor(u.y))) continue;
    const cx = cam.worldToScreenX(u.x);
    const cy = cam.worldToScreenY(u.y);
    const r = scale * (u.type === "worker" ? 0.26 : 0.33);
    if (view.selected.has(u.id)) {
      ctx.strokeStyle = "#7CFC7C";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawUnitIcon(ctx, u.type, cx, cy, r, state.players[u.owner].color);
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

  // Transient effects: wall breaks + attack impacts (fog-gated).
  for (const e of view.effects) {
    if (!tileVisible(Math.floor(e.ex ?? e.x), Math.floor(e.ey ?? e.y))) continue;
    ctx.globalAlpha = Math.max(0, e.t);
    if (e.kind === "wallBreak") {
      const x = cam.worldToScreenX(e.x);
      const y = cam.worldToScreenY(e.y);
      const rr = scale * (0.2 + (1 - e.t) * 0.5);
      ctx.strokeStyle = "#d9b48a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#b58a5e";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * rr * 0.8, y + Math.sin(a) * rr * 0.8, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const x = cam.worldToScreenX(e.x);
      const y = cam.worldToScreenY(e.y);
      const ex = cam.worldToScreenX(e.ex ?? e.x);
      const ey = cam.worldToScreenY(e.ey ?? e.y);
      ctx.strokeStyle = "#ffd24a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = "#fff3c0";
      ctx.beginPath();
      ctx.arc(ex, ey, 3 + (1 - e.t) * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Command feedback markers.
  for (const m of view.markers) {
    const cx = cam.worldToScreenX(m.x);
    const cy = cam.worldToScreenY(m.y);
    const rr = scale * (0.15 + (1 - m.t) * 0.4);
    ctx.globalAlpha = Math.max(0, m.t);
    ctx.strokeStyle = m.kind === "attack" ? "#ff5a4a" : "#7CFC7C";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
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
    drawBuildingIcon(ctx, view.placement.type, sx + (st.w * scale) / 2, sy + (st.h * scale) / 2, Math.min(st.w, st.h) * scale * 0.7);
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

function drawBuildingIcon(ctx: CanvasRenderingContext2D, type: BuildingType, cx: number, cy: number, size: number) {
  const u = size * 0.5;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = Math.max(1.5, size * 0.09);
  ctx.lineJoin = "round";
  switch (type) {
    case "nexus":
      ctx.beginPath();
      ctx.moveTo(cx, cy - u); ctx.lineTo(cx + u, cy); ctx.lineTo(cx, cy + u); ctx.lineTo(cx - u, cy); ctx.closePath();
      ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, size * 0.13, 0, Math.PI * 2); ctx.fill();
      break;
    case "pylon":
      ctx.beginPath();
      ctx.moveTo(cx, cy - u); ctx.lineTo(cx + u * 0.85, cy + u * 0.7); ctx.lineTo(cx - u * 0.85, cy + u * 0.7); ctx.closePath();
      ctx.stroke();
      break;
    case "gateway":
      ctx.beginPath();
      ctx.moveTo(cx - u, cy + u); ctx.lineTo(cx - u, cy - u * 0.2);
      ctx.arc(cx, cy - u * 0.2, u, Math.PI, 0);
      ctx.lineTo(cx + u, cy + u);
      ctx.stroke();
      break;
    case "cybernetics":
      ctx.beginPath(); ctx.arc(cx, cy, u * 0.75, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - u, cy); ctx.lineTo(cx + u, cy);
      ctx.moveTo(cx, cy - u); ctx.lineTo(cx, cy + u);
      ctx.stroke();
      break;
    case "forge":
      ctx.beginPath(); ctx.moveTo(cx - u * 0.15, cy + u); ctx.lineTo(cx - u * 0.15, cy - u * 0.1); ctx.stroke();
      ctx.fillRect(cx - u * 0.6, cy - u * 0.7, u * 1.2, u * 0.45);
      break;
    case "cannon":
      ctx.beginPath(); ctx.arc(cx, cy + u * 0.25, u * 0.55, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy + u * 0.1); ctx.lineTo(cx, cy - u); ctx.stroke();
      break;
  }
  ctx.restore();
}

function drawUnitIcon(ctx: CanvasRenderingContext2D, type: UnitType, cx: number, cy: number, r: number, color: string) {
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 1;
  if (type === "stalker") {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy + r * 0.85);
    ctx.lineTo(cx, cy + r * 0.35);
    ctx.lineTo(cx - r, cy + r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return;
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (type === "zealot") {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(1, r * 0.2);
    const b = r * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - b, cy - b); ctx.lineTo(cx + b, cy + b);
    ctx.moveTo(cx + b, cy - b); ctx.lineTo(cx - b, cy + b);
    ctx.stroke();
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
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

  const golden = new Set<number>();
  for (const d of state.deposits) if (d.golden) golden.add(d.ty * grid.width + d.tx);

  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = 0; tx < grid.width; tx++) {
      const i = idx(grid, tx, ty);
      if (visibility[i] === 0) continue;
      const t = grid.tiles[i];
      if (t === TileType.ROCK) continue;
      let color = TILE_COLORS[t] ?? "#000";
      if (golden.has(i)) color = t === TileType.GEYSER ? GOLDEN_GAS : GOLDEN_MINERAL;
      ctx.fillStyle = color;
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
