import { runLoop } from '../loop/orchestrator.js';

// Usage: npm run doctor            → fix every failing flow
//        npm run doctor -- --only t-6   → fix just one (cheaper first run)
const i = process.argv.indexOf('--only');
const only = i >= 0 ? process.argv[i + 1]?.split(',') : undefined;

const summary = await runLoop(only ? { only } : {});

console.log(`\nScore ${summary.scoreBefore} → ${summary.scoreAfter}  (${summary.kaneRuns} Kane runs)`);
for (const f of summary.flows) console.log(`  ${f.id.padEnd(4)} ${f.before.padEnd(5)} → ${f.after.padEnd(5)}  ${f.name}`);
console.log(`Evidence: evidence/${summary.runId}/`);
