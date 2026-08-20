import Link from 'next/link';

import type { Route } from '@/data/queries/shared';

import { Icon } from './icon';

/**
 * The run.
 *
 * This is the component the product exists for: a dependency path drawn the
 * way a cable record draws a jumper run — down the sheet, one terminal block
 * per frame, the fault at the end of the line.
 *
 * It is vertical at every width on purpose. A horizontal chain has to wrap on
 * a phone, and a wrapped chain loses the one thing the drawing is for: you can
 * see, at a glance, how far down the run the problem sits. Vertical also
 * matches how the artefact is read in life.
 *
 * The rail draws itself in on mount and the blocks land after it, staggered by
 * depth — one authored motion moment, not an effect on every element. Under
 * `prefers-reduced-motion` the whole thing is simply present.
 */
export function RunDiagram({
  origin,
  originHref,
  route,
  target,
  targetHref,
  targetNote,
  fault = true,
}: {
  origin: string;
  originHref?: string;
  route: Route;
  target?: { name: string; version: string };
  targetHref?: string;
  targetNote?: string;
  fault?: boolean;
}) {
  const hops = route.hops;
  const lastIndex = hops.length - 1;

  return (
    <ol className="relative pl-0" aria-label={`Dependency path, ${route.depth} hops`}>
      {/* The rail. One element, drawn once. */}
      <span
        aria-hidden="true"
        className="run-rail absolute left-[7px] top-3 bottom-3"
        style={{
          width: fault ? '1.5px' : '1px',
          // The one saturated colour in the system is spent here, on the run
          // that actually leads somewhere.
          background: fault ? 'var(--color-jumper)' : 'var(--color-rule-strong)',
        }}
      />

      <li className="run-block relative flex items-start gap-3 pb-4" style={{ ['--hop' as string]: 0 }}>
        <Terminal kind="origin" />
        <div className="min-w-0 flex-1 pt-px">
          <div className="stencil mb-1">Application</div>
          {originHref ? (
            <Link href={originHref} className="text-row font-medium text-ink hover:text-jumper">
              {origin}
            </Link>
          ) : (
            <span className="text-row font-medium text-ink">{origin}</span>
          )}
        </div>
      </li>

      {hops.map((hop, index) => {
        const edge = route.edges[index];
        const isTarget = index === lastIndex;
        const href = `/packages/${hop.ecosystem}/${hop.name}`;
        return (
          <li
            key={`${hop.key}-${index}`}
            className={`run-block relative flex items-start gap-3 ${isTarget ? '' : 'pb-4'}`}
            style={{ ['--hop' as string]: index + 1 }}
          >
            <Terminal kind={isTarget && fault ? 'fault' : 'hop'} />
            <div className="min-w-0 flex-1 pt-px">
              <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="stencil">
                  {isTarget && fault ? 'Fault' : `Hop ${index + 1}`}
                </span>
                {edge ? (
                  <span className="datum text-[12px] text-ink-3">
                    {edge.direct ? 'declared' : 'transitive'}
                    {edge.scope !== 'runtime' ? ` · ${edge.scope}` : ''}
                    {edge.range ? ` · ${edge.range}` : ''}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                {isTarget && targetHref ? (
                  <Link
                    href={targetHref}
                    className={`datum font-medium ${isTarget && fault ? 'text-jumper' : 'text-ink'} hover:underline`}
                  >
                    {hop.name}
                  </Link>
                ) : (
                  <Link
                    href={href}
                    className={`datum ${isTarget && fault ? 'text-jumper' : 'text-ink'} hover:text-jumper hover:underline`}
                  >
                    {hop.name}
                  </Link>
                )}
                <span className={`datum ${isTarget && fault ? 'text-jumper' : 'text-ink-3'}`}>
                  {hop.version}
                </span>
              </div>
              {isTarget && (target || targetNote) ? (
                <p className="mt-1 text-datum text-ink-2">
                  {targetNote ?? `${target?.name} ${target?.version}`}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Terminal({ kind }: { kind: 'origin' | 'hop' | 'fault' }) {
  if (kind === 'fault') {
    return (
      <span className="relative z-10 mt-0.5 shrink-0 text-jumper" aria-hidden="true">
        <Icon name="fault" size={15} strokeWidth={1.6} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`relative z-10 mt-[5px] block h-[9px] w-[9px] shrink-0 border ${
        kind === 'origin'
          ? 'border-ink bg-ink'
          : 'border-rule-strong bg-sheet'
      }`}
      style={{ marginLeft: '3px' }}
    />
  );
}

/**
 * The compact form: a run collapsed to one line, for table rows.
 *
 * Long runs elide from the middle rather than the end, because the two hops
 * that carry meaning are the first (the one you can change) and the last (the
 * one that is broken).
 */
export function RunInline({ route, max = 4 }: { route: Route; max?: number }) {
  const hops = route.hops;
  if (hops.length === 0) return <span className="datum text-ink-3">—</span>;

  const shown =
    hops.length <= max
      ? hops.map((hop, index) => ({ hop, index }))
      : [
          ...hops.slice(0, max - 2).map((hop, index) => ({ hop, index })),
          null,
          ...hops.slice(-2).map((hop, offset) => ({ hop, index: hops.length - 2 + offset })),
        ];

  return (
    <span className="datum inline-flex flex-wrap items-baseline gap-x-1 text-ink-2">
      {shown.map((entry, position) => {
        if (entry === null) {
          return (
            <span key={`gap-${position}`} className="text-ink-3" aria-label={`${hops.length - max + 1} more hops`}>
              &#8230;
            </span>
          );
        }
        const isLast = entry.index === hops.length - 1;
        return (
          <span key={`${entry.hop.key}-${entry.index}`} className="inline-flex items-baseline gap-1">
            {position > 0 ? (
              <span aria-hidden="true" className="text-rule-strong">
                &#8250;
              </span>
            ) : null}
            <span className={isLast ? 'font-medium text-jumper' : ''}>{entry.hop.name}</span>
          </span>
        );
      })}
    </span>
  );
}

/** Depth as a printed figure with its unit, used in table cells. */
export function DepthFigure({ depth }: { depth: number }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="datum text-ink">{depth}</span>
      <span className="stencil">{depth === 1 ? 'hop' : 'hops'}</span>
    </span>
  );
}
