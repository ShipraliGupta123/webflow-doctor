const API = 'https://api.webflow.com/v2';

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface WebflowConfig {
  token: string;
  siteId: string;
  stagingDomain: string;
}

export class WebflowError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    message: string,
  ) {
    super(message);
  }
}

// The safety rule: only a plain <name>.webflow.io domain counts as staging.
export function assertStagingDomain(domain: string): void {
  if (!/^[a-z0-9-]+\.webflow\.io$/i.test(domain)) {
    throw new Error(`Refusing to use "${domain}": only *.webflow.io staging domains are allowed`);
  }
}

export class WebflowClient {
  constructor(
    private readonly cfg: WebflowConfig,
    private readonly fetchFn: FetchLike = fetch,
  ) {
    if (!cfg.token) throw new Error('WEBFLOW_SITE_TOKEN is missing');
    if (!cfg.siteId) throw new Error('WEBFLOW_SITE_ID is missing');
    assertStagingDomain(cfg.stagingDomain);
  }

  static fromEnv(fetchFn?: FetchLike): WebflowClient {
    return new WebflowClient(
      {
        token: process.env.WEBFLOW_SITE_TOKEN ?? '',
        siteId: process.env.WEBFLOW_SITE_ID ?? '',
        stagingDomain: process.env.STAGING_DOMAIN ?? '',
      },
      fetchFn,
    );
  }

  get stagingUrl(): string {
    return `https://${this.cfg.stagingDomain}`;
  }

  private async call<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchFn(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.cfg.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    if (!res.ok) throw new WebflowError(res.status, text, `${method} ${path} → HTTP ${res.status}`);
    return (text ? JSON.parse(text) : {}) as T;
  }

  // ALT_TEXT
  getAsset(assetId: string) {
    return this.call('GET', `/assets/${assetId}`);
  }
  setAssetAltText(assetId: string, altText: string) {
    return this.call('PATCH', `/assets/${assetId}`, { altText });
  }

  // CMS_LINK
  getItem(collectionId: string, itemId: string) {
    return this.call('GET', `/collections/${collectionId}/items/${itemId}`);
  }
  setItemFields(collectionId: string, itemId: string, fieldData: Record<string, unknown>) {
    return this.call('PATCH', `/collections/${collectionId}/items/${itemId}`, { fieldData });
  }
  publishItems(collectionId: string, itemIds: string[]) {
    return this.call('POST', `/collections/${collectionId}/items/publish`, { itemIds });
  }

  // PAGE_META
  getPage(pageId: string) {
    return this.call('GET', `/pages/${pageId}`);
  }
  setPageSeoTitle(pageId: string, title: string) {
    return this.call('PUT', `/pages/${pageId}`, { seo: { title } });
  }

  // Publish: hard-coded to the webflow.io subdomain. There is no way to pass custom domains.
  publishToStaging() {
    return this.call('POST', `/sites/${this.cfg.siteId}/publish`, { publishToWebflowSubdomain: true });
  }
}
