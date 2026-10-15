/**
 * Purge specific public URLs at Cloudflare. No global flush.
 * Requires CF_ZONE_ID + CF_API_TOKEN. No-op when unset.
 */

const CF_PURGE_BATCH = 30;

export class CloudflareCdnProvider {
  constructor(
    private readonly zoneId: string,
    private readonly apiToken: string,
  ) {}

  async purge(request: { urls: string[]; tags?: string[] }): Promise<void> {
    const files = uniqueHttpUrls(request.urls);
    for (let i = 0; i < files.length; i += CF_PURGE_BATCH) {
      const batch = files.slice(i, i + CF_PURGE_BATCH);
      await this.postPurge({ files: batch });
    }
    const tags = (request.tags ?? []).map((t) => t.trim()).filter(Boolean);
    if (tags.length > 0) {
      await this.postPurge({ tags });
    }
  }

  private async postPurge(body: Record<string, unknown>): Promise<void> {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        JSON.stringify({
          event: "cf_purge_failed",
          status: res.status,
          body: text.slice(0, 300),
        }),
      );
      return;
    }
    console.log(
      JSON.stringify({
        event: "cf_purge_ok",
        files: Array.isArray(body.files) ? (body.files as unknown[]).length : 0,
        tags: Array.isArray(body.tags) ? (body.tags as unknown[]).length : 0,
      }),
    );
  }
}

export function uniqueHttpUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    try {
      const u = new URL(raw);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      const key = u.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    } catch {
      /* skip invalid */
    }
  }
  return out;
}
