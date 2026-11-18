import { readFileSync } from 'node:fs';
import type { FlowResult } from '../runner/kane.js';
import type { SuiteTest } from '../runner/suite.js';
import type { SiteInventory } from './inventory.js';

export interface Diagnosis {
  flowId: string;
  flowName: string;
  testPath: string;
  failedStep: number | undefined;
  failedStepText: string | undefined; // the plain-English step from the _test.md
  failureMessage: string | undefined;
  failedChecks: FlowResult['failedChecks'];
  kane: FlowResult['diagnosis']; // root cause, suggestion, bug title, confirmed flag
  inventory: SiteInventory;
}

// Returns the body text under "## Step N ..." in a _test.md file.
export function stepText(testMarkdown: string, step: number): string | undefined {
  const parts = testMarkdown.split(/^## Step (\d+)[^\n]*\n/m); // [before, "1", body, "2", body, ...]
  for (let i = 1; i < parts.length; i += 2) {
    if (Number(parts[i]) === step) return parts[i + 1]!.trim();
  }
  return undefined;
}

export function diagnose(
  test: SuiteTest,
  result: FlowResult,
  inventory: SiteInventory,
  readFile: (path: string) => string = (p) => readFileSync(p, 'utf8'),
): Diagnosis {
  const markdown = readFile(test.path);
  return {
    flowId: test.id,
    flowName: test.name,
    testPath: test.path,
    failedStep: result.failedStep,
    failedStepText: result.failedStep === undefined ? undefined : stepText(markdown, result.failedStep),
    failureMessage: result.failureMessage,
    failedChecks: result.failedChecks,
    kane: result.diagnosis,
    inventory,
  };
}
