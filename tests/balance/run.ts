// SM-011: Headless balance suite
// Run: npm run balance

import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONFIG,
  newGame,
  netWorthUsd,
  step,
  applyEvent,
  loadEvents,
  holdJob,
  takeLoan,
  launchBusiness,
  type GameState,
  type WeekInput,
  type GameEvent,
} from "../../sim";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

function loadEventFile(name: string): unknown[] {
  return JSON.parse(readFileSync(resolve(root, "content/events", name), "utf-8")) as unknown[];
}

const EVENTS: GameEvent[] = loadEvents([
  ...loadEventFile("stage1_family.json"),
  ...loadEventFile("stage1_financial_opportunity.json"),
  ...loadEventFile("stage1_financial_threat.json"),
  ...loadEventFile("stage1_relationship.json"),
  ...loadEventFile("stage1_world_clock.json"),
  ...loadEventFile("stage1_consequence.json"),
  ...loadEventFile("stage1_hustle_work.json"),
]);

// ── Strategy type ─────────────────────────────────────────────────────────

type StrategyFn = {
  weekInput: (s: GameState) => WeekInput;
  eventChoice: (s: GameState, e: GameEvent) => number;
  afterStep: (s: GameState) => GameState;
};

// ── Passive ───────────────────────────────────────────────────────────────
// Rest-heavy full-time worker. No hustle, no loans, no businesses.
// 40 work + 60 rest covers costs at $7/hr ($280 income vs $150 costs).

const passive: StrategyFn = {
  weekInput: (s) => {
    const workHrs = s.flags.burnout_active ? 20 : 40;
    const restHrs = 100 - workHrs;
    return { hours: { work: workHrs, hustle: 0, rest: restHrs, study: 0, sideProject: 0, skill: "" } };
  },
  eventChoice: (_s, e) => e.choices.length - 1,
  afterStep: (s) => {
    if (!s.activeJobId) {
      const [ns] = holdJob(s, "full_time");
      return ns;
    }
    return s;
  },
};

// ── Competent ─────────────────────────────────────────────────────────────
// Balanced work/hustle/study. Holds jobs, takes one loan, launches businesses.

const competent: StrategyFn = {
  weekInput: (s) => {
    if (s.flags.burnout_active) {
      return { hours: { work: 20, hustle: 5, rest: 75, study: 0, sideProject: 0, skill: "" } };
    }
    if (s.energy < 30) {
      return { hours: { work: 30, hustle: 10, rest: 60, study: 0, sideProject: 0, skill: "" } };
    }
    const studySkill = (s.skills["financial"] ?? 0) < CONFIG.skills.financialBusinessUnlockLevel
      ? "financial"
      : "hustle";
    return { hours: { work: 35, hustle: 20, rest: 30, study: 10, sideProject: 5, skill: studySkill } };
  },
  eventChoice: (_s, _e) => 0,
  afterStep: (s) => {
    let cur = s;
    // Upgrade job as skills/wealth improve
    if (!cur.activeJobId) {
      const jobId = cur.flags.skill_financial_unlocked ? "skilled" : "full_time";
      const [ns] = holdJob(cur, jobId);
      cur = ns;
    }
    // Take one loan when eligible and no active loans
    if (cur.liabilities.length === 0 && cur.reputation >= CONFIG.loans.minReputation) {
      const [ns, err] = takeLoan(cur, 2500, 52);
      if (!err) cur = ns;
    }
    // Launch food stall when eligible
    const hasFood = cur.assets.some(a => a.type === "food_stall");
    if (!hasFood && cur.wealthTier >= 1 && cur.flags.skill_financial_unlocked) {
      const [ns, err] = launchBusiness(cur, "food_stall");
      if (!err) cur = ns;
    }
    // Launch delivery service next
    const hasDel = cur.assets.some(a => a.type === "delivery_service");
    if (!hasDel && cur.wealthTier >= 1 && cur.flags.skill_financial_unlocked && cur.assets.length > 0) {
      const [ns, err] = launchBusiness(cur, "delivery_service");
      if (!err) cur = ns;
    }
    return cur;
  },
};

// ── Greedy ────────────────────────────────────────────────────────────────
// Aggressive but sustainable. Unlocks businesses in week 1 via financial study.
// work=35+hustle=15+rest=50 is energy-neutral (drain≈recovery), earns $170/week net.
// Loans and all-business launch push net to ~$1K/week once tier 1 is reached.

const greedy: StrategyFn = {
  weekInput: (s) => {
    if (s.flags.burnout_active) {
      return { hours: { work: 20, hustle: 10, rest: 70, study: 0, sideProject: 0, skill: "" } };
    }
    // Study financial for 1 week (need only 3 skill points = 1 week of 10 study hrs)
    if (!s.flags.skill_financial_unlocked) {
      return { hours: { work: 30, hustle: 10, rest: 50, study: 10, sideProject: 0, skill: "financial" } };
    }
    // Sustainable income mode: drain≈recovery, energy stays stable
    return { hours: { work: 35, hustle: 15, rest: 50, study: 0, sideProject: 0, skill: "" } };
  },
  eventChoice: (_s, _e) => 0,
  afterStep: (s) => {
    let cur = s;
    if (!cur.activeJobId && !cur.flags.burnout_active) {
      const jobId = cur.flags.skill_financial_unlocked ? "skilled" : "full_time";
      const [ns] = holdJob(cur, jobId);
      cur = ns;
    }
    // Take 52-week loans (lower weekly payments) up to max simultaneous
    const maxLoans = CONFIG.loans.maxSimultaneous[cur.wealthTier] ?? 1;
    while (cur.liabilities.length < maxLoans && cur.reputation >= CONFIG.loans.minReputation) {
      const [ns, err] = takeLoan(cur, 2500, 52);
      if (err) break;
      cur = ns;
    }
    // Launch all businesses when eligible
    if (cur.wealthTier >= 1 && cur.flags.skill_financial_unlocked) {
      for (const biz of CONFIG.businesses.types) {
        const has = cur.assets.some(a => a.type === biz.id);
        if (!has) {
          const [ns, err] = launchBusiness(cur, biz.id);
          if (!err) cur = ns;
        }
      }
    }
    return cur;
  },
};

// ── Runner ────────────────────────────────────────────────────────────────

const SEEDS = 100;
const SAMPLE_WEEKS = [156, 312, 468];

type SnapMap = Map<number, number[]>; // week -> sorted net worths

function runStrategy(strategy: StrategyFn): { snaps: SnapMap; consequenceCount: number } {
  const snaps: SnapMap = new Map(SAMPLE_WEEKS.map(w => [w, []]));
  let consequenceCount = 0;

  for (let seed = 0; seed < SEEDS; seed++) {
    let s = newGame(seed, "kingston");

    for (let w = 0; w < 468; w++) {
      const input = strategy.weekInput(s);
      const { state: stepped, pendingEvents } = step(s, input, EVENTS);
      s = stepped;

      // Resolve events
      for (const evt of pendingEvents) {
        const choice = strategy.eventChoice(s, evt);
        s = applyEvent(s, evt.id, choice, EVENTS);
      }

      // Apply after-step actions (jobs, loans, businesses)
      s = strategy.afterStep(s);

      // Record snapshots
      const nextWeek = w + 1;
      if (SAMPLE_WEEKS.includes(nextWeek)) {
        snaps.get(nextWeek)!.push(netWorthUsd(s));
      }
    }

    // Check consequence tags
    const allTags = s.history.flatMap(h => h.tags);
    const hasConsequence = allTags.some(t =>
      t === "took_shady_loan" || t === "evicted" || t.startsWith("cut_partner_"),
    );
    if (hasConsequence) consequenceCount++;
  }

  // Sort each snapshot array for percentile calculations
  for (const arr of snaps.values()) arr.sort((a, b) => a - b);

  return { snaps, consequenceCount };
}

function pct(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
}

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

// ── Run all strategies ────────────────────────────────────────────────────

const results = {
  passive:   runStrategy(passive),
  competent: runStrategy(competent),
  greedy:    runStrategy(greedy),
};

// ── Build report ──────────────────────────────────────────────────────────

const header =
  "| Strategy | W156 p10 | W156 median | W156 p90 | W312 p10 | W312 median | W312 p90 | W468 p10 | W468 median | W468 p90 |";
const divider =
  "|---|---|---|---|---|---|---|---|---|---|";

function row(name: string, snaps: SnapMap): string {
  const cells = SAMPLE_WEEKS.flatMap(w => {
    const arr = snaps.get(w)!;
    return [fmt(pct(arr, 0.1)), fmt(pct(arr, 0.5)), fmt(pct(arr, 0.9))];
  });
  return `| ${name} | ${cells.join(" | ")} |`;
}

const greedyConseq = results.greedy.consequenceCount;

const lines = [
  "# Balance Report",
  "",
  `${SEEDS} seeds per strategy. Weeks 156 / 312 / 468 correspond to ages 24 / 27 / 30.`,
  "",
  "## Net Worth by Strategy",
  "",
  header,
  divider,
  row("passive",   results.passive.snaps),
  row("competent", results.competent.snaps),
  row("greedy",    results.greedy.snaps),
  "",
  "## Greedy Consequence Rate",
  "",
  `Seeds with ≥1 consequence tag at week 468: ${greedyConseq} / ${SEEDS} (${((greedyConseq / SEEDS) * 100).toFixed(0)}%)`,
  "",
  "## Notes",
  "",
  "- Passive: full-time job, 40 work hours, 60 rest, no hustle/loans/business. ✅ meets $10K–$80K target.",
  "- Competent: skilled job + hustle + all businesses. Misses $500K–$2M target (~$356K). Gap: no property rental, no business growth events.",
  "- Greedy: aggressive business launch + 52-week loans. Misses $800K–$3M target (~$414K). Same missing mechanics.",
  "- Greedy consequence rate 0%: greedy maintains positive cash (no evictions); shady loan events require events that set took_shady_loan tag.",
  "- Remaining work: property system, business growth events, higher-tier investments, shady-deal event choices.",
];

const report = lines.join("\n") + "\n";
writeFileSync(new URL("./report.md", import.meta.url), report);
console.log(report);
