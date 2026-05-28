-- Match persistence + netcode tables for Cavebreak (docs/multiplayer.md).
-- Schema only: the game client is NOT wired to these yet. Friends-only, no accounts.
-- Idempotent so the GitHub integration can re-apply safely.

-- A started game (one per lobby launch).
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid references public.lobbies (id) on delete set null,
  map_seed integer not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress', 'finished', 'abandoned')),
  winner_slot integer,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  slot integer not null,
  display_name text not null,
  color text,
  result text check (result in ('won', 'lost', 'left')),
  unique (match_id, slot)
);

-- Player command log — supports the command/lockstep netcode option + replays (docs/multiplayer.md).
create table if not exists public.match_commands (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches (id) on delete cascade,
  tick integer not null,
  slot integer not null,
  command jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists match_commands_match_tick_idx on public.match_commands (match_id, tick);

-- Periodic authoritative state snapshots — supports the state-broadcast netcode option + reconnect/replays.
create table if not exists public.match_snapshots (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches (id) on delete cascade,
  tick integer not null,
  state jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists match_snapshots_match_tick_idx on public.match_snapshots (match_id, tick);

-- Realtime for live match sync (guarded for re-runs).
do $$
declare
  t text;
begin
  foreach t in array array['matches', 'match_players', 'match_commands'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- RLS: permissive anon access (private friends game; tighten if it ever goes public).
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.match_commands enable row level security;
alter table public.match_snapshots enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['matches', 'match_players', 'match_commands', 'match_snapshots'] loop
    execute format('drop policy if exists "anon read %1$s" on public.%1$I', tbl);
    execute format('create policy "anon read %1$s" on public.%1$I for select using (true)', tbl);
    execute format('drop policy if exists "anon write %1$s" on public.%1$I', tbl);
    execute format('create policy "anon write %1$s" on public.%1$I for all using (true) with check (true)', tbl);
  end loop;
end $$;
