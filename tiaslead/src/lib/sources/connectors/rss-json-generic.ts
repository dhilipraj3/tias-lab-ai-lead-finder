// src/lib/sources/connectors/rss-json-generic.ts
import { LeadSourceConnector, SourceSyncOutcome } from '../types';
import { RawCandidateInput } from '../../scoring';

export class DynamicRssOrJsonConnector implements LeadSourceConnector {
  constructor(
    public readonly id: string,
    public readonly name: string,
    private readonly endpointUrl: string,
    private readonly countryScope: string,
    public readonly requiresEnvSecret?: string
  ) {}

  async fetchCandidates(env: Record<string, string | undefined>): Promise<SourceSyncOutcome> {
    const headers: Record<string, string> = {
      'User-Agent': 'TIAS-Lab-AI-Lead-Finder/1.0'
    };

    if (this.requiresEnvSecret) {
      const secretVal = env[this.requiresEnvSecret];
      if (!secretVal) {
        return {
          sourceId: this.id,
          wasSearched: false,
          httpStatus: null,
          itemsScanned: 0,
          candidates: [],
          status: 'SKIPPED_MISSING_CREDENTIALS',
          errorMessage: `Missing server secret ${this.requiresEnvSecret}`
        };
      }
      headers['Authorization'] = `Bearer ${secretVal}`;
    }

    const res = await fetch(this.endpointUrl, { headers });
    if (!res.ok) {
      return {
        sourceId: this.id,
        wasSearched: true,
        httpStatus: res.status,
        itemsScanned: 0,
        candidates: [],
        status: 'ERROR',
        errorMessage: `Endpoint returned HTTP ${res.status}`
      };
    }

    const text = await res.text();
    const candidates: RawCandidateInput[] = [];

    // Lightweight RSS <item> or Atom <entry> parser compatible with Cloudflare Workers edge runtime
    const itemBlocks = text.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
    for (const block of itemBlocks.slice(0, 30)) {
      const title = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/<!\[CDATA\[\vert{}\]\]>/g, '').trim();
      const link =
        block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ??
        (block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? '').trim();
      const desc = (
        block.match(/<(description|summary|content)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? ''
      )
        .replace(/<!\[CDATA\[\vert{}\]\]>/g, '')
        .replace(/<[^>]+>/g, ' ')
        .trim();

      if (title && link && /^https?:\/\//i.test(link)) {
        candidates.push({
          sourceId: this.id,
          externalItemId: link,
          title,
          organizationName: this.name,
          country: this.countryScope,
          sourceUrl: link,
          rawText: `${title}. ${desc}`
        });
      }
    }

    return {
      sourceId: this.id,
      wasSearched: true,
      httpStatus: res.status,
      itemsScanned: itemBlocks.length,
      candidates,
      status: candidates.length > 0 ? 'SUCCESS' : 'ZERO_RESULTS'
    };
  }
}
