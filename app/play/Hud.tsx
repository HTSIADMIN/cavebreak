"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface HudAction {
  id: string;
  key: string; // hotkey letter
  label: string;
  cost?: string;
  disabled?: boolean;
  tooltip?: string;
}

export interface PlayerStatusInfo {
  color: string;
  label: string;
  defeated: boolean;
  isLocal: boolean;
}

export interface HudData {
  minerals: number;
  gas: number;
  supplyUsed: number;
  supplyMax: number;
  winner: number | null;
  localPlayer: number;
  localDefeated?: boolean;
  players?: PlayerStatusInfo[];
  title: string;
  sub?: string;
  hint?: string;
  actions: HudAction[];
}

// Top-right roster for free-for-alls: who's still in, by color. Hidden in 1v1.
export function PlayerStatus({ players }: { players?: PlayerStatusInfo[] }) {
  if (!players || players.length <= 2) return null;
  return (
    <div className="pointer-events-none absolute right-3 top-2 flex flex-col items-end gap-1 font-mono text-xs">
      {players.map((p, i) => (
        <div key={i} className={`flex items-center gap-1.5 ${p.defeated ? "opacity-40" : ""}`}>
          <span className={p.defeated ? "text-zinc-500 line-through" : "text-zinc-200"}>{p.label}</span>
          {p.defeated && <span className="text-[10px] uppercase text-red-400">out</span>}
          <span className="inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-black/40" style={{ background: p.color }} />
        </div>
      ))}
    </div>
  );
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
    <div className="grid w-72 grid-cols-3 content-start gap-1.5 p-2">
      {actions.map((a) => (
        <Tooltip key={a.id}>
          <TooltipTrigger asChild>
            <button
              onClick={() => onAction(a.id)}
              disabled={a.disabled}
              className="flex h-12 flex-col items-center justify-center gap-0.5 rounded border border-zinc-800 bg-zinc-900 px-1 text-center leading-none transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <span className="text-[10px] font-medium text-zinc-100">{a.label}</span>
              <span className="flex items-center gap-1 text-[9px]">
                {a.cost && <span className="text-cyan-300">{a.cost}</span>}
                <kbd className="rounded bg-zinc-950 px-1 text-zinc-500">{a.key}</kbd>
              </span>
            </button>
          </TooltipTrigger>
          {a.tooltip && (
            <TooltipContent side="top" className="max-w-56 whitespace-pre-line text-xs">
              {a.tooltip}
            </TooltipContent>
          )}
        </Tooltip>
      ))}
    </div>
  );
}

export function WinnerBanner({
  winner,
  localPlayer,
  localDefeated,
  onRestart,
  onMenu,
}: {
  winner: number | null;
  localPlayer: number;
  localDefeated?: boolean;
  onRestart?: () => void;
  onMenu?: () => void;
}) {
  const over = winner !== null || localDefeated;
  if (!over) return null;
  const won = winner === localPlayer;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className={`pointer-events-auto rounded-2xl px-10 py-6 text-center backdrop-blur-sm ${won ? "bg-cyan-500/15" : "bg-red-500/15"}`}>
        <p className={`text-5xl font-bold tracking-tight ${won ? "text-cyan-300" : "text-red-300"}`}>
          {won ? "Victory" : "Defeat"}
        </p>
        {!won && winner !== null && <p className="mt-1 text-sm text-zinc-400">The cave belongs to another.</p>}
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={onRestart}
            className="rounded-full bg-zinc-100 px-5 py-2 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white"
          >
            Play again
          </button>
          {onMenu && (
            <button
              onClick={onMenu}
              className="rounded-full border border-zinc-600 px-5 py-2 text-sm font-semibold text-zinc-200 transition-colors hover:bg-zinc-800"
            >
              New game
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
