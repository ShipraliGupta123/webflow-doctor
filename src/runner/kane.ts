import { spawn } from 'node:child_process';
import type { SuiteTest } from './suite.js';

export interface KaneDiagnosis {
  confirmedSiteBug: boolean | undefined; // test_md_bug_verdict.confirmed
  bugTitle: string | undefined;
  family: string | undefined;
  category: string | undefined;
  confidence: number | undefined;
  rootCause: string | undefined;
  suggestion: string | undefined;
}

export interface ParsedRun {
  status: 'pass' | 'fail' | 'error';
  durationMs: number;
  failedStep: number | undefined;
  failureMessage: string | undefined;
  diagnosis: KaneDiagnosis | undefined;
  authorDecisions: number; // 0 = every step was replayed from a recording
  credits: number;
  sessionId: string | undefined;
  failedChecks: { query: string; expected: string; actual: string; analyzer: string }[];
}

export interface FlowResult extends ParsedRun {
  id: string;
  name: string;
  weight: number;
  attempts: number;
}

type KaneEvent = Record<string, any>;

export function parseTestmdOutput(ndjson: string): ParsedRun {
  let done: KaneEvent | undefined;
  let summary: KaneEvent | undefined;
  let bugVerdict: KaneEvent | undefined;
  let failedRunEnd: KaneEvent | undefined;
  let failedStep: number | undefined;
  let credits = 0;

  for (const line of ndjson.split('\n')) {
    const text = line.trim();
    if (!text.startsWith('{')) continue; // skip non-JSON noise
    let ev: KaneEvent;
    try {
      ev = JSON.parse(text);
    } catch {
      continue;
    }
    switch (ev.type) {
      case 'test_md_done':
        done = ev;
        break;
      case 'test_md_summary':
        summary = ev;
        break;
      case 'test_md_bug_verdict':
        bugVerdict = ev;
        break;
      case 'test_md_step_end':
        if (ev.status === 'failed' && failedStep === undefined) failedStep = ev.step_index;
        break;
      case 'run_end':
        credits += Number(ev.credits_consumed ?? 0);
        if (ev.status === 'failed') failedRunEnd = ev;
        break;
      // every other event type is ignored on purpose — Kane adds new ones over time
    }
  }

  const status: ParsedRun['status'] = !done
    ? 'error' // Kane exited without finishing (crash, auth problem, killed)
    : done.overall_status === 'passed'
      ? 'pass'
      : done.overall_status === 'failed'
        ? 'fail'
        : 'error';

    const verdict = failedRunEnd?.verdict;
  const diagnosis: KaneDiagnosis | undefined =
    status === 'fail'
      ? {
          confirmedSiteBug: bugVerdict?.confirmed,
          bugTitle: bugVerdict?.bug_title ?? verdict?.bug_title,
          family: bugVerdict?.family ?? verdict?.family,
          category: bugVerdict?.category ?? verdict?.category,
          confidence: bugVerdict?.confidence ?? verdict?.confidence,
          rootCause: verdict?.root_cause,
          suggestion: verdict?.suggestion,
        }
      : undefined;

  // The individual checks that failed: what Kane expected vs what it actually saw.
  const memory: Record<string, any> = failedRunEnd?.context?.memory ?? {};
  const failedChecks = Object.values(memory)
    .filter((m: any) => typeof m?.reasoning === 'string' && m.reasoning.includes('FAIL'))
    .map((m: any) => ({
      query: String(m.condition ?? m.query ?? ''),
      expected: String(m.expected_value ?? ''),
      actual: String(m.extracted_value ?? ''),
      analyzer: String(m.analyzer_type ?? ''),
    }));

  return {
    status,
    durationMs: Math.round(Number(done?.duration_s ?? 0) * 1000),
    failedStep,
    failureMessage: failedRunEnd?.reason,
    diagnosis,
    authorDecisions: Number(summary?.steps?.author_decisions ?? 0),
    credits,
    sessionId: done?.session_id,
    failedChecks,
  };
}

function spawnKane(args: string[]): Promise<{ stdout: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn('kane-cli', args, {
      stdio: ['ignore', 'pipe', 'pipe'], // stdin closed = same as `< /dev/null`
      env: { ...process.env, KANE_CLI_USER_AGENT: 'webflow-doctor' },
    });
    let stdout = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', () => {}); // stderr only carries hints, not results
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, exitCode: code ?? 1 }));
  });
}

// One Kane run at a time: parallel runs fight over the same Chrome port.
let queue: Promise<unknown> = Promise.resolve();

export function runTest(
  test: SuiteTest,
  opts: { author: boolean },
): Promise<{ result: FlowResult; rawNdjson: string }> {
  const job = queue.then(async () => {
    const args = ['testmd', 'run', test.path, '--agent'];
    if (opts.author) args.push('--author');
    const { stdout } = await spawnKane(args);
    const parsed = parseTestmdOutput(stdout);
    return {
      result: { ...parsed, id: test.id, name: test.name, weight: test.weight, attempts: 1 },
      rawNdjson: stdout, // the evidence writer (T3.3) will save this
    };
  });
  queue = job.catch(() => undefined);
  return job;
}

export async function runWithRetries(
  test: SuiteTest,
  opts: { author: boolean },
  maxAttempts = 3,
  run: typeof runTest = runTest, // injectable so tests don't call Kane
): Promise<{ result: FlowResult; rawRuns: string[] }> {
  const rawRuns: string[] = [];
  let credits = 0;
  let last: FlowResult | undefined;

  for (let i = 0; i < maxAttempts; i++) {
    const { result, rawNdjson } = await run(test, opts);
    rawRuns.push(rawNdjson);
    credits += result.credits;
    last = result;
    if (result.status === 'pass') break; // passed — done
    const preciseFailure = result.failedChecks.some((c) => ['title', 'url'].includes(c.analyzer));
    if (result.diagnosis?.confirmedSiteBug === true || preciseFailure) break; // real failure — rerunning wastes credits
  }

  return { result: { ...last!, attempts: rawRuns.length, credits }, rawRuns };
}


