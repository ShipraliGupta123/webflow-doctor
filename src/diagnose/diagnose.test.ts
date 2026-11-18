import { describe, it, expect } from 'vitest';
import { summarizeHtml } from './inventory.js';
import { stepText } from './diagnose.js';

const html = `<html><head><title>Untitled</title></head><body>
  <img src="https://cdn.prod.website-files.com/6afb6f3f015a6fa143a72dc5/6afb70b5f814d42288f41ade_CA4A5845e.webp" alt="">
  <a href="https://webflow.com/404-this-page-is-gone" class="buy-button">Buy</a>
  <a href="mailto:hello@brewed.example.com"><span>hello@brewed.example.com</span></a>
</body></html>`;

describe('summarizeHtml', () => {
  it('reads the title, image asset ids with alt, and links', () => {
    const d = summarizeHtml(html);
    expect(d.title).toBe('Untitled');
    expect(d.images[0]).toMatchObject({ assetId: '6afb70b5f814d42288f41ade', alt: '' });
    expect(d.links).toContainEqual({ href: 'https://webflow.com/404-this-page-is-gone', text: 'Buy' });
    expect(d.links).toContainEqual({ href: 'mailto:hello@brewed.example.com', text: 'hello@brewed.example.com' });
  });

  it('marks a missing alt attribute as null, not empty', () => {
    expect(summarizeHtml('<img src="/x.png">').images[0]!.alt).toBeNull();
  });
});

describe('stepText', () => {
  const md = `---
assurance:
  id: t-1
---
# Title

## Step 1

Open the page.

## Step 2 @verifies ac-1

Click Buy, then assert no 404.
`;

  it('returns the body of the requested step', () => {
    expect(stepText(md, 2)).toBe('Click Buy, then assert no 404.');
    expect(stepText(md, 1)).toBe('Open the page.');
  });

  it('returns undefined for a step that does not exist', () => {
    expect(stepText(md, 9)).toBeUndefined();
  });
});
