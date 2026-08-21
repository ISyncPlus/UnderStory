import { NextResponse } from 'next/server';

import { checkHealth } from '@/lib/neo4j';

/** Connectivity probe for the line lamp. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const health = await checkHealth();
  return NextResponse.json(health, {
    headers: { 'cache-control': 'no-store' },
  });
}
