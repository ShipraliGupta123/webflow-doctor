import Anthropic from '@anthropic-ai/sdk';
import type { Diagnosis } from '../diagnose/diagnose.js';
import type { SiteInventory } from '../diagnose/inventory.js';
import { validatePlan, type FixPlan } from './executors.js';

export const PLANNER_MODEL = 'claude-opus-5-5';

const SYSTEM = `You repair a Webflow staging site so that a failing Kane browser test passes for the right reason.

Choose exactly one fix from this allow-list, or NONE:
- ALT_TEXT: set the alt text of an image asset. Use when an image has empty or missing alt text. Write a short, specific description of what the image shows.
- CMS_LINK: change a URL field of a CMS item. Use when a link that comes from the CMS is broken. Prefer a URL already used by a working item on the same site.
- PAGE_META: set a page's SEO title (the browser tab title).
- NONE: none of the allowed fixes addresses the failure.

Rules:
- Use only ids and field names that appear in the site inventory you are given.
- Change the site so the requirement in the failing test step is genuinely met. Never hide, remove or disable the element the test checks.
- Fill only the fields that belong to the fix type you choose; set every other field to an empty string.
- In rationale, say in one or two sentences which evidence in the diagnosis led to this fix.`;

// Structured output: Claude must reply with exactly this JSON shape.
const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    fixType: { type: 'string', enum: ['ALT_TEXT', 'CMS_LINK', 'PAGE_META', 'NONE'] },
    assetId: { type: 'string' },
    altText: { type: 'string' },
    collectionId: { type: 'string' },
    itemId: { type: 'string' },
    field: { type: 'string' },
    url: { type: 'string' },
    pageId: { type: 'string' },
    title: { type: 'string' },
    rationale: { type: 'string' },
  },
  required: ['fixType', 'assetId', 'altText', 'collectionId', 'itemId', 'field', 'url', 'pageId', 'title', 'rationale'],
  additionalProperties: false,
};

export interface PlannerOutput {
  fixType: 'ALT_TEXT' | 'CMS_LINK' | 'PAGE_META' | 'NONE';
  assetId: string;
  altText: string;
  collectionId: string;
  itemId: string;
  field: string;
  url: string;
  pageId: string;
  title: string;
  rationale: string;
}

export type PlanResult =
  | { ok: true; plan: FixPlan; output: PlannerOutput }
  | { ok: false; reasons: string[]; output: PlannerOutput | null };

// The one call to Claude. Returns null if the model declined.
export async function askClaude(diagnosis: Diagnosis, client = new Anthropic()): Promise<PlannerOutput | null> {
  const response = await client.beta.messages.create({
    model: PLANNER_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // if Opus declines, the API retries on a fallback model in the same call
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: PLAN_SCHEMA } },
    system: SYSTEM,
    messages: [
      { role: 'user', content: `Diagnosis of the failing test:\n\n${JSON.stringify(diagnosis, null, 2)}` },
    ],
  });
  if (response.stop_reason === 'refusal') return null;
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text');
  return text ? (JSON.parse(text.text) as PlannerOutput) : null;
}

export function toFixPlan(o: PlannerOutput): FixPlan | null {
  switch (o.fixType) {
    case 'ALT_TEXT':
      return { type: 'ALT_TEXT', params: { assetId: o.assetId, altText: o.altText }, rationale: o.rationale };
    case 'CMS_LINK':
      return {
        type: 'CMS_LINK',
        params: { collectionId: o.collectionId, itemId: o.itemId, field: o.field, url: o.url },
        rationale: o.rationale,
      };
    case 'PAGE_META':
      return { type: 'PAGE_META', params: { pageId: o.pageId, title: o.title }, rationale: o.rationale };
    default:
      return null;
  }
}

// Anti-hallucination check: every id the model names must exist on the real site.
export function checkAgainstInventory(plan: FixPlan, inv: SiteInventory): string[] {
  switch (plan.type) {
    case 'ALT_TEXT':
      return inv.dom.images.some((img) => img.assetId === plan.params.assetId)
        ? []
        : [`asset ${plan.params.assetId} is not an image on the page`];
    case 'CMS_LINK': {
      const item = inv.cmsItems.find(
        (i) => i.collectionId === plan.params.collectionId && i.itemId === plan.params.itemId,
      );
      if (!item) return [`CMS item ${plan.params.itemId} does not exist`];
      return plan.params.field in item.fields ? [] : [`field "${plan.params.field}" is not on that item`];
    }
    case 'PAGE_META':
      return inv.pages.some((p) => p.pageId === plan.params.pageId) ? [] : [`page ${plan.params.pageId} does not exist`];
  }
}

export async function urlReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    return res.status < 400;
  } catch {
    return false;
  }
}

export async function planFix(
  diagnosis: Diagnosis,
  deps: {
    ask?: (d: Diagnosis) => Promise<PlannerOutput | null>;
    reachable?: (url: string) => Promise<boolean>;
  } = {},
): Promise<PlanResult> {
  const ask = deps.ask ?? ((d: Diagnosis) => askClaude(d));
  const reachable = deps.reachable ?? urlReachable;

  const output = await ask(diagnosis);
  if (!output) return { ok: false, reasons: ['the model declined to propose a fix'], output };

  const plan = toFixPlan(output);
  if (!plan) return { ok: false, reasons: ['no allowed fix applies — needs a human'], output };

  const reasons = [...validatePlan(plan), ...checkAgainstInventory(plan, diagnosis.inventory)];
  if (plan.type === 'CMS_LINK' && reasons.length === 0 && !(await reachable(plan.params.url))) {
    reasons.push(`new URL ${plan.params.url} does not load (HTTP error)`);
  }
  return reasons.length ? { ok: false, reasons, output } : { ok: true, plan, output };
}
