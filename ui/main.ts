// SM-012 / SM-013 / SM-014: Phone UI

import {
  newGame,
  step,
  applyEvent,
  loadEvents,
  netWorthUsd,
  serialize,
  deserialize,
  CONFIG,
  type GameState,
  type WeekInput,
  type GameEvent,
  type HistoryEntry,
} from "../sim";

import familyRaw from "../content/events/stage1_family.json";
import finOppRaw from "../content/events/stage1_financial_opportunity.json";
import finThreatRaw from "../content/events/stage1_financial_threat.json";
import relationshipRaw from "../content/events/stage1_relationship.json";
import worldClockRaw from "../content/events/stage1_world_clock.json";
import consequenceRaw from "../content/events/stage1_consequence.json";
import hustleWorkRaw from "../content/events/stage1_hustle_work.json";

// ── Constants ──────────────────────────────────────────────────────────────

const SAVE_KEY = "self-made-save";
const WORTH_KEY = "self-made-nw";
const TOTAL_HOURS = 100;

const EVENTS: GameEvent[] = loadEvents([
  ...familyRaw,
  ...finOppRaw,
  ...finThreatRaw,
  ...relationshipRaw,
  ...worldClockRaw,
  ...consequenceRaw,
  ...hustleWorkRaw,
]);

interface HourAllocation {
  work: number;
  hustle: number;
  rest: number;
  study: number;
  sideProject: number;
}

const HOUR_FIELDS: Array<{ key: keyof HourAllocation; label: string }> = [
  { key: "work", label: "Work" },
  { key: "hustle", label: "Hustle" },
  { key: "rest", label: "Rest" },
  { key: "study", label: "Study" },
  { key: "sideProject", label: "Side Project" },
];

const SKILL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "None" },
  { value: "hustle", label: "Hustle" },
  { value: "negotiation", label: "Negotiation" },
  { value: "financial", label: "Financial" },
  { value: "trade", label: "Trade" },
];

// ── Mutable module state ───────────────────────────────────────────────────

let state: GameState = load();
let prevState: GameState | null = null;
let pendingEvents: GameEvent[] = [];
let nwHistory: number[] = loadNwHistory();

let hours: HourAllocation = { work: 40, hustle: 10, rest: 40, study: 5, sideProject: 5 };
let skill = "";

// ── Persistence ───────────────────────────────────────────────────────────

function load(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return deserialize(raw);
  } catch {
    // Storage unavailable or save corrupt — start fresh
  }
  return newGame(Date.now() >>> 0, "kingston");
}

function save(s: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, serialize(s));
  } catch {
    // ignore
  }
}

function loadNwHistory(): number[] {
  try {
    const raw = localStorage.getItem(WORTH_KEY);
    if (raw) return JSON.parse(raw) as number[];
  } catch {
    // ignore
  }
  return [];
}

function saveNwHistory(): void {
  try {
    localStorage.setItem(WORTH_KEY, JSON.stringify(nwHistory));
  } catch {
    // ignore
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatCash(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatCashShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function getYear(s: GameState): number {
  return CONFIG.start.year + Math.floor(s.week / CONFIG.time.weeksPerYear);
}

function energyFillClass(e: number): string {
  if (e > 50) return "energy-bar__fill energy-bar__fill--green";
  if (e >= 20) return "energy-bar__fill energy-bar__fill--yellow";
  return "energy-bar__fill energy-bar__fill--red";
}

function getAllocatedTotal(): number {
  return hours.work + hours.hustle + hours.rest + hours.study + hours.sideProject;
}

function remainingText(r: number): string {
  if (r === 0) return "100 / 100 — ready!";
  if (r > 0) return `${r} hours left to allocate`;
  return `${-r} hours over budget`;
}

function setHour(key: keyof HourAllocation, value: number): void {
  hours[key] = value;
}

// ── DOM creation ──────────────────────────────────────────────────────────

function buildAllocatorFields(): string {
  return HOUR_FIELDS.map(
    ({ key, label }) => `
      <div class="hour-input">
        <span class="hour-label">${label}</span>
        <div class="hour-controls">
          <button id="btn-${key}-minus" class="stepper-btn" aria-label="Decrease ${label}">−</button>
          <input
            id="input-${key}"
            type="number"
            class="hour-num"
            min="0"
            value="${hours[key]}"
            aria-label="${label} hours"
          />
          <button id="btn-${key}-plus" class="stepper-btn" aria-label="Increase ${label}">+</button>
        </div>
      </div>`,
  ).join("");
}

function buildSkillOptions(): string {
  return SKILL_OPTIONS.map(
    ({ value, label }) =>
      `<option value="${value}">${label}</option>`,
  ).join("");
}

function createDOM(): void {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="phone">

      <!-- ── Home / Week Summary ── -->
      <div id="screen-home" class="screen screen--active">
        <header class="phone-header">
          <h1 class="app-title">Self Made</h1>
          <div class="header-actions">
            <button id="btn-chart" class="btn-icon" aria-label="Net worth chart">&#9650;</button>
            <button id="btn-history" class="btn-icon" aria-label="History log">&#9776;</button>
          </div>
        </header>

        <div class="stat-card">
          <span class="stat-label">Cash</span>
          <div id="stat-cash" class="stat-cash">$0.00</div>
          <div id="stat-delta" class="stat-delta" aria-live="polite"></div>
        </div>

        <div class="stat-card">
          <span class="stat-label">Energy</span>
          <div class="energy-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100">
            <div id="energy-fill" class="energy-bar__fill energy-bar__fill--green" style="width:70%"></div>
          </div>
          <div id="stat-energy-val" class="stat-energy-val">70 / 100</div>
        </div>

        <div class="stat-row">
          <div class="stat-item">
            <span class="stat-label">Rep</span>
            <span id="stat-rep" class="stat-val">10</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Age</span>
            <span id="stat-age" class="stat-val">21</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Year</span>
            <span id="stat-year" class="stat-val">2026</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Week</span>
            <span id="stat-week" class="stat-val">0</span>
          </div>
        </div>

        <button id="btn-plan" class="btn-primary">Plan Week →</button>
      </div>

      <!-- ── Hour Allocator ── -->
      <div id="screen-allocator" class="screen">
        <header class="phone-header">
          <button id="btn-back" class="btn-back">← Back</button>
          <h2 class="screen-title">Plan Your Week</h2>
        </header>

        <div id="hours-remaining" class="remaining"></div>

        ${buildAllocatorFields()}

        <div class="skill-selector">
          <label class="stat-label" for="select-skill">Study skill</label>
          <select id="select-skill" class="skill-select">
            ${buildSkillOptions()}
          </select>
        </div>

        <button id="btn-advance" class="btn-primary">Advance Week</button>
      </div>

      <!-- ── Event Card ── -->
      <div id="screen-event" class="screen">
        <div class="event-card">
          <span id="event-channel" class="event-channel"></span>
          <h2 id="event-title" class="event-title"></h2>
          <p id="event-body" class="event-body"></p>
          <div id="event-choices" class="event-choices"></div>
        </div>
      </div>

      <!-- ── Net Worth Chart ── -->
      <div id="screen-chart" class="screen">
        <header class="phone-header">
          <button id="btn-chart-back" class="btn-back">← Back</button>
          <h2 class="screen-title">Net Worth</h2>
        </header>
        <div id="chart-container" class="chart-container"></div>
      </div>

      <!-- ── History Log ── -->
      <div id="screen-history" class="screen">
        <header class="phone-header">
          <button id="btn-history-back" class="btn-back">← Back</button>
          <h2 class="screen-title">History</h2>
        </header>
        <div id="history-list" class="history-list"></div>
      </div>

    </div>`;
}

// ── Rendering ─────────────────────────────────────────────────────────────

function renderHome(): void {
  (document.getElementById("stat-cash") as HTMLElement).textContent =
    formatCash(state.cashUsd);

  const e = Math.round(state.energy);
  const fill = document.getElementById("energy-fill") as HTMLElement;
  fill.style.width = `${e}%`;
  fill.className = energyFillClass(state.energy);
  fill.setAttribute("aria-valuenow", String(e));

  (document.getElementById("stat-energy-val") as HTMLElement).textContent =
    `${e} / 100`;

  (document.getElementById("stat-rep") as HTMLElement).textContent =
    String(state.reputation);
  (document.getElementById("stat-age") as HTMLElement).textContent =
    String(state.age);
  (document.getElementById("stat-year") as HTMLElement).textContent =
    String(getYear(state));
  (document.getElementById("stat-week") as HTMLElement).textContent =
    String(state.week);

  const deltaEl = document.getElementById("stat-delta") as HTMLElement;
  if (prevState !== null && state.week > 0) {
    const cashDelta = state.cashUsd - prevState.cashUsd;
    const energyDelta = state.energy - prevState.energy;
    const cashSign = cashDelta >= 0 ? "+" : "";
    const energySign = energyDelta >= 0 ? "+" : "";
    const cashCls = cashDelta >= 0 ? "delta--pos" : "delta--neg";
    const energyCls = energyDelta >= 0 ? "delta--pos" : "delta--neg";
    deltaEl.innerHTML =
      `<span class="${cashCls}">${cashSign}${formatCash(cashDelta)}</span>` +
      `<span class="delta-sep"> | </span>` +
      `<span class="${energyCls}">${energySign}${Math.round(energyDelta)} energy</span>`;
    deltaEl.style.display = "";
  } else {
    deltaEl.style.display = "none";
    deltaEl.textContent = "";
  }
}

function renderAllocator(): void {
  const remaining = TOTAL_HOURS - getAllocatedTotal();
  const remEl = document.getElementById("hours-remaining") as HTMLElement;
  remEl.textContent = remainingText(remaining);
  remEl.className = `remaining${remaining !== 0 ? " remaining--over" : ""}`;

  const advBtn = document.getElementById("btn-advance") as HTMLButtonElement;
  advBtn.disabled = remaining !== 0;

  HOUR_FIELDS.forEach(({ key }) => {
    const el = document.getElementById(`input-${key}`) as HTMLInputElement | null;
    if (el) el.value = String(hours[key]);
  });
}

function renderEventCard(evt: GameEvent): void {
  (document.getElementById("event-channel") as HTMLElement).textContent =
    evt.channel ?? "";
  (document.getElementById("event-title") as HTMLElement).textContent =
    evt.title;
  (document.getElementById("event-body") as HTMLElement).textContent =
    evt.body;

  const choicesEl = document.getElementById("event-choices") as HTMLElement;
  choicesEl.innerHTML = "";
  evt.choices.forEach((choice, idx) => {
    const btn = document.createElement("button");
    btn.className = "btn-primary";
    btn.textContent = choice.label;
    btn.addEventListener("click", () => resolveEvent(evt, idx));
    choicesEl.appendChild(btn);
  });
}

function renderChart(): void {
  const container = document.getElementById("chart-container") as HTMLElement;
  const data = nwHistory;

  if (data.length < 2) {
    container.innerHTML = `<p class="chart-empty">Advance a few weeks to see your net worth chart.</p>`;
    return;
  }

  const W = 358; // chart width (390 - 32px gutter)
  const H = 200;
  const PAD = { top: 20, right: 8, bottom: 28, left: 56 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const minV = Math.min(...data);
  const maxV = Math.max(...data, CONFIG.progression.tier1Threshold);
  const range = maxV - minV || 1;

  const xOf = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const yOf = (v: number) => PAD.top + innerH - ((v - minV) / range) * innerH;

  const points = data.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");

  const tier1Y = yOf(CONFIG.progression.tier1Threshold);
  const tier2Y = yOf(CONFIG.progression.tier2Threshold);

  // Y-axis labels: minV, tier1, tier2 (if visible), maxV
  const yLabels: Array<{ v: number; y: number }> = [
    { v: minV, y: yOf(minV) },
    { v: maxV, y: yOf(maxV) },
  ];
  if (tier1Y >= PAD.top && tier1Y <= PAD.top + innerH) {
    yLabels.push({ v: CONFIG.progression.tier1Threshold, y: tier1Y });
  }

  const labelsHtml = yLabels.map(
    ({ v, y }) =>
      `<text x="${PAD.left - 4}" y="${y.toFixed(1)}" class="chart-axis-label" text-anchor="end" dominant-baseline="middle">${formatCashShort(v)}</text>`,
  ).join("");

  // X axis ticks: start, middle, end
  const xTicks = [0, Math.floor((data.length - 1) / 2), data.length - 1];
  const xLabelsHtml = xTicks.map(
    (i) =>
      `<text x="${xOf(i).toFixed(1)}" y="${(PAD.top + innerH + 16).toFixed(1)}" class="chart-axis-label" text-anchor="middle">W${i}</text>`,
  ).join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="chart-svg" aria-label="Net worth over time">
      <!-- Tier lines -->
      ${tier1Y >= PAD.top && tier1Y <= PAD.top + innerH
        ? `<line x1="${PAD.left}" y1="${tier1Y.toFixed(1)}" x2="${PAD.left + innerW}" y2="${tier1Y.toFixed(1)}" class="chart-tier-line chart-tier1" />`
        : ""}
      ${tier2Y >= PAD.top && tier2Y <= PAD.top + innerH
        ? `<line x1="${PAD.left}" y1="${tier2Y.toFixed(1)}" x2="${PAD.left + innerW}" y2="${tier2Y.toFixed(1)}" class="chart-tier-line chart-tier2" />`
        : ""}
      <!-- Data line -->
      <polyline points="${points}" class="chart-line" fill="none" />
      <!-- Axes -->
      <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + innerH}" class="chart-axis" />
      <line x1="${PAD.left}" y1="${PAD.top + innerH}" x2="${PAD.left + innerW}" y2="${PAD.top + innerH}" class="chart-axis" />
      ${labelsHtml}
      ${xLabelsHtml}
    </svg>
    <div class="chart-legend">
      <span class="legend-item legend-item--tier1">Tier 1 $10K</span>
      <span class="legend-item legend-item--tier2">Tier 2 $1M</span>
    </div>`;
}

function renderHistoryLog(): void {
  const list = document.getElementById("history-list") as HTMLElement;
  const entries = [...state.history].reverse();

  if (entries.length === 0) {
    list.innerHTML = `<p class="history-empty">No history yet. Advance a week to start.</p>`;
    return;
  }

  list.innerHTML = entries.map((entry: HistoryEntry) => {
    const tagPills = entry.tags.map(
      (t) => `<span class="tag-pill">${t}</span>`,
    ).join("");
    return `
      <div class="history-entry">
        <div class="history-meta">
          <span class="history-week">W${entry.week}</span>
          <span class="history-action">${entry.action}</span>
        </div>
        ${tagPills ? `<div class="history-tags">${tagPills}</div>` : ""}
      </div>`;
  }).join("");
}

// ── Navigation ────────────────────────────────────────────────────────────

type ScreenId = "screen-home" | "screen-allocator" | "screen-event" | "screen-chart" | "screen-history";

function showScreen(id: ScreenId): void {
  document.querySelectorAll<HTMLDivElement>(".screen").forEach((el) => {
    el.classList.toggle("screen--active", el.id === id);
  });
}

// ── Actions ───────────────────────────────────────────────────────────────

function advanceWeek(): void {
  const input: WeekInput = {
    hours: {
      work: hours.work,
      hustle: hours.hustle,
      rest: hours.rest,
      study: hours.study,
      sideProject: hours.sideProject,
      skill: skill as string,
    },
  };

  prevState = state;
  const { state: newState, pendingEvents: fired } = step(state, input, EVENTS);
  state = newState;
  save(state);

  // Record net worth snapshot after step (before events resolve)
  nwHistory.push(netWorthUsd(state));
  saveNwHistory();

  if (fired.length > 0) {
    pendingEvents = fired;
    showScreen("screen-event");
    renderEventCard(pendingEvents[0]!);
  } else {
    showScreen("screen-home");
    renderHome();
  }
}

function resolveEvent(evt: GameEvent, choiceIndex: number): void {
  state = applyEvent(state, evt.id, choiceIndex, EVENTS);
  save(state);

  pendingEvents = pendingEvents.slice(1);
  if (pendingEvents.length > 0) {
    renderEventCard(pendingEvents[0]!);
  } else {
    showScreen("screen-home");
    renderHome();
  }
}

// ── Event wiring ──────────────────────────────────────────────────────────

function wireEvents(): void {
  document.getElementById("btn-plan")!.addEventListener("click", () => {
    showScreen("screen-allocator");
    renderAllocator();
  });

  document.getElementById("btn-back")!.addEventListener("click", () => {
    showScreen("screen-home");
  });

  document.getElementById("btn-chart")!.addEventListener("click", () => {
    renderChart();
    showScreen("screen-chart");
  });

  document.getElementById("btn-history")!.addEventListener("click", () => {
    renderHistoryLog();
    showScreen("screen-history");
  });

  document.getElementById("btn-chart-back")!.addEventListener("click", () => {
    showScreen("screen-home");
  });

  document.getElementById("btn-history-back")!.addEventListener("click", () => {
    showScreen("screen-home");
  });

  HOUR_FIELDS.forEach(({ key }) => {
    document.getElementById(`btn-${key}-minus`)!.addEventListener("click", () => {
      if (hours[key] > 0) {
        setHour(key, hours[key] - 1);
        renderAllocator();
      }
    });

    document.getElementById(`btn-${key}-plus`)!.addEventListener("click", () => {
      setHour(key, hours[key] + 1);
      renderAllocator();
    });

    const inputEl = document.getElementById(`input-${key}`) as HTMLInputElement;
    inputEl.addEventListener("input", () => {
      const v = parseInt(inputEl.value, 10);
      if (!isNaN(v) && v >= 0) {
        setHour(key, v);
        renderAllocator();
      }
    });
  });

  const skillSelect = document.getElementById("select-skill") as HTMLSelectElement;
  skillSelect.addEventListener("change", () => {
    skill = skillSelect.value;
  });

  document.getElementById("btn-advance")!.addEventListener("click", advanceWeek);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────

function init(): void {
  createDOM();
  wireEvents();
  renderHome();
  renderAllocator();
  showScreen("screen-home");
}

init();
