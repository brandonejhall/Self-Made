// Terminal play mode. Lets you play the sim before the UI exists.
// Run: npm run play            (random seed)
//      npm run play -- 42      (fixed seed, reproducible)
// Owned by sim-engineer. Extend it as systems land (events, loans, business).

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { CONFIG, netWorthUsd, newGame, step, validateInput, type GameState, type WeekInput } from "../sim";

const rl = createInterface({ input: stdin, output: stdout });
const seedArg = Number(process.argv[2]);
const seed = Number.isFinite(seedArg) && seedArg > 0 ? seedArg : Math.floor(Math.random() * 1_000_000);

let state: GameState = newGame(seed);
let last: WeekInput = { hours: { work: 45, hustle: 10, rest: 45 } };

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function status(s: GameState): string {
  const year = CONFIG.start.year + Math.floor(s.week / CONFIG.time.weeksPerYear);
  return `Week ${s.week} | ${year} | Age ${s.age} | Cash ${usd(s.cashUsd)} | Energy ${Math.round(s.energy)} | Net worth ${usd(netWorthUsd(s))}`;
}

function help(): void {
  console.log(`
Commands:
  Enter            play one week with your last hour split
  h W H R          set hours: work, hustle, rest (total ${CONFIG.time.hoursPerWeek} max), then play one week
  n 10             play 10 weeks with your last split
  q                quit
`);
}

console.log(`Self Made, terminal mode. Seed ${seed}. Kingston, age ${CONFIG.start.age}.`);
help();

const prompt = () => {
  console.log(status(state));
  rl.setPrompt(`[work ${last.hours.work} hustle ${last.hours.hustle} rest ${last.hours.rest}] > `);
  rl.prompt();
};

prompt();
for await (const raw of rl) {
  const [cmd, ...args] = raw.trim().split(/\s+/);

  if (cmd === "q") break;
  if (cmd === "?" || cmd === "help") {
    help();
    prompt();
    continue;
  }

  let weeks = 1;
  if (cmd === "h") {
    const [w, h, r] = args.map(Number);
    const input: WeekInput = { hours: { work: w ?? 0, hustle: h ?? 0, rest: r ?? 0 } };
    const error = validateInput(input);
    if (error) {
      console.log(error);
      prompt();
      continue;
    }
    last = input;
  } else if (cmd === "n") {
    weeks = Math.max(1, Number(args[0]) || 1);
  } else if (cmd !== "" && cmd !== undefined) {
    help();
    prompt();
    continue;
  }

  for (let i = 0; i < weeks; i++) state = step(state, last);
  prompt();
}

console.log(`Final: ${status(state)}`);
rl.close();
