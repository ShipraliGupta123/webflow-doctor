import type { WebflowClient } from '../webflow/client.js';

export interface DomSummary {
  title: string;
  images: { assetId: string | undefined; alt: string | null; src: string }[];
  links: { text: string; href: string }[];
}

export interface SiteInventory {
  stagingUrl: string;
  pages: { pageId: string; title: string; slug: string | null; seoTitle: string | null }[];
  cmsItems: {
    collectionId: string;
    collectionName: string;
    itemId: string;
    name: string;
    fields: Record<string, string>;
  }[];
  dom: DomSummary;
}

// Reads the published HTML: page title, every image (with its Webflow asset id) and every link.
export function summarizeHtml(html: string): DomSummary {
  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? '';

  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map(([tag]) => {
    const src = /\ssrc="([^"]*)"/i.exec(tag)?.[1] ?? '';
    const alt = /\salt="([^"]*)"/i.exec(tag);
    return {
      assetId: /\/([0-9a-f]{24})_/i.exec(src)?.[1], // Webflow CDN file names start with the asset id
      alt: alt ? alt[1]! : null,
      src,
    };
  });

  const links = [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({
    href: m[1]!,
    text: m[2]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  }));

  return { title, images, links };
}

// Keep only plain text/URL fields — image objects etc. would just bloat the prompt.
function textFields(fieldData: Record<string, unknown> = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldData).filter(([, v]) => typeof v === 'string'),
  ) as Record<string, string>;
}

export async function buildInventory(
  wf: WebflowClient,
  fetchHtml: (url: string) => Promise<string> = (url) => fetch(url).then((r) => r.text()),
): Promise<SiteInventory> {
  const [pagesRes, collectionsRes, html] = await Promise.all([
    wf.listPages(),
    wf.listCollections(),
    fetchHtml(`${wf.stagingUrl}/?_=${Date.now()}`), // cache-buster: always read the latest publish
  ]);

  const cmsItems: SiteInventory['cmsItems'] = [];
  for (const c of collectionsRes.collections ?? []) {
    const itemsRes = await wf.listItems(c.id);
    for (const it of itemsRes.items ?? []) {
      cmsItems.push({
        collectionId: c.id,
        collectionName: c.displayName,
        itemId: it.id,
        name: String(it.fieldData?.name ?? ''),
        fields: textFields(it.fieldData),
      });
    }
  }

  return {
    stagingUrl: wf.stagingUrl,
    pages: (pagesRes.pages ?? [])
      .filter((p: any) => !p.collectionId) // skip CMS template pages
      .map((p: any) => ({
        pageId: p.id,
        title: p.title,
        slug: p.slug ?? null,
        seoTitle: p.seo?.title ?? null,
      })),
    cmsItems,
    dom: summarizeHtml(html),
  };
}
