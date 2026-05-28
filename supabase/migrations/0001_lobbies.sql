-- Lobbies & players for Cavebreak multiplayer (docs/multiplayer.md).
-- Friends-only, no accounts: a display name is all that's needed to join.

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

-- Realtime so every client sees lobby/player changes live.
alter publication supabase_realtime add table public.lobbies;
alter publication supabase_realtime add table public.lobby_players;

-- RLS: private friends game with no anti-cheat hardening (docs/multiplayer.md).
-- Allow the anon key full access to lobby data for now; tighten if this ever goes public.
alter table public.lobbies enable row level security;
alter table public.lobby_players enable row level security;

create policy "anon read lobbies" on public.lobbies for select using (true);
create policy "anon write lobbies" on public.lobbies for all using (true) with check (true);
create policy "anon read lobby_players" on public.lobby_players for select using (true);
create policy "anon write lobby_players" on public.lobby_players for all using (true) with check (true);
