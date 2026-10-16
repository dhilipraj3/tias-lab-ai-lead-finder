// src/lib/sources/connectors/google-cse-india.ts
import { LeadSourceConnector, SourceSyncOutcome } from '../types';
import { RawCandidateInput } from '../../scoring';

const INDIA_RFP_SEARCH_QUERIES = [
  '("Request for Proposal" OR "Notice Inviting Tender" OR "RFP") ("website development" OR "website redesign" OR "web portal" OR "SEO") ("Chennai" OR "Tamil Nadu" OR "Bengaluru" OR "India") site:.in',
  '("Request for Proposal" OR "RFP" OR "EoI") ("Artificial Intelligence" OR "workflow automation" OR "API integration" OR "custom software") (site:.in OR site:.bank.in OR site:.gov.in)',
  '("looking for a web development agency" OR "looking for SEO agency" OR "need custom software") ("India" OR "Chennai" OR "Bengaluru" OR "Mumbai" OR "Hyderabad")'
];

export class GoogleCustomSearchIndiaConnector implements LeadSourceConnector {
  readonly id = 'google_cse_india';
  readonly name = 'Google Custom Search JSON API — India RFP & Buyer Intent Engine';
  readonly requiresEnvSecret = 'GOOGLE_CSE_API_KEY';

  async fetchCandidates(env: Record<string, string | undefined>): Promise<SourceSyncOutcome> {
    const apiKey = env.GOOGLE_CSE_API_KEY;
    const cx = env.GOOGLE_CSE_CX;

    // Requirement #10: Do not pretend that Google CSE was searched unless credentials exist
    if (!apiKey || !cx) {
      return {
        sourceId: this.id,
        wasSearched: false,
        httpStatus: null,
        itemsScanned: 0,
        candidates: [],
        status: 'SKIPPED_MISSING_CREDENTIALS',
        errorMessage: 'GOOGLE_CSE_API_KEY or GOOGLE_CSE_CX is not configured in server secrets.'
      };
    }

    const candidates: RawCandidateInput[] = [];
    let totalScanned = 0;

    for (const query of INDIA_RFP_SEARCH_QUERIES) {
      const endpoint = new URL('https://customsearch.googleapis.com/customsearch/v1');
      endpoint.searchParams.set('key', apiKey);
      endpoint.searchParams.set('cx', cx);
      endpoint.searchParams.set('q', query);
      endpoint.searchParams.set('gl', 'in');
      endpoint.searchParams.set('cr', 'countryIN');
      endpoint.searchParams.set('dateRestrict', 'm1');

      const res = await fetch(endpoint.toString());
      if (!res.ok) continue;

      const payload = (await res.json()) as {
        items?: Array<{ title: string; link: string; snippet: string; displayLink?: string }>;
      };

      const items = payload.items ?? [];
      totalScanned += items.length;

      for (const item of items) {
        candidates.push({
          sourceId: this.id,
          externalItemId: item.link,
          title: item.title,
          organizationName: item.displayLink ?? 'Indian Organization',
          country: 'India',
          sourceUrl: item.link,
          rawText: `${item.title}. ${item.snippet}`
        });
      }
    }

    return {
      sourceId: this.id,
      wasSearched: true,
      httpStatus: 200,
      itemsScanned: totalScanned,
      candidates,
      status: candidates.length > 0 ? 'SUCCESS' : 'ZERO_RESULTS'
    };
  }
}
