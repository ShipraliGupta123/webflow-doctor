import type { FlowResult } from './kane.js';

// Weighted 0–100: the share of total weight that passed.
export function score(results: FlowResult[]): number {
  const total = results.reduce((sum, r) => sum + r.weight, 0);
  if (total === 0) return 0;
  const passed = results
    .filter((r) => r.status === 'pass')
    .reduce((sum, r) => sum + r.weight, 0);
  return Math.round((passed / total) * 100);
}
