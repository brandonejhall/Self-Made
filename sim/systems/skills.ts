// Skills: study hours raise the chosen skill; financial skill unlocks businesses.

import { CONFIG } from "../config";
import type { StepContext } from "../util";

export function skillsSystem(ctx: StepContext): StepContext {
  const { study, skill } = ctx.hours;
  const newSkills = { ...ctx.prev.skills };
  if (study > 0 && skill !== "") {
    newSkills[skill] = (newSkills[skill] ?? 0) + Math.floor(study);
  }

  let flags = { ...ctx.prev.flags };
  if ((newSkills["financial"] ?? 0) >= CONFIG.skills.financialBusinessUnlockLevel) {
    flags = { ...flags, skill_financial_unlocked: true };
  }

  return { ...ctx, next: { ...ctx.next, skills: newSkills, flags } };
}
