import { WebflowClient } from '../src/webflow/client.js';
import { applyFix, readCurrent, rollback, type FixPlan } from '../src/fix/executors.js';

const wf = WebflowClient.fromEnv();
const plans: FixPlan[] = [
  { type: 'ALT_TEXT', params: { assetId: '6afb70b5f814d42288f41ade', altText: 'A ceramic coffee cup on a wooden table' }, rationale: 'smoke' },
  {
    type: 'CMS_LINK',
    params: { collectionId: '6afbef72ddd8aeed2da51e10', itemId: '6afbf088f45b0ed3cc52f6e5', field: 'buy-link', url: 'https://webflow.com' },
    rationale: 'smoke',
  },
  { type: 'PAGE_META', params: { pageId: '6afb6f40015a6fa143a72dd0', title: 'Brewed — small-batch coffee gear' }, rationale: 'smoke' },
];

for (const plan of plans) {
  const snap = await applyFix(plan, wf);
  const after = await readCurrent(plan, wf);
  await rollback(snap, wf);
  const restored = await readCurrent(plan, wf);
  console.log(`${plan.type.padEnd(9)} before=${JSON.stringify(snap.previous)} after=${JSON.stringify(after)} restored=${JSON.stringify(restored)}`);
}
