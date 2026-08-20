import Link from 'next/link';
import { notFound } from 'next/navigation';

import { TitleBlock } from '@/components/chrome';
import { FailureSheet } from '@/components/failure-sheet';
import { Icon } from '@/components/icon';
import { QueryDisclosure } from '@/components/query-disclosure';
import { RunDiagram } from '@/components/route';
import { ClearMark, Datum, FaultMark, Nothing, Ruled, Sheet, SheetHead } from '@/components/sheet';
import { getAdvisory, getBlastRadius, getCutPoints } from '@/data/queries/advisories';
import type { QueryMeta } from '@/lib/errors';
import { describeTarget } from '@/lib/env';
import { compact, isoDate, packageHref, plural } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  return { title: id.toUpperCase() };
}

export default async function AdvisoryPage({ params }: { params: Params }) {
  const { id } = await params;

  const [record, blast, cuts] = await Promise.all([
    getAdvisory(id),
    getBlastRadius(id),
    getCutPoints(id),
  ]);

  if (!record.ok) {
    return (
      <Shell sheet="Fault sheet">
        <FailureSheet failure={record.failure} retryHref={`/advisories/${id}`} />
      </Shell>
    );
  }

  const advisory = record.data;
  if (!advisory) notFound();

  const reached = blast.ok ? blast.data.filter((row) => row.reached) : [];
  const clear = blast.ok ? blast.data.filter((row) => !row.reached) : [];
  const total = blast.ok ? blast.data.length : 0;
  const nearest = reached.reduce<number | null>(
    (best, row) => (row.shortest && (best === null || row.shortest.depth < best) ? row.shortest.depth : best),
    null,
  );

  const bestCut = cuts.ok ? (cuts.data[0] ?? null) : null;
  const declaresDirectly = reached.filter((row) => row.shortest?.depth === 1);

  const queries: QueryMeta[] = [
    record.meta,
    ...(blast.ok ? [blast.meta] : []),
    ...(cuts.ok ? [cuts.meta] : []),
  ];

  return (
    <Shell sheet="3 of 6 &#183; Fault sheet">
      {/* ── The record ─────────────────────────────────────────────────────── */}
      <header className="sheet-enter mb-8">
        <Link href="/advisories" className="stencil inline-flex items-center gap-1.5 text-ink-3 hover:text-jumper">
          <Icon name="chevron" size={11} className="rotate-180" />
          Fault register
        </Link>

        <div className="mt-4 flex flex-wrap items-start gap-x-5 gap-y-3">
          <span className="mt-1.5 scale-[1.4] origin-left">
            <FaultMark severity={advisory.severity} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="datum max-w-[60ch] text-[12px] text-ink-3">
              {advisory.id} &#183; {advisory.weakness} &#183; score {advisory.score.toFixed(1)}
            </p>
            <h1 className="mt-1.5 max-w-[26ch] font-stencil text-[clamp(1.9rem,4.4vw,3rem)] font-bold uppercase leading-[0.98] tracking-[0.01em] text-ink">
              {advisory.title}
            </h1>
          </div>
        </div>

        <p className="mt-5 max-w-[56ch] text-prose text-ink-2">{advisory.summary}</p>

        {advisory.synthetic ? (
          <p className="mt-4 inline-flex max-w-[56ch] items-start gap-2 border border-rule bg-stock-sunk px-3 py-2 text-datum text-ink-2">
            <span className="mt-px shrink-0 border border-jumper px-1.5 py-0.5 font-stencil text-[11px] font-bold uppercase leading-none tracking-[0.14em] text-jumper">
              Synthetic
            </span>
            <span>
              This advisory is invented for the demonstration. <strong className="font-semibold text-ink">
              {advisory.packageName}</strong> is a real package; nothing described here has been
              reported against it.
            </span>
          </p>
        ) : null}
      </header>

      {/* ── Facts of the record ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-4">
        {[
          ['Affected package', <Link key="pkg" href={packageHref(`${advisory.ecosystem}:${advisory.packageName}`)} className="datum text-ink hover:text-jumper">{advisory.packageName}</Link>],
          ['Affected releases', <span key="rel" className="datum">{advisory.affected.length}{advisory.introducedIn ? ` from ${advisory.introducedIn}` : ''}</span>],
          ['Fixed in', advisory.fixedIn ? <span key="fix" className="datum text-clear">{advisory.fixedIn}</span> : <span key="fix" className="datum text-jumper">No fixed release</span>],
          ['Published', <span key="pub" className="datum">{isoDate(advisory.published)}</span>],
        ].map(([label, value], index) => (
          <div key={index} className="bg-sheet px-4 py-3">
            <div className="stencil mb-1.5">{label as string}</div>
            <div className="text-row text-ink-2">{value}</div>
          </div>
        ))}
      </div>

      {/* ── Blast radius: the answer the page exists for ────────────────────── */}
      <Sheet className="mt-6">
        <SheetHead
          label="Blast radius"
          icon="route"
          detail={
            blast.ok
              ? `${reached.length} of ${total} · nearest ${nearest ?? '—'}`
              : undefined
          }
        />

        {!blast.ok ? (
          <div className="p-4">
            <FailureSheet failure={blast.failure} retryHref={`/advisories/${id}`} />
          </div>
        ) : reached.length === 0 ? (
          <Nothing
            title="Nothing in the estate reaches this"
            detail={`No application has a dependency path to any affected release of ${advisory.packageName} within the traversal bound. That is a real answer rather than an absence of data: the traversal ran across all ${total} applications.`}
          />
        ) : (
          <div className="grid gap-px bg-rule lg:grid-cols-2">
            {reached.map((row) => (
              <article key={row.slug} className="bg-sheet p-4">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <Link href={`/applications/${row.slug}`} className="text-row font-semibold text-ink hover:text-jumper">
                    {row.name}
                  </Link>
                  <span className="flex items-baseline gap-2">
                    <span className="stencil">{row.team}</span>
                    <span className="datum text-[12px] text-ink-3">
                      {row.shortest?.depth ?? 0} {plural(row.shortest?.depth ?? 0, 'hop')}
                      {row.affectedReleasesReached > 1
                        ? ` · ${row.affectedReleasesReached} affected releases`
                        : ''}
                    </span>
                  </span>
                </div>
                {row.shortest ? (
                  <RunDiagram
                    origin={row.name}
                    originHref={`/applications/${row.slug}`}
                    route={row.shortest}
                    targetHref={packageHref(`${advisory.ecosystem}:${advisory.packageName}`)}
                    targetNote={
                      advisory.fixedIn
                        ? `Affected. Fixed in ${advisory.fixedIn}.`
                        : 'Affected. No fixed release has been published.'
                    }
                  />
                ) : null}
              </article>
            ))}
            {reached.length % 2 === 1 ? <div className="hidden bg-sheet lg:block" aria-hidden="true" /> : null}
          </div>
        )}

        {blast.ok && clear.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule bg-stock-sunk px-4 py-3">
            <ClearMark label={`Not reached · ${clear.length}`} />
            <span className="datum max-w-[64ch] text-[12px] text-ink-2">
              {clear.map((row) => row.name).join(', ')}
            </span>
          </div>
        ) : null}
      </Sheet>

      {/* ── Where to cut ───────────────────────────────────────────────────── */}
      {cuts.ok && (cuts.data.length > 0 || declaresDirectly.length > 0) ? (
        <Sheet className="mt-6">
          <SheetHead
            label="Where to cut"
            icon="cut"
            detail={
              bestCut && bestCut.applicationCount > 1
                ? `${bestCut.packageName} carries ${bestCut.applicationCount} of ${reached.length}`
                : `${cuts.data.length} ${plural(cuts.data.length, 'junction')}`
            }
          />
          <p className="max-w-[58ch] border-b border-rule px-4 py-3 text-row text-ink-2">
            {bestCut && bestCut.applicationCount > 1 ? (
              <>
                Drop the application at one end and the flawed release at the other, and count what is
                left in the middle. <strong className="font-semibold text-ink">{bestCut.packageName}</strong>{' '}
                sits on {bestCut.applicationCount} of the {reached.length} shortest paths, which makes it
                the cheapest single place to break the chain.
              </>
            ) : (
              <>
                Every exposed application reaches this on a route of its own: no intermediate package is
                shared by more than one path. There is no single change here; each application has to move
                separately, or the ecosystem has to move first.
              </>
            )}
          </p>

          {declaresDirectly.length > 0 ? (
            <p className="border-b border-rule bg-stock-sunk px-4 py-3 text-datum text-ink-2">
              <span className="stencil mr-2">Declared directly</span>
              {declaresDirectly.map((row) => row.name).join(', ')}. Nothing sits in between; the
              dependency is in the manifest.
            </p>
          ) : null}

          <Ruled>
            {cuts.data.map((entry) => (
              <div key={entry.versionKey} className="px-4 py-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <Link
                    href={packageHref(`${entry.ecosystem}:${entry.packageName}`)}
                    className="datum text-row font-medium text-ink hover:text-jumper"
                  >
                    {entry.packageName} {entry.version}
                  </Link>
                  <span className={`stencil ${entry.applicationCount > 1 ? 'text-jumper' : ''}`}>
                    on {entry.applicationCount} of {reached.length} paths
                  </span>
                </div>
                <p className="mt-1.5 max-w-[64ch] text-datum text-ink-2">
                  {entry.applications.map((application) => application.name).join(' · ')}
                </p>
              </div>
            ))}
          </Ruled>
        </Sheet>
      ) : null}

      {/* ── Affected releases and who can publish them ─────────────────────── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Sheet>
          <SheetHead label="Affected releases" icon="package" detail={`${advisory.affected.length}`} />
          <Ruled className="max-h-80 overflow-y-auto">
            {advisory.affected.map((release) => (
              <div key={release.key} className="flex items-baseline justify-between gap-4 px-4 py-2">
                <span className="datum text-ink">{release.version}</span>
                <span className="stencil">{isoDate(release.published)}</span>
              </div>
            ))}
          </Ruled>
          <div className="border-t border-rule px-4 py-3">
            <Datum label="Package role">
              <span className="text-ink-2">{advisory.packageRole}</span>
              <span className="stencil ml-2">{compact(advisory.weeklyDownloads)} downloads/wk</span>
            </Datum>
          </div>
        </Sheet>

        <Sheet>
          <SheetHead
            label="Who can publish it"
            icon="maintainer"
            detail={`${advisory.maintainers.length} ${plural(advisory.maintainers.length, 'account')}`}
          />
          {advisory.maintainers.length === 0 ? (
            <Nothing title="No maintainer on record" />
          ) : (
            <Ruled>
              {advisory.maintainers.map((maintainer) => (
                <Link
                  key={maintainer.handle}
                  href={`/maintainers/${maintainer.handle}`}
                  className="row-hit flex items-center justify-between gap-4 px-4 py-2.5 no-underline"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-row text-ink">{maintainer.name}</span>
                    <span className="datum block truncate text-[12px] text-ink-3">{maintainer.handle}</span>
                  </span>
                  <span className={`stencil shrink-0 ${maintainer.twoFactorEnabled ? 'text-clear' : 'text-jumper'}`}>
                    {maintainer.twoFactorEnabled ? '2FA on' : 'No 2FA'}
                  </span>
                </Link>
              ))}
            </Ruled>
          )}
          {advisory.maintainers.length === 1 ? (
            <p className="border-t border-rule bg-stock-sunk px-4 py-3 text-datum text-ink-2">
              <span className="block max-w-[52ch]">
                One account can publish this package. Whoever holds it can reach everything downstream
                of it, with or without an advisory.
              </span>
            </p>
          ) : null}
        </Sheet>
      </div>

      <Sheet className="mt-6">
        <QueryDisclosure queries={queries} label="Show the queries" />
      </Sheet>
    </Shell>
  );
}

function Shell({ children, sheet }: { children: React.ReactNode; sheet: string }) {
  return (
    <>
      <main id="sheet" className="mx-auto max-w-[1400px] px-4 pb-4 pt-10 sm:px-6 sm:pt-14">
        {children}
      </main>
      <TitleBlock sheet={sheet} instance={describeTarget() ?? 'Not connected'} />
    </>
  );
}
