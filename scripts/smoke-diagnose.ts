import { readFileSync } from 'node:fs';
import { WebflowClient } from '../src/webflow/client.js';
import { parseTestmdOutput } from '../src/runner/kane.js';
import { SUITE } from '../src/runner/suite.js';
import { buildInventory } from '../src/diagnose/inventory.js';
import { diagnose } from '../src/diagnose/diagnose.js';

// Reuses the saved Travel Press failure, so no Kane credits are spent.
const wf = WebflowClient.fromEnv();
const test = SUITE.find((t) => t.id === 't-1')!;
const parsed = parseTestmdOutput(readFileSync('src/runner/__fixtures__/fail-site-bug.ndjson', 'utf8'));
const result = { ...parsed, id: test.id, name: test.name, weight: test.weight, attempts: 1 };

const d = diagnose(test, result, await buildInventory(wf));

// Print everything except the long list of links, which we only count.
console.log(
  JSON.stringify(
    { ...d, inventory: { ...d.inventory, dom: { ...d.inventory.dom, links: `${d.inventory.dom.links.length} links` } } },
    null,
    2,
  ),
);
