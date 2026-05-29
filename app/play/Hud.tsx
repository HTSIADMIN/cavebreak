"use client";

export interface HudAction {
  id: string;
  key: string; // hotkey letter
  label: string;
  cost?: string;
  disabled?: boolean;
}

export interface HudData {
  minerals: number;
  gas: number;
  supplyUsed: number;
  supplyMax: number;
  winner: number | null;
  localPlayer: number;
  title: string;
  sub?: string;
  hint?: string;
  actions: HudAction[];
}

export function TopBar({ minerals, gas, supplyUsed, supplyMax }: HudData) {
  const capped = supplyUsed >= supplyMax;
  return (
    <div className="pointer-events-none absolute left-0 top-0 flex gap-6 px-4 py-2 font-mono text-sm">
      <Stat label="Minerals" value={Math.floor(minerals)} color="text-cyan-300" />
      <Stat label="Gas" value={Math.floor(gas)} color="text-green-300" />
      <Stat label="Supply" value={`${supplyUsed}/${supplyMax}`} color={capped ? "text-red-400" : "text-zinc-200"} />
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

export function SelectionPanel({ title, sub, hint }: { title: string; sub?: string; hint?: string }) {
  return (
    <div className="flex-1 border-x border-zinc-800 px-4 py-3">
      <p className="text-sm font-semibold text-zinc-200">{title}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
      {hint && <p className="mt-2 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function CommandCard({ actions, onAction }: { actions: HudAction[]; onAction: (id: string) => void }) {
  return (
    <div className="grid w-72 grid-cols-3 content-start gap-1.5 px-3 py-3">
      {actions.map((a) => (
        <button
          key={a.id}
          onClick={() => onAction(a.id)}
          disabled={a.disabled}
          title={a.cost}
          className="flex aspect-square flex-col items-center justify-center rounded border border-zinc-800 bg-zinc-900 p-1 text-center transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <span className="text-[11px] font-medium leading-tight text-zinc-100">{a.label}</span>
          {a.cost && <span className="mt-0.5 text-[9px] text-cyan-300">{a.cost}</span>}
          <kbd className="mt-0.5 rounded bg-zinc-950 px-1 text-[9px] text-zinc-500">{a.key}</kbd>
        </button>
      ))}
    </div>
  );
}

export function WinnerBanner({
  winner,
  localPlayer,
  onRestart,
}: {
  winner: number | null;
  localPlayer: number;
  onRestart?: () => void;
}) {
  if (winner === null) return null;
  const won = winner === localPlayer;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className={`pointer-events-auto rounded-2xl px-10 py-6 text-center backdrop-blur-sm ${won ? "bg-cyan-500/15" : "bg-red-500/15"}`}>
        <p className={`text-5xl font-bold tracking-tight ${won ? "text-cyan-300" : "text-red-300"}`}>
          {won ? "Victory" : "Defeat"}
        </p>
        <button
          onClick={onRestart}
          className="mt-3 rounded-full bg-zinc-100 px-5 py-2 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white"
        >
          Play again
        </button>
      </div>
    </div>
  );
}
