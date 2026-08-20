/**
 * The domain vocabulary, shared by the seed script, the query layer and the UI.
 *
 * These types describe *plain* objects. Nothing that crosses the query
 * boundary carries a driver class instance: Node, Relationship and Path are
 * mapped to these shapes inside each query module so results can be handed
 * straight to a Server Component and, from there, to the client.
 */

export const ECOSYSTEMS = ['npm', 'pypi'] as const;
export type Ecosystem = (typeof ECOSYSTEMS)[number];

export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const DEPENDENCY_SCOPES = ['runtime', 'dev', 'optional'] as const;
export type DependencyScope = (typeof DEPENDENCY_SCOPES)[number];

export const LICENSE_CATEGORIES = [
  'public-domain',
  'permissive',
  'weak-copyleft',
  'strong-copyleft',
  'network-copyleft',
] as const;
export type LicenseCategory = (typeof LICENSE_CATEGORIES)[number];

/** Categories that oblige a distributor to publish source. */
export const RECIPROCAL_CATEGORIES: readonly LicenseCategory[] = [
  'weak-copyleft',
  'strong-copyleft',
  'network-copyleft',
];

export const TIERS = ['critical', 'high', 'standard'] as const;
export type ApplicationTier = (typeof TIERS)[number];

// ── Node shapes ──────────────────────────────────────────────────────────────

export type Application = {
  slug: string;
  name: string;
  team: string;
  tier: ApplicationTier;
  runtime: string;
  purpose: string;
  /** ISO date. */
  firstShipped: string;
};

export type Package = {
  /** `<ecosystem>:<name>` — the natural key, unique across the graph. */
  key: string;
  ecosystem: Ecosystem;
  name: string;
  role: string;
  /** Rough popularity signal, used for ordering and for the "how load-bearing" read. */
  weeklyDownloads: number;
  deprecated: boolean;
};

export type PackageVersion = {
  /** `<ecosystem>:<name>@<version>` — the natural key. */
  key: string;
  ecosystem: Ecosystem;
  /** Denormalised from the parent Package so a path can be rendered without a second hop. */
  name: string;
  version: string;
  /** ISO date. */
  published: string;
  /** Sortable integer, `major * 1e6 + minor * 1e3 + patch`. */
  ordinal: number;
};

export type Maintainer = {
  handle: string;
  name: string;
  /** ISO date the account was created. */
  joined: string;
  twoFactorEnabled: boolean;
  /** Self-declared affiliation; `null` for unaffiliated volunteers. */
  affiliation: string | null;
};

export type Advisory = {
  id: string;
  title: string;
  severity: Severity;
  /** 0.0–10.0, CVSS-shaped. */
  score: number;
  /** Common Weakness Enumeration label, e.g. "Prototype pollution". */
  weakness: string;
  summary: string;
  published: string;
  /** Every advisory in this dataset is invented. Rendered wherever it could be mistaken for real. */
  synthetic: true;
};

export type License = {
  spdxId: string;
  name: string;
  category: LicenseCategory;
  note: string;
};

// ── Relationship shapes ──────────────────────────────────────────────────────

export type DependencyEdge = {
  /** Application slug or PackageVersion key. */
  from: string;
  /** PackageVersion key. */
  to: string;
  scope: DependencyScope;
  /** The declared semver/PEP 440 range that resolved to `to`. */
  range: string;
};

export type MaintainerEdge = {
  packageKey: string;
  handle: string;
  role: 'owner' | 'publisher';
  since: string;
};

export type AffectsEdge = {
  advisoryId: string;
  versionKey: string;
  /** The first version in which the flaw was introduced, when known. */
  introducedIn: string | null;
  /** The version that fixes it, when one exists. */
  fixedIn: string | null;
};

export type LicenseEdge = {
  versionKey: string;
  spdxId: string;
};

export type SupersededEdge = {
  /** Deprecated package key. */
  from: string;
  /** Recommended replacement package key. */
  to: string;
  reason: string;
};

// ── The whole graph, as the seed script hands it to the loader ───────────────

export type GraphDataset = {
  applications: Application[];
  packages: Package[];
  versions: PackageVersion[];
  maintainers: Maintainer[];
  advisories: Advisory[];
  licenses: License[];
  /** `from` is an Application slug. */
  applicationDependencies: DependencyEdge[];
  /** `from` is a PackageVersion key. */
  versionDependencies: DependencyEdge[];
  maintenance: MaintainerEdge[];
  affects: AffectsEdge[];
  licensing: LicenseEdge[];
  supersessions: SupersededEdge[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function packageKey(ecosystem: Ecosystem, name: string): string {
  return `${ecosystem}:${name}`;
}

export function versionKey(ecosystem: Ecosystem, name: string, version: string): string {
  return `${ecosystem}:${name}@${version}`;
}

export function versionOrdinal(version: string): number {
  const [major = '0', minor = '0', patch = '0'] = version.split('.');
  return Number(major) * 1_000_000 + Number(minor) * 1_000 + Number(patch);
}

export function isSeverity(value: string): value is Severity {
  return (SEVERITIES as readonly string[]).includes(value);
}

export function isEcosystem(value: string): value is Ecosystem {
  return (ECOSYSTEMS as readonly string[]).includes(value);
}
