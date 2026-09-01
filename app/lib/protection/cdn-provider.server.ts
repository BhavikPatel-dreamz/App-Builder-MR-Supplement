/**
 * Provider-neutral CDN purge abstraction — optional infrastructure only.
 * Default: no-op. Cloudflare/CloudFront providers can be added without touching request path.
 */

export type CdnPurgeRequest = {
  urls: string[];
  tags?: string[];
};

export interface CdnCacheProvider {
  purge(request: CdnPurgeRequest): Promise<void>;
}

export class NoopCdnProvider implements CdnCacheProvider {
  async purge(_request: CdnPurgeRequest): Promise<void> {
    /* CDN purge is optional — TTL + SWR handle freshness when no provider configured. */
  }
}

let provider: CdnCacheProvider = new NoopCdnProvider();

export function getCdnProvider(): CdnCacheProvider {
  return provider;
}

export function setCdnProvider(forProvider: CdnCacheProvider): void {
  provider = forProvider;
}
