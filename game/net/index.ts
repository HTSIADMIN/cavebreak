// Client networking bindings (placeholder).
//
// For the MVP the simulation runs locally in the browser (single player). When
// multiplayer lands (docs/multiplayer.md), this module will expose a transport
// that sends Commands to the authoritative server and applies broadcast state.
//
// The contract is intentionally tiny so a local stub and a real WebSocket /
// Supabase Realtime client are interchangeable.

import { Command, GameState } from "../sim";

export interface NetClient {
  /** Send a player intent to the authoritative sim. */
  send(cmd: Command): void;
  /** Latest authoritative state (local sim returns its own state). */
  getState(): GameState;
}
