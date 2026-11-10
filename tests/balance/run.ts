// SM-011 / SM-019: Headless balance suite
// Run: npm run balance
//
// Each strategy resolves pending events by its own rule, using effects read
// from content/events/*.json. Seeds 0..SEEDS-1 per strategy; every run is
// reproducible with newGame(seed, "kingston").

import { writeFileSync, readFileSync, readdirSync } from "node:fs";
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
  type EventChoice,
} from "../../sim";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const eventsDir = resolve(root, "content/events");

const EVENT_FILES = readdirSync(eventsDir).filter(f => f.endsWith(".json")).sort();
const EVENTS: GameEvent[] = loadEvents(
  EVENT_FILES.flatMap(f => JSON.parse(readFileSync(resolve(eventsDir, f), "utf-8")) as unknown[]),
);
const EVENT_BY_ID = new Map(EVENTS.map(e => [e.id, e]));

// What-if mode: BALANCE_WHATIF='{"businesses.types.0.weeklyIncomeUsd":900}' patches the
// in-memory CONFIG for this process only (sim/config.ts on disk is untouched) and prints
// the report to stdout without writing report.md. Used to size config recommendations.
const WHATIF = process.env.BALANCE_WHATIF ? (JSON.parse(process.env.BALANCE_WHATIF) as Record<string, unknown>) : null;
if (WHATIF) {
  for (const [path, value] of Object.entries(WHATIF)) {
    const keys = path.split(".");
    let obj = CONFIG as unknown as Record<string, unknown>;
    for (const k of keys.slice(0, -1)) {
      if (obj[k] === undefined) throw new Error(`BALANCE_WHATIF: unknown config path ${path}`);
      obj = obj[k] as Record<string, unknown>;
    }
    const last = keys[keys.length - 1]!;
    if (obj[last] === undefined) throw new Error(`BALANCE_WHATIF: unknown config path ${path}`);
    obj[last] = value;
  }
}

// Delayed consequence = an event whose trigger has requiresTags AND minYearsAfterTag.
const DELAYED_IDS = new Set(
  EVENTS.filter(e => (e.trigger.requiresTags?.length ?? 0) > 0 && e.trigger.minYearsAfterTag !== undefined)
    .map(e => e.id),
);

// Major delayed consequence: every choice costs >= MAJOR_CASH_USD cash or >= MAJOR_REP reputation,
// so the player cannot dodge it for free. Reported alongside the ticket's broader definition.
const MAJOR_CASH_USD = 250;
const MAJOR_REP = 10;
const MAJOR_IDS = new Set(
  EVENTS.filter(e => DELAYED_IDS.has(e.id) && e.choices.every(c =>
    (c.effects.cashUsd ?? 0) <= -MAJOR_CASH_USD || (c.effects.reputation ?? 0) <= -MAJOR_REP)).map(e => e.id),
);

// Tags that gate some event, mapped to the ids of the events they gate.
const GATING_TAGS = new Map<string, Set<string>>();
for (const e of EVENTS) {
  for (const t of e.trigger.requiresTags ?? []) {
    if (!GATING_TAGS.has(t)) GATING_TAGS.set(t, new Set());
    GATING_TAGS.get(t)!.add(e.id);
  }
}

// ── Event choice rules ────────────────────────────────────────────────────

function cashOf(c: EventChoice): number { return c.effects.cashUsd ?? 0; }
function repOf(c: EventChoice): number { return c.effects.reputation ?? 0; }
function tagCount(c: EventChoice): number { return c.effects.addTags?.length ?? 0; }
function absMagnitude(c: EventChoice): number {
  const e = c.effects;
  const trust = Object.values(e.trust ?? {}).reduce((s, v) => s + Math.abs(v), 0);
  return Math.abs(e.cashUsd ?? 0) + Math.abs(e.energy ?? 0) + Math.abs(e.reputation ?? 0) + trust;
}

// Returns the index of the best choice by a lexicographic score; ties go to the lowest index.
function argBest(choices: EventChoice[], score: (c: EventChoice) => number[]): number {
  let best = 0;
  let bestScore = score(choices[0]!);
  for (let i = 1; i < choices.length; i++) {
    const s = score(choices[i]!);
    for (let k = 0; k < s.length; k++) {
      if (s[k]! > bestScore[k]!) { best = i; bestScore = s; break; }
      if (s[k]! < bestScore[k]!) break;
    }
  }
  return best;
}

// greedy: highest immediate cashUsd; ties go to the choice that adds more tags.
function greedyChoice(e: GameEvent): number {
  return argBest(e.choices, c => [cashOf(c), tagCount(c)]);
}

// competent: drop choices that add a tag required by ANOTHER event's trigger;
// among the rest, highest cash + reputation. If every choice is excluded, use all.
function addsGatingTag(c: EventChoice, selfId: string): boolean {
  return (c.effects.addTags ?? []).some(t => {
    const gated = GATING_TAGS.get(t);
    if (!gated) return false;
    for (const id of gated) if (id !== selfId) return true;
    return false;
  });
}
function competentChoice(e: GameEvent): number {
  const allowed = e.choices.map(c => !addsGatingTag(c, e.id));
  const anyAllowed = allowed.some(Boolean);
  return argBest(e.choices, c => {
    const i = e.choices.indexOf(c);
    const ok = !anyAllowed || allowed[i] ? 1 : 0;
    return [ok, cashOf(c) + repOf(c)];
  });
}

// passive: smallest sum of absolute effects (cash + energy + reputation + trust).
function passiveChoice(e: GameEvent): number {
  return argBest(e.choices, c => [-absMagnitude(c), -tagCount(c)]);
}

// ── Local seeded RNG for the random strategy (separate from the sim RNG) ──

function makeRng(seed: number): () => number {
  let a = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Strategy type ─────────────────────────────────────────────────────────

type StrategyFn = {
  weekInput: (s: GameState) => WeekInput;
  eventChoice: (s: GameState, e: GameEvent) => number;
  afterStep: (s: GameState) => GameState;
};
type StrategyFactory = (seed: number) => StrategyFn;

// ── Passive ───────────────────────────────────────────────────────────────
// Keeps the full-time job. 40 work + 60 rest. No hustle, loans or businesses.

const passive: StrategyFactory = () => ({
  weekInput: (s) => {
    const workHrs = s.flags.burnout_active ? 20 : 40;
    return { hours: { work: workHrs, hustle: 0, rest: 100 - workHrs, study: 0, sideProject: 0, skill: "" } };
  },
  eventChoice: (_s, e) => passiveChoice(e),
  afterStep: (s) => {
    if (!s.activeJobId) return holdJob(s, "full_time")[0];
    return s;
  },
});

// ── Competent ─────────────────────────────────────────────────────────────
// Balanced work/hustle/study. Holds jobs, takes one loan, launches 2 businesses.

const competent: StrategyFactory = () => ({
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
  eventChoice: (_s, e) => competentChoice(e),
  afterStep: (s) => {
    let cur = s;
    if (!cur.activeJobId) {
      const jobId = cur.flags.skill_financial_unlocked ? "skilled" : "full_time";
      cur = holdJob(cur, jobId)[0];
    }
    if (cur.liabilities.length === 0 && cur.reputation >= CONFIG.loans.minReputation) {
      const [ns, err] = takeLoan(cur, 2500, 52);
      if (!err) cur = ns;
    }
    const hasFood = cur.assets.some(a => a.type === "food_stall");
    if (!hasFood && cur.wealthTier >= 1 && cur.flags.skill_financial_unlocked) {
      const [ns, err] = launchBusiness(cur, "food_stall");
      if (!err) cur = ns;
    }
    const hasDel = cur.assets.some(a => a.type === "delivery_service");
    if (!hasDel && cur.wealthTier >= 1 && cur.flags.skill_financial_unlocked && cur.assets.length > 0) {
      const [ns, err] = launchBusiness(cur, "delivery_service");
      if (!err) cur = ns;
    }
    return cur;
  },
});

// ── Greedy ────────────────────────────────────────────────────────────────
// Unlocks businesses in week 1, max loans, every business, cash-max event choices.

const greedy: StrategyFactory = () => ({
  weekInput: (s) => {
    if (s.flags.burnout_active) {
      return { hours: { work: 20, hustle: 10, rest: 70, study: 0, sideProject: 0, skill: "" } };
    }
    if (!s.flags.skill_financial_unlocked) {
      return { hours: { work: 30, hustle: 10, rest: 50, study: 10, sideProject: 0, skill: "financial" } };
    }
    return { hours: { work: 35, hustle: 15, rest: 50, study: 0, sideProject: 0, skill: "" } };
  },
  eventChoice: (_s, e) => greedyChoice(e),
  afterStep: (s) => {
    let cur = s;
    if (!cur.activeJobId && !cur.flags.burnout_active) {
      const jobId = cur.flags.skill_financial_unlocked ? "skilled" : "full_time";
      cur = holdJob(cur, jobId)[0];
    }
    const maxLoans = CONFIG.loans.maxSimultaneous[cur.wealthTier] ?? 1;
    while (cur.liabilities.length < maxLoans && cur.reputation >= CONFIG.loans.minReputation) {
      const [ns, err] = takeLoan(cur, 2500, 52);
      if (err) break;
      cur = ns;
    }
    if (cur.wealthTier >= 1 && cur.flags.skill_financial_unlocked) {
      for (const biz of CONFIG.businesses.types) {
        if (!cur.assets.some(a => a.type === biz.id)) {
          const [ns, err] = launchBusiness(cur, biz.id);
          if (!err) cur = ns;
        }
      }
    }
    return cur;
  },
});

// ── Random ────────────────────────────────────────────────────────────────
// Baseline. Random legal hour split, random event choice, random actions.
// Uses its own RNG seeded from the run seed so the sim RNG stream is untouched.

const random: StrategyFactory = (seed) => {
  const r = makeRng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const skills = ["", "financial", "hustle", "negotiation"];
  return {
    weekInput: (s) => {
      const cap = s.flags.burnout_active ? CONFIG.energy.burnoutMaxHours : 100;
      const work = Math.floor(r() * 61);
      const job = CONFIG.cities.kingston.jobs.find(j => j.id === s.activeJobId);
      const hustleMax = job && job.minCommitHours >= 40 ? 20 : 40;
      let hustle = Math.floor(r() * (hustleMax + 1));
      let w = work;
      if (w + hustle > cap) { w = Math.min(w, cap); hustle = Math.max(0, cap - w); }
      const left = 100 - w - hustle;
      const study = Math.floor(r() * Math.min(20, left + 1));
      const rest = left - study;
      return { hours: { work: w, hustle, rest, study, sideProject: 0, skill: study > 0 ? pick(skills) : "" } };
    },
    eventChoice: (_s, e) => Math.floor(r() * e.choices.length),
    afterStep: (s) => {
      let cur = s;
      if (r() < 0.02) cur = holdJob(cur, pick(CONFIG.cities.kingston.jobs).id)[0];
      if (r() < 0.02) {
        const [ns, err] = takeLoan(cur, pick(CONFIG.loans.amountTiers), pick(CONFIG.loans.termWeeksOptions));
        if (!err) cur = ns;
      }
      if (r() < 0.05) {
        const [ns, err] = launchBusiness(cur, pick(CONFIG.businesses.types).id);
        if (!err) cur = ns;
      }
      return cur;
    },
  };
};

// ── Runner ────────────────────────────────────────────────────────────────

const SEEDS = 300;
const WEEKS = 468;
const SAMPLE_WEEKS = [156, 312, 468];
const MILLION = 1_000_000;

type RunResult = {
  seed: number;
  snaps: Record<number, number>;
  weekAt1M: number | null;
  evicted: boolean;
  delayedFired: string[];
  picks: string[]; // "eventId#choiceIndex"
  finalNw: number;
};

function ageAtWeek(w: number): number {
  return CONFIG.start.age + w / CONFIG.time.weeksPerYear;
}

function runOne(factory: StrategyFactory, seed: number): RunResult {
  const strategy = factory(seed);
  let s = newGame(seed, "kingston");
  const snaps: Record<number, number> = {};
  let weekAt1M: number | null = null;
  const delayedFired: string[] = [];
  const picks: string[] = [];

  for (let w = 0; w < WEEKS; w++) {
    const { state: stepped, pendingEvents } = step(s, strategy.weekInput(s), EVENTS);
    s = stepped;
    for (const evt of pendingEvents) {
      const choice = strategy.eventChoice(s, evt);
      s = applyEvent(s, evt.id, choice, EVENTS);
      picks.push(`${evt.id}#${choice}`);
      if (DELAYED_IDS.has(evt.id)) delayedFired.push(evt.id);
    }
    s = strategy.afterStep(s);
    const week = w + 1;
    const nw = netWorthUsd(s);
    if (weekAt1M === null && nw >= MILLION) weekAt1M = week;
    if (SAMPLE_WEEKS.includes(week)) snaps[week] = nw;
  }

  return {
    seed,
    snaps,
    weekAt1M,
    evicted: s.history.some(h => h.tags.includes("evicted")),
    delayedFired,
    picks,
    finalNw: netWorthUsd(s),
  };
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function pctStr(n: number, d: number): string {
  return d === 0 ? "n/a" : `${((n / d) * 100).toFixed(1)}%`;
}

function choiceLabel(key: string): string {
  const [id, idx] = key.split("#");
  const e = EVENT_BY_ID.get(id!)!;
  const c = e.choices[Number(idx)]!;
  return `\`${id}\` #${idx} (${c.label})`;
}

type Summary = {
  name: string;
  runs: RunResult[];
  snapSorted: Record<number, number[]>;
  reached1M: number;
  medianAge1M: number | null; // null = median run never reached $1M
  evictions: number;
  runsWithDelayed: number;
  runsWithMajor: number;
  delayedByEvent: Map<string, number>;
  topPicks: [string, number][];
  winningDef: string;
  winners: RunResult[];
  dominant: [string, number][];
};

function summarize(name: string, runs: RunResult[]): Summary {
  const snapSorted: Record<number, number[]> = {};
  for (const w of SAMPLE_WEEKS) snapSorted[w] = runs.map(r => r.snaps[w]!).sort((a, b) => a - b);

  // Median age at $1M: unreached runs count as +Infinity.
  const weeks1M = runs.map(r => r.weekAt1M ?? Infinity).sort((a, b) => a - b);
  const medWeek = quantile(weeks1M, 0.5);
  const reached1M = runs.filter(r => r.weekAt1M !== null).length;

  const delayedByEvent = new Map<string, number>();
  for (const r of runs) for (const id of r.delayedFired) delayedByEvent.set(id, (delayedByEvent.get(id) ?? 0) + 1);

  const pickCounts = new Map<string, number>();
  for (const r of runs) for (const k of r.picks) pickCounts.set(k, (pickCounts.get(k) ?? 0) + 1);
  const topPicks = [...pickCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);

  // Winning run: reached $1M by week 468. If none did, top quartile by week-468 net worth.
  let winners = runs.filter(r => r.weekAt1M !== null);
  let winningDef = "reached $1M by week 468";
  if (winners.length === 0) {
    const cut = quantile(runs.map(r => r.finalNw).sort((a, b) => a - b), 0.75);
    winners = runs.filter(r => r.finalNw >= cut);
    winningDef = `no run reached $1M; top quartile by W468 net worth (>= ${fmt(cut)})`;
  }
  const perRun = new Map<string, number>();
  for (const r of winners) for (const k of new Set(r.picks)) perRun.set(k, (perRun.get(k) ?? 0) + 1);
  const dominant = [...perRun.entries()]
    .filter(([, n]) => n / winners.length > 0.8)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return {
    name,
    runs,
    snapSorted,
    reached1M,
    medianAge1M: Number.isFinite(medWeek) ? ageAtWeek(medWeek) : null,
    evictions: runs.filter(r => r.evicted).length,
    runsWithDelayed: runs.filter(r => r.delayedFired.length > 0).length,
    runsWithMajor: runs.filter(r => r.delayedFired.some(id => MAJOR_IDS.has(id))).length,
    delayedByEvent,
    topPicks,
    winningDef,
    winners,
    dominant,
  };
}

// ── Run all strategies ────────────────────────────────────────────────────

const t0 = performance.now();
const STRATEGIES: [string, StrategyFactory][] = [
  ["greedy", greedy],
  ["competent", competent],
  ["passive", passive],
  ["random", random],
];
const summaries: Summary[] = STRATEGIES.map(([name, f]) => {
  const runs: RunResult[] = [];
  for (let seed = 0; seed < SEEDS; seed++) runs.push(runOne(f, seed));
  return summarize(name, runs);
});
const elapsedSec = (performance.now() - t0) / 1000;
const S = Object.fromEntries(summaries.map(s => [s.name, s])) as Record<string, Summary>;

// ── Targets (docs/CONCEPT.md, scoped to the 468-week slice by SM-019) ─────

const g = S.greedy!, c = S.competent!, p = S.passive!;
const ageStr = (a: number | null) => (a === null ? "not reached" : a.toFixed(1));
const greedyDelayedRate = g.runsWithDelayed / SEEDS;
const passiveMed468 = quantile(p.snapSorted[468]!, 0.5);

const targets = [
  {
    id: "T1",
    target: "Competent median reaches $1M at age 27 to 30",
    actual: `median age ${ageStr(c.medianAge1M)}; ${pctStr(c.reached1M, SEEDS)} of runs reached $1M; W468 median ${fmt(quantile(c.snapSorted[468]!, 0.5))}`,
    pass: c.medianAge1M !== null && c.medianAge1M >= 27 && c.medianAge1M <= 30,
  },
  {
    id: "T2",
    target: "Greedy median age at $1M lower than competent",
    actual: `greedy ${ageStr(g.medianAge1M)} vs competent ${ageStr(c.medianAge1M)}`,
    pass: g.medianAge1M !== null && (c.medianAge1M === null || g.medianAge1M < c.medianAge1M),
  },
  {
    id: "T3",
    target: "50%+ of greedy runs fire a delayed consequence",
    actual: `${pctStr(g.runsWithDelayed, SEEDS)} any; ${pctStr(g.runsWithMajor, SEEDS)} major`,
    pass: greedyDelayedRate >= 0.5,
  },
  {
    id: "T4",
    target: "Passive median net worth at W468 under $50K",
    actual: fmt(passiveMed468),
    pass: passiveMed468 < 50_000,
  },
];

// ── Build report ──────────────────────────────────────────────────────────

const L: string[] = [];
L.push("# Balance Report (SM-019)", "");
L.push(`Seeds 0 to ${SEEDS - 1} per strategy (${SEEDS} runs each), city kingston, ${WEEKS} weeks. Reproduce one run with \`newGame(seed, "kingston")\` and the strategy in \`tests/balance/run.ts\`.`);
L.push(`Events loaded: ${EVENTS.length} from ${EVENT_FILES.length} files. Delayed-consequence events (requiresTags + minYearsAfterTag): ${[...DELAYED_IDS].map(i => `\`${i}\``).join(", ")}.`);
L.push(`Runtime: ${elapsedSec.toFixed(1)} s for ${SEEDS * STRATEGIES.length} runs.`, "");
L.push("Age at week w = 21 + w/52. W156 = age 24, W312 = age 27, W468 = age 30.", "");

L.push("## Event choice rules", "");
L.push("Strategies resolve each pending event through `applyEvent(state, eventId, choiceIndex, EVENTS)`. Remaining ties go to the lowest choice index.", "");
L.push("- greedy: highest `cashUsd`; ties go to the choice that adds more tags.");
L.push("- competent: excludes choices that add a tag in another event's `trigger.requiresTags`; among the rest, highest `cashUsd + reputation`.");
L.push("- passive: smallest sum of |cashUsd| + |energy| + |reputation| + |trust deltas|; ties go to fewer tags.");
L.push("- random: uniform choice index from a local RNG seeded with the run seed. Baseline only, not scored.", "");
L.push(`Gating tags the competent rule avoids: ${[...GATING_TAGS.keys()].sort().map(t => `\`${t}\``).join(", ")}.`, "");

L.push("## Net worth", "");
L.push("| Strategy | W156 p10 | W156 median | W156 p90 | W312 p10 | W312 median | W312 p90 | W468 p10 | W468 median | W468 p90 |");
L.push("|---|---|---|---|---|---|---|---|---|---|");
for (const s of summaries) {
  const cells = SAMPLE_WEEKS.flatMap(w => [0.1, 0.5, 0.9].map(q => fmt(quantile(s.snapSorted[w]!, q))));
  L.push(`| ${s.name} | ${cells.join(" | ")} |`);
}
L.push("");

L.push("## $1M, evictions, delayed consequences", "");
L.push("| Strategy | Median age at $1M | Runs reaching $1M | Eviction rate | Runs with >=1 delayed consequence | Runs with >=1 major delayed consequence |");
L.push("|---|---|---|---|---|---|");
for (const s of summaries) {
  L.push(`| ${s.name} | ${ageStr(s.medianAge1M)} | ${s.reached1M} / ${SEEDS} (${pctStr(s.reached1M, SEEDS)}) | ${pctStr(s.evictions, SEEDS)} | ${s.runsWithDelayed} / ${SEEDS} (${pctStr(s.runsWithDelayed, SEEDS)}) | ${s.runsWithMajor} / ${SEEDS} (${pctStr(s.runsWithMajor, SEEDS)}) |`);
}
L.push("");
L.push(`Major = every choice costs at least $${MAJOR_CASH_USD} cash or ${MAJOR_REP} reputation. Major events: ${[...MAJOR_IDS].map(i => `\`${i}\``).join(", ")}.`, "");
L.push("Delayed consequences fired, by event (total fires across runs):", "");
L.push(`| Event | ${summaries.map(s => s.name).join(" | ")} |`);
L.push(`|---|${summaries.map(() => "---").join("|")}|`);
for (const id of DELAYED_IDS) {
  L.push(`| \`${id}\`${MAJOR_IDS.has(id) ? " (major)" : ""} (${(EVENT_BY_ID.get(id)!.trigger.requiresTags ?? []).join(", ")}) | ${summaries.map(s => s.delayedByEvent.get(id) ?? 0).join(" | ")} |`);
}
L.push("");

L.push("## Top 5 most-picked choices", "");
L.push("Ties sort by event id. Every `once` event fires in nearly every 468-week run, so counts of 300 are common.", "");
for (const s of summaries) {
  L.push(`**${s.name}**`, "");
  for (const [k, n] of s.topPicks) L.push(`- ${choiceLabel(k)}: ${n} picks`);
  L.push("");
}

L.push("## Dominant choices (picked in over 80% of winning runs)", "");
L.push("Greedy, competent and passive pick deterministically, so for them any event that fires in over 80% of winning runs shows up here. The list flags choices the rule always lands on, not player preference.", "");
for (const s of summaries) {
  L.push(`**${s.name}**: winning = ${s.winningDef}; ${s.winners.length} runs.`, "");
  L.push(s.dominant.length === 0
    ? "none"
    : s.dominant.map(([k, n]) => `\`${k}\` ${pctStr(n, s.winners.length)}`).join(", "));
  L.push("");
}

L.push("## Pass/fail against CONCEPT targets", "");
L.push("| ID | Target | Actual | Result |");
L.push("|---|---|---|---|");
for (const t of targets) L.push(`| ${t.id} | ${t.target} | ${t.actual} | ${t.pass ? "PASS" : "FAIL"} |`);
L.push("");

// Recommendations live in recommendations.md (hand-written after reading the numbers
// above) so the generated tables never overwrite the analysis.
let recs = "";
try { recs = readFileSync(resolve(__dirname, "recommendations.md"), "utf-8"); } catch { recs = ""; }
if (recs) L.push(recs.trimEnd(), "");

const report = L.join("\n");
if (WHATIF) {
  console.log(`WHAT-IF overrides: ${JSON.stringify(WHATIF)} (report.md not written)\n`);
} else {
  writeFileSync(resolve(__dirname, "report.md"), report);
}
console.log(report);
console.log(`\nBalance suite finished in ${elapsedSec.toFixed(1)} s`);
if (elapsedSec > 60) {
  console.error("Balance suite exceeded the 60 s budget");
  process.exitCode = 1;
}
