// src/app/api/sources/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { HackerNewsFreelancerConnector } from '@/lib/sources/connectors/hn-algolia';
import { RedditStartupFastWinConnector } from '@/lib/sources/connectors/reddit-buyers';
import { GoogleCustomSearchIndiaConnector } from '@/lib/sources/connectors/google-cse-india';
import { SamGovOpportunitiesConnector } from '@/lib/sources/connectors/sam-gov';
import { DynamicRssOrJsonConnector } from '@/lib/sources/connectors/rss-json-generic';
import {
  computeCanonicalUrlHash,
  computeOrgTitleFingerprint,
  normalizeCanonicalUrl
} from '@/lib/deduplication';
import { classifyAndScoreCandidate } from '@/lib/scoring';

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext();
  const typedEnv = env as unknown as Record<string, string | undefined> & {
    DB: D1Database;
    AI?: { run: (model: string, input: unknown) => Promise<unknown> };
  };
  const db = typedEnv.DB;

  // Load built-in + unlimited user-registered connectors from D1 `data_sources`
  const connectors = [
    new HackerNewsFreelancerConnector(),
    new RedditStartupFastWinConnector(),
    new GoogleCustomSearchIndiaConnector(),
    new SamGovOpportunitiesConnector()
  ];

  const customSources = await db
    .prepare(`SELECT * FROM data_sources WHERE is_enabled = 1 AND protocol = 'CUSTOM_RSS_JSON'`)
    .all<{
      id: string;
      name: string;
      protocol: string;
      endpoint_url: string;
      country_scope: string;
      requires_env_secret: string | null;
    }>();

  for (const row of customSources.results ?? []) {
    if (!connectors.some((c) => c.id === row.id)) {
      connectors.push(
        new DynamicRssOrJsonConnector(
          row.id,
          row.name,
          row.endpoint_url,
          row.country_scope,
          row.requires_env_secret ?? undefined
        )
      );
    }
  }

  const syncSummaries = [];

  for (const connector of connectors) {
    const startedAt = new Date().toISOString();
    const outcome = await connector.fetchCandidates(typedEnv);

    let inserted = 0;
    let duplicates = 0;
    let quarantined = 0;

    if (outcome.wasSearched && outcome.candidates.length > 0) {
      for (const candidate of outcome.candidates) {
        const canonicalUrl = normalizeCanonicalUrl(candidate.sourceUrl);
        const canonicalUrlHash = await computeCanonicalUrlHash(canonicalUrl);
        const orgTitleFp = computeOrgTitleFingerprint(candidate.organizationName, candidate.title);

        // Check canonical URL hash or org+title fingerprint in D1
        const existing = await db
          .prepare(
            `SELECT id FROM leads WHERE canonical_url_hash = ? OR org_title_fingerprint = ? LIMIT 1`
          )
          .bind(canonicalUrlHash, orgTitleFp)
          .first();

        if (existing) {
          duplicates++;
          continue;
        }

        const classified = await classifyAndScoreCandidate(candidate, typedEnv.AI);
        if (classified.isQuarantinedSellerOrNoise) {
          quarantined++;
          continue;
        }

        const leadId = `lead_${crypto.randomUUID().slice(0, 12)}`;
        await db
          .prepare(
            `INSERT INTO leads (
              id, source_id, external_item_id, title, organization_name, country,
              source_url, canonical_url, canonical_url_hash, org_title_fingerprint,
              discovered_at, published_at, deadline_at, buying_intent, primary_service,
              secondary_services_json, estimated_budget_min, estimated_budget_max,
              budget_tier, budget_is_disclosed, lead_score, score_breakdown_json,
              evidence_json, contact_channel, next_action, status, is_mock_preview
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', 0)`
          )
          .bind(
            leadId,
            connector.id,
            candidate.externalItemId ?? null,
            candidate.title,
            candidate.organizationName,
            candidate.country,
            candidate.sourceUrl,
            canonicalUrl,
            canonicalUrlHash,
            orgTitleFp,
            new Date().toISOString(),
            candidate.publishedAt ?? null,
            candidate.deadlineAt ?? null,
            classified.buyingIntent,
            classified.primaryService,
            JSON.stringify(classified.secondaryServices),
            classified.estimatedBudgetMin,
            classified.estimatedBudgetMax,
            classified.budgetTier,
            classified.budgetIsDisclosed ? 1 : 0,
            classified.leadScore,
            JSON.stringify(classified.scoreBreakdown),
            JSON.stringify(classified.evidenceSnippets),
            candidate.contactChannel ?? null,
            classified.nextAction
          )
          .run();

        inserted++;
      }
    }

    // Record honest audit log in D1 `sync_runs` (Requirement #9 & #10)
    await db
      .prepare(
        `INSERT INTO sync_runs (
          id, source_id, started_at, completed_at, http_status,
          items_scanned, buyer_leads_inserted, duplicates_skipped,
          seller_noise_quarantined, status, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        `sync_${crypto.randomUUID().slice(0, 12)}`,
        connector.id,
        startedAt,
        new Date().toISOString(),
        outcome.httpStatus,
        outcome.itemsScanned,
        inserted,
        duplicates,
        quarantined,
        outcome.status,
        outcome.errorMessage ?? null
      )
      .run();

    syncSummaries.push({
      sourceId: connector.id,
      wasSearched: outcome.wasSearched,
      status: outcome.status,
      itemsScanned: outcome.itemsScanned,
      buyerLeadsInserted: inserted,
      duplicatesSkipped: duplicates,
      sellerNoiseQuarantined: quarantined,
      errorMessage: outcome.errorMessage ?? null
    });
  }

  return NextResponse.json({
    syncedAt: new Date().toISOString(),
    results: syncSummaries
  });
}
