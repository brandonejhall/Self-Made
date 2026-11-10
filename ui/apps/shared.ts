// SM-023: DOM and formatting helpers shared by the phone apps.

import type { AppContext, SimAction } from "./types";

type Child = Node | string | null | undefined | false;

/** Tiny element builder. Text children are inserted as text, never as HTML. */
export function h(
  tag: string,
  attrs: Record<string, string> = {},
  ...children: Child[]
): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return el;
}

export function usd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function usd0(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** "part_time" -> "Part Time" */
export function prettyId(id: string): string {
  return id
    .split("_")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function section(title: string, ...children: Child[]): HTMLElement {
  return h("div", { class: "app-section" }, h("span", { class: "stat-label" }, title), ...children);
}

/** A label/value line inside a card. */
export function kv(label: string, value: string, cls = ""): HTMLElement {
  return h(
    "div",
    { class: "kv" },
    h("span", { class: "kv__label" }, label),
    h("span", { class: `kv__value ${cls}`.trim() }, value),
  );
}

/** A requirement line with a met / unmet marker. */
export function req(label: string, met: boolean): HTMLElement {
  return h(
    "div",
    { class: `req ${met ? "req--met" : "req--unmet"}` },
    h("span", { class: "req__mark" }, met ? "OK" : "NO"),
    h("span", {}, label),
  );
}

export function card(...children: Child[]): HTMLElement {
  return h("div", { class: "app-card" }, ...children);
}

export function empty(text: string): HTMLElement {
  return h("p", { class: "app-empty" }, text);
}

export interface ActionOptions {
  label: string;
  /** Numbers restated on the confirm panel. */
  confirmLines: Array<[string, string]>;
  /** Sim error from a dry run. Shown on the card; the button stays usable so the sim has the final word. */
  blockedReason: string | null;
  action: SimAction;
  successMessage: string;
  secondary?: boolean;
}

/**
 * Two-step action button. First tap opens a confirm panel listing every number
 * that matters. Confirm calls the sim; the shell shows the result.
 */
export function actionButton(ctx: AppContext, opts: ActionOptions): HTMLElement {
  const wrap = h("div", { class: "action" });

  const showButton = (): void => {
    wrap.replaceChildren();
    if (opts.blockedReason) {
      wrap.append(h("div", { class: "action__blocked" }, opts.blockedReason));
    }
    const btn = h(
      "button",
      { class: opts.secondary ? "btn-secondary" : "btn-action" },
      opts.label,
    ) as HTMLButtonElement;
    btn.addEventListener("click", showConfirm);
    wrap.append(btn);
  };

  const showConfirm = (): void => {
    wrap.replaceChildren();
    const panel = h("div", { class: "confirm" }, h("div", { class: "confirm__title" }, `${opts.label}?`));
    for (const [k, v] of opts.confirmLines) panel.append(kv(k, v));
    const yes = h("button", { class: "btn-action" }, "Confirm");
    const no = h("button", { class: "btn-secondary" }, "Cancel");
    // The shell re-renders the app after the sim answers, success or failure.
    yes.addEventListener("click", () => ctx.run(opts.action, opts.successMessage));
    no.addEventListener("click", showButton);
    panel.append(h("div", { class: "confirm__buttons" }, no, yes));
    wrap.append(panel);
  };

  showButton();
  return wrap;
}
