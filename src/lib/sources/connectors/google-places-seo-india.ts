// src/lib/sources/connectors/google-places-seo-india.ts
import { LeadSourceConnector, SourceSyncOutcome } from '../types';
import { RawCandidateInput } from '../../scoring';

export class GooglePlacesAndPageSpeedIndiaConnector implements LeadSourceConnector {
  readonly id = 'google_places_seo_audit_india';
  readonly name = 'Google Places API (New) + PageSpeed Insights v5 SEO Auditor (India)';
  readonly requiresEnvSecret = 'GOOGLE_PLACES_API_KEY';

  async fetchCandidates(env: Record<string, string | undefined>): Promise<SourceSyncOutcome> {
    const placesKey = env.GOOGLE_PLACES_API_KEY;
    const pageSpeedKey = env.GOOGLE_PAGESPEED_API_KEY ?? placesKey;

    if (!placesKey) {
      return {
        sourceId: this.id,
        wasSearched: false,
        httpStatus: null,
        itemsScanned: 0,
        candidates: [],
        status: 'SKIPPED_MISSING_CREDENTIALS',
        errorMessage: 'GOOGLE_PLACES_API_KEY is not configured in Cloudflare Worker secrets.'
      };
    }

    // 1. Query Google Places API (New) Text Search for target Indian SME verticals
    const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': placesKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount'
      },
      body: JSON.stringify({
        textQuery: 'Industrial manufacturers and exporters in Chennai, Tamil Nadu',
        regionCode: 'IN',
        maxResultCount: 10
      })
    });

    if (!placesRes.ok) {
      return {
        sourceId: this.id,
        wasSearched: true,
        httpStatus: placesRes.status,
        itemsScanned: 0,
        candidates: [],
        status: 'ERROR',
        errorMessage: `Google Places API (New) returned HTTP ${placesRes.status}`
      };
    }

    const placesData = (await placesRes.json()) as {
      places?: Array<{
        id: string;
        displayName?: { text: string };
        formattedAddress?: string;
        websiteUri?: string;
        googleMapsUri?: string;
        rating?: number;
        userRatingCount?: number;
      }>;
    };

    const places = placesData.places ?? [];
    const candidates: RawCandidateInput[] = [];

    for (const place of places) {
      const bizName = place.displayName?.text ?? 'Indian Business';

      // Case A: Established business with NO websiteUri listed on Google Maps
      if (!place.websiteUri && place.googleMapsUri) {
        candidates.push({
          sourceId: this.id,
          externalItemId: `gplace_noweb_${place.id}`,
          title: `Missing Website & Local SEO Opportunity — ${bizName}`,
          organizationName: bizName,
          country: 'India',
          sourceUrl: place.googleMapsUri,
          rawText: `Verified via Google Places API (New): ${bizName} (${place.formattedAddress ?? 'India'}) has ${place.userRatingCount ?? 0} Google reviews (Rating: ${place.rating ?? 'N/A'}) but has NO websiteUri linked. High-fit Inferred Potential Need for Website Development, Local SEO, and WhatsApp lead automation.`
        });
        continue;
      }

      // Case B: Business has a website -> Audit Mobile Speed & Technical SEO via PageSpeed Insights v5
      if (place.websiteUri) {
        const psiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
        psiUrl.searchParams.set('url', place.websiteUri);
        psiUrl.searchParams.append('category', 'PERFORMANCE');
        psiUrl.searchParams.append('category', 'SEO');
        psiUrl.searchParams.set('strategy', 'mobile');
        if (pageSpeedKey) psiUrl.searchParams.set('key', pageSpeedKey);

        const psiRes = await fetch(psiUrl.toString());
        if (!psiRes.ok) continue;
        const psiData = (await psiRes.json()) as any;
        const perf = Math.round((psiData.lighthouseResult?.categories?.performance?.score ?? 1) * 100);
        const seo = Math.round((psiData.lighthouseResult?.categories?.seo?.score ?? 1) * 100);
        const lcp = psiData.lighthouseResult?.audits?.['largest-contentful-paint']?.displayValue ?? 'N/A';

        if (perf < 60 || seo < 80) {
          candidates.push({
            sourceId: this.id,
            externalItemId: `gplace_psi_${place.id}`,
            title: `Website Redesign & Technical SEO Modernization — ${bizName} (Mobile Speed ${perf}/100, SEO ${seo}/100)`,
            organizationName: bizName,
            country: 'India',
            sourceUrl: place.websiteUri,
            rawText: `Google PageSpeed Insights v5 Audit on ${place.websiteUri}: Mobile Performance Score is ${perf}/100 (LCP: ${lcp}) and Technical SEO Score is ${seo}/100. Classified as INFERRED_POTENTIAL_NEED for Website Redesign, Core Web Vitals optimization, and AI lead capture.`
          });
        }
      }
    }

    return {
      sourceId: this.id,
      wasSearched: true,
      httpStatus: 200,
      itemsScanned: places.length,
      candidates,
      status: candidates.length > 0 ? 'SUCCESS' : 'ZERO_RESULTS'
    };
  }
}
