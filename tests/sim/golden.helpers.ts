// Deterministic golden-run harness for SM-015. Shared by golden.test.ts.
import {
  applyEvent,
  holdJob,
  launchBusiness,
  loadEvents,
  moveHousing,
  netWorthUsd,
  newGame,
  quitJob,
  serialize,
  step,
  takeLoan,
  type GameEvent,
  type GameState,
  type WeekInput,
} from "../../sim";
import consequence from "../../content/events/stage1_consequence.json";
import family from "../../content/events/stage1_family.json";
import opportunity from "../../content/events/stage1_financial_opportunity.json";
import threat from "../../content/events/stage1_financial_threat.json";
import hustleWork from "../../content/events/stage1_hustle_work.json";
import relationship from "../../content/events/stage1_relationship.json";
import worldClock from "../../content/events/stage1_world_clock.json";

function asArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r["events"])) return r["events"] as unknown[];
  return [raw];
}

export const ALL_EVENTS: GameEvent[] = loadEvents([
  ...asArray(consequence),
  ...asArray(family),
  ...asArray(opportunity),
  ...asArray(threat),
  ...asArray(hustleWork),
  ...asArray(relationship),
  ...asArray(worldClock),
]);

export type Policy = {
  before: (s: GameState) => GameState;
  hours: (s: GameState) => WeekInput;
};

function capBurnout(s: GameState, h: WeekInput["hours"]): WeekInput {
  if (s.flags.burnout_active && h.work + h.hustle > 40) {
    const extra = h.work + h.hustle - 40;
    const cutHustle = Math.min(h.hustle, extra);
    const cutWork = extra - cutHustle;
    return {
      hours: { ...h, work: h.work - cutWork, hustle: h.hustle - cutHustle, rest: h.rest + extra },
    };
  }
  return { hours: h };
}

const SKILLS = ["financial", "hustle", "negotiation"];

export const POLICY_A: Policy = {
  before: (s) => {
    let st = s;
    if (st.week === 0) st = holdJob(st, "full_time")[0];
    if (st.week % 52 === 10) st = takeLoan(st, 1000, 52)[0];
    if (st.week % 100 === 50) st = moveHousing(st, 1)[0];
    if (st.assets.length === 0) st = launchBusiness(st, "food_stall")[0];
    return st;
  },
  hours: (s) =>
    capBurnout(s, {
      work: 40,
      hustle: 5,
      rest: 50,
      study: 5,
      skill: SKILLS[s.week % SKILLS.length]!,
    }),
};

export const POLICY_B: Policy = {
  before: (s) => {
    let st = s;
    if (st.week === 10) st = holdJob(st, "part_time")[0];
    if (st.week === 200) st = quitJob(st)[0];
    if (st.week === 210) st = holdJob(st, "gig")[0];
    if (st.week % 30 === 5) st = takeLoan(st, 500, 26)[0];
    if (st.week % 80 === 40) st = moveHousing(st, (st.housingTier + 1) % 3)[0];
    if (st.assets.length < 2) st = launchBusiness(st, "content_brand")[0];
    return st;
  },
  hours: (s) =>
    capBurnout(s, {
      work: s.week < 10 ? 0 : 20,
      hustle: 30,
      rest: 40,
      study: 8,
      sideProject: 2,
      skill: s.week % 4 === 0 ? "negotiation" : "financial",
    }),
};

// FNV-1a over the serialized state: catches any drift in fields not listed explicitly.
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function runGolden(seed: number, weeks: number, policy: Policy) {
  let s = newGame(seed);
  let eventsShown = 0;
  for (let i = 0; i < weeks; i++) {
    s = policy.before(s);
    const { state, pendingEvents } = step(s, policy.hours(s), ALL_EVENTS);
    s = state;
    for (const ev of pendingEvents) {
      s = applyEvent(s, ev.id, 0, ALL_EVENTS);
      eventsShown++;
    }
  }
  return {
    week: s.week,
    age: s.age,
    cashUsd: s.cashUsd,
    energy: s.energy,
    reputation: s.reputation,
    netWorthUsd: netWorthUsd(s),
    wealthTier: s.wealthTier,
    housingTier: s.housingTier,
    activeJobId: s.activeJobId,
    rngState: s.rngState,
    historyLength: s.history.length,
    firedEventsCount: s.firedEvents.length,
    eventsShown,
    assetsCount: s.assets.length,
    liabilitiesCount: s.liabilities.length,
    skills: s.skills,
    flags: s.flags,
    stateHash: fnv1a(serialize(s)),
  };
}
