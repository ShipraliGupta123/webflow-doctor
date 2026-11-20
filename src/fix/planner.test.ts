import { describe, it, expect } from 'vitest';
import { planFix, type PlannerOutput } from './planner.js';
import type { Diagnosis } from '../diagnose/diagnose.js';

const diagnosis = {
  flowId: 't-4', flowName: 'Hero image alt text', testPath: 'x', failedStep: 2,
  failedStepText: 'assert the alt attribute value is not an empty string', failureMessage: 'alt empty',
  failedChecks: [], kane: undefined,
  inventory: {
    stagingUrl: 'https://webflow-doctor-demo.webflow.io',
    pages: [{ pageId: 'page1', title: 'Home', slug: null, seoTitle: 'Untitled' }],
    cmsItems: [{
      collectionId: 'col1', collectionName: 'Products', itemId: 'item1', name: 'Travel Press',
      fields: { name: 'Travel Press', 'buy-link': 'https://webflow.com/404-this-page-is-gone' },
    }],
    dom: { title: 'Untitled', images: [{ assetId: 'asset1', alt: '', src: 'x' }], links: [] },
  },
} as Diagnosis;

const empty: PlannerOutput = {
  fixType: 'NONE', assetId: '', altText: '', collectionId: '', itemId: '', field: '', url: '', pageId: '', title: '', rationale: 'r',
};
const answer = (o: Partial<PlannerOutput>) => async () => ({ ...empty, ...o });
const alwaysReachable = async () => true;

describe('planFix', () => {
  it('accepts a valid alt-text fix for a real image', async () => {
    const r = await planFix(diagnosis, { ask: answer({ fixType: 'ALT_TEXT', assetId: 'asset1', altText: 'A ceramic coffee cup on a wooden table' }) });
    expect(r.ok).toBe(true);
  });

  it('rejects an asset id that is not on the page (hallucinated)', async () => {
    const r = await planFix(diagnosis, { ask: answer({ fixType: 'ALT_TEXT', assetId: 'made-up', altText: 'A ceramic coffee cup' }) });
    expect(r.ok).toBe(false);
  });

  it('rejects placeholder alt text', async () => {
    const r = await planFix(diagnosis, { ask: answer({ fixType: 'ALT_TEXT', assetId: 'asset1', altText: 'image' }) });
    expect(r.ok).toBe(false);
  });

  it('rejects a replacement link that does not load', async () => {
    const r = await planFix(diagnosis, {
      ask: answer({ fixType: 'CMS_LINK', collectionId: 'col1', itemId: 'item1', field: 'buy-link', url: 'https://example.com/dead' }),
      reachable: async () => false,
    });
    expect(r.ok).toBe(false);
  });

  it('accepts a working replacement link on a real field', async () => {
    const r = await planFix(diagnosis, {
      ask: answer({ fixType: 'CMS_LINK', collectionId: 'col1', itemId: 'item1', field: 'buy-link', url: 'https://webflow.com' }),
      reachable: alwaysReachable,
    });
    expect(r.ok).toBe(true);
  });

  it('treats NONE and a refusal as "needs a human"', async () => {
    expect((await planFix(diagnosis, { ask: answer({ fixType: 'NONE' }) })).ok).toBe(false);
    expect((await planFix(diagnosis, { ask: async () => null })).ok).toBe(false);
  });
});
