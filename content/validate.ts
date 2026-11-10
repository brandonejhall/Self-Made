// Validates every JSON file in content/events against the event schema.
// Run: npm run validate

import Ajv from "ajv";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EVENT_FILES } from "./index";

const root = new URL(".", import.meta.url).pathname;
const schema = JSON.parse(readFileSync(join(root, "schema/event.schema.json"), "utf8"));
const validate = new Ajv({ allErrors: true }).compile(schema);

const dir = join(root, "events");
const ids = new Set<string>();
let errors = 0;
let count = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  if (!(file in EVENT_FILES)) {
    errors++;
    console.error(`${file}: not listed in content/index.ts, so the game never loads it`);
  }
  const events = JSON.parse(readFileSync(join(dir, file), "utf8"));
  if (!Array.isArray(events)) {
    console.error(`${file}: top level must be an array`);
    errors++;
    continue;
  }
  for (const event of events) {
    count++;
    if (!validate(event)) {
      errors++;
      console.error(`${file} > ${event.id ?? "(no id)"}:`, validate.errors);
    }
    if (ids.has(event.id)) {
      errors++;
      console.error(`${file}: duplicate id ${event.id}`);
    }
    ids.add(event.id);
  }
}

if (errors > 0) {
  console.error(`${errors} error(s) in ${count} events`);
  process.exit(1);
}
console.log(`${count} events valid`);
