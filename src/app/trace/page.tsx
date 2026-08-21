import Link from 'next/link';

import { TitleBlock } from '@/components/chrome';
import FoldText from '@/components/FoldText';
import { FailureSheet } from '@/components/failure-sheet';
import { Icon } from '@/components/icon';
import { QueryDisclosure } from '@/components/query-disclosure';
import { RunDiagram, RunInline } from '@/components/route';
import { Nothing, Ruled, Sheet, SheetHead } from '@/components/sheet';
import { listApplications } from '@/data/queries/applications';
import { getAlternateRoutes, getTraceablePackages, traceRoutes } from '@/data/queries/trace';
import type { QueryMeta } from '@/lib/errors';
import { describeTarget } from '@/lib/env';
import { isoDate, packageHref, plural } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Trace a run',
  description: 'Why is this package here? Trace the shortest dependency chain from an application to anything beneath it.',
};

type SearchParams = Promise<{ app?: string; q?: string; pkg?: string }>;

export default async function TracePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const applications = await listApplications();

  if (!applications.ok) {
    return (
      <Shell>
        <FailureSheet failure={applications.failure} retryHref="/trace" />
      </Shell>
    );
  }

  const slug = applications.data.some((application) => application.slug === params.app)
    ? (params.app as string)
    : (applications.data[0]?.slug ?? '');
  const chosen = applications.data.find((application) => application.slug === slug) ?? null;
  const term = (params.q ?? '').slice(0, 64);
  const packageKey = (params.pkg ?? '').slice(0, 128);

  const [candidates, trace] = await Promise.all([
    slug ? getTraceablePackages(slug, term, 30) : Promise.resolve(null),
    slug && packageKey ? traceRoutes(slug, packageKey) : Promise.resolve(null),
  ]);

  const primary = trace?.ok ? trace.data.routes[0] : undefined;
  const alternates =
    trace?.ok && primary ? await getAlternateRoutes(slug, primary.target.key, 6) : null;

  const queries: QueryMeta[] = [
    applications.meta,
    ...(candidates?.ok ? [candidates.meta] : []),
    ...(trace?.ok ? [trace.meta] : []),
    ...(alternates?.ok ? [alternates.meta] : []),
  ];

  return (
    <Shell>
      <header className="sheet-enter mb-8 max-w-[56ch]">
        <h1 className="font-stencil text-[clamp(1.9rem,4.6vw,3rem)] font-bold uppercase leading-[0.98] tracking-[0.01em] text-ink">
          <FoldText
            text="Why is this here?"
            splitBy="word"
            hinge="top"
            duration={0.6}
            stagger={0.04}
          />
        </h1>
        <p className="mt-4 text-prose text-ink-2">
The route finder. Pick an application and any package beneath it. Understory returns the shortest chain of
          dependency edges that explains the package&#8217;s presence. When there is more than one
          chain of the same length, all of them, because removing a single route may change nothing.
        </p>
      </header>

      {/* ── Step 1 · the application ───────────────────────────────────────── */}
      <Sheet>
        <SheetHead label="1 · Application" icon="application" />
        <form action="/trace" method="get" className="flex flex-wrap items-end gap-3 px-4 py-4">
          <div className="min-w-56 flex-1">
            <label htmlFor="app" className="stencil mb-1.5 block">
              Start from
            </label>
            <select id="app" name="app" defaultValue={slug} className="field">
              {applications.data.map((application) => (
                <option key={application.slug} value={application.slug}>
                  {application.name} &#183; {application.team}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-56 flex-1">
            <label htmlFor="q" className="stencil mb-1.5 block">
              Look for a package
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={term}
              placeholder="lodash, requests, ms…"
              className="field"
            />
          </div>
          <button type="submit" className="control control-filled">
            <Icon name="search" size={13} />
            Find
          </button>
          {packageKey ? (
            <Link href={`/trace?app=${slug}`} className="stencil text-ink-3 hover:text-jumper">
              Start over
            </Link>
          ) : null}
        </form>
        {chosen ? (
          <p className="max-w-[72ch] border-t border-rule bg-stock-sunk px-4 py-2.5 text-datum text-ink-2">
            <span className="stencil mr-2">Reach</span>
            {chosen.name} declares {chosen.directDependencies} dependencies and reaches{' '}
            {chosen.reachablePackages} packages within six hops.
          </p>
        ) : null}
      </Sheet>

      {/* ── Step 2 · pick the target ───────────────────────────────────────── */}
      {candidates ? (
        <Sheet className="mt-6">
          <SheetHead
            label="2 · Reachable packages"
            icon="package"
            detail={candidates.ok ? `${candidates.data.length} shown` : undefined}
          />
          {!candidates.ok ? (
            <div className="p-4">
              <FailureSheet failure={candidates.failure} retryHref={`/trace?app=${slug}`} />
            </div>
          ) : candidates.data.length === 0 ? (
            <Nothing
              title={term ? 'Nothing matches beneath this application' : 'Nothing reachable'}
              detail={
                term
                  ? `No package reachable from ${chosen?.name ?? 'this application'} has a name containing “${term}”. Try a shorter term.`
                  : 'This application reaches no packages in the graph.'
              }
              icon="search"
            />
          ) : (
            <Ruled className={packageKey ? 'max-h-64 overflow-y-auto' : 'max-h-[30rem] overflow-y-auto'}>
              {candidates.data.map((candidate) => (
                <Link
                  key={candidate.key}
                  href={`/trace?app=${slug}&pkg=${encodeURIComponent(candidate.key)}${term ? `&q=${encodeURIComponent(term)}` : ''}`}
                  aria-current={candidate.key === packageKey ? 'true' : undefined}
                  className={`row-hit flex items-center justify-between gap-4 px-4 py-2.5 no-underline ${
                    candidate.key === packageKey ? 'bg-stock-sunk' : ''
                  }`}
                >
                  <span className="min-w-0">
                    <span
                      className={`datum block truncate ${
                        candidate.key === packageKey ? 'font-medium text-jumper' : 'text-ink'
                      }`}
                    >
                      {candidate.name}
                    </span>
                    <span className="datum block truncate text-[12px] text-ink-3">{candidate.role}</span>
                  </span>
                  <span className="stencil shrink-0">
                    {candidate.depth} {plural(candidate.depth, 'hop')}
                  </span>
                </Link>
              ))}
            </Ruled>
          )}
        </Sheet>
      ) : null}

      {/* ── Step 3 · the run ───────────────────────────────────────────────── */}
      {trace ? (
        !trace.ok ? (
          <div className="mt-6">
            <FailureSheet failure={trace.failure} retryHref={`/trace?app=${slug}&pkg=${packageKey}`} />
          </div>
        ) : trace.data.routes.length === 0 ? (
          <Sheet className="mt-6">
            <SheetHead label="3 · The run" icon="route" />
            <Nothing
              title="No route exists"
              detail={`${trace.data.application?.name ?? 'This application'} cannot reach ${
                trace.data.package?.name ?? 'that package'
              } within the traversal bound. The traversal ran; there is simply no path.`}
              action={
                <Link href={`/trace?app=${slug}`} className="control no-underline">
                  Pick another package
                </Link>
              }
            />
          </Sheet>
        ) : (
          <>
            <Sheet className="mt-6">
              <SheetHead
                label="3 · The run"
                icon="route"
                detail={`${trace.data.routes.length} reachable ${plural(trace.data.routes.length, 'release')}`}
                action={
                  trace.data.package ? (
                    <Link href={packageHref(trace.data.package.key)} className="stencil text-ink-3 hover:text-jumper">
                      Package record
                    </Link>
                  ) : undefined
                }
              />
              <div className="grid gap-px bg-rule lg:grid-cols-2">
                {trace.data.routes.map((entry) => (
                  <article key={entry.target.key} className="bg-sheet p-4">
                    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="datum text-row font-medium text-ink">
                        {trace.data.package?.name} {entry.target.version}
                      </span>
                      <span className="datum text-[12px] text-ink-3">
                        {entry.route.depth} {plural(entry.route.depth, 'hop')} &#183; published{' '}
                        {isoDate(entry.target.published)}
                      </span>
                    </div>
                    <RunDiagram
                      origin={trace.data.application?.name ?? 'Application'}
                      originHref={`/applications/${slug}`}
                      route={entry.route}
                      fault={false}
                      targetHref={trace.data.package ? packageHref(trace.data.package.key) : undefined}
                    />
                  </article>
                ))}
              </div>
            </Sheet>

            {alternates?.ok && alternates.data.total > 1 ? (
              <Sheet className="mt-6">
                <SheetHead
                  label="Equally short routes"
                  icon="cut"
                  detail={`${alternates.data.total} of the same length`}
                />
                <p className="max-w-[58ch] border-b border-rule px-4 py-3 text-row text-ink-2">
                  There is more than one shortest chain to this release. Removing any single one of them
                  leaves the package exactly where it is. That is the difference between an upgrade
                  that helps and one that does nothing.
                </p>
                <Ruled>
                  {alternates.data.routes.map((route, index) => (
                    <div key={index} className="flex items-baseline gap-3 px-4 py-2.5">
                      <span className="stencil w-8 shrink-0">{String(index + 1).padStart(2, '0')}</span>
                      <RunInline route={route} max={7} />
                    </div>
                  ))}
                </Ruled>
              </Sheet>
            ) : null}
          </>
        )
      ) : null}

      <Sheet className="mt-6">
        <QueryDisclosure queries={queries} label="Show the queries" />
      </Sheet>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main id="sheet" className="mx-auto max-w-[1400px] px-4 pb-4 pt-10 sm:px-6 sm:pt-14">
        {children}
      </main>
      <TitleBlock sheet="Route finder" instance={describeTarget() ?? 'Not connected'} />
    </>
  );
}
