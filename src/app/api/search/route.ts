import { NextResponse } from 'next/server';

import { search } from '@/data/queries/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lookup endpoint. */
export async function GET(request: Request) {
  const term = new URL(request.url).searchParams.get('q')?.trim() ?? '';

  if (term.length < 2) {
    return NextResponse.json({ hits: [] }, { headers: { 'cache-control': 'no-store' } });
  }

  const outcome = await search(term.slice(0, 64));

  if (!outcome.ok) {
    return NextResponse.json(
      { hits: [], failure: outcome.failure },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  return NextResponse.json(
    { hits: outcome.data, elapsedMs: outcome.meta.elapsedMs },
    { headers: { 'cache-control': 'no-store' } },
  );
}
