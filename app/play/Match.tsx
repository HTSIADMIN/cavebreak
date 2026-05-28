"use client";

import { useEffect, useRef, useState } from "react";
import {
  applyCommand,
  BUILDING_STATS,
  BuildingType,
  canPlaceBuilding,
  Command,
  createInitialState,
  DT,
  GameState,
  getTile,
  MAP_H,
  MAP_W,
  step,
  TICK_RATE_HZ,
  TileType,
  UNIT_STATS,
  UnitType,
} from "@/game/sim";
import { Camera } from "@/game/render/camera";
import { renderGame, renderMinimap, RenderView } from "@/game/render/renderer";
import { CommandCard, HudAction, HudData, SelectionPanel, TopBar, WinnerBanner } from "./Hud";

const LOCAL_PLAYER = 0;
const PAN_SPEED = 24;
const DRAG_THRESHOLD = 5;

const EMPTY_HUD: HudData = {
  minerals: 0, gas: 0, supplyUsed: 0, supplyMax: 0,
  winner: null, localPlayer: LOCAL_PLAYER,
  title: "Nothing selected", actions: [],
};

function costStr(m: number, g: number): string {
  return g > 0 ? `${m}/${g}g` : `${m}`;
}

// Build the selection summary + command-card actions from current state + selection.
function computeSelection(s: GameState, sel: Set<number>): {
  title: string; sub?: string; hint?: string; actions: HudAction[];
} {
  const p = s.players[LOCAL_PLAYER];
  const units = s.units.filter((u) => sel.has(u.id) && u.owner === LOCAL_PLAYER);
  if (units.length > 0) {
    const workers = units.filter((u) => u.type === "worker");
    const sameType = units.every((u) => u.type === units[0].type);
    const title =
      units.length === 1
        ? UNIT_STATS[units[0].type].label
        : `${units.length} ${sameType ? UNIT_STATS[units[0].type].label + "s" : "Units"}`;
    const actions: HudAction[] = [];
    if (workers.length > 0) {
      const ps = BUILDING_STATS.pylon, gs = BUILDING_STATS.gateway, cs = BUILDING_STATS.cannon;
      actions.push({ id: "build:pylon", key: "E", label: "Pylon", cost: costStr(ps.minerals, ps.gas), disabled: p.minerals < ps.minerals });
      actions.push({ id: "build:gateway", key: "R", label: "Gateway", cost: costStr(gs.minerals, gs.gas), disabled: p.minerals < gs.minerals });
      actions.push({ id: "build:cannon", key: "T", label: "Cannon", cost: costStr(cs.minerals, cs.gas), disabled: p.minerals < cs.minerals });
    }
    actions.push({ id: "stop", key: "S", label: "Stop" });
    const hint =
      workers.length > 0
        ? "Right-click: rock = mine · mineral = gather · floor = move. A = attack-move."
        : "A = attack-move · right-click an enemy to attack.";
    return { title, sub: units.length === 1 ? stateLabel(units[0].state) : undefined, hint, actions };
  }

  const b = s.buildings.find((bb) => sel.has(bb.id) && bb.owner === LOCAL_PLAYER);
  if (b) {
    const st = BUILDING_STATS[b.type];
    const actions: HudAction[] = [];
    let sub = b.built ? undefined : "Warping in…";
    if (b.built) {
      if (b.type === "nexus") {
        const ws = UNIT_STATS.worker;
        actions.push({ id: "train:worker", key: "Q", label: "Worker", cost: costStr(ws.minerals, ws.gas), disabled: p.minerals < ws.minerals || p.supplyUsed + ws.supply > p.supplyMax });
        sub = `Queue: ${b.queue.length} · supply +${st.supply}`;
      } else if (b.type === "gateway") {
        const z = UNIT_STATS.zealot, k = UNIT_STATS.stalker;
        actions.push({ id: "train:zealot", key: "Q", label: "Zealot", cost: costStr(z.minerals, z.gas), disabled: p.minerals < z.minerals || p.supplyUsed + z.supply > p.supplyMax });
        actions.push({ id: "train:stalker", key: "W", label: "Stalker", cost: costStr(k.minerals, k.gas), disabled: p.minerals < k.minerals || p.gas < k.gas || p.supplyUsed + k.supply > p.supplyMax });
        sub = `Queue: ${b.queue.length}`;
      } else if (b.type === "pylon") {
        sub = `Supply +${st.supply} · powers nearby buildings`;
      } else if (b.type === "cannon") {
        sub = "Static defense";
      }
    }
    return { title: st.label, sub, actions };
  }

  return {
    title: "Nothing selected",
    hint: "Left-click / drag to select. Arrow keys or minimap to pan.",
    actions: [],
  };
}

function stateLabel(st: string): string {
  const map: Record<string, string> = {
    mining_wall: "mining wall",
    returning_resource: "returning cargo",
    attack_moving: "attack-moving",
  };
  return map[st] ?? st;
}

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
  const placementRef = useRef<BuildingType | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const miniDragRef = useRef(false);
  const sizeRef = useRef({ w: 0, h: 0 });
  const actionsRef = useRef<HudAction[]>([]);

  function dispatch(cmd: Command) {
    const s = stateRef.current;
    if (s) applyCommand(s, cmd);
  }
  function selectedUnitIds(): number[] {
    const s = stateRef.current;
    if (!s) return [];
    return s.units.filter((u) => selectedRef.current.has(u.id) && u.owner === LOCAL_PLAYER).map((u) => u.id);
  }
  function selectedWorkerIds(): number[] {
    const s = stateRef.current;
    if (!s) return [];
    return s.units.filter((u) => selectedRef.current.has(u.id) && u.owner === LOCAL_PLAYER && u.type === "worker").map((u) => u.id);
  }
  function selectedBuilding() {
    const s = stateRef.current;
    if (!s) return null;
    return s.buildings.find((b) => selectedRef.current.has(b.id) && b.owner === LOCAL_PLAYER) ?? null;
  }
  function onAction(id: string) {
    if (id.startsWith("build:")) {
      if (selectedWorkerIds().length > 0) placementRef.current = id.slice(6) as BuildingType;
      return;
    }
    if (id.startsWith("train:")) {
      const b = selectedBuilding();
      if (b) dispatch({ type: "train", buildingId: b.id, unitType: id.slice(6) as UnitType });
      return;
    }
    if (id === "stop") {
      const ids = selectedUnitIds();
      if (ids.length) dispatch({ type: "stop", unitIds: ids });
    }
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
        select: (ids: number[]) => { selectedRef.current = new Set(ids); },
        dispatch: (c: Command) => applyCommand(state, c),
        ff: (n: number) => { for (let i = 0; i < n && state.winner === null; i++) step(state, DT); },
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

    const myNexus = state.buildings.find((b) => b.owner === LOCAL_PLAYER && b.type === "nexus");
    if (myNexus) cam.centerOn(myNexus.tx + myNexus.w / 2, myNexus.ty + myNexus.h / 2, MAP_W, MAP_H, sizeRef.current.w, sizeRef.current.h);

    const ro = new ResizeObserver(resizeMain);
    ro.observe(wrapRef.current!);

    const canvasXY = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        inside: e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom,
      };
    };
    const worldAt = (sx: number, sy: number) => ({ wx: cam.screenToWorldX(sx), wy: cam.screenToWorldY(sy) });
    const placementTile = (): { tx: number; ty: number } | null => {
      const type = placementRef.current;
      if (!type) return null;
      const { wx, wy } = worldAt(mouseRef.current.x, mouseRef.current.y);
      const st = BUILDING_STATS[type];
      return { tx: Math.round(wx - st.w / 2), ty: Math.round(wy - st.h / 2) };
    };

    const tileVisible = (tx: number, ty: number) =>
      tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && state.visibility[ty * MAP_W + tx] === 2;
    const pickEnemyAt = (wx: number, wy: number): number | null => {
      const u = state.units.find((e) => e.owner !== LOCAL_PLAYER && Math.hypot(e.x - wx, e.y - wy) < 0.5 && tileVisible(Math.floor(e.x), Math.floor(e.y)));
      if (u) return u.id;
      const b = state.buildings.find((e) => e.owner !== LOCAL_PLAYER && wx >= e.tx && wx < e.tx + e.w && wy >= e.ty && wy < e.ty + e.h && tileVisible(Math.floor(e.tx + e.w / 2), Math.floor(e.ty + e.h / 2)));
      return b ? b.id : null;
    };

    const issueRightClick = (sx: number, sy: number) => {
      const { wx, wy } = worldAt(sx, sy);
      const tx = Math.floor(wx);
      const ty = Math.floor(wy);
      const ids = selectedUnitIds();
      if (ids.length === 0) {
        const b = selectedBuilding();
        if (b) dispatch({ type: "setRally", buildingId: b.id, tx, ty });
        return;
      }
      const enemy = pickEnemyAt(wx, wy);
      if (enemy !== null) {
        dispatch({ type: "attack", unitIds: ids, targetId: enemy });
        return;
      }
      const t = getTile(state.grid, tx, ty);
      if (t === TileType.ROCK) dispatch({ type: "mine", unitIds: ids, tx, ty });
      else if (t === TileType.MINERAL || t === TileType.GEYSER) {
        const dep = state.deposits.find((d) => d.tx === tx && d.ty === ty);
        if (dep) dispatch({ type: "harvest", unitIds: ids, depositId: dep.id });
        else dispatch({ type: "move", unitIds: ids, tx, ty });
      } else dispatch({ type: "move", unitIds: ids, tx, ty });
    };

    const clickSelect = (sx: number, sy: number, shift: boolean) => {
      const { wx, wy } = worldAt(sx, sy);
      const unit = state.units.find((u) => u.owner === LOCAL_PLAYER && Math.hypot(u.x - wx, u.y - wy) < 0.45);
      if (unit) {
        if (!shift) selectedRef.current = new Set();
        selectedRef.current.add(unit.id);
        return;
      }
      const b = state.buildings.find((bb) => bb.owner === LOCAL_PLAYER && wx >= bb.tx && wx < bb.tx + bb.w && wy >= bb.ty && wy < bb.ty + bb.h);
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
      if (found.size > 0) selectedRef.current = found;
    };

    const onMouseDown = (e: MouseEvent) => {
      const { x, y, inside } = canvasXY(e);
      if (!inside) return;
      if (e.button === 0) {
        if (placementRef.current) {
          const t = placementTile();
          const type = placementRef.current;
          if (t && canPlaceBuilding(state, LOCAL_PLAYER, type, t.tx, t.ty)) {
            const ws = selectedWorkerIds();
            if (ws.length) dispatch({ type: "build", unitIds: ws, buildingType: type, tx: t.tx, ty: t.ty });
          }
          if (!e.shiftKey) placementRef.current = null;
          return;
        }
        if (attackModeRef.current) {
          const { wx, wy } = worldAt(x, y);
          const ids = selectedUnitIds();
          if (ids.length) dispatch({ type: "attackMove", unitIds: ids, tx: Math.floor(wx), ty: Math.floor(wy) });
          attackModeRef.current = false;
          return;
        }
        dragRef.current = { active: true, moved: false, x0: x, y0: y, x1: x, y1: y };
      } else if (e.button === 2) {
        e.preventDefault();
        if (placementRef.current) {
          placementRef.current = null;
          return;
        }
        attackModeRef.current = false;
        issueRightClick(x, y);
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      const { x, y } = canvasXY(e);
      mouseRef.current = { x, y };
      const d = dragRef.current;
      if (d?.active) {
        d.x1 = x;
        d.y1 = y;
        if (Math.hypot(d.x1 - d.x0, d.y1 - d.y0) > DRAG_THRESHOLD) d.moved = true;
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const d = dragRef.current;
      if (!d?.active) return;
      dragRef.current = null;
      if (d.moved) boxSelect(d);
      else clickSelect(d.x0, d.y0, e.shiftKey);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) {
        e.preventDefault();
        keysRef.current.add(k);
        return;
      }
      const lk = k.toLowerCase();
      if (lk === "escape") {
        if (placementRef.current) placementRef.current = null;
        else {
          selectedRef.current = new Set();
          attackModeRef.current = false;
        }
        return;
      }
      if (lk === "a" && selectedUnitIds().length > 0) {
        attackModeRef.current = true;
        return;
      }
      const action = actionsRef.current.find((a) => a.key.toLowerCase() === lk && !a.disabled);
      if (action) onAction(action.id);
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const panFromKeys = (dt: number) => {
      let dx = 0, dy = 0;
      const keys = keysRef.current;
      if (keys.has("ArrowLeft")) dx -= 1;
      if (keys.has("ArrowRight")) dx += 1;
      if (keys.has("ArrowUp")) dy -= 1;
      if (keys.has("ArrowDown")) dy += 1;
      if (dx || dy) cam.pan(dx * PAN_SPEED * dt, dy * PAN_SPEED * dt, MAP_W, MAP_H, sizeRef.current.w, sizeRef.current.h);
    };

    const pushHud = () => {
      const p = state.players[LOCAL_PLAYER];
      const selInfo = computeSelection(state, selectedRef.current);
      actionsRef.current = selInfo.actions;
      setHud({
        minerals: p.minerals, gas: p.gas, supplyUsed: p.supplyUsed, supplyMax: p.supplyMax,
        winner: state.winner, localPlayer: LOCAL_PLAYER,
        title: selInfo.title, sub: selInfo.sub, hint: selInfo.hint, actions: selInfo.actions,
      });
    };

    const draw = () => {
      const { w, h } = sizeRef.current;
      const d = dragRef.current;
      let placement: RenderView["placement"] = null;
      const ptype = placementRef.current;
      if (ptype) {
        const t = placementTile();
        if (t) placement = { type: ptype, tx: t.tx, ty: t.ty, valid: canPlaceBuilding(state, LOCAL_PLAYER, ptype, t.tx, t.ty) && selectedWorkerIds().length > 0 };
      }
      const view: RenderView = {
        selected: selectedRef.current,
        localPlayer: LOCAL_PLAYER,
        dragScreen: d?.active && d.moved ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null,
        placement,
      };
      renderGame(ctx, w, h, state, cam, view);
      renderMinimap(mctx, mini.clientWidth, mini.clientHeight, state, cam, w, h);
    };

    // Simulation runs on a fixed-timestep interval (independent of display refresh,
    // and keeps advancing when the tab is backgrounded — rAF would pause).
    let raf = 0;
    let hudCtr = 0;
    let simLast = performance.now();
    let acc = 0;
    const stepOnce = () => {
      const now = performance.now();
      let dt = (now - simLast) / 1000;
      simLast = now;
      if (dt > 0.5) dt = 0.5; // cap catch-up after a stall
      acc += dt;
      let steps = 0;
      while (acc >= DT && steps < 16) {
        if (state.winner === null) step(state, DT);
        acc -= DT;
        steps++;
      }
      if (++hudCtr % 6 === 0) pushHud();
      if (document.hidden) draw(); // rAF is paused while hidden; keep the canvas current
    };
    const simTimer = window.setInterval(stepOnce, 1000 / TICK_RATE_HZ);

    // Rendering + camera panning on rAF for smoothness while visible.
    let rafLast = performance.now();
    const renderLoop = (now: number) => {
      const dt = Math.min(0.1, (now - rafLast) / 1000);
      rafLast = now;
      panFromKeys(dt);
      draw();
      raf = requestAnimationFrame(renderLoop);
    };
    raf = requestAnimationFrame(renderLoop);

    return () => {
      clearInterval(simTimer);
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
        <WinnerBanner winner={hud.winner} localPlayer={hud.localPlayer} />
      </div>
      <div className="flex h-44 items-stretch border-t border-zinc-800 bg-zinc-950">
        <div className="p-2">
          <canvas
            ref={miniRef}
            className="h-40 w-40 rounded border border-zinc-800 bg-black"
            onMouseDown={(e) => { miniDragRef.current = true; miniGoto(e); }}
            onMouseMove={(e) => { if (miniDragRef.current) miniGoto(e); }}
            onMouseUp={() => (miniDragRef.current = false)}
            onMouseLeave={() => (miniDragRef.current = false)}
          />
        </div>
        <SelectionPanel title={hud.title} sub={hud.sub} hint={hud.hint} />
        <CommandCard actions={hud.actions} onAction={onAction} />
      </div>
    </div>
  );
}
