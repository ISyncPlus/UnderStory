import Link from 'next/link';

import { FrameIndex } from './frame-index';
import { LineLamp } from './line-lamp';
import { Lookup } from './lookup';
import { PrintToggle } from './print-toggle';

/** Top navigation masthead with title, links, search lookup, status indicator, and theme switcher. */
export function Masthead() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-rule-strong bg-stock">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-stretch justify-between gap-y-2 px-4 sm:px-6">
        <div className="flex items-stretch">
          <Link href="/" className="flex items-center gap-2.5 pr-4 no-underline" aria-label="Understory, home">
            <Mark />
            <span className="font-stencil text-[15px] font-bold uppercase leading-none tracking-[0.16em] text-ink">
              Understory
            </span>
          </Link>
          <div className="hidden lg:block">
            <FrameIndex />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 py-2 sm:gap-3 lg:flex-none">
          <Lookup />
          <LineLamp />
          <PrintToggle />
        </div>
      </div>
      <div className="overflow-x-auto border-t border-rule lg:hidden">
        <FrameIndex />
      </div>
    </header>
  );
}

/** Brand logo mark. */
function Mark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
      <g stroke="var(--color-ink)" strokeWidth="1.3" fill="none" strokeLinecap="square">
        <path d="M3.5 3.5v4h6v5h7" />
      </g>
      <rect x="1.5" y="1.5" width="4" height="4" fill="var(--color-ink)" />
      <rect x="7.5" y="5.5" width="4" height="4" fill="none" stroke="var(--color-ink)" strokeWidth="1.3" />
      <rect x="14.5" y="10.5" width="4" height="4" fill="var(--color-jumper)" />
    </svg>
  );
}

/** Sheet title block with document title and metadata badges. */
export function TitleBlock({
  sheet,
  scale,
  instance,
}: {
  sheet: string;
  scale?: string;
  instance?: string;
}) {
  return (
    <footer className="mt-12 border-t border-rule-strong">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="grid grid-cols-2 divide-x divide-rule border-x border-b border-rule sm:grid-cols-4">
          <Cell label="Record">Understory &#183; dependency reach</Cell>
          <Cell label="Sheet">{sheet}</Cell>
          <Cell label="Traversal bound">{scale ?? '8 hops'}</Cell>
          <Cell label="Instance">{instance ?? 'CognoDB'}</Cell>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-x border-b border-rule px-3 py-3">
          <p className="max-w-[56ch] text-datum text-ink-2">
            <span className="mr-2 inline-block border border-jumper px-1.5 py-0.5 font-stencil text-[11px] font-bold uppercase leading-none tracking-[0.14em] text-jumper">
              Synthetic data
            </span>
            Package names and ecosystems are real. The organisation, its applications, its maintainer
            accounts and every advisory in this graph are invented for the demonstration. No advisory
            here describes a real published vulnerability.
          </p>
          <a
            href="https://github.com"
            className="stencil text-ink-3 hover:text-jumper"
            rel="noreferrer noopener"
          >
            Source
          </a>
        </div>
      </div>
    </footer>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5">
      <div className="stencil mb-1">{label}</div>
      <div className="datum truncate text-[12px] text-ink-2">{children}</div>
    </div>
  );
}
