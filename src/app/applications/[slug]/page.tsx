import Link from 'next/link';
import { notFound } from 'next/navigation';

import { TitleBlock } from '@/components/chrome';
import { FailureSheet } from '@/components/failure-sheet';
import { Icon } from '@/components/icon';
import { QueryDisclosure } from '@/components/query-disclosure';
import { RunDiagram, RunInline } from '@/components/route';
import { ClearMark, FaultMark, Measure, Nothing, Ruled, Sheet, SheetHead } from '@/components/sheet';
import {
  getApplicationAdvisories,
  getApplicationProfile,
  getDirectDependencies,
  getLicenceExposure,
} from '@/data/queries/applications';
import type { QueryMeta } from '@/lib/errors';
import { describeTarget } from '@/lib/env';
import { count, isoDate, packageHref, plural, TIER_LABEL } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  return { title: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) };
}

export default async function ApplicationPage({ params }: { params: Params }) {
  const { slug } = await params;

  const [profile, advisories, direct, licences] = await Promise.all([
    getApplicationProfile(slug),
    getApplicationAdvisories(slug),
    getDirectDependencies(slug),
    getLicenceExposure(slug),
  ]);

  if (!profile.ok) {
    return (
      <Shell>
        <FailureSheet failure={profile.failure} retryHref={`/applications/${slug}`} />
      </Shell>
    );
  }

  const application = profile.data;
  if (!application) notFound();

  const maxDepth = Math.max(1, ...application.depthProfile.map((bucket) => bucket.newPackages));
  const queries: QueryMeta[] = [
    profile.meta,
    ...(advisories.ok ? [advisories.meta] : []),
    ...(direct.ok ? [direct.meta] : []),
    ...(licences.ok ? [licences.meta] : []),
  ];

  const worst = advisories.ok ? advisories.data[0] ?? null : null;

  return (
    <Shell>
      <header className="sheet-enter mb-8">
        <Link href="/applications" className="stencil inline-flex items-center gap-1.5 text-ink-3 hover:text-jumper">
          <Icon name="chevron" size={11} className="rotate-180" />
          Applications
        </Link>
        <h1 className="mt-5 max-w-[20ch] font-stencil text-[clamp(1.9rem,4.6vw,3.1rem)] font-bold uppercase leading-[0.96] tracking-[0.01em] text-ink">
          {application.name}
        </h1>
        <p className="datum mt-2 text-[12px] text-ink-3">
          {application.team} &#183; {TIER_LABEL[application.tier] ?? application.tier} &#183;{' '}
          {application.runtime} &#183; shipping since {isoDate(application.firstShipped)}
        </p>
        <p className="mt-4 max-w-[58ch] text-prose text-ink-2">{application.purpose}</p>
      </header>

      {/* ── Depth profile: where this application's dependencies actually live ── */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Sheet>
          <SheetHead
            label="Depth profile"
            icon="depth"
            detail={`${count(application.totalReach)} releases within 6 hops`}
          />
          <p className="max-w-[48ch] border-b border-rule px-4 py-3 text-datum text-ink-2">
            Releases that first become reachable at each depth. The first row is what the team wrote
            down; everything below it arrived on its own.
          </p>
          <Ruled>
            {application.depthProfile.map((bucket) => (
              <div key={bucket.depth} className="flex items-center gap-4 px-4 py-2.5">
                <span className="stencil w-14 shrink-0">
                  {bucket.depth === 1 ? 'Declared' : `Hop ${bucket.depth}`}
                </span>
                <span className="flex-1">
                  <Measure
                    value={bucket.newPackages}
                    max={maxDepth}
                    tone={bucket.depth === 1 ? 'ink' : 'ink'}
                    label={count(bucket.newPackages)}
                  />
                </span>
              </div>
            ))}
          </Ruled>
        </Sheet>

        <Sheet>
          <SheetHead
            label="Nearest fault"
            icon="advisory"
            detail={advisories.ok ? `${advisories.data.length} reachable` : undefined}
          />
          {!advisories.ok ? (
            <Nothing title="Unavailable" detail={advisories.failure.detail} icon="fault" />
          ) : !worst ? (
            <Nothing
              title="Nothing reaches this application"
              detail="No advisory in the graph has a dependency path to this application within the traversal bound."
            />
          ) : (
            <div className="p-4">
              <div className="mb-4 flex flex-wrap items-start gap-3">
                <FaultMark severity={worst.severity} />
                <div className="min-w-0 flex-1">
                  <Link href={`/advisories/${worst.id}`} className="text-row font-medium text-ink hover:text-jumper">
                    {worst.title}
                  </Link>
                  <p className="datum mt-0.5 text-[12px] text-ink-3">
                    {worst.id} &#183; score {worst.score.toFixed(1)}
                    {worst.fixedIn ? ` · fixed in ${worst.fixedIn}` : ' · no fixed release'}
                  </p>
                </div>
              </div>
              {worst.route ? (
                <RunDiagram
                  origin={application.name}
                  route={worst.route}
                  targetHref={packageHref(`${worst.ecosystem}:${worst.packageName}`)}
                  targetNote={`${worst.packageName} ${worst.targetVersion} is affected.`}
                />
              ) : null}
            </div>
          )}
        </Sheet>
      </div>

      {/* ── Every reachable advisory ───────────────────────────────────────── */}
      {advisories.ok && advisories.data.length > 0 ? (
        <Sheet className="mt-6">
          <SheetHead
            label="Reachable faults"
            icon="route"
            detail={`${advisories.data.length} ${plural(advisories.data.length, 'advisory', 'advisories')}`}
          />
          <div className="hidden grid-cols-[2.5rem_minmax(0,2fr)_minmax(0,2fr)_4.5rem] gap-3 border-b border-rule bg-stock-sunk px-4 py-2 lg:grid">
            <span className="stencil">Cls</span>
            <span className="stencil">Advisory</span>
            <span className="stencil">Shortest run</span>
            <span className="stencil text-center">Depth</span>
          </div>
          <Ruled>
            {advisories.data.map((advisory) => (
              <Link
                key={advisory.id}
                href={`/advisories/${advisory.id}`}
                className="row-hit grid grid-cols-1 gap-x-3 gap-y-2 px-4 py-3 no-underline lg:grid-cols-[2.5rem_minmax(0,2fr)_minmax(0,2fr)_4.5rem] lg:items-center"
              >
                <span>
                  <FaultMark severity={advisory.severity} />
                </span>
                <span className="min-w-0">
                  <span className="block text-row leading-snug text-ink">{advisory.title}</span>
                  <span className="datum block text-[12px] text-ink-3">
                    {advisory.id} &#183; {advisory.packageName}
                  </span>
                </span>
                <span className="min-w-0">{advisory.route ? <RunInline route={advisory.route} /> : null}</span>
                <span className="datum text-ink-2 lg:text-center">{advisory.route?.depth ?? '—'}</span>
              </Link>
            ))}
          </Ruled>
        </Sheet>
      ) : null}

      {/* ── Licence exposure ───────────────────────────────────────────────── */}
      <Sheet className="mt-6">
        <SheetHead
          label="Reciprocal licences"
          icon="licence"
          detail={licences.ok ? `${licences.data.length} reachable` : undefined}
        />
        {!licences.ok ? (
          <Nothing title="Unavailable" detail={licences.failure.detail} icon="fault" />
        ) : licences.data.length === 0 ? (
          <Nothing
            title="No copyleft licence is reachable"
            detail="Every package this application can reach within the traversal bound is under a permissive or public-domain licence."
          />
        ) : (
          <Ruled>
            {licences.data.map((licence) => (
              <div key={licence.spdxId} className="px-4 py-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="datum text-row font-medium text-ink">{licence.spdxId}</span>
                  <span className="stencil">
                    {licence.category.replace('-', ' ')} &#183; {licence.packagesReached}{' '}
                    {plural(licence.packagesReached, 'package')}
                  </span>
                </div>
                <p className="mt-1 max-w-[56ch] text-datum text-ink-2">{licence.note}</p>
                {licence.nearest?.route ? (
                  <div className="mt-2 flex flex-wrap items-baseline gap-2">
                    <span className="stencil">Nearest</span>
                    <RunInline route={licence.nearest.route} max={5} />
                    <span className="stencil text-ink-3">
                      {licence.nearest.route.depth} {plural(licence.nearest.route.depth, 'hop')}
                    </span>
                  </div>
                ) : null}
              </div>
            ))}
          </Ruled>
        )}
      </Sheet>

      {/* ── What the team actually wrote down ──────────────────────────────── */}
      <Sheet className="mt-6">
        <SheetHead
          label="Declared dependencies"
          icon="package"
          detail={direct.ok ? `${direct.data.length}` : undefined}
        />
        {!direct.ok ? (
          <Nothing title="Unavailable" detail={direct.failure.detail} icon="fault" />
        ) : direct.data.length === 0 ? (
          <Nothing title="Nothing declared" detail="This application declares no dependencies in the graph." />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.6fr)_7rem_6rem_7rem] gap-3 border-b border-rule bg-stock-sunk px-4 py-2 lg:grid">
              <span className="stencil">Package</span>
              <span className="stencil">Role</span>
              <span className="stencil">Declared range</span>
              <span className="stencil">Licence</span>
              <span className="stencil">On this release</span>
            </div>
            <Ruled>
              {direct.data.map((dependency) => (
                <div
                  key={dependency.key}
                  className="grid grid-cols-1 gap-x-3 gap-y-1.5 px-4 py-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.6fr)_7rem_6rem_7rem] lg:items-center"
                >
                  <span className="min-w-0">
                    <Link
                      href={packageHref(`${dependency.ecosystem}:${dependency.name}`)}
                      className="datum block truncate text-ink hover:text-jumper"
                    >
                      {dependency.name}
                    </Link>
                    <span className="datum block truncate text-[12px] text-ink-3">
                      {dependency.version}
                      {dependency.scope !== 'runtime' ? ` · ${dependency.scope}` : ''}
                    </span>
                  </span>
                  <span className="text-datum text-ink-2">{dependency.role}</span>
                  <span className="datum text-[12px] text-ink-3">{dependency.range}</span>
                  <span className="datum text-[12px] text-ink-2">{dependency.license ?? '—'}</span>
                  <span>
                    {dependency.advisoryCount === 0 ? (
                      <ClearMark />
                    ) : (
                      <span className="flex items-center gap-1.5">
                        {dependency.worstSeverity ? <FaultMark severity={dependency.worstSeverity} size="small" /> : null}
                        <span className="datum text-[12px] text-ink-2">
                          {dependency.advisoryCount} {plural(dependency.advisoryCount, 'advisory', 'advisories')}
                        </span>
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </Ruled>
          </>
        )}
      </Sheet>

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
      <TitleBlock sheet="4 of 6 &#183; Application" instance={describeTarget() ?? 'Not connected'} />
    </>
  );
}
