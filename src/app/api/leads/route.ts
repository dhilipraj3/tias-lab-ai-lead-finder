// src/app/api/leads/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext();
  const db = (env as unknown as { DB: D1Database }).DB;

  const { searchParams } = new URL(request.url);
  const country = searchParams.get('country');
  const service = searchParams.get('service');
  const buyingIntent = searchParams.get('buyingIntent');
  const budgetTier = searchParams.get('budgetTier');
  const status = searchParams.get('status');
  const includePreview = searchParams.get('preview') === 'true' ? 1 : 0;

  const clauses: string[] = ['is_mock_preview = ?'];
  const bindings: (string | number)[] = [includePreview];

  if (country && country !== 'ALL') {
    clauses.push('country = ?');
    bindings.push(country);
  }
  if (service && service !== 'ALL') {
    clauses.push('(primary_service = ? OR secondary_services_json LIKE ?)');
    bindings.push(service, `%${service}%`);
  }
  if (buyingIntent && buyingIntent !== 'ALL') {
    clauses.push('buying_intent = ?');
    bindings.push(buyingIntent);
  }
  if (budgetTier && budgetTier !== 'ALL') {
    clauses.push('budget_tier = ?');
    bindings.push(budgetTier);
  }
  if (status && status !== 'ALL') {
    clauses.push('status = ?');
    bindings.push(status);
  }

  const sql = `
    SELECT * FROM leads
    WHERE ${clauses.join(' AND ')}
    ORDER BY lead_score DESC, discovered_at DESC
    LIMIT 100
  `;

  const { results } = await db.prepare(sql).bind(...bindings).all();

  return NextResponse.json({
    mode: includePreview ? 'DEVELOPMENT_PREVIEW' : 'LIVE_PRODUCTION_D1',
    count: results.length,
    leads: results
  });
}
