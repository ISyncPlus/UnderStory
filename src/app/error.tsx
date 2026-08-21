'use client';

import { useEffect } from 'react';

import { Icon } from '@/components/icon';

/** The last line of defence. */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[understory] unhandled', error);
  }, [error]);

  return (
    <main id="sheet" className="mx-auto flex min-h-[65vh] max-w-[1400px] items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-[56ch] border border-jumper bg-jumper-wash">
        <header className="flex items-center gap-2 border-b border-jumper/30 px-4 py-2.5">
          <Icon name="fault" size={14} className="text-jumper" />
          <h1 className="stencil-strong text-jumper">Unhandled fault</h1>
        </header>
        <div className="px-4 py-8">
          <h2 className="mb-3 font-stencil text-3xl font-bold uppercase tracking-wide text-ink">
            Something failed that should not have
          </h2>
          <p className="text-prose text-ink-2">
            This sheet could not be drawn. Database problems are handled as designed states elsewhere in
            the application, so reaching this boundary means a genuine defect.
          </p>
          {error.digest ? (
            <p className="datum mt-4 text-[12px] text-ink-3">
              <span className="stencil mr-1.5">Digest</span>
              {error.digest}
            </p>
          ) : null}
          <button type="button" onClick={reset} className="control control-filled mt-6">
            <Icon name="arrow-right" size={13} />
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
