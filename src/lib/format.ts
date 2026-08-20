/** Presentation helpers. Locale-independent by design: the interface prints figures the same way everywhere. */

const GROUPED = new Intl.NumberFormat('en-GB');

export function count(value: number): string {
  return GROUPED.format(value);
}

/** Compact form for large registry figures: 1.2M, 84k, 940. */
export function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return String(value);
}

export function isoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const [year, month, day] = value.slice(0, 10).split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const index = Number(month) - 1;
  return `${Number(day)} ${months[index] ?? month} ${year}`;
}

export function plural(value: number, singular: string, pluralForm?: string): string {
  return value === 1 ? singular : (pluralForm ?? `${singular}s`);
}

/** `npm:@nestjs/core` -> `/packages/npm/@nestjs/core` */
export function packageHref(key: string): string {
  const separator = key.indexOf(':');
  if (separator === -1) return `/packages/npm/${key}`;
  return `/packages/${key.slice(0, separator)}/${key.slice(separator + 1)}`;
}

/** `['npm','@nestjs','core']` -> `npm:@nestjs/core` */
export function keyFromSegments(segments: string[]): string | null {
  if (segments.length < 2) return null;
  const [ecosystem, ...rest] = segments;
  if (ecosystem !== 'npm' && ecosystem !== 'pypi') return null;
  const name = rest.map((segment) => decodeURIComponent(segment)).join('/');
  return name.length > 0 ? `${ecosystem}:${name}` : null;
}

export const TIER_LABEL: Record<string, string> = {
  critical: 'Tier 1',
  high: 'Tier 2',
  standard: 'Tier 3',
};
