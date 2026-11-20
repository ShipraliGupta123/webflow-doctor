import { describe, it, expect } from 'vitest';
import { gate, type GateInput } from './gate.js';
import { hashTests, stepsOnly } from './antiCheat.js';
import type { FlowResult } from '../runner/kane.js';

const flow = (id: string, status: FlowResult['status']): FlowResult =>
  ({ id, name: id, weight: 1, attempts: 1, status, durationMs: 0, failedStep: undefined, failureMessage: undefined,
     diagnosis: undefined, authorDecisions: 0, credits: 0, sessionId: undefined, failedChecks: [] });

const dom = { title: 'Untitled', images: [{ assetId: 'a1', alt: '', src: 'x' }], links: [{ text: 'Buy', href: 'https://webflow.com' }] };

const good: GateInput = {
  plan: { type: 'PAGE_META', params: { pageId: 'p1', title: 'Brewed — small-batch coffee gear' }, rationale: '' },
  target: flow('t-6', 'pass'),
  regression: [flow('t-3', 'pass'), flow('t-5', 'pass')],
  testsHashAtStart: 'h1',
  testsHashNow: 'h1',
  domBefore: dom,
  domAfter: { ...dom, title: 'Brewed — small-batch coffee gear' },
  kaneRuns: 8,
  maxKaneRuns: 40,
};

describe('gate', () => {
  it('accepts a good fix', () => {
    expect(gate(good).accepted).toBe(true);
  });
  it('rejects when the target still fails', () => {
    expect(gate({ ...good, target: flow('t-6', 'fail') }).accepted).toBe(false);
  });
  it('rejects a fix that breaks a previously passing flow', () => {
    const v = gate({ ...good, regression: [flow('t-3', 'fail')] });
    expect(v.accepted).toBe(false);
    expect(v.reasons.join()).toMatch(/t-3/);
  });
  it('rejects when a test file was edited during the loop', () => {
    expect(gate({ ...good, testsHashNow: 'h2' }).accepted).toBe(false);
  });
  it('rejects a fix that removes content the flows check', () => {
    expect(gate({ ...good, domAfter: { ...dom, images: [] } }).accepted).toBe(false);
  });
  it('rejects a fix that special-cases the test runner', () => {
    const plan = { type: 'PAGE_META' as const, params: { pageId: 'p1', title: 'Kane test title' }, rationale: '' };
    expect(gate({ ...good, plan }).accepted).toBe(false);
  });
});

describe('hashTests', () => {
  const read = (body: string) => () => `---\nassurance:\n  base: sha256:abc\n---\n${body}`;
  it('ignores frontmatter changes (Kane --author rewrites base:)', () => {
    expect(hashTests(['a'], read('## Step 1\n\nOpen.'))).toBe(
      hashTests(['a'], () => `---\nassurance:\n  base: sha256:zzz\n---\n## Step 1\n\nOpen.`),
    );
  });
  it('changes when a step changes', () => {
    expect(hashTests(['a'], read('## Step 1\n\nOpen.'))).not.toBe(hashTests(['a'], read('## Step 1\n\nSkip.')));
  });
  it('strips only the frontmatter', () => {
    expect(stepsOnly('---\nx: 1\n---\n# T\n')).toBe('# T');
  });
});
