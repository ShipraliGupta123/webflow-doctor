import { WebflowClient } from '../src/webflow/client.js';

// Re-plants the three demo bugs on the staging site so the loop can be run again.
const wf = WebflowClient.fromEnv();
const COLLECTION = '6afbef72ddd8aeed2da51e10';
const TRAVEL_PRESS = '6afbf088f45b0ed3cc52f6e5';

await wf.setPageSeoTitle('6afb6f40015a6fa143a72dd0', 'Untitled');                     // bug: PAGE_META
await wf.setAssetAltText('6afb70b5f814d42288f41ade', '');                               // bug: ALT_TEXT
await wf.setItemFields(COLLECTION, TRAVEL_PRESS, { 'buy-link': 'https://webflow.com/404-this-page-is-gone' }); // bug: CMS_LINK
await wf.publishItems(COLLECTION, [TRAVEL_PRESS]);
await wf.publishToStaging();
console.log('Demo bugs re-planted and published to staging. Wait ~1 minute before running the loop.');
