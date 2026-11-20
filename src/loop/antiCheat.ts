import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { DomSummary } from '../diagnose/inventory.js';
import type { FixPlan } from '../fix/executors.js';

// Hash only the steps, not the frontmatter: `--author` rewrites the `base:` hash in the
// frontmatter on every fresh run, and that must not trip the lock.
export function stepsOnly(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
}

export function hashTests(paths: string[], read: (p: string) => string = (p) => readFileSync(p, 'utf8')): string {
  const h = createHash('sha256');
  for (const p of [...paths].sort()) {
    h.update(p).update('\0').update(stepsOnly(read(p))).update('\0');
  }
  return h.digest('hex');
}

// Gate rule 5: a fix must not make the checked content disappear.
export function removedElements(before: DomSummary, after: DomSummary): string[] {
  const out: string[] = [];
  if (after.images.length < before.images.length) out.push(`images ${before.images.length} → ${after.images.length}`);
  if (after.links.length < before.links.length) out.push(`links ${before.links.length} → ${after.links.length}`);
  if (before.title && !after.title) out.push('page title removed');
  return out;
}

// Gate rule 6: a fix value must not target the test runner instead of real visitors.
const RUNNER_MARKERS = /kane|testmu|lambdatest|user-?agent|headless|webdriver|navigator\./i;
export function specialCasing(plan: FixPlan): string[] {
  return Object.values(plan.params)
    .map(String)
    .filter((v) => RUNNER_MARKERS.test(v))
    .map((v) => `value special-cases the test runner: "${v}"`);
}
