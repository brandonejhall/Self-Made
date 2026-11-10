// SM-023: contract between the phone shell (ui/main.ts) and each phone app.
// An app is one module: a render function plus its own action handlers.
// To add an app, write ui/apps/<name>.ts exporting a PhoneApp and add it to ui/apps/index.ts.

import type { GameState } from "../../sim";

// Every sim action has this shape: pure, returns the new state or an error string.
export type SimAction = (state: GameState) => [GameState, string | null];

export interface AppContext {
  /** Current sim state. Read-only for apps. */
  getState(): GameState;
  /**
   * Run a sim action. On success the shell stores the new state, saves to
   * localStorage and re-renders the app with `successMessage`. On failure the
   * shell shows the sim's error string. Returns true on success.
   */
  run(action: SimAction, successMessage: string): boolean;
  /** UI-only metadata store (never game outcomes), persisted by the shell. */
  meta: UiMeta;
}

export interface LoanMeta {
  aprPct: number;
  termWeeks: number;
}

export interface UiMeta {
  loans: Record<string, LoanMeta>;
}

export interface PhoneApp {
  id: string;
  name: string;
  /** Short glyph shown on the home screen tile. */
  icon: string;
  /** True for apps that are not wired to the sim yet. */
  placeholder?: boolean;
  render(root: HTMLElement, ctx: AppContext): void;
}
