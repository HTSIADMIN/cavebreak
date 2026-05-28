import { TILE_SIZE_PX } from "../sim/constants";

// Camera position is the world tile coordinate at the top-left of the viewport.
// `scale` is pixels per tile (TILE_SIZE_PX * zoom).
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;

  get scale(): number {
    return TILE_SIZE_PX * this.zoom;
  }

  worldToScreenX(wx: number): number {
    return (wx - this.x) * this.scale;
  }
  worldToScreenY(wy: number): number {
    return (wy - this.y) * this.scale;
  }
  screenToWorldX(sx: number): number {
    return sx / this.scale + this.x;
  }
  screenToWorldY(sy: number): number {
    return sy / this.scale + this.y;
  }

  pan(dxTiles: number, dyTiles: number, mapW: number, mapH: number, viewW: number, viewH: number) {
    this.x = clamp(this.x + dxTiles, 0, Math.max(0, mapW - viewW / this.scale));
    this.y = clamp(this.y + dyTiles, 0, Math.max(0, mapH - viewH / this.scale));
  }

  centerOn(wx: number, wy: number, mapW: number, mapH: number, viewW: number, viewH: number) {
    this.x = clamp(wx - viewW / this.scale / 2, 0, Math.max(0, mapW - viewW / this.scale));
    this.y = clamp(wy - viewH / this.scale / 2, 0, Math.max(0, mapH - viewH / this.scale));
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
