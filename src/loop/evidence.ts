import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Everything the loop decides is written under evidence/<run-id>/ (PRD FR-7).
export class Evidence {
  readonly dir: string;
  private seq = 0;

  constructor(runId: string, root = 'evidence') {
    this.dir = join(root, runId);
    mkdirSync(this.dir, { recursive: true });
  }

  private write(name: string, content: string): void {
    const path = join(this.dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }

  json(name: string, data: unknown): void {
    this.write(name, JSON.stringify(data, null, 2));
  }

  kaneOutput(testId: string, ndjson: string): void {
    this.write(`kane/${String(++this.seq).padStart(3, '0')}-${testId}.ndjson`, ndjson);
  }

  // Structured log: one JSON line per decision, also echoed to the terminal.
  log(event: string, data: Record<string, unknown> = {}): void {
    appendFileSync(join(this.dir, 'log.ndjson'), JSON.stringify({ ts: new Date().toISOString(), event, ...data }) + '\n');
    console.log(`[${event}]`, JSON.stringify(data));
  }
}
