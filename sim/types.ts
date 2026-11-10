import type { CityId } from "./config";

export interface HistoryEntry {
  week: number;
  action: string;
  tags: string[];
}

export interface GameState {
  version: 1;
  seed: number;
  rngState: number;
  week: number; // weeks since game start
  age: number;
  cityId: CityId;
  cashUsd: number;
  energy: number;
  reputation: number;
  history: HistoryEntry[];
  flags: Record<string, boolean>;
}

export interface WeekInput {
  hours: {
    work: number;
    hustle: number;
    rest: number;
  };
}
