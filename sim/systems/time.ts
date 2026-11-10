// Time: advances the week counter and derives age.

import { CONFIG } from "../config";
import type { StepContext } from "../util";

export function timeSystem(ctx: StepContext): StepContext {
  const week = ctx.prev.week + 1;
  const age = CONFIG.start.age + Math.floor(week / CONFIG.time.weeksPerYear);
  return { ...ctx, next: { ...ctx.next, week, age } };
}
