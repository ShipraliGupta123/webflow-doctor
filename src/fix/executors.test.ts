import { describe, it, expect } from 'vitest';
import type { WebflowClient } from '../webflow/client.js';
import { applyFix, rollback, validatePlan, type FixPlan } from './executors.js';

function fakeWebflow(initial: { alt?: string | null; link?: string; title?: string }) {
  const state = { alt: initial.alt ?? null, link: initial.link ?? '', title: initial.title ?? '' };
  const writes: string[] = [];
  const wf = {
    getAsset: async () => ({ altText: state.alt }),
    setAssetAltText: async (_id: string, v: string) => { writes.push(`alt=${v}`); state.alt = v; },
    getItem: async () => ({ fieldData: { 'buy-link': state.link } }),
    setItemFields: async (_c: string, _i: string, f: Record<string, string>) => {
      writes.push(`link=${f['buy-link']}`);
      state.link = f['buy-link']!;
    },
    getPage: async () => ({ seo: { title: state.title } }),
    setPageSeoTitle: async (_p: string, v: string) => { writes.push(`title=${v}`); state.title = v; },
  } as unknown as WebflowClient;
  return { wf, state, writes };
}

const altPlan: FixPlan = { type: 'ALT_TEXT', params: { assetId: 'a1', altText: 'Coffee cup on a wooden table' }, rationale: '' };
const linkPlan: FixPlan = {
  type: 'CMS_LINK',
  params: { collectionId: 'c', itemId: 'i', field: 'buy-link', url: 'https://webflow.com' },
  rationale: '',
};
const titlePlan: FixPlan = { type: 'PAGE_META', params: { pageId: 'p', title: 'Brewed — small-batch coffee gear' }, rationale: '' };

describe('validatePlan', () => {
  it('accepts the three intended fixes', () => {
    expect(validatePlan(altPlan)).toEqual([]);
    expect(validatePlan(linkPlan)).toEqual([]);
    expect(validatePlan(titlePlan)).toEqual([]);
  });
  it('rejects placeholder alt text, http links, empty titles and off-list types', () => {
    expect(validatePlan({ ...altPlan, params: { assetId: 'a1', altText: 'image' } })).not.toEqual([]);
    expect(validatePlan({ ...linkPlan, params: { ...linkPlan.params, url: 'http://x.com' } })).not.toEqual([]);
    expect(validatePlan({ ...titlePlan, params: { pageId: 'p', title: '  ' } })).not.toEqual([]);
    expect(validatePlan({ type: 'CUSTOM_CSS', params: {}, rationale: '' } as unknown as FixPlan)).not.toEqual([]);
  });
});

describe('apply + rollback', () => {
  it('snapshots the old value, applies the fix, and rollback restores it', async () => {
    const { wf, state } = fakeWebflow({ title: 'Untitled' });
    const snap = await applyFix(titlePlan, wf);
    expect(snap.previous).toBe('Untitled');
    expect(state.title).toBe('Brewed — small-batch coffee gear');
    await rollback(snap, wf);
    expect(state.title).toBe('Untitled');
  });

  it('restores an empty alt (null) as an empty string', async () => {
    const { wf, state } = fakeWebflow({ alt: null });
    const snap = await applyFix(altPlan, wf);
    await rollback(snap, wf);
    expect(state.alt).toBe('');
  });

  it('refuses an invalid plan without writing anything', async () => {
    const { wf, writes } = fakeWebflow({ link: 'https://webflow.com/404' });
    await expect(applyFix({ ...linkPlan, params: { ...linkPlan.params, url: 'not a url' } }, wf)).rejects.toThrow(/rejected/);
    expect(writes).toEqual([]);
  });
});
