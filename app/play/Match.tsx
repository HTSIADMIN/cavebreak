"use client";

import { useEffect, useRef, useState } from "react";
import {
  applyCommand,
  Command,
  createInitialState,
  DT,
  GameState,
  getTile,
  MAP_H,
  MAP_W,
  step,
  TileType,
  WORKER_COST_MINERALS,
} from "@/game/sim";
import { Camera } from "@/game/render/camera";
import { renderGame, renderMinimap, RenderView } from "@/game/render/renderer";
import { CommandCard, HudData, HudSelection, SelectionPanel, TopBar } from "./Hud";

const LOCAL_PLAYER = 0;
const PAN_SPEED = 24; // tiles/sec
const DRAG_THRESHOLD = 5; // px

const EMPTY_HUD: HudData = {
  minerals: 0,
  gas: 0,
  supplyUsed: 0,
  supplyMax: 0,
  selection: { kind: "none", count: 0 },
};

export default function Match() {
  const [hud, setHud] = useState<HudData>(EMPTY_HUD);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);

  const stateRef = useRef<GameState | null>(null);
  const camRef = useRef<Camera | null>(null);
  const selectedRef = useRef<Set<number>>(new Set());
  const keysRef = useRef<Set<string>>(new Set());
  const dragRef = useRef<{ active: boolean; moved: boolean; x0: number; y0: number; x1: number; y1: number } | null>(null);
  const attackModeRef = useRef(false);
  const miniDragRef = useRef(false);
  const sizeRef = useRef({ w: 0, h: 0 });

  // --- command helpers (read refs only, so no stale closures) ---
  function dispatch(cmd: Command) {
    const s = stateRef.current;
    if (s) applyCommand(s, cmd);
  }
  function selectedUnitIds(): number[] {
    const s = stateRef.current;
    if (!s) return [];
    return s.units.filter((u) => selectedRef.current.has(u.id) && u.owner === LOCAL_PLAYER).map((u) => u.id);
  }
  function selectedBaseId(): number | null {
    const s = stateRef.current;
    if (!s) return null;
    const b = s.buildings.find((b) => selectedRef.current.has(b.id) && b.owner === LOCAL_PLAYER && b.type === "base");
    return b ? b.id : null;
  }
  function doBuildWorker() {
    const id = selectedBaseId();
    if (id !== null) dispatch({ type: "buildWorker", baseId: id });
  }
  function doStop() {
    const ids = selectedUnitIds();
    if (ids.length) dispatch({ type: "stop", unitIds: ids });
  }

  useEffect(() => {
    const state = createInitialState();
    stateRef.current = state;
    const cam = new Camera();
    camRef.current = cam;

    if (process.env.NODE_ENV !== "production") {
      (window as unknown as Record<string, unknown>).__cb = {
        state,
        cam,
        dispatch,
        select: (ids: number[]) => {
          selectedRef.current = new Set(ids);
        },
      };
    }

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const mini = miniRef.current!;
    const mctx = mini.getContext("2d")!;

    const resizeMain = () => {
      const wrap = wrapRef.current!;
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      sizeRef.current = { w, h };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const resizeMini = () => {
      const dpr = window.devicePixelRatio || 1;
      mini.width = Math.round(mini.clientWidth * dpr);
      mini.height = Math.round(mini.clientHeight * dpr);
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeMain();
    resizeMini();

    const myBase = state.buildings.find((b) => b.owner === LOCAL_PLAYER && b.type === "base");
    if (myBase) cam.centerOn(myBase.tx + myBase.w / 2, myBase.ty + myBase.h / 2, MAP_W, MAP_H, sizeRef.current.w, sizeRef.current.h);

    const ro = new ResizeObserver(resizeMain);
    ro.observe(wrapRef.current!);

    // --- coordinate helpers ---
    const canvasXY = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        inside: e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom,
      };
    };

    const issueRightClick = (sx: number, sy: number) => {
      const wx = cam.screenToWorldX(sx);
      const wy = cam.screenToWorldY(sy);
      const tx = Math.floor(wx);
      const ty = Math.floor(wy);
      const ids = selectedUnitIds();
      if (ids.length > 0) {
        const t = getTile(state.grid, tx, ty);
        if (t === TileType.ROCK) {
          dispatch({ type: "mine", unitIds: ids, tx, ty });
        } else if (t === TileType.MINERAL || t === TileType.GEYSER) {
          const dep = state.deposits.find((d) => d.tx === tx && d.ty === ty);
          if (dep) dispatch({ type: "harvest", unitIds: ids, depositId: dep.id });
          else dispatch({ type: "move", unitIds: ids, tx, ty });
        } else {
          dispatch({ type: "move", unitIds: ids, tx, ty });
        }
      } else {
        const baseId = selectedBaseId();
        if (baseId !== null) dispatch({ type: "setRally", baseId, tx, ty });
      }
    };

    const issueAttack = (sx: number, sy: number) => {
      const ids = selectedUnitIds();
      if (!ids.length) return;
      const tx = Math.floor(cam.screenToWorldX(sx));
      const ty = Math.floor(cam.screenToWorldY(sy));
      dispatch({ type: "attackMove", unitIds: ids, tx, ty });
    };

    const clickSelect = (sx: number, sy: number, shift: boolean) => {
      const wx = cam.screenToWorldX(sx);
      const wy = cam.screenToWorldY(sy);
      const unit = state.units.find((u) => u.owner === LOCAL_PLAYER && Math.hypot(u.x - wx, u.y - wy) < 0.45);
      if (unit) {
        if (!shift) selectedRef.current = new Set();
        selectedRef.current.add(unit.id);
        return;
      }
      const b = state.buildings.find((b) => b.owner === LOCAL_PLAYER && wx >= b.tx && wx < b.tx + b.w && wy >= b.ty && wy < b.ty + b.h);
      if (b) {
        selectedRef.current = new Set([b.id]);
        return;
      }
      if (!shift) selectedRef.current = new Set();
    };

    const boxSelect = (d: { x0: number; y0: number; x1: number; y1: number }) => {
      const wx0 = Math.min(cam.screenToWorldX(d.x0), cam.screenToWorldX(d.x1));
      const wx1 = Math.max(cam.screenToWorldX(d.x0), cam.screenToWorldX(d.x1));
      const wy0 = Math.min(cam.screenToWorldY(d.y0), cam.screenToWorldY(d.y1));
      const wy1 = Math.max(cam.screenToWorldY(d.y0), cam.screenToWorldY(d.y1));
      const found = new Set<number>();
      for (const u of state.units) {
        if (u.owner !== LOCAL_PLAYER) continue;
        if (u.x >= wx0 && u.x <= wx1 && u.y >= wy0 && u.y <= wy1) found.add(u.id);
      }
      selectedRef.current = found;
    };

    // --- mouse ---
    const onMouseDown = (e: MouseEvent) => {
      const { x, y, inside } = canvasXY(e);
      if (!inside) return;
      if (e.button === 0) {
        if (attackModeRef.current) {
          issueAttack(x, y);
          attackModeRef.current = false;
          return;
        }
        dragRef.current = { active: true, moved: false, x0: x, y0: y, x1: x, y1: y };
      } else if (e.button === 2) {
        e.preventDefault();
        attackModeRef.current = false;
        issueRightClick(x, y);
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d?.active) return;
      const { x, y } = canvasXY(e);
      d.x1 = x;
      d.y1 = y;
      if (Math.hypot(d.x1 - d.x0, d.y1 - d.y0) > DRAG_THRESHOLD) d.moved = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const d = dragRef.current;
      if (!d?.active) return;
      dragRef.current = null;
      if (d.moved) boxSelect(d);
      else clickSelect(d.x0, d.y0, e.shiftKey);
    };

    // --- keyboard ---
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) {
        e.preventDefault();
        keysRef.current.add(k);
        return;
      }
      switch (k.toLowerCase()) {
        case "a":
          if (selectedUnitIds().length) attackModeRef.current = true;
          break;
        case "s":
          doStop();
          break;
        case "h":
          doStop();
          break;
        case "b":
          doBuildWorker();
          break;
        case "escape":
          attackModeRef.current = false;
          selectedRef.current = new Set();
          break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // --- loop ---
    const panFromKeys = (dt: number) => {
      let dx = 0;
      let dy = 0;
      const keys = keysRef.current;
      if (keys.has("ArrowLeft")) dx -= 1;
      if (keys.has("ArrowRight")) dx += 1;
      if (keys.has("ArrowUp")) dy -= 1;
      if (keys.has("ArrowDown")) dy += 1;
      if (dx || dy) cam.pan(dx * PAN_SPEED * dt, dy * PAN_SPEED * dt, MAP_W, MAP_H, sizeRef.current.w, sizeRef.current.h);
    };

    const pushHud = () => {
      const p = state.players[LOCAL_PLAYER];
      const sel = selectedRef.current;
      let selection: HudSelection = { kind: "none", count: 0 };
      const units = state.units.filter((u) => sel.has(u.id) && u.owner === LOCAL_PLAYER);
      if (units.length > 0) {
        selection = { kind: "units", count: units.length, unitState: units.length === 1 ? units[0].state : undefined };
      } else {
        const base = state.buildings.find((b) => sel.has(b.id) && b.owner === LOCAL_PLAYER && b.type === "base");
        if (base) {
          selection = {
            kind: "base",
            count: 1,
            baseId: base.id,
            baseQueue: base.queue.length,
            canBuildWorker: p.minerals >= WORKER_COST_MINERALS && p.supplyUsed < p.supplyMax,
          };
        }
      }
      setHud({ minerals: p.minerals, gas: p.gas, supplyUsed: p.supplyUsed, supplyMax: p.supplyMax, selection });
    };

    const draw = () => {
      const { w, h } = sizeRef.current;
      const d = dragRef.current;
      const view: RenderView = {
        selected: selectedRef.current,
        localPlayer: LOCAL_PLAYER,
        dragScreen: d?.active && d.moved ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null,
      };
      renderGame(ctx, w, h, state, cam, view);
      renderMinimap(mctx, mini.clientWidth, mini.clientHeight, state, cam, w, h);
    };

    let last = performance.now();
    let acc = 0;
    let raf = 0;
    let hudCtr = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      panFromKeys(dt);
      let steps = 0;
      while (acc >= DT && steps < 5) {
        step(state, DT);
        acc -= DT;
        steps++;
      }
      draw();
      if (++hudCtr % 6 === 0) pushHud();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- minimap interaction (React handlers) ---
  const miniGoto = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cam = camRef.current;
    if (!cam) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    cam.centerOn(fx * MAP_W, fy * MAP_H, MAP_W, MAP_H, sizeRef.current.w, sizeRef.current.h);
  };

  return (
    <div className="flex h-screen w-screen select-none flex-col bg-black text-zinc-100">
      <div ref={wrapRef} className="relative flex-1 overflow-hidden">
        <canvas ref={canvasRef} className="block h-full w-full" onContextMenu={(e) => e.preventDefault()} />
        <TopBar {...hud} />
      </div>
      <div className="flex h-44 items-stretch border-t border-zinc-800 bg-zinc-950">
        <div className="p-2">
          <canvas
            ref={miniRef}
            className="h-40 w-40 rounded border border-zinc-800 bg-black"
            onMouseDown={(e) => {
              miniDragRef.current = true;
              miniGoto(e);
            }}
            onMouseMove={(e) => {
              if (miniDragRef.current) miniGoto(e);
            }}
            onMouseUp={() => (miniDragRef.current = false)}
            onMouseLeave={() => (miniDragRef.current = false)}
          />
        </div>
        <SelectionPanel selection={hud.selection} />
        <CommandCard selection={hud.selection} onBuildWorker={doBuildWorker} onStop={doStop} />
      </div>
    </div>
  );
}
