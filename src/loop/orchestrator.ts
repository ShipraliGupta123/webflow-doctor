import { SUITE, type SuiteTest } from '../runner/suite.js';
import { runWithRetries, type FlowResult } from '../runner/kane.js';
import { score } from '../runner/score.js';
import { WebflowClient, WebflowError } from '../webflow/client.js';
import { buildInventory, summarizeHtml, type DomSummary } from '../diagnose/inventory.js';
import { diagnose } from '../diagnose/diagnose.js';
import { planFix } from '../fix/planner.js';
import { applyFix, publishFix, rollback, type Snapshot } from '../fix/executors.js';
import { gate } from './gate.js';
import { hashTests } from './antiCheat.js';
import { Evidence } from './evidence.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface LoopOptions {
  runId?: string;
  only?: string[]; // fix only these flow ids (the baseline still runs the whole suite)
  maxAttemptsPerFlow?: number;
  maxKaneRuns?: number;
  suite?: SuiteTest[];
}

export interface LoopSummary {
  runId: string;
  scoreBefore: number;
  scoreAfter: number;
  kaneRuns: number;
  flows: { id: string; name: string; before: string; after: string }[];
}

// Webflow allows one publish per minute; wait and retry on HTTP 429.
async function publishStaging(wf: WebflowClient, ev: Evidence): Promise<void> {
  for (let i = 0; i < 4; i++) {
    try {
      await wf.publishToStaging();
      return;
    } catch (e) {
      if (e instanceof WebflowError && e.status === 429) {
        ev.log('publish_rate_limited', { waitSeconds: 65 });
        await sleep(65_000);
        continue;
      }
      throw e;
    }
  }
  throw new Error('publish kept hitting the rate limit');
}

async function fetchDom(wf: WebflowClient): Promise<DomSummary> {
  const html = await fetch(`${wf.stagingUrl}/?_=${Date.now()}`).then((r) => r.text());
  return summarizeHtml(html);
}

// Is the change actually visible on the published page yet?
function looksLive(snap: Snapshot, dom: DomSummary, phase: 'applied' | 'rolledBack'): boolean {
  const p = snap.plan;
  const before = snap.previous ?? '';
  switch (p.type) {
    case 'PAGE_META':
      return dom.title === (phase === 'applied' ? p.params.title.trim() : before);
    case 'ALT_TEXT': {
      const img = dom.images.find((i) => i.assetId === p.params.assetId);
      return !!img && (img.alt ?? '') === (phase === 'applied' ? p.params.altText.trim() : before);
    }
    case 'CMS_LINK': {
      const oldLinkShown = dom.links.some((l) => l.href === before);
      return phase === 'applied' ? !oldLinkShown : oldLinkShown;
    }
  }
}

async function waitUntilLive(wf: WebflowClient, snap: Snapshot, phase: 'applied' | 'rolledBack', ev: Evidence): Promise<DomSummary> {
  const start = Date.now();
  while (Date.now() - start < 180_000) {
    const dom = await fetchDom(wf);
    if (looksLive(snap, dom, phase)) return dom;
    await sleep(10_000);
  }
  ev.log('publish_not_visible', { phase, plan: snap.plan });
  throw new Error(`change not visible on staging after 3 minutes (${phase})`);
}

export async function runLoop(opts: LoopOptions = {}): Promise<LoopSummary> {
  const suite = opts.suite ?? SUITE;
  const runId = opts.runId ?? new Date().toISOString().replace(/[:.]/g, '-');
  const maxAttempts = opts.maxAttemptsPerFlow ?? 3;
  const maxKaneRuns = opts.maxKaneRuns ?? Number(process.env.KANE_MAX_RUNS_PER_SESSION ?? 40);
  const ev = new Evidence(runId);
  const wf = WebflowClient.fromEnv();
  let kaneRuns = 0;

  const run = async (t: SuiteTest, author: boolean): Promise<FlowResult> => {
    if (kaneRuns >= maxKaneRuns) throw new Error(`Kane run budget (${maxKaneRuns}) exhausted`);
    const { result, rawRuns } = await runWithRetries(t, { author });
    kaneRuns += result.attempts;
    for (const raw of rawRuns) ev.kaneOutput(t.id, raw);
    return result;
  };

  const paths = suite.map((t) => t.path);
  const testsHashAtStart = hashTests(paths);
  ev.log('loop_start', { runId, suite: suite.map((t) => t.id), testsHashAtStart, maxKaneRuns });

  // 1. Red baseline — fresh (--author) so it reflects the live site, not a recording.
  const baseline = new Map<string, FlowResult>();
  for (const t of suite) {
    const r = await run(t, true);
    baseline.set(t.id, r);
    ev.log('baseline_flow', { id: t.id, status: r.status, failedStep: r.failedStep });
  }
  const scoreBefore = score([...baseline.values()]);
  ev.json('baseline.json', { score: scoreBefore, flows: [...baseline.values()] });

  // 2. Fix failing flows, most important first.
  const current = new Map(baseline);
  const failing = suite
    .filter((t) => baseline.get(t.id)!.status !== 'pass')
    .filter((t) => !opts.only || opts.only.includes(t.id))
    .sort((a, b) => b.weight - a.weight);

  for (const t of failing) {
    let accepted = false;
    for (let attempt = 1; attempt <= maxAttempts && !accepted; attempt++) {
      const tag = `${t.id}/attempt-${attempt}`;
      const inventory = await buildInventory(wf);
      const diag = diagnose(t, current.get(t.id)!, inventory);
      ev.json(`${tag}/diagnosis.json`, diag);

      const planned = await planFix(diag);
      ev.json(`${tag}/plan.json`, planned);
      if (!planned.ok) {
        ev.log('plan_rejected', { flow: t.id, attempt, reasons: planned.reasons });
        continue;
      }

      const snap = await applyFix(planned.plan, wf);
      await publishFix(planned.plan, wf);
      await publishStaging(wf, ev);
      const domAfter = await waitUntilLive(wf, snap, 'applied', ev);
      ev.log('fix_live', { flow: t.id, attempt, plan: planned.plan, previous: snap.previous });

      // Kane is the judge: fresh run of the target, free replays of everything that was passing.
      const target = await run(t, true);
      const regression: FlowResult[] = [];
      for (const other of suite) {
        if (other.id !== t.id && current.get(other.id)!.status === 'pass') regression.push(await run(other, false));
      }

      const verdict = gate({
        plan: planned.plan,
        target,
        regression,
        testsHashAtStart,
        testsHashNow: hashTests(paths),
        domBefore: inventory.dom,
        domAfter,
        kaneRuns,
        maxKaneRuns,
      });
      ev.json(`${tag}/verdict.json`, { verdict, target, regression });
      ev.log('gate', { flow: t.id, attempt, accepted: verdict.accepted, reasons: verdict.reasons });

      if (verdict.accepted) {
        accepted = true;
        current.set(t.id, target);
        for (const r of regression) current.set(r.id, r);
      } else {
        await rollback(snap, wf);
        await publishFix(planned.plan, wf);
        await publishStaging(wf, ev);
        await waitUntilLive(wf, snap, 'rolledBack', ev);
        ev.log('rolled_back', { flow: t.id, attempt });
        current.set(t.id, target); // next attempt diagnoses the latest failure
      }
    }
    if (!accepted) ev.log('needs_human', { flow: t.id });
  }

  // 3. Final fresh run of the whole suite: the "after" score.
  const final: FlowResult[] = [];
  for (const t of suite) final.push(await run(t, true));

  const summary: LoopSummary = {
    runId,
    scoreBefore,
    scoreAfter: score(final),
    kaneRuns,
    flows: suite.map((t) => ({
      id: t.id,
      name: t.name,
      before: baseline.get(t.id)!.status,
      after: final.find((r) => r.id === t.id)!.status,
    })),
  };
  ev.json('summary.json', summary);
  ev.log('loop_done', { ...summary });
  return summary;
}
