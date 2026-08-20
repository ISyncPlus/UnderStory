import Link from 'next/link';

import { TitleBlock } from '@/components/chrome';
import FoldText from '@/components/FoldText';
import { FailureSheet } from '@/components/failure-sheet';
import { QueryDisclosure } from '@/components/query-disclosure';
import { Measure, Ruled, Sheet, SheetHead } from '@/components/sheet';
import { listApplications } from '@/data/queries/applications';
import { describeTarget } from '@/lib/env';
import { count, TIER_LABEL } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Applications',
  description: 'Every application in the estate, with what it declares and what it actually reaches.',
};

export default async function ApplicationsPage() {
  const outcome = await listApplications();

  return (
    <>
      <main id="sheet" className="mx-auto max-w-[1400px] px-4 pb-4 pt-10 sm:px-6 sm:pt-14">
        <header className="sheet-enter mb-8 max-w-[55ch]">
          <h1 className="font-stencil text-[clamp(1.9rem,4.6vw,3rem)] font-bold uppercase leading-[0.98] tracking-[0.01em] text-ink">
            <FoldText
              text="Applications"
              splitBy="char"
              hinge="top"
              duration={0.6}
              stagger={0.03}
            />
          </h1>
          <p className="mt-4 text-prose text-ink-2">
            What each application declares, and how far that actually goes. The gap between the two
            columns is the whole point: a service with fourteen declared dependencies is standing on
            several hundred packages it never named.
          </p>
        </header>

        {!outcome.ok ? (
          <FailureSheet failure={outcome.failure} retryHref="/applications" />
        ) : (
          <Sheet>
            <SheetHead label="Estate" icon="application" detail={`${outcome.data.length} applications`} />
            <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_7rem_minmax(0,12rem)] gap-3 border-b border-rule bg-stock-sunk px-4 py-2 lg:grid">
              <span className="stencil">Application</span>
              <span className="stencil">Purpose</span>
              <span className="stencil text-center">Declared</span>
              <span className="stencil">Packages reached</span>
            </div>
            <Ruled>
              {outcome.data.map((application) => {
                const max = Math.max(1, ...outcome.data.map((row) => row.reachablePackages));
                return (
                  <Link
                    key={application.slug}
                    href={`/applications/${application.slug}`}
                    className="row-hit grid grid-cols-1 gap-x-3 gap-y-2 px-4 py-3.5 no-underline lg:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_7rem_minmax(0,12rem)] lg:items-center"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-row font-medium text-ink">{application.name}</span>
                      <span className="datum block truncate text-[12px] text-ink-3">
                        {application.team} &#183; {TIER_LABEL[application.tier] ?? application.tier} &#183;{' '}
                        {application.runtime}
                      </span>
                    </span>
                    <span className="text-datum text-ink-2">{application.purpose}</span>
                    <span className="datum text-ink-2 lg:text-center">{application.directDependencies}</span>
                    <Measure
                      value={application.reachablePackages}
                      max={max}
                      label={count(application.reachablePackages)}
                    />
                  </Link>
                );
              })}
            </Ruled>
            <QueryDisclosure queries={[outcome.meta]} />
          </Sheet>
        )}
      </main>
      <TitleBlock sheet="4 of 6 &#183; Applications" instance={describeTarget() ?? 'Not connected'} />
    </>
  );
}
