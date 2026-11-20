import type { FlowResult } from '../runner/kane.js';
import type { DomSummary } from '../diagnose/inventory.js';
import { validatePlan, type FixPlan } from '../fix/executors.js';
import { removedElements, specialCasing } from './antiCheat.js';

export interface GateInput {
  plan: FixPlan;
  target: FlowResult; // the failing flow, re-run fresh after the fix
  regression: FlowResult[]; // every flow that was passing before this fix, re-run after it
  testsHashAtStart: string;
  testsHashNow: string;
  domBefore: DomSummary;
  domAfter: DomSummary;
  kaneRuns: number;
  maxKaneRuns: number;
}

export interface GateCheck {
  rule: string;
  passed: boolean;
  detail: string;
}

export interface GateVerdict {
  accepted: boolean;
  reasons: string[];
  checks: GateCheck[];
}

// PRD section 8. Kane's results decide rules 1–2; the rest are our anti-cheat checks.
export function gate(i: GateInput): GateVerdict {
  const broken = i.regression.filter((r) => r.status !== 'pass').map((r) => r.id);
  const invalid = validatePlan(i.plan);
  const removed = removedElements(i.domBefore, i.domAfter);
  const cheating = specialCasing(i.plan);

  const checks: GateCheck[] = [
    { rule: '1 target flow passes', passed: i.target.status === 'pass', detail: `${i.target.id} is ${i.target.status}` },
    { rule: '2 no regressions', passed: broken.length === 0, detail: broken.length ? `now failing: ${broken.join(', ')}` : 'all still pass' },
    { rule: '3 tests unchanged', passed: i.testsHashAtStart === i.testsHashNow, detail: i.testsHashAtStart === i.testsHashNow ? 'hash matches' : 'test files were modified during the loop' },
    { rule: '4 allow-listed, valid params', passed: invalid.length === 0, detail: invalid.join('; ') || 'ok' },
    { rule: '5 nothing removed', passed: removed.length === 0, detail: removed.join('; ') || 'ok' },
    { rule: '6 no special-casing of the test runner', passed: cheating.length === 0, detail: cheating.join('; ') || 'ok' },
    { rule: '7 within Kane run budget', passed: i.kaneRuns <= i.maxKaneRuns, detail: `${i.kaneRuns}/${i.maxKaneRuns} runs` },
  ];

  const failed = checks.filter((c) => !c.passed);
  return { accepted: failed.length === 0, reasons: failed.map((c) => `${c.rule}: ${c.detail}`), checks };
}
