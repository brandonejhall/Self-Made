// Headless balance suite. balance-qa extends this with real strategies and metrics.
// Run: npm run balance

import { writeFileSync } from "node:fs";
import { CONFIG, newGame, netWorthUsd, step, type GameState, type WeekInput } from "../../sim";

type Strategy = (state: GameState, week: number) => WeekInput;

const H = CONFIG.time.hoursPerWeek;

const strategies: Record<string, Strategy> = {
  passive: () => ({ hours: { work: 40, hustle: 0, rest: 60 } }),
  competent: (s) =>
    s.energy < 30
      ? { hours: { work: 40, hustle: 5, rest: 55 } }
      : { hours: { work: 45, hustle: 15, rest: 40 } },
  greedy: () => ({ hours: { work: 55, hustle: 30, rest: 15 } }),
  random: (s, w) => {
    const work = (s.seed + w * 7) % 60;
    const hustle = Math.min(H - work, (s.seed + w * 13) % 40);
    return { hours: { work, hustle, rest: H - work - hustle } };
  },
};

const LIVES = 1000;
const YEARS = 9;
const WEEKS = YEARS * CONFIG.time.weeksPerYear;

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
}

const lines: string[] = [
  "# Balance report",
  "",
  `${LIVES} lives per strategy, ${YEARS} years, seeds 1 to ${LIVES}.`,
  "",
  "| Strategy | p10 net worth at 30 | Median at 30 | p90 at 30 | Ended below $0 |",
  "| --- | --- | --- | --- | --- |",
];

for (const [name, strategy] of Object.entries(strategies)) {
  const finals: number[] = [];
  let broke = 0;
  for (let seed = 1; seed <= LIVES; seed++) {
    let s = newGame(seed);
    for (let w = 0; w < WEEKS; w++) s = step(s, strategy(s, w));
    const nw = netWorthUsd(s);
    finals.push(nw);
    if (nw < 0) broke++;
  }
  finals.sort((a, b) => a - b);
  const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  lines.push(
    `| ${name} | ${fmt(percentile(finals, 0.1))} | ${fmt(percentile(finals, 0.5))} | ${fmt(percentile(finals, 0.9))} | ${((broke / LIVES) * 100).toFixed(1)}% |`,
  );
}

const report = lines.join("\n") + "\n";
writeFileSync(new URL("./report.md", import.meta.url), report);
console.log(report);
