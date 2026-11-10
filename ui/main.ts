// Placeholder UI so the build works end to end. ui-engineer replaces this
// with the Stage 1 phone UI once the GDD defines the screens.

import { deserialize, newGame, serialize, step, type GameState } from "../sim";

const SAVE_KEY = "self-made-save";

function load(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return deserialize(raw);
  } catch {
    // Storage unavailable or save corrupt: start fresh.
  }
  return newGame(Date.now() % 1_000_000);
}

function save(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, serialize(state));
  } catch {
    // Storage unavailable: the game still runs in memory.
  }
}

let state = load();
const app = document.getElementById("app")!;

function render(): void {
  app.innerHTML = `
    <main class="phone">
      <h1>Self Made</h1>
      <p>Age ${state.age} · Week ${state.week}</p>
      <p class="cash">$${state.cashUsd.toLocaleString("en-US")}</p>
      <p>Energy ${Math.round(state.energy)}</p>
      <button id="next">Work the week</button>
    </main>`;
  document.getElementById("next")!.onclick = () => {
    state = step(state, { hours: { work: 45, hustle: 10, rest: 45 } });
    save(state);
    render();
  };
}

render();
