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

  return {
    status,
    durationMs: Math.round(Number(done?.duration_s ?? 0) * 1000),
    failedStep,
    failureMessage: failedRunEnd?.reason,
    diagnosis,
    authorDecisions: Number(summary?.steps?.author_decisions ?? 0),
    credits,
    sessionId: done?.session_id,
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
