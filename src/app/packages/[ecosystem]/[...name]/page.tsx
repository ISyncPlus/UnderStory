import Link from 'next/link';
import { notFound } from 'next/navigation';

import { TitleBlock } from '@/components/chrome';
import { FailureSheet } from '@/components/failure-sheet';
import { Icon } from '@/components/icon';
import { QueryDisclosure } from '@/components/query-disclosure';
import { RunInline } from '@/components/route';
import { FaultMark, Nothing, Ruled, Sheet, SheetHead } from '@/components/sheet';
import { getPackage, getPackageReach } from '@/data/queries/packages';
import type { QueryMeta } from '@/lib/errors';
import { describeTarget } from '@/lib/env';
import { compact, count, isoDate, keyFromSegments, packageHref, plural } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Params = Promise<{ ecosystem: string; name: string[] }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { ecosystem, name } = await params;
  return { title: `${name.map(decodeURIComponent).join('/')} (${ecosystem})` };
}

export default async function PackagePage({ params }: { params: Params }) {
  const { ecosystem, name } = await params;
  const key = keyFromSegments([ecosystem, ...name]);
  if (!key) notFound();

  const [record, reach] = await Promise.all([getPackage(key), getPackageReach(key)]);

  if (!record.ok) {
    return (
      <Shell>
        <FailureSheet failure={record.failure} retryHref={packageHref(key)} />
      </Shell>
    );
  }

  const pkg = record.data;
  if (!pkg) notFound();

  const withAdvisories = pkg.releases.filter((release) => release.advisories.length > 0).length;
  const soleMaintainer = pkg.maintainers.length === 1;
  const queries: QueryMeta[] = [record.meta, ...(reach.ok ? [reach.meta] : [])];

  return (
    <Shell>
      <header className="sheet-enter mb-8">
        <h1 className="max-w-[22ch] break-words font-mono text-[clamp(1.6rem,4vw,2.6rem)] font-medium leading-[1.05] tracking-tight text-ink">
          {pkg.name}
        </h1>
        <p className="datum mt-2 text-[12px] text-ink-3">
          {pkg.ecosystem === 'npm' ? 'npm registry' : 'Python package index'} &#183; package record
        </p>
        <p className="mt-3 max-w-[56ch] text-prose text-ink-2">{pkg.role}</p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="stencil">{compact(pkg.weeklyDownloads)} downloads / week</span>
          <span className="stencil">
            {pkg.releases.length} {plural(pkg.releases.length, 'release')}
          </span>
          {withAdvisories > 0 ? (
            <span className="stencil text-jumper">
              {withAdvisories} {plural(withAdvisories, 'release')} with an advisory
            </span>
          ) : null}
          {pkg.deprecated ? <span className="stencil text-jumper">Deprecated</span> : null}
        </div>

        {pkg.supersededBy ? (
          <p className="mt-4 flex max-w-[56ch] items-start gap-2 border border-rule bg-stock-sunk px-3 py-2 text-datum text-ink-2">
            <Icon name="arrow-right" size={14} className="mt-0.5 shrink-0 text-ink-3" />
            <span>
              {pkg.supersededBy.reason}. The ecosystem moved to{' '}
              <Link href={packageHref(pkg.supersededBy.key)} className="datum text-ink hover:text-jumper">
                {pkg.supersededBy.name}
              </Link>
              .
            </span>
          </p>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Sheet>
          <SheetHead label="Releases" icon="package" detail={`${pkg.releases.length}`} />
          <div className="hidden grid-cols-[7rem_7rem_5.5rem_minmax(0,1fr)] gap-3 border-b border-rule bg-stock-sunk px-4 py-2 sm:grid">
            <span className="stencil">Version</span>
            <span className="stencil">Published</span>
            <span className="stencil">Licence</span>
            <span className="stencil">Advisories</span>
          </div>
          <Ruled className="max-h-[34rem] overflow-y-auto">
            {pkg.releases.map((release) => (
              <div
                key={release.key}
                className="grid grid-cols-1 gap-x-3 gap-y-1 px-4 py-2.5 sm:grid-cols-[7rem_7rem_5.5rem_minmax(0,1fr)] sm:items-center"
              >
                <span className="datum text-ink">{release.version}</span>
                <span className="stencil">{isoDate(release.published)}</span>
                <span
                  className={`datum text-[12px] ${
                    release.licenseCategory && release.licenseCategory !== 'permissive' && release.licenseCategory !== 'public-domain'
                      ? 'text-jumper'
                      : 'text-ink-2'
                  }`}
                >
                  {release.license ?? '—'}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {release.advisories.length === 0 ? (
                    <span className="stencil text-ink-3">—</span>
                  ) : (
                    release.advisories.map((advisory) => (
                      <Link
                        key={advisory.id}
                        href={`/advisories/${advisory.id}`}
                        className="flex items-center gap-1.5 no-underline"
                      >
                        <FaultMark severity={advisory.severity} size="small" />
                        <span className="datum text-[12px] text-ink-2 hover:text-jumper">{advisory.id}</span>
                      </Link>
                    ))
                  )}
                </span>
              </div>
            ))}
          </Ruled>
        </Sheet>

        <div className="flex flex-col gap-6">
          <Sheet>
            <SheetHead
              label="Publish rights"
              icon="maintainer"
              detail={`${pkg.maintainers.length} ${plural(pkg.maintainers.length, 'account')}`}
            />
            {pkg.maintainers.length === 0 ? (
              <Nothing title="No maintainer on record" />
            ) : (
              <Ruled>
                {pkg.maintainers.map((maintainer) => (
                  <Link
                    key={maintainer.handle}
                    href={`/maintainers/${maintainer.handle}`}
                    className="row-hit flex items-center justify-between gap-4 px-4 py-2.5 no-underline"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-row text-ink">{maintainer.name}</span>
                      <span className="datum block truncate text-[12px] text-ink-3">
                        {maintainer.handle} &#183; {maintainer.role}
                        {maintainer.affiliation ? ` · ${maintainer.affiliation}` : ''}
                      </span>
                    </span>
                    <span className={`stencil shrink-0 ${maintainer.twoFactorEnabled ? 'text-clear' : 'text-jumper'}`}>
                      {maintainer.twoFactorEnabled ? '2FA on' : 'No 2FA'}
                    </span>
                  </Link>
                ))}
              </Ruled>
            )}
            {soleMaintainer ? (
              <p className="border-t border-rule bg-stock-sunk px-4 py-3 text-datum text-ink-2">
                <span className="block max-w-[52ch]">
                  One account can publish this package. That is a single point of failure with no
                  advisory attached to it.
                </span>
              </p>
            ) : null}
          </Sheet>

          <Sheet>
            <SheetHead
              label="Reached from"
              icon="route"
              detail={reach.ok ? `${reach.data.applications.length} applications` : undefined}
            />
            {!reach.ok ? (
              <Nothing title="Unavailable" detail={reach.failure.detail} icon="fault" />
            ) : reach.data.applications.length === 0 ? (
              <Nothing
                title="Nothing in the estate reaches this package"
                detail="No application has a dependency path to any release of it."
              />
            ) : (
              <Ruled>
                {reach.data.applications.map((application) => (
                  <Link
                    key={application.slug}
                    href={`/applications/${application.slug}`}
                    className="row-hit block px-4 py-2.5 no-underline"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-row text-ink">{application.name}</span>
                      <span className="stencil shrink-0">
                        {application.depth} {plural(application.depth, 'hop')}
                      </span>
                    </div>
                    {application.route ? (
                      <div className="mt-1">
                        <RunInline route={application.route} max={5} />
                      </div>
                    ) : null}
                  </Link>
                ))}
              </Ruled>
            )}
          </Sheet>
        </div>
      </div>

      {reach.ok && reach.data.directDependentCount > 0 ? (
        <Sheet className="mt-6">
          <SheetHead
            label="Pulled in directly by"
            icon="package"
            detail={`${count(reach.data.directDependentCount)} ${plural(reach.data.directDependentCount, 'release')}`}
          />
          <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 py-3.5">
            {reach.data.directDependents.map((dependent) => (
              <Link
                key={dependent.key}
                href={packageHref(`${dependent.ecosystem}:${dependent.name}`)}
                className="datum text-[12px] text-ink-2 hover:text-jumper"
              >
                {dependent.name}
                <span className="text-ink-3"> {dependent.version}</span>
              </Link>
            ))}
            {reach.data.directDependentCount > reach.data.directDependents.length ? (
              <span className="stencil">
                +{reach.data.directDependentCount - reach.data.directDependents.length} more
              </span>
            ) : null}
          </div>
        </Sheet>
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
      <TitleBlock sheet="5 of 6 &#183; Package" instance={describeTarget() ?? 'Not connected'} />
    </>
  );
}
