// SM-023: Jobs app. Lists Kingston jobs, holds one, quits the current one.
// Sim calls: holdJob, quitJob, validateInput (to read the hustle cap a job imposes).

import { CONFIG, holdJob, quitJob, validateInput, type GameState } from "../../sim";
import { actionButton, card, empty, h, kv, prettyId, section, usd } from "./shared";
import type { AppContext, PhoneApp } from "./types";

type Job = (typeof CONFIG.cities.kingston.jobs)[number];

function jobsFor(state: GameState): readonly Job[] {
  return CONFIG.cities[state.cityId].jobs;
}

// Highest hustle hours the sim accepts while holding this job (null = no job-specific cap).
function hustleCapWith(state: GameState, jobId: string): number | null {
  const [held, err] = holdJob(state, jobId);
  if (err) return null;
  const probe: GameState = { ...held, flags: { ...held.flags, burnout_active: false } };
  for (let hustle = 0; hustle <= CONFIG.time.hoursPerWeek; hustle++) {
    if (validateInput(probe, { hours: { work: 0, hustle, rest: 0 } }) !== null) {
      return hustle - 1;
    }
  }
  return null;
}

function jobFacts(state: GameState, job: Job): HTMLElement[] {
  const lines = [
    kv("Wage", `${usd(job.hourlyWageUsd)} / hr`),
    kv("Expected work", job.minCommitHours > 0 ? `${job.minCommitHours} h / week` : "Any hours"),
  ];
  if (job.lossConsecutiveWeeks > 0) {
    lines.push(
      kv(
        "Fired if",
        `work < ${job.lossThresholdHours} h for ${job.lossConsecutiveWeeks} weeks in a row`,
        "kv__value--warn",
      ),
    );
  } else {
    lines.push(kv("Fired if", "Never"));
  }
  const cap = hustleCapWith(state, job.id);
  lines.push(kv("Hustle limit", cap === null ? "None" : `${cap} h / week`));
  return lines;
}

function render(root: HTMLElement, ctx: AppContext): void {
  const state = ctx.getState();
  const city = CONFIG.cities[state.cityId];
  const current = jobsFor(state).find((j) => j.id === state.activeJobId) ?? null;

  // ── Current job ──
  const currentCard = current
    ? card(
        h("div", { class: "app-card__title" }, prettyId(current.id)),
        ...jobFacts(state, current),
        current.lossConsecutiveWeeks > 0
          ? kv("Short weeks so far", `${state.underHoursWeeks} of ${current.lossConsecutiveWeeks}`)
          : null,
        actionButton(ctx, {
          label: "Quit job",
          secondary: true,
          confirmLines: [
            ["Wage after quitting", `${usd(city.baseHourlyWageUsd)} / hr`],
          ],
          blockedReason: null,
          action: (s) => quitJob(s),
          successMessage: `You quit ${prettyId(current.id)}.`,
        }),
      )
    : card(
        h("div", { class: "app-card__title" }, "No job"),
        kv("Work hours pay", `${usd(city.baseHourlyWageUsd)} / hr`),
      );

  // ── Openings ──
  const openings = jobsFor(state)
    .filter((j) => j.id !== state.activeJobId)
    .map((job) => {
      const [, err] = holdJob(state, job.id);
      const confirmLines: Array<[string, string]> = [
        ["Wage", `${usd(job.hourlyWageUsd)} / hr`],
        ["Expected work", job.minCommitHours > 0 ? `${job.minCommitHours} h / week` : "Any hours"],
      ];
      if (current) confirmLines.push(["Leaves", prettyId(current.id)]);
      return card(
        h("div", { class: "app-card__title" }, prettyId(job.id)),
        ...jobFacts(state, job),
        actionButton(ctx, {
          label: "Take job",
          confirmLines,
          blockedReason: err,
          action: (s) => holdJob(s, job.id),
          successMessage: `You started at ${prettyId(job.id)}.`,
        }),
      );
    });

  root.append(
    section("Current job", currentCard),
    section("Openings", ...(openings.length ? openings : [empty("No other openings.")])),
  );
}

export const jobsApp: PhoneApp = {
  id: "jobs",
  name: "Jobs",
  icon: "J",
  render,
};
