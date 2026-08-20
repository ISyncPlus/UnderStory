import Link from 'next/link';

import type { Failure } from '@/lib/errors';

import { Icon, type IconName } from './icon';

const PRESENTATION: Record<
  Failure['kind'],
  { stencil: string; icon: IconName; tone: 'fault' | 'quiet' }
> = {
  unconfigured: { stencil: 'No instance connected', icon: 'plug', tone: 'quiet' },
  unreachable: { stencil: 'Exchange unreachable', icon: 'plug', tone: 'fault' },
  unauthorized: { stencil: 'Credentials refused', icon: 'fault', tone: 'fault' },
  timeout: { stencil: 'No answer in time', icon: 'clock', tone: 'quiet' },
  query: { stencil: 'Statement rejected', icon: 'fault', tone: 'fault' },
  unknown: { stencil: 'Call failed', icon: 'fault', tone: 'fault' },
};

/**
 * The designed failure state.
 *
 * A database that will not answer is a normal condition on a free tier, not an
 * exception — so it gets a drawn state with a name, a cause, and the next step,
 * rather than an error boundary or a blank sheet. The recovery is specific to
 * the failure: an unconfigured instance is told to run the seed, an unreachable
 * one to check the console.
 */
export function FailureSheet({ failure, retryHref }: { failure: Failure; retryHref?: string }) {
  const presentation = PRESENTATION[failure.kind];
  const isFault = presentation.tone === 'fault';

  return (
    <section className={`border ${isFault ? 'border-jumper bg-jumper-wash' : 'border-rule bg-sheet'}`}>
      <header className="flex items-center gap-2 border-b border-current/15 px-4 py-2.5">
        <Icon name={presentation.icon} size={14} className={isFault ? 'text-jumper' : 'text-ink-3'} />
        <h2 className={`stencil-strong ${isFault ? 'text-jumper' : ''}`}>{presentation.stencil}</h2>
      </header>

      <div className="px-4 py-6">
        <h3 className="mb-2 max-w-[42ch] font-stencil text-2xl font-bold uppercase tracking-wide text-ink">
          {failure.title}
        </h3>
        <p className="max-w-[57ch] text-prose text-ink-2">{failure.detail}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {retryHref ? (
            <Link href={retryHref} className="control control-filled no-underline">
              <Icon name="arrow-right" size={13} />
              Try again
            </Link>
          ) : null}
          {failure.kind === 'unconfigured' ? (
            <span className="datum text-[12px] text-ink-2">
              docs/SETUP-COGNODB.md &#183; then <code className="text-ink">npm run db:seed</code>
            </span>
          ) : null}
          {failure.code ? (
            <span className="datum text-[12px] text-ink-3">
              <span className="stencil mr-1.5">Code</span>
              {failure.code}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
