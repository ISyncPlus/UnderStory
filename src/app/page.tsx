import Link from 'next/link';

import { Icon } from '@/components/icon';
import { QueryDisclosure } from '@/components/query-disclosure';
import { FailureSheet } from '@/components/failure-sheet';
import { ClearMark, FaultMark, Measure, Nothing, Ruled, Sheet, SheetHead } from '@/components/sheet';
import { TitleBlock } from '@/components/chrome';
import FoldText from '@/components/FoldText';
import { listAdvisories } from '@/data/queries/advisories';
import { getChokepoints } from '@/data/queries/maintainers';
import { getOverview } from '@/data/queries/overview';
import { getLoadBearingPackages } from '@/data/queries/packages';
import type { QueryMeta } from '@/lib/errors';
import { count, packageHref, plural, TIER_LABEL } from '@/lib/format';
import { describeTarget } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function EstatePage() {
  const [overview, advisories, chokepoints, loadBearing] = await Promise.all([
    getOverview(),
    listAdvisories(),
    getChokepoints(5),
    getLoadBearingPackages(8),
  ]);

  if (!overview.ok) {
    return (
      <Shell>
        <FailureSheet failure={overview.failure} retryHref="/" />
      </Shell>
    );
  }

  const { summary, exposure, advisoriesWithReach } = overview.data;
  const exposed = exposure.filter((application) => application.advisoryCount > 0);
  const maxReach = Math.max(1, ...exposure.map((application) => application.reachablePackages));
  const register = advisories.ok ? advisories.data.filter((advisory) => advisory.applicationsReached > 0) : [];
  const maxRegisterReach = Math.max(1, ...register.map((advisory) => advisory.applicationsReached));

  const queries: QueryMeta[] = [
    ...(overview.queries ?? [overview.meta]),
    ...(advisories.ok ? (advisories.queries ?? [advisories.meta]) : []),
    ...(loadBearing.ok ? [loadBearing.meta] : []),
    ...(chokepoints.ok ? [chokepoints.meta] : []),
  ];

  return (
    <Shell>
      {/* ── The thesis, stated once, in the numbers this graph actually holds ── */}
      <div className="sheet-enter grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <h1 className="max-w-[18ch] font-stencil text-[clamp(2.25rem,6vw,4rem)] font-bold uppercase leading-[0.94] tracking-[0.01em] text-ink">
            <FoldText
              text={`${count(summary.applications)} applications.`}
              splitBy="word"
              hinge="top"
              duration={0.6}
              stagger={0.04}
            />
            <br />
            <span className="text-jumper">
              <FoldText
                text={`${count(summary.versions)} releases`}
                splitBy="word"
                hinge="top"
                duration={0.6}
                stagger={0.04}
                color="var(--color-jumper)"
              />
            </span>{' '}
            <FoldText
              text="beneath them."
              splitBy="word"
              hinge="top"
              duration={0.6}
              stagger={0.04}
            />
          </h1>
          <p className="mt-5 max-w-[56ch] text-prose text-ink-2">
            Understory reads the Meridian Systems estate as a graph and answers one shape of question: which
            applications can reach a given flaw, by what route, and which single change cuts the most
            routes.{' '}
            {exposed.length === summary.applications ? (
              <>
                Every one of the {summary.applications} reaches at least one of{' '}
                <strong className="font-semibold text-ink">{advisoriesWithReach}</strong> open{' '}
                {plural(advisoriesWithReach, 'advisory', 'advisories')}, almost all of it through code
                nobody on these teams chose.
              </>
            ) : (
              <>
                Right now{' '}
                <strong className="font-semibold text-ink">
                  {exposed.length} of {summary.applications}
                </strong>{' '}
                reach at least one open advisory, across{' '}
                <strong className="font-semibold text-ink">{advisoriesWithReach}</strong>{' '}
                {plural(advisoriesWithReach, 'advisory', 'advisories')}.
              </>
            )}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/trace" className="control control-filled no-underline">
              <Icon name="route" size={14} />
              Trace a run
            </Link>
            <Link href="/advisories" className="control no-underline">
              <Icon name="advisory" size={13} />
              Open the fault register
            </Link>
          </div>
        </div>

        {/* A parts list, not a row of stat tiles. */}
        <Sheet className="self-start">
          <SheetHead label="Schedule" />
          <dl className="ruled">
            {[
              ['Applications', summary.applications],
              ['Packages', summary.packages],
              ['Releases', summary.versions],
              ['Maintainers', summary.maintainers],
              ['Advisories', summary.advisories],
              ['Dependency edges', summary.dependencies],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-baseline justify-between gap-4 px-4 py-2">
                <dt className="stencil">{label}</dt>
                <dd className="datum text-ink">{count(Number(value))}</dd>
              </div>
            ))}
          </dl>
        </Sheet>
      </div>

      {/* ── Estate ledger + fault register ─────────────────────────────────── */}
      <div className="mt-12 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Sheet className="flex flex-col h-full">
          <SheetHead
            label="Estate ledger"
            icon="application"
            detail={`${summary.applications} sheets`}
            action={
              <Link href="/applications" className="stencil text-ink-3 hover:text-jumper">
                All applications
              </Link>
            }
          />
          <div className="hidden grid-cols-[minmax(0,1.9fr)_5rem_minmax(0,1.5fr)_minmax(0,7.5rem)] gap-4 border-b border-rule bg-stock-sunk px-6 py-2.5 sm:grid sm:items-center">
            <span className="stencil">Application</span>
            <span className="stencil text-center">Declared</span>
            <span className="stencil">Reach</span>
            <span className="stencil text-center">Faults</span>
          </div>
          <Ruled className="flex-1">
            {exposure.map((application) => (
              <Link
                key={application.slug}
                href={`/applications/${application.slug}`}
                className="row-hit grid grid-cols-1 gap-x-4 gap-y-2 px-6 py-3 no-underline sm:grid-cols-[minmax(0,1.9fr)_5rem_minmax(0,1.5fr)_minmax(0,7.5rem)] sm:items-center"
              >
                <span className="min-w-0">
                  <span className="block truncate text-row font-medium text-ink">{application.name}</span>
                  <span className="datum block truncate text-[12px] text-ink-3">
                    {application.team} &#183; {TIER_LABEL[application.tier] ?? application.tier}
                  </span>
                </span>
                <span className="flex items-baseline gap-2 sm:block sm:text-center">
                  <span className="stencil sm:hidden">Declared</span>
                  <span className="datum text-ink-2">{application.directDependencies}</span>
                </span>
                <span className="flex items-center gap-3 pr-2">
                  <span className="stencil w-14 shrink-0 sm:hidden">Reach</span>
                  <span className="datum w-7 shrink-0 text-right font-medium text-ink">
                    {count(application.reachablePackages)}
                  </span>
                  <span
                    className="relative h-2 min-w-14 flex-1 border border-rule bg-stock-sunk"
                    aria-hidden="true"
                  >
                    <span
                      className="absolute inset-y-0 left-0 bg-ink-2"
                      style={{
                        width: `${Math.min(100, Math.round((application.reachablePackages / maxReach) * 100))}%`,
                      }}
                    />
                  </span>
                </span>
                <span className="flex items-center justify-start sm:justify-center">
                  <span className="stencil w-14 shrink-0 sm:hidden">Faults</span>
                  {application.advisoryCount === 0 ? (
                    <ClearMark />
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
                      {(['critical', 'high', 'medium', 'low'] as const).map((severity) =>
                        application.severityCounts[severity] > 0 ? (
                          <span key={severity} className="flex items-center gap-1">
                            <FaultMark severity={severity} size="small" />
                            <span className="datum text-[12px] text-ink-2">
                              {application.severityCounts[severity]}
                            </span>
                          </span>
                        ) : null,
                      )}
                    </div>
                  )}
                </span>
              </Link>
            ))}
          </Ruled>
        </Sheet>

        <Sheet className="flex flex-col h-full">
          <SheetHead
            label="Fault register"
            icon="advisory"
            detail="by reach"
            action={
              <Link href="/advisories" className="stencil text-ink-3 hover:text-jumper">
                All faults
              </Link>
            }
          />
          {!advisories.ok ? (
            <Nothing
              title="Register unavailable"
              detail={advisories.failure.detail}
              icon="fault"
            />
          ) : register.length === 0 ? (
            <Nothing
              title="Nothing reaches this estate"
              detail="No advisory in the graph has a dependency path to any application."
            />
          ) : (
            <div className="flex flex-1 flex-col justify-between">
              <Ruled className="flex-1">
                {register.slice(0, 6).map((advisory) => (
                  <Link
                    key={advisory.id}
                    href={`/advisories/${advisory.id}`}
                    className="row-hit block px-6 py-3 no-underline"
                  >
                    <div className="flex items-start gap-3">
                      <span className="pt-0.5">
                        <FaultMark severity={advisory.severity} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="datum block text-[12px] text-ink-3">{advisory.id}</span>
                        <span className="mt-0.5 block text-row leading-snug text-ink">{advisory.title}</span>
                        <span className="datum mt-1 block text-[12px] text-ink-3">
                          {advisory.packageName}
                          {advisory.fixedIn ? ` → ${advisory.fixedIn}` : ' · no fixed release'}
                        </span>
                      </span>
                    </div>
                    <div className="mt-2.5 pl-8">
                      <Measure
                        value={advisory.applicationsReached}
                        max={maxRegisterReach}
                        tone="fault"
                        label={`${advisory.applicationsReached}/${summary.applications}`}
                      />
                    </div>
                  </Link>
                ))}
              </Ruled>
              {register.length > 6 ? (
                <div className="border-t border-rule bg-stock-sunk/40 px-6 py-2.5 text-center mt-auto">
                  <Link
                    href="/advisories"
                    className="stencil text-ink-3 transition-colors hover:text-jumper inline-flex items-center gap-1.5"
                  >
                    View all {register.length} faults in register →
                  </Link>
                </div>
              ) : null}
            </div>
          )}
        </Sheet>
      </div>

      {/* ── Two questions a table cannot answer ────────────────────────────── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Sheet className="flex flex-col h-full">
          <SheetHead label="Load-bearing" icon="package" detail="by reach" />
          {!loadBearing.ok ? (
            <Nothing title="Unavailable" detail={loadBearing.failure.detail} icon="fault" />
          ) : (
            <Ruled className="flex-1">
              {loadBearing.data.map((entry) => (
                <Link
                  key={entry.key}
                  href={packageHref(entry.key)}
                  className="row-hit flex items-center justify-between gap-4 px-6 py-2.5 no-underline"
                >
                  <span className="min-w-0">
                    <span className="datum block truncate text-ink">{entry.name}</span>
                    <span className="datum block truncate text-[12px] text-ink-3">{entry.role}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span
                      className={`stencil ${entry.maintainerCount === 1 ? 'text-jumper' : 'text-ink-3'}`}
                      title={`${entry.maintainerCount} ${plural(entry.maintainerCount, 'maintainer')}`}
                    >
                      {entry.maintainerCount} {plural(entry.maintainerCount, 'hand')}
                    </span>
                    <span className="datum w-12 text-right text-ink">
                      {entry.applicationsReached}/{summary.applications}
                    </span>
                  </span>
                </Link>
              ))}
            </Ruled>
          )}
        </Sheet>

        <Sheet className="flex flex-col h-full">
          <SheetHead
            label="Chokepoints"
            icon="maintainer"
            detail="sole owner &#183; no 2fa"
            action={
              <Link href="/maintainers" className="stencil text-ink-3 hover:text-jumper">
                All
              </Link>
            }
          />
          {!chokepoints.ok ? (
            <Nothing title="Unavailable" detail={chokepoints.failure.detail} icon="fault" />
          ) : chokepoints.data.length === 0 ? (
            <Nothing
              title="No sole maintainers found"
              detail="Every package this estate reaches has more than one person able to publish it."
            />
          ) : (
            <Ruled className="flex-1">
              {chokepoints.data.map((person) => (
                <Link
                  key={person.handle}
                  href={`/maintainers/${person.handle}`}
                  className="row-hit flex items-center justify-between gap-4 px-6 py-2.5 no-underline"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-row text-ink">{person.name}</span>
                    <span className="datum block truncate text-[12px] text-ink-3">
                      {person.packages.map((entry) => entry.name).join(', ')}
                    </span>
                  </span>
                  <span className="datum w-12 shrink-0 text-right text-jumper">
                    {person.applicationCount}/{summary.applications}
                  </span>
                </Link>
              ))}
            </Ruled>
          )}
        </Sheet>
      </div>

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
      <TitleBlock sheet="1 of 6 &#183; Estate" instance={describeTarget() ?? 'Not connected'} />
    </>
  );
}
