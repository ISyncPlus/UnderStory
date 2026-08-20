import Link from 'next/link';

import { TitleBlock } from '@/components/chrome';
import FoldText from '@/components/FoldText';
import { FailureSheet } from '@/components/failure-sheet';
import { QueryDisclosure } from '@/components/query-disclosure';
import { Measure, Nothing, Ruled, Sheet, SheetHead } from '@/components/sheet';
import { getChokepoints } from '@/data/queries/maintainers';
import { describeTarget } from '@/lib/env';
import { packageHref, plural } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Chokepoints',
  description: 'Sole maintainers without a second factor, ranked by how much of the estate sits above them.',
};

export default async function MaintainersPage() {
  const outcome = await getChokepoints(12);

  return (
    <>
      <main id="sheet" className="mx-auto max-w-[1400px] px-4 pb-4 pt-10 sm:px-6 sm:pt-14">
        <header className="sheet-enter mb-8 max-w-[56ch]">
          <h1 className="font-stencil text-[clamp(1.9rem,4.6vw,3rem)] font-bold uppercase leading-[0.98] tracking-[0.01em] text-ink">
            <FoldText
              text="Chokepoints"
              splitBy="char"
              hinge="top"
              duration={0.6}
              stagger={0.03}
            />
          </h1>
          <p className="mt-4 text-prose text-ink-2">
            A maintainer who is the only person able to publish a package, on an account with no second
            factor, is a live risk to everything downstream of it. No vulnerability feed will ever tell
            you about this: there is no advisory, no CVSS score and nothing to upgrade to. There is only
            the shape of the graph.
          </p>
          <p className="mt-3 text-prose text-ink-2">
            This is the query a relational schema handles worst: a recursive closure over the
            dependency table, joined against a <code className="datum text-ink">GROUP BY … HAVING COUNT(*) = 1</code>{' '}
            over maintainers, collapsed again by a distinct count. Here it is one traversal and a
            four-line predicate.
          </p>
        </header>

        {!outcome.ok ? (
          <FailureSheet failure={outcome.failure} retryHref="/maintainers" />
        ) : (
          <Sheet>
            <SheetHead
              label="Sole owners without 2FA"
              icon="maintainer"
              detail={`${outcome.data.length} ${plural(outcome.data.length, 'account')}`}
            />
            {outcome.data.length === 0 ? (
              <Nothing
                title="No chokepoint found"
                detail="Every package this estate reaches has more than one account able to publish it, or has two-factor authentication on the sole account."
              />
            ) : (
              <Ruled>
                {outcome.data.map((person) => {
                  const max = Math.max(1, ...outcome.data.map((row) => row.applicationCount));
                  return (
                    <Link
                      key={person.handle}
                      href={`/maintainers/${person.handle}`}
                      className="row-hit grid grid-cols-1 gap-x-4 gap-y-2 px-4 py-3.5 no-underline lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)_minmax(0,11rem)] lg:items-center"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-row font-medium text-ink">{person.name}</span>
                        <span className="datum block truncate text-[12px] text-ink-3">
                          {person.handle} &#183; {person.affiliation ?? 'Unaffiliated'}
                        </span>
                      </span>
                      <span className="min-w-0">
                        <span className="stencil mb-1 block">
                          {person.packageCount} {plural(person.packageCount, 'package')}
                        </span>
                        <span className="datum block max-w-[56ch] text-[12px] text-ink-2">
                          {person.packages.map((entry) => entry.name).join(', ')}
                        </span>
                      </span>
                      <span>
                        <span className="stencil mb-1 block">Applications above</span>
                        <Measure
                          value={person.applicationCount}
                          max={max}
                          tone="fault"
                          label={String(person.applicationCount)}
                        />
                      </span>
                    </Link>
                  );
                })}
              </Ruled>
            )}
            <QueryDisclosure queries={[outcome.meta]} />
          </Sheet>
        )}

        {outcome.ok && outcome.data.length > 0 ? (
          <p className="mt-6 max-w-[58ch] text-datum text-ink-3">
            Packages are listed by the maintainer who solely owns them; follow a name to see every
            application that sits above their work and by what route. Package links:{' '}
            {outcome.data
              .flatMap((person) => person.packages)
              .slice(0, 8)
              .map((entry) => (
                <Link key={entry.key} href={packageHref(entry.key)} className="datum text-ink-2 hover:text-jumper">
                  {entry.name}{' '}
                </Link>
              ))}
          </p>
        ) : null}
      </main>
      <TitleBlock sheet="6 of 6 &#183; Chokepoints" instance={describeTarget() ?? 'Not connected'} />
    </>
  );
}
