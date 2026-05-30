// Browser-only art layer for the Kenney CC0 packs. This is part of game/render (NOT game/sim,
// which must stay engine-agnostic). It lazily loads + caches images, maps game entities to
// sprites, and offers rotated-draw + cursor helpers. Everything degrades gracefully: callers
// check `ready()` and fall back to the hand-drawn vector icons in renderer.ts until an image
// has decoded.
//
// Asset → entity mapping (see GAME_DESIGN.md art notes):
//   Workers  → space-shooter playerShip1 (per-player color variant)
//   Zealot   → top-down-tanks tankBody (turretless, melee)
//   Stalker  → top-down-tanks tank (with barrel, ranged)
//   Buildings→ sci-fi-rts structures (one distinct silhouette per type)
//   Vision   → light-masks cone (flashlight, rotated to unit facing)
//   Cursors  → cursor-pack (per action)

import { BuildingType, UnitType } from "../sim/types";

const BASE = "/assets/kenney";
const STRUCT_BASE = `${BASE}/sci-fi-rts/PNG/Default size/Structure`;
const TANK_BASE = `${BASE}/top-down-tanks/PNG/Default size`;
const SHIP_BASE = `${BASE}/space-shooter/PNG`;

// Player seat colors (mapgen COLORS: blue / red / green / gold) line up with the pack color
// variants, so we pick the matching variant per owner instead of tinting.
const SHIP_COLORS = ["blue", "red", "green", "orange"];
const TANK_COLORS = ["blue", "red", "green", "sand"];

const STRUCTURE: Record<BuildingType, string> = {
  nexus: "scifiStructure_16", // command fortress
  pylon: "scifiStructure_08", // blue energy panels
  gateway: "scifiStructure_02", // arch / portal
  cybernetics: "scifiStructure_05", // tall tech tower
  forge: "scifiStructure_09", // smokestack furnace
  cannon: "scifiStructure_13", // gun turret
};

const cache = new Map<string, HTMLImageElement>();
function img(src: string): HTMLImageElement {
  let im = cache.get(src);
  if (!im) {
    im = new Image();
    im.src = src;
    cache.set(src, im);
  }
  return im;
}

export function ready(im: HTMLImageElement | null | undefined): im is HTMLImageElement {
  return !!im && im.complete && im.naturalWidth > 0;
}

export function buildingImage(type: BuildingType): HTMLImageElement {
  return img(`${STRUCT_BASE}/${STRUCTURE[type]}.png`);
}

export function unitImage(type: UnitType, owner: number): HTMLImageElement {
  if (type === "worker") return img(`${SHIP_BASE}/playerShip1_${SHIP_COLORS[owner % SHIP_COLORS.length]}.png`);
  if (type === "zealot") return img(`${TANK_BASE}/tankBody_${TANK_COLORS[owner % TANK_COLORS.length]}.png`);
  return img(`${TANK_BASE}/tank_${TANK_COLORS[owner % TANK_COLORS.length]}.png`); // stalker
}

export function coneImage(): HTMLImageElement {
  return img(`${BASE}/light-masks/Default/cone_b.png`);
}

export function explosionFrame(i: number): HTMLImageElement {
  const n = Math.max(1, Math.min(5, i));
  return img(`${TANK_BASE}/explosion${n}.png`);
}

// Draw `im` centered at (cx,cy), scaled to fit `size` px, rotated so the sprite's drawn "up"
// (north — how the Kenney art is oriented) points along `facing` (radians, 0 = east). Returns
// false when the image isn't ready so the caller can fall back to a vector icon.
export function drawRotated(
  ctx: CanvasRenderingContext2D,
  im: HTMLImageElement,
  cx: number,
  cy: number,
  size: number,
  facing: number
): boolean {
  if (!ready(im)) return false;
  const ar = im.naturalWidth / im.naturalHeight;
  let w = size;
  let h = size;
  if (ar >= 1) h = size / ar;
  else w = size * ar;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(facing + Math.PI / 2); // art faces up; facing 0 (east) → rotate +90°
  ctx.drawImage(im, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}

// Draw `im` upright (no rotation), centered, fit to a `w`×`h` box.
export function drawFit(
  ctx: CanvasRenderingContext2D,
  im: HTMLImageElement,
  cx: number,
  cy: number,
  boxW: number,
  boxH: number
): boolean {
  if (!ready(im)) return false;
  const ar = im.naturalWidth / im.naturalHeight;
  const boxAr = boxW / boxH;
  let w = boxW;
  let h = boxH;
  if (ar > boxAr) h = boxW / ar;
  else w = boxH * ar;
  ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h);
  return true;
}

// A flashlight cone of light projected from a unit in its facing direction. Drawn additively
// ('lighter') so the grayscale mask brightens the lit floor — a fog-of-war flashlight look.
// The cone art's light source sits at its bottom-center with the beam pointing up, so we anchor
// the bottom-center at the unit and let the beam extend forward.
export function drawCone(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  lengthPx: number,
  facing: number,
  alpha: number
): boolean {
  const im = coneImage();
  if (!ready(im)) return false;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(facing + Math.PI / 2);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  ctx.drawImage(im, -lengthPx / 2, -lengthPx, lengthPx, lengthPx);
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  return true;
}

// Preload everything a match uses (call once on mount) for up to `seats` players.
export function preloadSprites(seats = 4): void {
  (Object.keys(STRUCTURE) as BuildingType[]).forEach(buildingImage);
  for (let o = 0; o < seats; o++) {
    unitImage("worker", o);
    unitImage("zealot", o);
    unitImage("stalker", o);
  }
  for (let i = 1; i <= 5; i++) explosionFrame(i);
}

// --- Cursors (applied as the canvas element's CSS `cursor`) ----------------
const CUR = `${BASE}/cursors/PNG/Basic/Default`;
export type CursorKind =
  | "default"
  | "move"
  | "attack"
  | "mine"
  | "build"
  | "rally"
  | "invalid"
  | "pan";

// file + hotspot (px) + a native fallback used until the PNG loads / if it fails.
const CURSOR_DEF: Record<CursorKind, { file: string; hx: number; hy: number; fallback: string }> = {
  default: { file: "pointer_b.png", hx: 2, hy: 2, fallback: "default" },
  move: { file: "boot.png", hx: 14, hy: 14, fallback: "pointer" },
  attack: { file: "target_a.png", hx: 16, hy: 16, fallback: "crosshair" },
  mine: { file: "tool_pickaxe.png", hx: 6, hy: 6, fallback: "crosshair" },
  build: { file: "tool_hammer.png", hx: 6, hy: 6, fallback: "copy" },
  rally: { file: "target_round_a.png", hx: 16, hy: 16, fallback: "cell" },
  invalid: { file: "cursor_disabled.png", hx: 12, hy: 12, fallback: "not-allowed" },
  pan: { file: "hand_closed.png", hx: 14, hy: 14, fallback: "grabbing" },
};

export function cursorCss(kind: CursorKind): string {
  const c = CURSOR_DEF[kind];
  return `url("${CUR}/${c.file}") ${c.hx} ${c.hy}, ${c.fallback}`;
}

export function preloadCursors(): void {
  for (const k of Object.keys(CURSOR_DEF) as CursorKind[]) img(`${CUR}/${CURSOR_DEF[k].file}`);
}
