import { WebflowClient } from '../src/webflow/client.js';

const wf = WebflowClient.fromEnv();
const page = await wf.getPage('6afb6f40015a6fa143a72dd0');
const asset = await wf.getAsset('6afb70b5f814d42288f41ade');
const item = await wf.getItem('6afbef72ddd8aeed2da51e10', '6afbf088f45b0ed3cc52f6e5');

console.log('page SEO title :', page.seo?.title);
console.log('hero alt text  :', asset.altText);
console.log('Travel Press   :', item.fieldData?.['buy-link']);
