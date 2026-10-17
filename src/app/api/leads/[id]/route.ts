// src/app/api/leads/[id]/route.ts
/// <reference types="@cloudflare/workers-types" />
import type { D1Database } from "@cloudflare/workers-types";
import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json()) as { status?: string; nextAction?: string };
  const { env } = await getCloudflareContext();
  const db = (env as unknown as { DB: D1Database }).DB;

  const allowedStatuses = new Set(['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST', 'IGNORED']);
  if (body.status && !allowedStatuses.has(body.status)) {
    return NextResponse.json({ ok: false, error: 'Invalid status value' }, { status: 400 });
  }
  if (typeof body.nextAction === 'string' && body.nextAction.length > 2000) {
    return NextResponse.json({ ok: false, error: 'nextAction is too long' }, { status: 400 });
  }
  if (body.status) {
    await db
      .prepare(`UPDATE leads SET status = ? WHERE id = ?`)
      .bind(body.status, id)
      .run();
  }
  if (typeof body.nextAction === 'string') {
    await db
      .prepare(`UPDATE leads SET next_action = ? WHERE id = ?`)
      .bind(body.nextAction, id)
      .run();
  }

  return NextResponse.json({ ok: true, id, updatedAt: new Date().toISOString() });
}
