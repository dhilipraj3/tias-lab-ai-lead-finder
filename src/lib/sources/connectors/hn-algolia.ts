// src/lib/sources/connectors/hn-algolia.ts
import { LeadSourceConnector, SourceSyncOutcome } from '../types';
import { RawCandidateInput } from '../../scoring';

export class HackerNewsFreelancerConnector implements LeadSourceConnector {
  readonly id = 'hn_algolia_freelance';
  readonly name = 'Hacker News Algolia Search API (Seeking Freelancer)';

  async fetchCandidates(): Promise<SourceSyncOutcome> {
    const endpoint =
      'https://hn.algolia.com/api/v1/search_by_date?query=%22SEEKING%20FREELANCER%22&tags=comment&hitsPerPage=25';
    const res = await fetch(endpoint, {
      headers: { 'User-Agent': 'TIAS-Lab-AI-Lead-Finder/1.0 (+https://tiaslab.example)' }
    });

    if (!res.ok) {
      return {
        sourceId: this.id,
        wasSearched: true,
        httpStatus: res.status,
        itemsScanned: 0,
        candidates: [],
        status: 'ERROR',
        errorMessage: `Algolia HN API returned HTTP ${res.status}`
      };
    }

    const payload = (await res.json()) as {
      hits?: Array<{
        objectID: string;
        author: string;
        comment_text?: string;
        story_title?: string;
        created_at?: string;
      }>;
    };

    const hits = payload.hits ?? [];
    const candidates: RawCandidateInput[] = hits.map((h) => ({
      sourceId: this.id,
      externalItemId: `hn_${h.objectID}`,
      title: `HN Buyer Inquiry: ${h.story_title ?? 'Seeking Freelancer'}`,
      organizationName: `HN Poster @${h.author}`,
      country: 'Global / International',
      sourceUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
      publishedAt: h.created_at?.slice(0, 10),
      rawText: (h.comment_text ?? '').replace(/<[^>]+>/g, ' ')
    }));

    return {
      sourceId: this.id,
      wasSearched: true,
      httpStatus: res.status,
      itemsScanned: hits.length,
      candidates,
      status: candidates.length > 0 ? 'SUCCESS' : 'ZERO_RESULTS'
    };
  }
}
