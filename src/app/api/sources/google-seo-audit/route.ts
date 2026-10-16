// src/app/api/sources/google-seo-audit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function POST(request: NextRequest) {
  const { targetUrl, organizationName, country = 'Global / International' } = (await request.json()) as {
    targetUrl: string;
    organizationName: string;
    country?: string;
  };
  const { env } = await getCloudflareContext();
  const typedEnv = env as unknown as Record<string, string | undefined>;
  const apiKey = typedEnv.GOOGLE_PAGESPEED_API_KEY;

  const psiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  psiUrl.searchParams.set('url', targetUrl);
  psiUrl.searchParams.append('category', 'PERFORMANCE');
  psiUrl.searchParams.append('category', 'SEO');
  psiUrl.searchParams.append('category', 'ACCESSIBILITY');
  psiUrl.searchParams.set('strategy', 'mobile');
  if (apiKey) psiUrl.searchParams.set('key', apiKey);

  const res = await fetch(psiUrl.toString());
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: `Google PageSpeed API returned HTTP ${res.status}` },
      { status: res.status }
    );
  }

  const data = (await res.json()) as any;
  const cats = data.lighthouseResult?.categories ?? {};
  const audits = data.lighthouseResult?.audits ?? {};

  return NextResponse.json({
    ok: true,
    organizationName,
    country,
    targetUrl,
    buyingIntent: 'INFERRED_POTENTIAL_NEED',
    performanceScore: Math.round((cats.performance?.score ?? 0) * 100),
    seoScore: Math.round((cats.seo?.score ?? 0) * 100),
    accessibilityScore: Math.round((cats.accessibility?.score ?? 0) * 100),
    lcp: audits['largest-contentful-paint']?.displayValue ?? 'N/A',
    cls: audits['cumulative-layout-shift']?.displayValue ?? 'N/A'
  });
}
