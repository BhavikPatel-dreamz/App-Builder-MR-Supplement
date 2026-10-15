/**
 * Provider-neutral CDN purge abstraction — optional infrastructure only.
 * Default: no-op unless CF_ZONE_ID + CF_API_TOKEN are set (URL purge only).
 */

import { CloudflareCdnProvider } from "./cloudflare-cdn.server";

export type CdnPurgeRequest = {
  urls: string[];
  tags?: string[];
};

export interface CdnCacheProvider {
  purge(request: CdnPurgeRequest): Promise<void>;
}

export class NoopCdnProvider implements CdnCacheProvider {
  async purge(_request: CdnPurgeRequest): Promise<void> {
    console.warn(
      JSON.stringify({
        event: "cf_purge_skipped",
        reason: "CF_ZONE_ID or CF_API_TOKEN unset",
      }),
    );
  }
}

export function isCdnProviderConfigured(): boolean {
  const zoneId = process.env.CF_ZONE_ID?.trim() ?? "";
  const apiToken = process.env.CF_API_TOKEN?.trim() ?? "";
  return Boolean(zoneId && apiToken);
}

function createDefaultProvider(): CdnCacheProvider {
  const zoneId = process.env.CF_ZONE_ID?.trim() ?? "";
  const apiToken = process.env.CF_API_TOKEN?.trim() ?? "";
  if (zoneId && apiToken) {
    return new CloudflareCdnProvider(zoneId, apiToken);
  }
  return new NoopCdnProvider();
}

let provider: CdnCacheProvider = createDefaultProvider();

export function getCdnProvider(): CdnCacheProvider {
  return provider;
}

export function setCdnProvider(forProvider: CdnCacheProvider): void {
  provider = forProvider;
}
