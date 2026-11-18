import { describe, it, expect } from 'vitest';
import { WebflowClient, assertStagingDomain } from './client.js';

const cfg = { token: 'tok', siteId: 'site1', stagingDomain: 'webflow-doctor-demo.webflow.io' };

function recorder(status = 200, body = '{}') {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(body, { status });
  };
  return { calls, fetchFn };
}

describe('staging-only guard', () => {
  it('refuses a production / custom domain', () => {
    expect(() => assertStagingDomain('www.brewed.com')).toThrow(/only \*\.webflow\.io/);
    expect(() => new WebflowClient({ ...cfg, stagingDomain: 'brewed.com' })).toThrow();
  });

  it('refuses look-alike domains', () => {
    expect(() => assertStagingDomain('webflow.io.evil.com')).toThrow();
    expect(() => assertStagingDomain('a.b.webflow.io')).toThrow();
  });

  it('accepts the demo staging domain', () => {
    expect(() => assertStagingDomain(cfg.stagingDomain)).not.toThrow();
  });

  it('publishes only to the webflow.io subdomain and never sends custom domains', async () => {
    const { calls, fetchFn } = recorder();
    await new WebflowClient(cfg, fetchFn).publishToStaging();
    expect(calls[0]!.url).toBe('https://api.webflow.com/v2/sites/site1/publish');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ publishToWebflowSubdomain: true });
  });
});

describe('requests', () => {
  it('sends the token and the alt text', async () => {
    const { calls, fetchFn } = recorder();
    await new WebflowClient(cfg, fetchFn).setAssetAltText('a1', 'Coffee cup on a wooden table');
    expect(calls[0]!.url).toBe('https://api.webflow.com/v2/assets/a1');
    expect(calls[0]!.init.method).toBe('PATCH');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ altText: 'Coffee cup on a wooden table' });
  });

  it('throws with the HTTP status when Webflow returns an error', async () => {
    const { fetchFn } = recorder(403, '{"code":"missing_scopes"}');
    await expect(new WebflowClient(cfg, fetchFn).getAsset('a1')).rejects.toMatchObject({ status: 403 });
  });
});
