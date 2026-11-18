import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTestmdOutput } from './kane.js';

const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8');

describe('parseTestmdOutput', () => {
  it('reads a real site bug (Travel Press 404)', () => {
    const r = parseTestmdOutput(fixture('fail-site-bug.ndjson'));
    expect(r.status).toBe('fail');
    expect(r.failedStep).toBe(4);
    expect(r.diagnosis?.confirmedSiteBug).toBe(true);
    expect(r.diagnosis?.family).toBe('application_issue');
    expect(r.diagnosis?.bugTitle).toBe('Travel Press Buy link opens a Webflow 404 page');
    expect(r.diagnosis?.suggestion).toContain('Travel Press');
    expect(r.durationMs).toBe(180_000);
    expect(r.credits).toBeCloseTo(79.18, 1);
  });

  it('flags a failure Kane blames on itself as not a confirmed site bug', () => {
    const r = parseTestmdOutput(fixture('fail-kane-blames-itself.ndjson'));
    expect(r.status).toBe('fail');
    expect(r.failedStep).toBe(2);
    expect(r.diagnosis?.confirmedSiteBug).toBe(false);
    expect(r.diagnosis?.family).toBe('automation_bug');
  });

  it('reads a replayed pass: zero credits, zero fresh decisions', () => {
    const r = parseTestmdOutput(fixture('pass-replay.ndjson'));
    expect(r.status).toBe('pass');
    expect(r.diagnosis).toBeUndefined();
    expect(r.failedStep).toBeUndefined();
    expect(r.credits).toBe(0);
    expect(r.authorDecisions).toBe(0);
  });

  it('returns error when Kane never finishes', () => {
    const r = parseTestmdOutput('{"type":"stream_start"}\nnot json at all\n');
    expect(r.status).toBe('error');
  });
});
