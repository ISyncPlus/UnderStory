import { NextResponse } from 'next/server';

import { checkHealth } from '@/lib/neo4j';

/**
 * Connectivity probe for the line lamp.
 *
 * Never cached, and never fails the request: an unreachable database is a
 * 200 with `status: "down"`, because the caller is a status indicator and a
 * status indicator that throws is not a status indicator.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const health = await checkHealth();
  return NextResponse.json(health, {
    headers: { 'cache-control': 'no-store' },
  });
}
