"use client";

export interface HudSelection {
  kind: "none" | "units" | "base";
  count: number;
  baseId?: number;
  baseQueue?: number;
  unitState?: string;
  canBuildWorker?: boolean;
}

export interface HudData {
  minerals: number;
  gas: number;
  supplyUsed: number;
  supplyMax: number;
  selection: HudSelection;
}

export function TopBar({ minerals, gas, supplyUsed, supplyMax }: HudData) {
  const supplyCapped = supplyUsed >= supplyMax;
  return (
    <div className="pointer-events-none absolute left-0 top-0 flex gap-6 px-4 py-2 font-mono text-sm">
      <Stat label="Minerals" value={Math.floor(minerals)} color="text-cyan-300" />
      <Stat label="Gas" value={Math.floor(gas)} color="text-green-300" />
      <Stat
        label="Supply"
        value={`${supplyUsed}/${supplyMax}`}
        color={supplyCapped ? "text-red-400" : "text-zinc-200"}
      />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className={`text-base font-semibold ${color}`}>{value}</span>
    </div>
  );
}

export function SelectionPanel({ selection }: { selection: HudSelection }) {
  return (
    <div className="flex-1 border-x border-zinc-800 px-4 py-3">
      {selection.kind === "none" && (
        <p className="text-sm text-zinc-600">Nothing selected.</p>
      )}
      {selection.kind === "base" && (
        <div>
          <p className="text-sm font-semibold text-zinc-200">Base</p>
          <p className="text-xs text-zinc-400">Townhall · produces workers · deposit point</p>
          <p className="mt-1 text-xs text-zinc-500">Queue: {selection.baseQueue ?? 0}</p>
        </div>
      )}
      {selection.kind === "units" && (
        <div>
          <p className="text-sm font-semibold text-zinc-200">
            {selection.count} Worker{selection.count > 1 ? "s" : ""}
          </p>
          {selection.count === 1 && selection.unitState && (
            <p className="text-xs text-zinc-400">State: {labelState(selection.unitState)}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function CommandCard({
  selection,
  onBuildWorker,
  onStop,
}: {
  selection: HudSelection;
  onBuildWorker: () => void;
  onStop: () => void;
}) {
  return (
    <div className="w-72 px-4 py-3">
      {selection.kind === "base" && (
        <button
          onClick={onBuildWorker}
          disabled={!selection.canBuildWorker}
          className="w-full rounded bg-zinc-800 px-3 py-2 text-left text-sm text-zinc-100 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="font-semibold">Build Worker</span>{" "}
          <kbd className="rounded bg-zinc-900 px-1 text-xs text-zinc-400">B</kbd>
          <span className="ml-2 text-xs text-cyan-300">50 min</span>
        </button>
      )}
      {selection.kind === "units" && (
        <div className="space-y-2 text-xs text-zinc-400">
          <p>
            <span className="text-zinc-300">Right-click</span> rock to mine · mineral to gather ·
            floor to move
          </p>
          <div className="flex gap-2">
            <Hint k="A">attack-move</Hint>
            <button
              onClick={onStop}
              className="rounded bg-zinc-800 px-2 py-1 text-zinc-200 hover:bg-zinc-700"
            >
              Stop <kbd className="text-zinc-500">S</kbd>
            </button>
          </div>
        </div>
      )}
      {selection.kind === "none" && (
        <p className="text-xs text-zinc-600">
          Arrow keys / minimap to pan. Left-click or drag to select.
        </p>
      )}
    </div>
  );
}

function Hint({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <span className="rounded bg-zinc-800 px-2 py-1 text-zinc-300">
      <kbd className="text-zinc-500">{k}</kbd> {children}
    </span>
  );
}

function labelState(s: string): string {
  switch (s) {
    case "mining_wall":
      return "mining wall";
    case "returning_resource":
      return "returning cargo";
    default:
      return s;
  }
}
