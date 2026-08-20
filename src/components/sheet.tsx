import type { ReactNode } from 'react';

import { Icon, type IconName } from './icon';

/**
 * The sheet.
 *
 * Every region of every page is a drawing sheet: a ruled border, a stencilled
 * field label in the top-left, and content below. Elevation is the border — no
 * surface in this system casts a shadow, because a drawing is flat and the
 * hierarchy comes from line weight and space instead.
 */
export function Sheet({
  children,
  className = '',
  tone = 'sheet',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'sheet' | 'sunk' | 'fault';
}) {
  const tones = {
    sheet: 'bg-sheet border-rule',
    sunk: 'bg-stock-sunk border-rule',
    fault: 'bg-jumper-wash border-jumper',
  } as const;
  return <section className={`border ${tones[tone]} ${className}`}>{children}</section>;
}

/**
 * A sheet's field header: stencilled label on the left, optional count or
 * control on the right, separated from the body by a single rule.
 */
export function SheetHead({
  label,
  icon,
  detail,
  action,
}: {
  label: string;
  icon?: IconName;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex min-h-[2.75rem] flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-rule px-4 py-2.5">
      <div className="flex items-center gap-2">
        {icon ? <Icon name={icon} size={13} className="text-ink-3" /> : null}
        <h2 className="stencil-strong">{label}</h2>
        {detail ? <span className="stencil text-ink-3">{detail}</span> : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </header>
  );
}

/** Rows separated by hairlines rather than wrapped in cards. */
export function Ruled({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ruled ${className}`}>{children}</div>;
}

const FAULT_LETTER = { critical: 'C', high: 'H', medium: 'M', low: 'L' } as const;
const FAULT_WORD = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' } as const;
const FAULT_INK = {
  critical: 'var(--color-fault-critical)',
  high: 'var(--color-fault-high)',
  medium: 'var(--color-fault-medium)',
  low: 'var(--color-fault-low)',
} as const;

/**
 * The fault stencil.
 *
 * Severity is carried three ways at once — a letter, a fill weight and a
 * colour — so the class survives a monochrome print, a colour-blind reader,
 * and a screenshot pasted into a ticket. The two heavier classes are filled;
 * the two lighter ones are outlined.
 */
export function FaultMark({
  severity,
  size = 'normal',
  withLabel = false,
}: {
  severity: 'critical' | 'high' | 'medium' | 'low';
  size?: 'normal' | 'small';
  withLabel?: boolean;
}) {
  const filled = severity === 'critical' || severity === 'high';
  const box = size === 'small' ? 'h-4 w-4 text-[9px]' : 'h-5 w-5 text-[10px]';
  const ink = FAULT_INK[severity];

  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <span
        aria-hidden="true"
        className={`inline-flex ${box} shrink-0 items-center justify-center border font-stencil font-bold leading-none tracking-wider`}
        style={
          filled
            ? { backgroundColor: ink, borderColor: ink, color: 'var(--color-sheet)' }
            : { borderColor: ink, color: ink }
        }
      >
        {FAULT_LETTER[severity]}
      </span>
      {withLabel ? (
        <span className="stencil" style={{ color: ink }}>
          {FAULT_WORD[severity]}
        </span>
      ) : null}
      <span className="sr-only">{FAULT_WORD[severity]} severity</span>
    </span>
  );
}

/** A clear (no fault) stencil, so "nothing found" is a drawn state rather than a blank cell. */
export function ClearMark({ label = 'Clear' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 align-middle text-clear">
      <Icon name="clear" size={15} />
      <span className="stencil text-clear">{label}</span>
    </span>
  );
}

/**
 * A measured bar.
 *
 * Used for depth profiles and reach counts. It reads as a scale rule rather
 * than a chart: ticks, a filled run, and the figure printed beside it.
 */
export function Measure({
  value,
  max,
  label,
  tone = 'ink',
}: {
  value: number;
  max: number;
  label?: string;
  tone?: 'ink' | 'jumper' | 'fault';
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const fill = { ink: 'bg-ink-2', jumper: 'bg-jumper', fault: 'bg-fault-critical' }[tone];
  return (
    <span className="flex items-center gap-2">
      <span className="relative h-2 min-w-16 flex-1 border border-rule bg-stock-sunk" aria-hidden="true">
        <span className={`absolute inset-y-0 left-0 ${fill}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="datum w-10 shrink-0 text-right text-ink-2">{label ?? value}</span>
    </span>
  );
}

/**
 * The empty state.
 *
 * Named, not blank. A drawing with nothing on it still says what it is and
 * what would put something there.
 */
export function Nothing({
  title,
  detail,
  icon = 'clear',
  action,
}: {
  title: string;
  detail?: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-10">
      <div className="flex items-center gap-2 text-ink-3">
        <Icon name={icon} size={18} />
        <span className="stencil-strong text-ink-2">{title}</span>
      </div>
      {detail ? <p className="max-w-[55ch] text-row text-ink-2">{detail}</p> : null}
      {action}
    </div>
  );
}

/** A key/value pair as it appears in a title block: stencilled label above a value. */
export function Datum({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="stencil mb-1">{label}</div>
      <div className="text-row text-ink">{children}</div>
    </div>
  );
}
