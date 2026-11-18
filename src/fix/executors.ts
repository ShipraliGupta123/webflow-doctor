import type { WebflowClient } from '../webflow/client.js';

export const ALLOWED_FIX_TYPES = ['ALT_TEXT', 'CMS_LINK', 'PAGE_META'] as const;
export type FixType = (typeof ALLOWED_FIX_TYPES)[number];

export type FixPlan =
  | { type: 'ALT_TEXT'; params: { assetId: string; altText: string }; rationale: string }
  | { type: 'CMS_LINK'; params: { collectionId: string; itemId: string; field: string; url: string }; rationale: string }
  | { type: 'PAGE_META'; params: { pageId: string; title: string }; rationale: string };

export interface Snapshot {
  plan: FixPlan;
  previous: string | null; // value before the fix — what rollback restores
  takenAt: string;
}

// Gate rule 4: allow-listed type + params that pass validation.
export function validatePlan(plan: FixPlan): string[] {
  const errors: string[] = [];
  switch (plan.type) {
    case 'ALT_TEXT': {
      const t = plan.params.altText?.trim() ?? '';
      if (!plan.params.assetId) errors.push('assetId is missing');
      if (t.length < 5) errors.push('alt text is too short to describe an image');
      if (t.length > 250) errors.push('alt text is longer than 250 characters');
      if (/^(image|photo|picture|img|hero|x+)$/i.test(t)) errors.push('alt text is a placeholder');
      break;
    }
    case 'CMS_LINK': {
      if (!plan.params.collectionId || !plan.params.itemId || !plan.params.field) {
        errors.push('collectionId, itemId and field are required');
      }
      try {
        if (new URL(plan.params.url).protocol !== 'https:') errors.push('url must use https');
      } catch {
        errors.push('url is not a valid URL');
      }
      break;
    }
    case 'PAGE_META': {
      const t = plan.params.title?.trim() ?? '';
      if (!plan.params.pageId) errors.push('pageId is missing');
      if (!t) errors.push('title is empty');
      if (t.length > 70) errors.push('title is longer than 70 characters');
      break;
    }
    default:
      errors.push(`fix type "${(plan as { type: string }).type}" is not on the allow-list`);
  }
  return errors;
}

export async function readCurrent(plan: FixPlan, wf: WebflowClient): Promise<string | null> {
  switch (plan.type) {
    case 'ALT_TEXT':
      return (await wf.getAsset(plan.params.assetId)).altText ?? null;
    case 'CMS_LINK': {
      const item = await wf.getItem(plan.params.collectionId, plan.params.itemId);
      return item.fieldData?.[plan.params.field] ?? null;
    }
    case 'PAGE_META':
      return (await wf.getPage(plan.params.pageId)).seo?.title ?? null;
  }
}

// Writes are staged: nothing goes live until publishFix() + publishToStaging().
async function writeValue(plan: FixPlan, value: string, wf: WebflowClient): Promise<void> {
  switch (plan.type) {
    case 'ALT_TEXT':
      await wf.setAssetAltText(plan.params.assetId, value);
      return;
    case 'CMS_LINK':
      await wf.setItemFields(plan.params.collectionId, plan.params.itemId, { [plan.params.field]: value });
      return;
    case 'PAGE_META':
      await wf.setPageSeoTitle(plan.params.pageId, value);
      return;
  }
}

function newValue(plan: FixPlan): string {
  switch (plan.type) {
    case 'ALT_TEXT':
      return plan.params.altText.trim();
    case 'CMS_LINK':
      return plan.params.url;
    case 'PAGE_META':
      return plan.params.title.trim();
  }
}

export async function applyFix(plan: FixPlan, wf: WebflowClient): Promise<Snapshot> {
  const errors = validatePlan(plan);
  if (errors.length) throw new Error(`Fix rejected before applying: ${errors.join('; ')}`);
  const snapshot: Snapshot = { plan, previous: await readCurrent(plan, wf), takenAt: new Date().toISOString() };
  await writeValue(plan, newValue(plan), wf);
  return snapshot;
}

export async function rollback(snapshot: Snapshot, wf: WebflowClient): Promise<void> {
  await writeValue(snapshot.plan, snapshot.previous ?? '', wf);
}

// CMS items need their own publish; asset and page changes go out with the site publish.
export async function publishFix(plan: FixPlan, wf: WebflowClient): Promise<void> {
  if (plan.type === 'CMS_LINK') await wf.publishItems(plan.params.collectionId, [plan.params.itemId]);
}
