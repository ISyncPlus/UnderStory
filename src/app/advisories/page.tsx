import Link from 'next/link';

import { TitleBlock } from '@/components/chrome';
import FoldText from '@/components/FoldText';
import { FailureSheet } from '@/components/failure-sheet';
import { Icon } from '@/components/icon';
import { QueryDisclosure } from '@/components/query-disclosure';
import { ClearMark, FaultMark, Measure, Nothing, Ruled, Sheet, SheetHead } from '@/components/sheet';
import { listAdvisories } from '@/data/queries/advisories';
import { describeTarget } from '@/lib/env';
import { count, isoDate, plural } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Fault register',
  description: 'Every advisory in the graph, ordered by how much of the estate it reaches.',
};

const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

type SearchParams = Promise<{ severity?: string | string[]; q?: string }>;

export default async function AdvisoriesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selected = new Set(
    (Array.isArray(params.severity) ? params.severity : params.severity ? [params.severity] : []).filter(
      (value): value is (typeof SEVERITIES)[number] => (SEVERITIES as readonly string[]).includes(value),
    ),
  );
  const term = (params.q ?? '').slice(0, 64);

  const outcome = await listAdvisories({ severities: [...selected], search: term });

  const filtersActive = selected.size > 0 || term.length > 0;

  return (
    <>
      <main id="sheet" className="mx-auto max-w-[1400px] px-4 pb-4 pt-10 sm:px-6 sm:pt-14">
        <header className="sheet-enter mb-8 max-w-[55ch]">
          <h1 className="font-stencil text-[clamp(1.9rem,4.6vw,3rem)] font-bold uppercase leading-[0.98] tracking-[0.01em] text-ink">
            <FoldText
              text="Fault register"
              splitBy="char"
              hinge="top"
              duration={0.6}
              stagger={0.03}
            />
          </h1>
          <p className="mt-4 text-prose text-ink-2">
            Every advisory in the graph, ordered by how much of the estate can actually reach it. Reach
            is a traversal, not a lookup: an application counts as exposed when a dependency path
            exists from it to an affected release, however many hops away.
          </p>
        </header>

        {/* ── Filters. Plain links and a GET form, so every state is a URL a
             reader can send to somebody else. ──────────────────────────────── */}
        <Sheet className="mb-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="stencil mr-1">Class</span>
              {SEVERITIES.map((severity) => {
                const next = new Set(selected);
                if (next.has(severity)) next.delete(severity);
                else next.add(severity);
                const query = new URLSearchParams();
                for (const value of next) query.append('severity', value);
                if (term) query.set('q', term);
                const href = query.toString() ? `/advisories?${query}` : '/advisories';
                const active = selected.has(severity);
                return (
                  <Link
                    key={severity}
                    href={href}
                    aria-pressed={active}
                    className={`control h-8 min-h-0 px-2 no-underline ${active ? 'control-on' : ''}`}
                  >
                    <FaultMark severity={severity} size="small" />
                    <span className="capitalize">{severity}</span>
                  </Link>
                );
              })}
            </div>

            <form action="/advisories" method="get" className="flex flex-1 items-center gap-2 sm:max-w-sm">
              {[...selected].map((severity) => (
                <input key={severity} type="hidden" name="severity" value={severity} />
              ))}
              <label htmlFor="advisory-search" className="sr-only">
                Filter advisories
              </label>
              <input
                id="advisory-search"
                type="search"
                name="q"
                defaultValue={term}
                placeholder="Identifier, title or package"
                className="field h-8 min-h-0 py-0 text-[12px]"
              />
              <button type="submit" className="control h-8 min-h-0">
                Filter
              </button>
            </form>

            {filtersActive ? (
              <Link href="/advisories" className="stencil text-ink-3 hover:text-jumper">
                Clear
              </Link>
            ) : null}
          </div>
        </Sheet>

        {!outcome.ok ? (
          <FailureSheet failure={outcome.failure} retryHref="/advisories" />
        ) : (
          <Sheet>
            <SheetHead
              label={filtersActive ? 'Filtered' : 'All faults'}
              icon="advisory"
              detail={`${outcome.data.length} ${plural(outcome.data.length, 'record')}`}
            />

            <div className="hidden grid-cols-[2.5rem_minmax(0,2.4fr)_minmax(0,1fr)_7rem_minmax(0,9rem)] gap-3 border-b border-rule bg-stock-sunk px-4 py-2 lg:grid">
              <span className="stencil">Cls</span>
              <span className="stencil">Advisory</span>
              <span className="stencil">Package</span>
              <span className="stencil">Fixed in</span>
              <span className="stencil">Applications reached</span>
            </div>

            {outcome.data.length === 0 ? (
              <Nothing
                title="No advisory matches"
                detail={
                  filtersActive
                    ? 'Nothing in the register matches these filters. Clearing them will show all 22 records.'
                    : 'The register is empty. Load the graph with `npm run db:seed`.'
                }
                icon="search"
                action={
                  filtersActive ? (
                    <Link href="/advisories" className="control no-underline">
                      Clear filters
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <Ruled>
                {outcome.data.map((advisory) => {
                  const maxReach = Math.max(1, ...outcome.data.map((row) => row.applicationsReached));
                  return (
                    <Link
                      key={advisory.id}
                      href={`/advisories/${advisory.id}`}
                      className="row-hit grid grid-cols-1 gap-x-3 gap-y-2 px-4 py-3 no-underline lg:grid-cols-[2.5rem_minmax(0,2.4fr)_minmax(0,1fr)_7rem_minmax(0,9rem)] lg:items-center"
                    >
                      <span>
                        <FaultMark severity={advisory.severity} />
                      </span>
                      <span className="min-w-0">
                        <span className="datum block text-[12px] text-ink-3">
                          {advisory.id} &#183; {advisory.weakness} &#183; {advisory.score.toFixed(1)}
                        </span>
                        <span className="mt-0.5 block text-row leading-snug text-ink">{advisory.title}</span>
                        <span className="stencil mt-1 block lg:hidden">
                          {advisory.packageName} &#183; {isoDate(advisory.published)}
                        </span>
                      </span>
                      <span className="datum hidden truncate text-ink-2 lg:block">
                        {advisory.packageName}
                        <span className="block text-[12px] text-ink-3">
                          {advisory.affectedReleases} affected {plural(advisory.affectedReleases, 'release')}
                        </span>
                      </span>
                      <span className="datum hidden text-ink-2 lg:block">
                        {advisory.fixedIn ?? <span className="text-jumper">none</span>}
                      </span>
                      <span>
                        {advisory.applicationsReached === 0 ? (
                          <ClearMark label="Not reached" />
                        ) : (
                          <Measure
                            value={advisory.applicationsReached}
                            max={maxReach}
                            tone="fault"
                            label={count(advisory.applicationsReached)}
                          />
                        )}
                      </span>
                    </Link>
                  );
                })}
              </Ruled>
            )}

            <QueryDisclosure queries={outcome.queries ?? [outcome.meta]} />
          </Sheet>
        )}

        <p className="mt-6 flex items-start gap-2 text-datum text-ink-3">
          <Icon name="advisory" size={14} className="mt-0.5 shrink-0" />
          <span className="max-w-[56ch]">
            Every advisory here is invented for this demonstration and carries a <code>USY-</code>
            prefix so it cannot be mistaken for a published GHSA or CVE record.
          </span>
        </p>
      </main>
      <TitleBlock sheet="2 of 6 &#183; Fault register" instance={describeTarget() ?? 'Not connected'} />
    </>
  );
}
