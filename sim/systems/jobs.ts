// Jobs: hold/quit actions, wage lookup, and under-hours job loss.

import { CONFIG } from "../config";
import type { GameState } from "../types";
import type { StepContext } from "../util";

export function findJob(jobId: string) {
  return CONFIG.cities.kingston.jobs.find(j => j.id === jobId);
}

// Hourly wage for work hours this week, from the job held at the start of the week.
export function jobHourlyWage(state: GameState): number {
  const city = CONFIG.cities[state.cityId];
  if (!state.activeJobId) return city.baseHourlyWageUsd;
  const job = findJob(state.activeJobId);
  return job ? job.hourlyWageUsd : city.baseHourlyWageUsd;
}

export function jobLossSystem(ctx: StepContext): StepContext {
  const { prev } = ctx;
  let activeJobId = prev.activeJobId;
  let underHoursWeeks = prev.underHoursWeeks;
  let reputation = ctx.next.reputation; // next, not prev: earlier systems (business failure) may have changed it
  let history = ctx.next.history;

  if (activeJobId) {
    const job = findJob(activeJobId)!;
    if (job.lossConsecutiveWeeks > 0) {
      if (ctx.hours.work < job.lossThresholdHours) {
        underHoursWeeks += 1;
      } else {
        underHoursWeeks = 0;
      }
      if (underHoursWeeks >= job.lossConsecutiveWeeks) {
        history = [
          ...history,
          { week: prev.week + 1, action: `lost_job_${activeJobId}`, tags: [`lost_job_${activeJobId}`] },
        ];
        reputation = Math.max(0, reputation - CONFIG.reputation.jobLossPenalty);
        activeJobId = null;
        underHoursWeeks = 0;
      }
    }
  }

  return {
    ...ctx,
    next: { ...ctx.next, history, reputation, activeJobId, underHoursWeeks },
  };
}

export function holdJob(
  state: GameState,
  jobId: string,
): [GameState, string | null] {
  const job = findJob(jobId);
  if (!job) return [state, `Unknown job id: ${jobId}`];
  return [
    {
      ...state,
      activeJobId: jobId,
      underHoursWeeks: 0,
      history: [
        ...state.history,
        { week: state.week, action: `took_job_${jobId}`, tags: [`took_job_${jobId}`] },
      ],
    },
    null,
  ];
}

export function quitJob(state: GameState): [GameState, string | null] {
  if (!state.activeJobId) return [state, 'No active job to quit'];
  const jobId = state.activeJobId;
  return [
    {
      ...state,
      activeJobId: null,
      underHoursWeeks: 0,
      history: [
        ...state.history,
        { week: state.week, action: `quit_job_${jobId}`, tags: [`quit_job_${jobId}`] },
      ],
    },
    null,
  ];
}
