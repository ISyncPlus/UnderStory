import Link from 'next/link';

import { Icon } from '@/components/icon';

export default function NotFound() {
  return (
    <main id="sheet" className="mx-auto flex min-h-[65vh] max-w-[1400px] items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-[56ch] border border-rule bg-sheet">
        <header className="flex items-center gap-2 border-b border-rule px-4 py-2.5">
          <Icon name="fault" size={14} className="text-ink-3" />
          <h1 className="stencil-strong">Sheet not found</h1>
        </header>
        <div className="px-4 py-8">
          <h2 className="mb-3 font-stencil text-3xl font-bold uppercase tracking-wide text-ink">
            No record at this reference
          </h2>
          <p className="text-prose text-ink-2">
            Nothing in the graph matches this address. The identifier may be misspelled, or it may
            belong to a record that was never loaded.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/" className="control control-filled no-underline">
              <Icon name="arrow-right" size={13} />
              Estate sheet
            </Link>
            <Link href="/advisories" className="control no-underline">
              Fault register
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
