import Link from 'next/link';
import { notFound } from 'next/navigation';

import { TitleBlock } from '@/components/chrome';
import { FailureSheet } from '@/components/failure-sheet';
import { Icon } from '@/components/icon';
import { QueryDisclosure } from '@/components/query-disclosure';
import { RunInline } from '@/components/route';
import { Nothing, Ruled, Sheet, SheetHead } from '@/components/sheet';
import { getMaintainer } from '@/data/queries/maintainers';
import { describeTarget } from '@/lib/env';
import { compact, isoDate, packageHref, plural } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Params = Promise<{ handle: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { handle } = await params;
  return { title: handle };
}

export default async function MaintainerPage({ params }: { params: Params }) {
  const { handle } = await params;
  const outcome = await getMaintainer(handle);

  if (!outcome.ok) {
    return (
      <Shell>
        <FailureSheet failure={outcome.failure} retryHref={`/maintainers/${handle}`} />
      </Shell>
    );
  }

  const maintainer = outcome.data;
  if (!maintainer) notFound();

  const sole = maintainer.packages.filter((entry) => entry.soleMaintainer);

  return (
    <Shell>
      <header className="sheet-enter mb-8">
        <Link href="/maintainers" className="stencil inline-flex items-center gap-1.5 text-ink-3 hover:text-jumper">
          <Icon name="chevron" size={11} className="rotate-180" />
          Chokepoints
        </Link>
        <h1 className="mt-5 max-w-[20ch] font-stencil text-[clamp(1.9rem,4.6vw,3.1rem)] font-bold uppercase leading-[0.96] tracking-[0.01em] text-ink">
          {maintainer.name}
        </h1>
        <p className="datum mt-2 text-[12px] text-ink-3">
          {maintainer.handle} &#183; joined {isoDate(maintainer.joined)} &#183;{' '}
          {maintainer.affiliation ?? 'Unaffiliated'}
        </p>

        <p className="mt-5 max-w-[58ch] text-prose text-ink-2">
          {maintainer.twoFactorEnabled ? (
            <>
              This account has a second factor. It can publish{' '}
              {maintainer.packages.length} {plural(maintainer.packages.length, 'package')}, and{' '}
              {maintainer.reach.length} of the estate&#8217;s applications sit above that work.
            </>
          ) : (
            <>
              <span className="text-jumper">No second factor on this account.</span> It can publish{' '}
              {maintainer.packages.length} {plural(maintainer.packages.length, 'package')}
              {sole.length > 0 ? `, ${sole.length} of which nobody else can` : ''}, and{' '}
              {maintainer.reach.length} of the estate&#8217;s applications sit above that work.
            </>
          )}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Sheet>
          <SheetHead
            label="Can publish"
            icon="package"
            detail={`${maintainer.packages.length} ${plural(maintainer.packages.length, 'package')}`}
          />
          {maintainer.packages.length === 0 ? (
            <Nothing title="No packages on record" />
          ) : (
            <Ruled>
              {maintainer.packages.map((entry) => (
                <Link
                  key={entry.key}
                  href={packageHref(entry.key)}
                  className="row-hit flex items-center justify-between gap-4 px-4 py-2.5 no-underline"
                >
                  <span className="min-w-0">
                    <span className="datum block truncate text-ink">{entry.name}</span>
                    <span className="datum block truncate text-[12px] text-ink-3">{entry.role}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="stencil text-ink-3">{compact(entry.weeklyDownloads)}/wk</span>
                    {entry.soleMaintainer ? (
                      <span className="stencil text-jumper">Sole</span>
                    ) : (
                      <span className="stencil text-ink-3">Shared</span>
                    )}
                  </span>
                </Link>
              ))}
            </Ruled>
          )}
        </Sheet>

        <Sheet>
          <SheetHead
            label="Applications above"
            icon="route"
            detail={`${maintainer.reach.length} ${plural(maintainer.reach.length, 'application')}`}
          />
          {maintainer.reach.length === 0 ? (
            <Nothing
              title="Nothing in the estate sits above this work"
              detail="No application has a dependency path to any release of a package this account can publish."
            />
          ) : (
            <Ruled>
              {maintainer.reach.map((application) => (
                <Link
                  key={application.slug}
                  href={`/applications/${application.slug}`}
                  className="row-hit block px-4 py-2.5 no-underline"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-row text-ink">{application.name}</span>
                    <span className="stencil shrink-0">
                      {application.team} &#183; {application.depth} {plural(application.depth, 'hop')}
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

      <Sheet className="mt-6">
        <QueryDisclosure queries={[outcome.meta]} label="Show the query" />
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
      <TitleBlock sheet="6 of 6 &#183; Maintainer" instance={describeTarget() ?? 'Not connected'} />
    </>
  );
}
