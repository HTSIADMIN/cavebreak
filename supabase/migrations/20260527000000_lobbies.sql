-- Lobbies & players for Cavebreak multiplayer (docs/multiplayer.md).
-- Friends-only, no accounts: a display name is all that's needed to join.
-- Written idempotently so the GitHub integration can re-apply it safely.

create table if not exists public.lobbies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,            -- short human-shareable join code
  host_name text not null,
  status text not null default 'waiting' check (status in ('waiting', 'in_progress', 'finished')),
  map_seed integer not null default 0,
  max_players integer not null default 2,
  created_at timestamptz not null default now()
);

create table if not exists public.lobby_players (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.lobbies (id) on delete cascade,
  display_name text not null,
  slot integer not null,                -- player index / spawn slot
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (lobby_id, slot)
);

create index if not exists lobby_players_lobby_id_idx on public.lobby_players (lobby_id);

-- Realtime so every client sees lobby/player changes live (guarded for re-runs).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lobbies'
  ) then
    alter publication supabase_realtime add table public.lobbies;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lobby_players'
  ) then
    alter publication supabase_realtime add table public.lobby_players;
  end if;
end $$;

-- RLS: private friends game with no anti-cheat hardening (docs/multiplayer.md).
-- Allow the anon key full access to lobby data for now; tighten if it ever goes public.
alter table public.lobbies enable row level security;
alter table public.lobby_players enable row level security;

drop policy if exists "anon read lobbies" on public.lobbies;
create policy "anon read lobbies" on public.lobbies for select using (true);
drop policy if exists "anon write lobbies" on public.lobbies;
create policy "anon write lobbies" on public.lobbies for all using (true) with check (true);

drop policy if exists "anon read lobby_players" on public.lobby_players;
create policy "anon read lobby_players" on public.lobby_players for select using (true);
drop policy if exists "anon write lobby_players" on public.lobby_players;
create policy "anon write lobby_players" on public.lobby_players for all using (true) with check (true);
