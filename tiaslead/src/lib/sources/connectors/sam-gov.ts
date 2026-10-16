// src/lib/sources/connectors/sam-gov.ts
import { LeadSourceConnector, SourceSyncOutcome } from '../types';
import { RawCandidateInput } from '../../scoring';

export class SamGovOpportunitiesConnector implements LeadSourceConnector {
  readonly id = 'sam_gov_opportunities';
  readonly name = 'U.S. SAM.gov Get Opportunities Public API v2';
  readonly requiresEnvSecret = 'SAM_GOV_API_KEY';

  async fetchCandidates(env: Record<string, string | undefined>): Promise<SourceSyncOutcome> {
    const apiKey = env.SAM_GOV_API_KEY;
    // Requirement #10: Never pretend a source has been searched if credentials are not configured
    if (!apiKey) {
      return {
        sourceId: this.id,
        wasSearched: false,
        httpStatus: null,
        itemsScanned: 0,
        candidates: [],
        status: 'SKIPPED_MISSING_CREDENTIALS',
        errorMessage: 'SAM_GOV_API_KEY is not configured in server environment secrets.'
      };
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400 * 1000);
    const fmt = (d: Date) =>
      `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;

    const url = new URL('https://api.sam.gov/opportunities/v2/search');
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('postedFrom', fmt(thirtyDaysAgo));
    url.searchParams.set('postedTo', fmt(now));
    url.searchParams.set('ncode', '541511'); // Custom Computer Programming Services
    url.searchParams.set('limit', '25');

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': 'TIAS-Lab-AI-Lead-Finder/1.0' }
    });

    if (!res.ok) {
      return {
        sourceId: this.id,
        wasSearched: true,
        httpStatus: res.status,
        itemsScanned: 0,
        candidates: [],
        status: 'ERROR',
        errorMessage: `SAM.gov API returned HTTP ${res.status}`
      };
    }

    const data = (await res.json()) as {
      opportunitiesData?: Array<{
        noticeId: string;
        title: string;
        fullParentPathName?: string;
        postedDate?: string;
        responseDeadLine?: string;
        uiLink?: string;
        description?: string;
      }>;
    };

    const items = data.opportunitiesData ?? [];
    const candidates: RawCandidateInput[] = items.map((item) => ({
      sourceId: this.id,
      externalItemId: `sam_${item.noticeId}`,
      title: item.title,
      organizationName: item.fullParentPathName ?? 'U.S. Federal Agency',
      country: 'United States',
      sourceUrl: item.uiLink ?? `https://sam.gov/opp/${item.noticeId}/view`,
      publishedAt: item.postedDate,
      deadlineAt: item.responseDeadLine,
      rawText: `${item.title}. ${item.description ?? 'Explicit federal contract solicitation (NAICS 541511).'}`
    }));

    return {
      sourceId: this.id,
      wasSearched: true,
      httpStatus: res.status,
      itemsScanned: items.length,
      candidates,
      status: candidates.length > 0 ? 'SUCCESS' : 'ZERO_RESULTS'
    };
  }
}
