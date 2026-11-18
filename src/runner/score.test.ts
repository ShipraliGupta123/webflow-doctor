import { describe, it, expect } from 'vitest';
import { score } from './score.js';
import { runWithRetries, type FlowResult, type ParsedRun } from './kane.js';
import { SUITE } from './suite.js';

const flow = (weight: number, status: FlowResult['status']): FlowResult =>
  ({ id: 'x', name: 'x', weight, attempts: 1, status, durationMs: 0, failedStep: undefined,
     failureMessage: undefined, diagnosis: undefined, authorDecisions: 0, credits: 0,
     sessionId: undefined });

describe('score', () => {
  it('matches the red baseline: only the weight-3 desktop test passes', () => {
    expect(score([flow(3, 'fail'), flow(3, 'pass'), flow(2, 'fail'), flow(1, 'fail')])).toBe(33);
  });
  it('is 100 when everything passes, 0 for an empty run', () => {
    expect(score([flow(3, 'pass'), flow(1, 'pass')])).toBe(100);
    expect(score([])).toBe(0);
  });
});

describe('runWithRetries', () => {
  const test = SUITE[0]!;
  const fake = (results: Partial<ParsedRun>[]) => {
    let i = 0;
    return async () => ({
      result: { ...flow(3, 'fail'), credits: 10, ...results[i++] } as FlowResult,
      rawNdjson: `run-${i}`,
    });
  };

  it('does not rerun a confirmed site bug', async () => {
    const run = fake([{ status: 'fail', diagnosis: { confirmedSiteBug: true } as any }]);
    const { result } = await runWithRetries(test, { author: true }, 3, run);
    expect(result.attempts).toBe(1);
  });

  it('reruns when Kane blames itself, stops at the first pass', async () => {
    const run = fake([
      { status: 'fail', diagnosis: { confirmedSiteBug: false } as any },
      { status: 'pass' },
    ]);
    const { result } = await runWithRetries(test, { author: true }, 3, run);
    expect(result.attempts).toBe(2);
    expect(result.status).toBe('pass');
    expect(result.credits).toBe(20);
  });

  it('gives up after 3 unconfirmed failures', async () => {
    const unconfirmed = { status: 'fail' as const, diagnosis: { confirmedSiteBug: false } as any };
    const { result } = await runWithRetries(test, { author: true }, 3, fake([unconfirmed, unconfirmed, unconfirmed]));
    expect(result.attempts).toBe(3);
    expect(result.status).toBe('fail');
  });
});
