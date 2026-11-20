import { readFileSync } from 'node:fs';
import { WebflowClient } from '../src/webflow/client.js';
import { parseTestmdOutput } from '../src/runner/kane.js';
import { SUITE } from '../src/runner/suite.js';
import { buildInventory } from '../src/diagnose/inventory.js';
import { diagnose } from '../src/diagnose/diagnose.js';
import { planFix } from '../src/fix/planner.js';

const wf = WebflowClient.fromEnv();
const inventory = await buildInventory(wf);

const cases = [
  { id: 't-1', fixture: 'src/runner/__fixtures__/fail-site-bug.ndjson' },
  { id: 't-6', fixture: 'src/runner/__fixtures__/fail-title-precise.ndjson' },
];

for (const c of cases) {
  const test = SUITE.find((t) => t.id === c.id)!;
  const parsed = parseTestmdOutput(readFileSync(c.fixture, 'utf8'));
  const result = { ...parsed, id: test.id, name: test.name, weight: test.weight, attempts: 1 };
  const r = await planFix(diagnose(test, result, inventory));
  console.log(`\n=== ${c.id} ${test.name}`);
  console.log(r.ok ? 'ACCEPTED' : `REJECTED: ${r.reasons.join('; ')}`);
  console.log(JSON.stringify(r.ok ? r.plan : r.output, null, 2));
}
