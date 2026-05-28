# Multiplayer

A private real-time game for the owner and friends. No anti-cheat hardening required (stated scope), which simplifies the netcode considerably.

## Model: Server-Authoritative (lightweight)

Even for a friends-only game, use a **client–server** model with the server as the source of truth for game state. This avoids the desync nightmares of pure peer-to-peer once you have more than 2 players, and keeps everyone's simulation consistent.

- Clients send **player intents/commands** (move these units, build this, mine that wall).
- The server validates and applies them to the authoritative game state and **broadcasts state/updates** back to all clients.
- Clients render from the state they receive (and may interpolate for smoothness).
- Because there's no anti-cheat requirement, validation can be light — but keeping the server authoritative still prevents accidental desyncs.

## Transport

- **Web app** (see [tech-stack.md](./tech-stack.md)) → use **WebSockets** for the real-time channel. Options:
  - **Supabase Realtime** (already in the stack, free tier covers a few friends comfortably), or
  - **Socket.io** if Supabase Realtime feels too coarse for fast tick updates.
- HTTP/packets are sent over the same internet connection as any web app — for a browser game you're on WebSocket (TCP) rather than raw UDP, which is fine at this scale.

## Sync Strategy

Two common approaches — pick based on effort vs. bandwidth:

1. **Command/lockstep-ish:** broadcast only player commands + a tick number; every client runs the same deterministic simulation. Low bandwidth, but requires a **fully deterministic** sim (tricky with floating point / pathing). 
2. **State broadcast (recommended for MVP):** server runs the sim and pushes authoritative state deltas on a fixed tick (e.g. 10–20 Hz). Simpler to get right; bandwidth is fine for 2–4 players on a small grid. **Start here.**

- Send each player only what their **fog of war** allows where practical (don't leak the whole map) — fog is per-player ([fog-of-war.md](./fog-of-war.md)). For MVP simplicity you may broadcast full state and let the client hide fogged areas; tighten later if needed.

## Lobby / Match Flow

1. A player creates a match (room/lobby) → gets a join code/link.
2. Friends join the lobby.
3. Host starts → server generates the map ([map-terrain.md](./map-terrain.md)), assigns spawn pockets, begins the tick loop.
4. Match runs until a win condition ([combat.md](./combat.md)) is met.

- **No account system** beyond a display name needed to join — keep friction near zero.

## Where the Sim Runs

- For Vercel (serverless) the long-lived tick loop doesn't fit a standard serverless function well. Options:
  - Run the authoritative sim in a **dedicated lightweight game server** (a small Node process) that clients connect to via WebSocket, with Vercel hosting the frontend; **or**
  - Use **Supabase Realtime + Postgres** as the shared state backbone with a server-side function/worker driving ticks.
- Flag this as a key architecture decision to lock early — see [tech-stack.md](./tech-stack.md).

## Related Systems

- [tech-stack.md](./tech-stack.md) — concrete hosting/runtime choices.
- [map-terrain.md](./map-terrain.md) — map state is the big authoritative structure to sync.
- [fog-of-war.md](./fog-of-war.md) — per-player visibility; ideally don't broadcast fogged info.
- [combat.md](./combat.md) — win condition ends the match.

## Implementation Notes

- **2026-05-28** — Supabase side scaffolded (still local, no netcode yet): `lib/supabase/client.ts` (browser client, anon key, Realtime) and `supabase/migrations/0001_lobbies.sql` (`lobbies` + `lobby_players`, permissive anon RLS, Realtime publication) per the lobby flow above. Env via `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`). DB home is the Supabase project `faexpupzpyubdcbooypo`; the migration still needs to be applied there (SQL editor or Supabase CLI). No lobby UI or state-sync wired yet.
