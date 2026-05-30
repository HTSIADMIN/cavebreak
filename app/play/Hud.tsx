"use client";

import { PlayerStats, UnitType } from "@/game/sim";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface HudAction {
  id: string;
  key: string; // hotkey letter
  label: string;
  cost?: string;
  disabled?: boolean;
  tooltip?: string;
  active?: boolean; // highlighted (e.g. the current stance)
  tone?: "default" | "danger"; // accent color
}

// One chip in the unit-type quick-select bar.
export interface QuickGroup {
  type: UnitType;
  label: string;
  count: number;
  selected: boolean; // any of this type currently in the selection
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
  quickGroups?: QuickGroup[]; // unit-type quick-select bar
  stats?: PlayerStats[]; // parallel to players; for the end-game summary
  durationSec?: number;
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
      {actions.map((a) => {
        const border = a.active
          ? a.tone === "danger"
            ? "border-red-400 bg-red-500/15"
            : "border-cyan-400 bg-cyan-500/15"
          : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800";
        return (
          <Tooltip key={a.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onAction(a.id)}
                disabled={a.disabled}
                className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded border px-1 text-center leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${border}`}
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
        );
      })}
    </div>
  );
}

const UNIT_GLYPH: Record<UnitType, string> = { worker: "⛏", zealot: "⚔", stalker: "⊿" };

// Bottom quick-select bar: one chip per unit type the player owns; click selects all of them.
export function QuickSelectBar({
  groups,
  onSelectType,
}: {
  groups?: QuickGroup[];
  onSelectType: (type: UnitType) => void;
}) {
  if (!groups || groups.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 border-b border-zinc-800 bg-zinc-950/80 px-2 py-1">
      <span className="mr-1 text-[10px] uppercase tracking-wider text-zinc-600">Army</span>
      {groups.map((g) => (
        <button
          key={g.type}
          onClick={() => onSelectType(g.type)}
          title={`Select all ${g.label}s (${g.count})`}
          className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs transition-colors ${
            g.selected ? "border-cyan-400 bg-cyan-500/15" : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
          }`}
        >
          <span className="text-sm leading-none">{UNIT_GLYPH[g.type]}</span>
          <span className="font-medium text-zinc-200">{g.label}</span>
          <span className="rounded bg-zinc-950 px-1 font-mono text-[10px] text-zinc-400">{g.count}</span>
        </button>
      ))}
    </div>
  );
}

const STAT_COLS: { key: keyof PlayerStats; label: string }[] = [
  { key: "unitsProduced", label: "Built" },
  { key: "unitsKilled", label: "Killed" },
  { key: "unitsLost", label: "Lost" },
  { key: "buildingsConstructed", label: "Bldgs" },
  { key: "buildingsDestroyed", label: "Razed" },
  { key: "mineralsGathered", label: "Minerals" },
  { key: "gasGathered", label: "Gas" },
  { key: "peakSupply", label: "Peak sup." },
];

export function WinnerBanner({
  winner,
  localPlayer,
  localDefeated,
  players,
  stats,
  durationSec,
  onRestart,
  onMenu,
}: {
  winner: number | null;
  localPlayer: number;
  localDefeated?: boolean;
  players?: PlayerStatusInfo[];
  stats?: PlayerStats[];
  durationSec?: number;
  onRestart?: () => void;
  onMenu?: () => void;
}) {
  const over = winner !== null || localDefeated;
  if (!over) return null;
  const won = winner === localPlayer;
  const dur =
    durationSec != null
      ? `${Math.floor(durationSec / 60)}:${String(Math.floor(durationSec % 60)).padStart(2, "0")}`
      : null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950/90 p-6 text-center backdrop-blur-sm">
        <p className={`text-5xl font-bold tracking-tight ${won ? "text-cyan-300" : "text-red-300"}`}>
          {won ? "Victory" : "Defeat"}
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          {!won && winner !== null ? "The cave belongs to another." : "Last settlement standing."}
          {dur && <span className="text-zinc-500"> · {dur}</span>}
        </p>

        {stats && players && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-right text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="px-2 py-1 text-left font-medium">Player</th>
                  {STAT_COLS.map((c) => (
                    <th key={c.key} className="px-2 py-1 font-medium">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={i} className="border-t border-zinc-800/70">
                    <td className="px-2 py-1.5 text-left">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-black/40" style={{ background: p.color }} />
                        <span className={p.defeated ? "text-zinc-500" : "text-zinc-200"}>{p.label}</span>
                      </span>
                    </td>
                    {STAT_COLS.map((c) => (
                      <td key={c.key} className="px-2 py-1.5 font-mono text-zinc-300">
                        {Math.round(stats[i]?.[c.key] ?? 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 flex justify-center gap-2">
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
