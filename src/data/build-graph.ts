import { ADVISORIES, type AdvisorySeed } from './advisories';
import { CATALOG, SUPERSESSIONS, type CatalogEntry } from './catalog';
import { LICENSES } from './licenses';
import {
  AFFILIATIONS,
  APPLICATIONS,
  CHOKEPOINT_MAINTAINERS,
  FAMILY_NAMES,
  GIVEN_NAMES,
} from './organisation';
import {
  packageKey,
  versionKey,
  versionOrdinal,
  type AffectsEdge,
  type DependencyEdge,
  type Ecosystem,
  type GraphDataset,
  type License,
  type LicenseEdge,
  type Maintainer,
  type MaintainerEdge,
  type Package,
  type PackageVersion,
  type SupersededEdge,
} from './model';

/**
 * Builds the whole graph deterministically from the authored catalogue.
 *
 * Determinism is not a nicety here: the seed script, the README figures, the
 * screenshots and the demo script all have to agree, and a reviewer who runs
 * `npm run db:seed` a week later has to get the same graph we describe. The
 * only source of variation is the integer seed, and it is a constant.
 *
 * Two structural invariants hold by construction:
 *
 *  1. **Dependencies only ever point from a lower tier to a strictly higher
 *     one.** The dependency graph is therefore acyclic, which is what makes a
 *     bounded variable-length traversal safe on a 0.5 vCPU instance.
 *  2. **Dependencies never cross ecosystems.** An npm package cannot depend on
 *     a PyPI distribution, and the applications inherit the ecosystem of their
 *     runtime.
 */

const SEED = 20_260_820;

/** mulberry32 — small, fast, and good enough for reproducible fixture data. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

function pickInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('pick() called with an empty list');
  return item;
}

/** Chooses `count` distinct members of `items`, weighted by `weight`. */
function pickWeighted<T>(rng: Rng, items: readonly T[], count: number, weight: (item: T) => number): T[] {
  const pool = items.map((item) => ({ item, key: Math.pow(rng(), 1 / Math.max(weight(item), 0.0001)) }));
  pool.sort((a, b) => b.key - a.key);
  return pool.slice(0, Math.min(count, pool.length)).map((entry) => entry.item);
}

// ── Version ladders ──────────────────────────────────────────────────────────

type Semver = [number, number, number];

function parseVersion(version: string): Semver {
  const [major = '0', minor = '0', patch = '0'] = version.split('.');
  return [Number(major), Number(minor), Number(patch)];
}

function formatVersion([major, minor, patch]: Semver): string {
  return `${major}.${minor}.${patch}`;
}

function bumpVersion(version: Semver, rng: Rng): Semver {
  const roll = rng();
  const [major, minor, patch] = version;
  if (roll < 0.62) return [major, minor, patch + pickInt(rng, 1, 3)];
  if (roll < 0.92) return [major, minor + 1, 0];
  return [major + 1, 0, 0];
}

function stepDown(version: Semver, rng: Rng): Semver {
  const [major, minor, patch] = version;
  if (patch > 0) return [major, minor, Math.max(0, patch - pickInt(rng, 1, 2))];
  if (minor > 0) return [major, minor - 1, pickInt(rng, 0, 6)];
  if (major > 0) return [major - 1, pickInt(rng, 0, 9), pickInt(rng, 0, 6)];
  return [0, 0, 0];
}

/** Versions strictly between `low` and `high`, bumping patch or minor only. */
function versionsBetween(low: string, high: string, want: number, rng: Rng): string[] {
  const out: string[] = [];
  const ceiling = versionOrdinal(high);
  let cursor = parseVersion(low);
  for (let i = 0; i < want; i += 1) {
    const [major, minor, patch] = cursor;
    const next: Semver = rng() < 0.72 ? [major, minor, patch + pickInt(rng, 1, 3)] : [major, minor + 1, 0];
    if (versionOrdinal(formatVersion(next)) >= ceiling) break;
    out.push(formatVersion(next));
    cursor = next;
  }
  return out;
}

/**
 * Produces an ascending list of versions for one package.
 *
 * When the package carries advisories, the versions those advisories name
 * (`introducedIn`, `fixedIn`) are guaranteed to appear, the vulnerable band
 * between them is widened to several releases, and **at most one release is
 * added above the fix**. That last constraint is the important one: it puts
 * the vulnerable range near the head of the ladder, which is what a real
 * estate looks like in the weeks after an advisory lands — the fix exists,
 * and most lockfiles have not moved yet.
 */
function buildVersionLadder(entry: CatalogEntry, anchors: readonly string[], rng: Rng): string[] {
  const target = 4 + entry.reach + pickInt(rng, 0, 3);

  if (anchors.length === 0) {
    let current: Semver = [pickInt(rng, 0, 6), pickInt(rng, 0, 9), pickInt(rng, 0, 12)];
    const out: string[] = [formatVersion(current)];
    while (out.length < target) {
      current = bumpVersion(current, rng);
      out.push(formatVersion(current));
    }
    return out;
  }

  const sortedAnchors = [...new Set(anchors)].sort((a, b) => versionOrdinal(a) - versionOrdinal(b));
  const lowest = sortedAnchors[0] as string;
  const highest = sortedAnchors[sortedAnchors.length - 1] as string;

  // Widen the vulnerable band so an advisory covers a range of releases
  // rather than a single point.
  const intermediates: string[] = [];
  for (let i = 0; i < sortedAnchors.length - 1; i += 1) {
    intermediates.push(
      ...versionsBetween(sortedAnchors[i] as string, sortedAnchors[i + 1] as string, pickInt(rng, 2, 4), rng),
    );
  }

  // At most one release after the newest anchor.
  const above: string[] = [];
  if (rng() < 0.55) {
    const [major, minor, patch] = parseVersion(highest);
    above.push(formatVersion(rng() < 0.7 ? [major, minor, patch + pickInt(rng, 1, 2)] : [major, minor + 1, 0]));
  }

  const core = [...new Set([...sortedAnchors, ...intermediates, ...above])];

  // Everything else fills in beneath the earliest anchor.
  const below: string[] = [];
  let cursor = parseVersion(lowest);
  const wantBelow = Math.max(2, target - core.length);
  for (let i = 0; i < wantBelow; i += 1) {
    cursor = stepDown(cursor, rng);
    below.unshift(formatVersion(cursor));
  }

  return [...new Set([...below, ...core])].sort((a, b) => versionOrdinal(a) - versionOrdinal(b));
}

// ── Licence assignment ───────────────────────────────────────────────────────

const LICENSE_WEIGHTS: ReadonlyArray<[string, number]> = [
  ['MIT', 44],
  ['Apache-2.0', 17],
  ['ISC', 12],
  ['BSD-3-Clause', 8],
  ['BSD-2-Clause', 4],
  ['Python-2.0', 3],
  ['MPL-2.0', 4],
  ['LGPL-3.0', 3],
  ['GPL-3.0', 2],
  ['AGPL-3.0', 2],
  ['Unlicense', 1],
];

const LICENSE_TOTAL = LICENSE_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);

function rollLicense(rng: Rng): string {
  let roll = rng() * LICENSE_TOTAL;
  for (const [spdxId, weight] of LICENSE_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return spdxId;
  }
  return 'MIT';
}

/**
 * Packages that changed licence mid-life.
 *
 * This is the shape that makes licence review a traversal problem rather than
 * a lookup: the package is fine at the version you audited and not fine at the
 * version your lockfile actually resolved.
 */
const RELICENSED: ReadonlyArray<{ packageKey: string; from: string; to: string; atIndex: number }> = [
  { packageKey: 'npm:sharp', from: 'Apache-2.0', to: 'LGPL-3.0', atIndex: 3 },
  { packageKey: 'npm:node-forge', from: 'BSD-3-Clause', to: 'GPL-3.0', atIndex: 4 },
  { packageKey: 'pypi:elasticsearch', from: 'Apache-2.0', to: 'AGPL-3.0', atIndex: 3 },
];

// ── The build ────────────────────────────────────────────────────────────────

export type BuildReport = {
  seed: number;
  /** How many dependency resolutions the exposure guarantee had to move. */
  retargets: number;
  counts: {
    applications: number;
    packages: number;
    versions: number;
    maintainers: number;
    advisories: number;
    licenses: number;
    nodes: number;
    relationships: number;
  };
  /** Applications reached, per advisory, by bounded traversal over the built edges. */
  advisoryReach: Array<{ id: string; severity: string; applications: number; minimumDepth: number }>;
  /** Distribution of shortest depths across every application/version pair the traversal reaches. */
  depthHistogram: Array<{ depth: number; pairs: number }>;
  /** Sole maintainers without a second factor, ordered by how much of the estate they sit under. */
  chokepoints: Array<{ handle: string; applications: number; packages: number }>;
};

export type BuiltGraph = GraphDataset & { report: BuildReport };

const DEV_ONLY = new Set([
  'npm:jest',
  'npm:vitest',
  'npm:eslint',
  'npm:playwright',
  'npm:cypress',
  'npm:tslint',
  'npm:nyc',
  'npm:node-sass',
  'npm:sass',
  'pypi:pytest',
  'pypi:nose',
]);

/**
 * Shortest depth from every application to every reachable package version.
 *
 * Deliberately the same shape as the Cypher the application runs: breadth-first
 * from an application's direct dependencies, bounded at `MAX_TRAVERSAL_DEPTH`.
 * Having it here lets the seed reason about the graph it is about to write.
 */
export const MAX_TRAVERSAL_DEPTH = 8;

function computeDepths(
  applications: readonly { slug: string }[],
  applicationDependencies: readonly DependencyEdge[],
  versionDependencies: readonly DependencyEdge[],
): Map<string, Map<string, number>> {
  const adjacency = new Map<string, string[]>();
  for (const edge of versionDependencies) {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge.to);
    adjacency.set(edge.from, list);
  }

  const depthByVersion = new Map<string, Map<string, number>>();

  for (const application of applications) {
    const seenDepth = new Map<string, number>();
    let frontier = [
      ...new Set(
        applicationDependencies.filter((edge) => edge.from === application.slug).map((edge) => edge.to),
      ),
    ];
    let depth = 1;
    for (const key of frontier) seenDepth.set(key, depth);

    while (frontier.length > 0 && depth < MAX_TRAVERSAL_DEPTH) {
      const next: string[] = [];
      for (const key of frontier) {
        for (const child of adjacency.get(key) ?? []) {
          if (!seenDepth.has(child)) {
            seenDepth.set(child, depth + 1);
            next.push(child);
          }
        }
      }
      frontier = next;
      depth += 1;
    }

    for (const [key, reachedAt] of seenDepth) {
      const perApp = depthByVersion.get(key) ?? new Map<string, number>();
      perApp.set(application.slug, reachedAt);
      depthByVersion.set(key, perApp);
    }
  }

  return depthByVersion;
}

/**
 * Guarantees the advisories the demo is built around actually have exposure.
 *
 * Version resolution above is probabilistic, so whether a given application
 * happens to sit on a vulnerable release is a matter of chance. For the
 * handful of advisories the README, the screenshots and the demo script all
 * point at, chance is not good enough.
 *
 * This step never invents an edge. It only *retargets* an existing dependency
 * from one release of a package to an earlier release of the same package —
 * which is precisely the difference between two lockfiles of the same estate.
 * It stops the moment the stated minimum is met, so most of the graph stays
 * exactly as the distribution produced it.
 */
function ensureExposure(
  applications: readonly { slug: string }[],
  applicationDependencies: DependencyEdge[],
  versionDependencies: DependencyEdge[],
  affectedVersionsByAdvisory: ReadonlyMap<string, readonly PackageVersion[]>,
  allVersionsByPackage: ReadonlyMap<string, readonly PackageVersion[]>,
  seeds: readonly AdvisorySeed[],
): number {
  let retargets = 0;

  for (const advisory of seeds) {
    const required = advisory.minimumApplicationsReached ?? 0;
    if (required === 0) continue;

    const affected = affectedVersionsByAdvisory.get(advisory.id) ?? [];
    if (affected.length === 0) continue;
    const affectedKeys = new Set(affected.map((version) => version.key));
    // Prefer the newest vulnerable release: the most plausible thing for a
    // lockfile written just before the fix to be sitting on.
    const preferred = [...affected].sort((a, b) => b.ordinal - a.ordinal)[0] as PackageVersion;

    const siblingKeys = new Set(
      (allVersionsByPackage.get(advisory.packageKey) ?? [])
        .filter((version) => !affectedKeys.has(version.key))
        .map((version) => version.key),
    );

    for (let attempt = 0; attempt < 24; attempt += 1) {
      const depths = computeDepths(applications, applicationDependencies, versionDependencies);
      const reached = new Set<string>();
      for (const key of affectedKeys) {
        for (const slug of depths.get(key)?.keys() ?? []) reached.add(slug);
      }
      if (reached.size >= required) break;

      const missing = applications
        .map((application) => application.slug)
        .filter((slug) => !reached.has(slug))
        .sort();
      const targetApp = missing[0];
      if (!targetApp) break;

      // Which nodes can this application actually see? Its own direct
      // dependencies, plus everything beneath them.
      const visible = new Set<string>(
        applicationDependencies.filter((edge) => edge.from === targetApp).map((edge) => edge.to),
      );
      for (const [key, perApp] of depths) {
        if (perApp.has(targetApp)) visible.add(key);
      }

      const directCandidate = applicationDependencies
        .filter((edge) => edge.from === targetApp && siblingKeys.has(edge.to))
        .sort((a, b) => a.to.localeCompare(b.to))[0];

      if (directCandidate) {
        directCandidate.to = preferred.key;
        directCandidate.range = `^${preferred.version}`;
        retargets += 1;
        continue;
      }

      const transitiveCandidate = versionDependencies
        .filter((edge) => siblingKeys.has(edge.to) && visible.has(edge.from))
        .sort((a, b) => `${a.from}->${a.to}`.localeCompare(`${b.from}->${b.to}`))[0];

      if (transitiveCandidate) {
        transitiveCandidate.to = preferred.key;
        transitiveCandidate.range = `^${preferred.version}`;
        retargets += 1;
        continue;
      }

      // Nothing this application can see depends on the package at all. Give
      // it the dependency the only honest way: through a package it already
      // uses, at the newest vulnerable release.
      const bridge = versionDependencies
        .filter((edge) => visible.has(edge.from) && edge.from !== preferred.key)
        .sort((a, b) => `${a.from}->${a.to}`.localeCompare(`${b.from}->${b.to}`))[0];
      if (!bridge) break;
      versionDependencies.push({
        from: bridge.from,
        to: preferred.key,
        scope: 'runtime',
        range: `^${preferred.version}`,
      });
      retargets += 1;
    }
  }

  return retargets;
}

export function buildGraph(seed: number = SEED): BuiltGraph {
  const rng = makeRandom(seed);

  // ── Packages ───────────────────────────────────────────────────────────────
  const packages: Package[] = CATALOG.map((entry) => ({
    key: packageKey(entry.ecosystem, entry.name),
    ecosystem: entry.ecosystem,
    name: entry.name,
    role: entry.role,
    weeklyDownloads: Math.round(
      Math.pow(10, 2.6 + entry.reach * 0.92) * (0.55 + rng() * 0.9),
    ),
    deprecated: entry.deprecated === true,
  }));

  const catalogByKey = new Map(CATALOG.map((entry) => [packageKey(entry.ecosystem, entry.name), entry]));
  const duplicateKeys = packages.length - new Set(packages.map((p) => p.key)).size;
  if (duplicateKeys > 0) throw new Error(`Catalogue contains ${duplicateKeys} duplicate package keys`);

  // ── Versions ───────────────────────────────────────────────────────────────
  const anchorsByPackage = new Map<string, string[]>();
  for (const advisory of ADVISORIES) {
    const anchors = anchorsByPackage.get(advisory.packageKey) ?? [];
    if (advisory.introducedIn) anchors.push(advisory.introducedIn);
    if (advisory.fixedIn) anchors.push(advisory.fixedIn);
    anchorsByPackage.set(advisory.packageKey, anchors);
    if (!catalogByKey.has(advisory.packageKey)) {
      throw new Error(`Advisory ${advisory.id} names an unknown package: ${advisory.packageKey}`);
    }
  }

  const versions: PackageVersion[] = [];
  const versionsByPackage = new Map<string, PackageVersion[]>();

  for (const pkg of packages) {
    const entry = catalogByKey.get(pkg.key);
    if (!entry) throw new Error(`No catalogue entry for ${pkg.key}`);
    const ladder = buildVersionLadder(entry, anchorsByPackage.get(pkg.key) ?? [], rng);
    const releaseYearStart = 2019 + pickInt(rng, 0, 2);
    const built = ladder.map((version, index) => {
      const monthsIn = Math.round((index / Math.max(ladder.length - 1, 1)) * 66) + pickInt(rng, 0, 2);
      const published = new Date(Date.UTC(releaseYearStart, monthsIn, 1 + pickInt(rng, 0, 27)));
      return {
        key: versionKey(pkg.ecosystem, pkg.name, version),
        ecosystem: pkg.ecosystem,
        name: pkg.name,
        version,
        published: published.toISOString().slice(0, 10),
        ordinal: versionOrdinal(version),
      } satisfies PackageVersion;
    });
    versions.push(...built);
    versionsByPackage.set(pkg.key, built);
  }

  // ── Maintainers ────────────────────────────────────────────────────────────
  const maintainers: Maintainer[] = [];
  const maintenance: MaintainerEdge[] = [];
  const soleOwned = new Set<string>();

  for (const chokepoint of CHOKEPOINT_MAINTAINERS) {
    maintainers.push({
      handle: chokepoint.handle,
      name: chokepoint.name,
      joined: chokepoint.joined,
      twoFactorEnabled: false,
      affiliation: chokepoint.affiliation,
    });
    for (const key of chokepoint.owns) {
      if (!catalogByKey.has(key)) throw new Error(`Chokepoint maintainer owns unknown package ${key}`);
      maintenance.push({
        packageKey: key,
        handle: chokepoint.handle,
        role: 'owner',
        since: chokepoint.joined,
      });
      soleOwned.add(key);
    }
  }

  const generatedCount = 168;
  const usedHandles = new Set(maintainers.map((m) => m.handle));
  for (let i = 0; i < generatedCount; i += 1) {
    const given = pick(rng, GIVEN_NAMES);
    const family = pick(rng, FAMILY_NAMES);
    const base = `${given.toLowerCase().replace(/[^a-z]/g, '')}-${family.toLowerCase().replace(/[^a-z]/g, '')}`;
    let handle = base;
    let suffix = 2;
    while (usedHandles.has(handle)) {
      handle = `${base}${suffix}`;
      suffix += 1;
    }
    usedHandles.add(handle);
    maintainers.push({
      handle,
      name: `${given} ${family}`,
      joined: new Date(Date.UTC(2009 + pickInt(rng, 0, 14), pickInt(rng, 0, 11), 1 + pickInt(rng, 0, 27)))
        .toISOString()
        .slice(0, 10),
      twoFactorEnabled: rng() < 0.79,
      affiliation: pick(rng, AFFILIATIONS),
    });
  }

  const assignable = maintainers.filter((m) => !CHOKEPOINT_MAINTAINERS.some((c) => c.handle === m.handle));
  for (const pkg of packages) {
    if (soleOwned.has(pkg.key)) continue;
    const entry = catalogByKey.get(pkg.key);
    const tier = entry?.tier ?? 3;
    // Widely used, application-facing packages tend to have more hands on them.
    const roll = rng();
    const count = tier <= 2 ? (roll < 0.15 ? 1 : pickInt(rng, 2, 5)) : roll < 0.42 ? 1 : pickInt(rng, 2, 3);
    const chosen = pickWeighted(rng, assignable, count, (m) =>
      // A handful of prolific maintainers should own a disproportionate share,
      // which is what the registry actually looks like.
      m.handle.charCodeAt(0) % 7 === 0 ? 3.2 : 1,
    );
    chosen.forEach((maintainer, index) => {
      maintenance.push({
        packageKey: pkg.key,
        handle: maintainer.handle,
        role: index === 0 ? 'owner' : 'publisher',
        since: maintainer.joined,
      });
    });
  }

  // ── Licences ───────────────────────────────────────────────────────────────
  const licensing: LicenseEdge[] = [];
  const relicensedByKey = new Map(RELICENSED.map((entry) => [entry.packageKey, entry]));
  const licenseIds = new Set(LICENSES.map((license: License) => license.spdxId));

  for (const pkg of packages) {
    const ladder = versionsByPackage.get(pkg.key) ?? [];
    const change = relicensedByKey.get(pkg.key);
    if (change) {
      if (!licenseIds.has(change.from) || !licenseIds.has(change.to)) {
        throw new Error(`Relicensing for ${pkg.key} names an unknown SPDX id`);
      }
      ladder.forEach((version, index) => {
        licensing.push({ versionKey: version.key, spdxId: index < change.atIndex ? change.from : change.to });
      });
      continue;
    }
    const base = pkg.ecosystem === 'pypi' && rng() < 0.16 ? 'Python-2.0' : rollLicense(rng);
    for (const version of ladder) {
      licensing.push({ versionKey: version.key, spdxId: base });
    }
  }

  // ── Dependencies ───────────────────────────────────────────────────────────
  type CatalogItem = CatalogEntry & { ecosystem: Ecosystem };
  const byEcosystemAndTier = new Map<string, CatalogItem[]>();
  for (const entry of CATALOG) {
    const bucket = `${entry.ecosystem}:${entry.tier}`;
    const list = byEcosystemAndTier.get(bucket) ?? [];
    list.push(entry);
    byEcosystemAndTier.set(bucket, list);
  }

  function candidatesAbove(ecosystem: Ecosystem, tier: number): CatalogItem[] {
    const out: CatalogItem[] = [];
    for (let t = tier + 1; t <= 6; t += 1) {
      out.push(...(byEcosystemAndTier.get(`${ecosystem}:${t}`) ?? []));
    }
    return out;
  }

  /** Resolves a target package to one of its versions, biased toward — but not pinned to — the newest. */
  function resolveVersion(targetKey: string): PackageVersion {
    const ladder = versionsByPackage.get(targetKey);
    if (!ladder || ladder.length === 0) throw new Error(`No versions built for ${targetKey}`);
    // Geometric decay back from the newest release. Most consumers are on or
    // near the head; a long tail is not, which is the whole reason an estate
    // has exposure at all. Modelling that as a distribution rather than a
    // coin flip keeps the vulnerable ranges populated without hand-placing
    // a single edge.
    let back = 0;
    while (back < ladder.length - 1 && rng() < 0.58) back += 1;
    return ladder[ladder.length - 1 - back] as PackageVersion;
  }

  function rangeFor(version: string, rng2: Rng): string {
    const [major, minor] = parseVersion(version);
    const roll = rng2();
    if (roll < 0.62) return `^${version}`;
    if (roll < 0.82) return `~${version}`;
    if (roll < 0.93) return `>=${major}.${minor}.0 <${major + 1}.0.0`;
    return version;
  }

  const versionDependencies: DependencyEdge[] = [];
  const seenVersionEdges = new Set<string>();

  const depCountByTier: Record<number, [number, number]> = {
    1: [4, 9],
    2: [3, 7],
    3: [2, 5],
    4: [1, 3],
    5: [0, 2],
    6: [0, 0],
  };

  for (const pkg of packages) {
    const entry = catalogByKey.get(pkg.key);
    if (!entry) continue;
    const [minDeps, maxDeps] = depCountByTier[entry.tier] ?? [0, 2];
    if (maxDeps === 0) continue;
    const pool = candidatesAbove(entry.ecosystem, entry.tier);
    if (pool.length === 0) continue;

    for (const version of versionsByPackage.get(pkg.key) ?? []) {
      const count = pickInt(rng, minDeps, maxDeps);
      // Registries stratify: a framework mostly depends on the layer directly
      // beneath it and only occasionally reaches further down. Weighting by
      // tier proximity as well as reach is what gives the graph real depth —
      // without it every leaf is two hops from every application and the
      // multi-hop queries have nothing to traverse.
      const targets = pickWeighted(rng, pool, count, (candidate) => {
        const gap = candidate.tier - entry.tier;
        const proximity = gap === 1 ? 3.4 : gap === 2 ? 1.1 : 0.28;
        return candidate.reach * proximity;
      });
      for (const target of targets) {
        const targetKey = packageKey(target.ecosystem, target.name);
        if (DEV_ONLY.has(targetKey)) continue;
        const resolved = resolveVersion(targetKey);
        const edgeId = `${version.key}->${resolved.key}`;
        if (seenVersionEdges.has(edgeId)) continue;
        seenVersionEdges.add(edgeId);
        versionDependencies.push({
          from: version.key,
          to: resolved.key,
          scope: 'runtime',
          range: rangeFor(resolved.version, rng),
        });
      }
    }
  }

  // ── Applications ───────────────────────────────────────────────────────────
  const applicationDependencies: DependencyEdge[] = [];
  const seenAppEdges = new Set<string>();

  for (const application of APPLICATIONS) {
    const ecosystem: Ecosystem = application.runtime.startsWith('Python') ? 'pypi' : 'npm';
    const runtimePool = CATALOG.filter(
      (entry) => entry.ecosystem === ecosystem && entry.tier <= 2 && !DEV_ONLY.has(packageKey(entry.ecosystem, entry.name)),
    );
    const devPool = CATALOG.filter(
      (entry) => entry.ecosystem === ecosystem && DEV_ONLY.has(packageKey(entry.ecosystem, entry.name)),
    );

    const runtimeCount = application.tier === 'standard' ? pickInt(rng, 7, 11) : pickInt(rng, 10, 16);
    for (const target of pickWeighted(rng, runtimePool, runtimeCount, (entry) => entry.reach)) {
      const targetKey = packageKey(target.ecosystem, target.name);
      const resolved = resolveVersion(targetKey);
      const edgeId = `${application.slug}->${resolved.key}`;
      if (seenAppEdges.has(edgeId)) continue;
      seenAppEdges.add(edgeId);
      applicationDependencies.push({
        from: application.slug,
        to: resolved.key,
        scope: 'runtime',
        range: rangeFor(resolved.version, rng),
      });
    }

    for (const target of pickWeighted(rng, devPool, pickInt(rng, 2, 4), (entry) => entry.reach)) {
      const targetKey = packageKey(target.ecosystem, target.name);
      const resolved = resolveVersion(targetKey);
      const edgeId = `${application.slug}->${resolved.key}`;
      if (seenAppEdges.has(edgeId)) continue;
      seenAppEdges.add(edgeId);
      applicationDependencies.push({
        from: application.slug,
        to: resolved.key,
        scope: 'dev',
        range: rangeFor(resolved.version, rng),
      });
    }
  }

  // ── Advisories ─────────────────────────────────────────────────────────────
  const affects: AffectsEdge[] = [];
  for (const advisory of ADVISORIES) {
    const ladder = versionsByPackage.get(advisory.packageKey) ?? [];
    const introducedOrdinal = advisory.introducedIn ? versionOrdinal(advisory.introducedIn) : 0;
    const fixedOrdinal = advisory.fixedIn ? versionOrdinal(advisory.fixedIn) : Number.POSITIVE_INFINITY;
    const affected = ladder.filter(
      (version) => version.ordinal >= introducedOrdinal && version.ordinal < fixedOrdinal,
    );
    if (affected.length === 0) {
      throw new Error(
        `Advisory ${advisory.id} matched no version of ${advisory.packageKey}. Ladder: ${ladder
          .map((v) => v.version)
          .join(', ')}`,
      );
    }
    for (const version of affected) {
      affects.push({
        advisoryId: advisory.id,
        versionKey: version.key,
        introducedIn: advisory.introducedIn,
        fixedIn: advisory.fixedIn,
      });
    }
  }

  const affectedVersionsByAdvisory = new Map<string, PackageVersion[]>();
  for (const edge of affects) {
    const list = affectedVersionsByAdvisory.get(edge.advisoryId) ?? [];
    const version = versions.find((candidate) => candidate.key === edge.versionKey);
    if (version) list.push(version);
    affectedVersionsByAdvisory.set(edge.advisoryId, list);
  }

  const retargets = ensureExposure(
    APPLICATIONS,
    applicationDependencies,
    versionDependencies,
    affectedVersionsByAdvisory,
    versionsByPackage,
    ADVISORIES,
  );

  const supersessions: SupersededEdge[] = SUPERSESSIONS.map((entry): SupersededEdge => {
    if (!catalogByKey.has(entry.from) || !catalogByKey.has(entry.to)) {
      throw new Error(`Supersession references an unknown package: ${entry.from} → ${entry.to}`);
    }
    return { from: entry.from, to: entry.to, reason: entry.reason };
  });

  // ── Verification ───────────────────────────────────────────────────────────
  const report = verify({
    applications: [...APPLICATIONS],
    packages,
    versions,
    maintainers,
    advisories: ADVISORIES.map((advisory) => ({
      id: advisory.id,
      title: advisory.title,
      severity: advisory.severity,
      score: advisory.score,
      weakness: advisory.weakness,
      summary: advisory.summary,
      published: advisory.published,
      synthetic: true as const,
    })),
    licenses: [...LICENSES],
    applicationDependencies,
    versionDependencies,
    maintenance,
    affects,
    licensing,
    supersessions,
  }, ADVISORIES, seed, retargets);

  return {
    applications: [...APPLICATIONS],
    packages,
    versions,
    maintainers,
    advisories: ADVISORIES.map((advisory) => ({
      id: advisory.id,
      title: advisory.title,
      severity: advisory.severity,
      score: advisory.score,
      weakness: advisory.weakness,
      summary: advisory.summary,
      published: advisory.published,
      synthetic: true as const,
    })),
    licenses: [...LICENSES],
    applicationDependencies,
    versionDependencies,
    maintenance,
    affects,
    licensing,
    supersessions,
    report,
  };
}

/**
 * Walks the built graph before it is ever written to the database.
 *
 * The traversal here is deliberately the same shape as the Cypher the
 * application runs, so the seed can assert that the dataset still demonstrates
 * what the README says it demonstrates. A fixture that silently stops
 * exercising the interesting queries is a slow-motion failure.
 */
function verify(
  dataset: GraphDataset,
  seeds: readonly AdvisorySeed[],
  seed: number,
  retargets: number,
): BuildReport {
  const depthByVersion = computeDepths(
    dataset.applications,
    dataset.applicationDependencies,
    dataset.versionDependencies,
  );

  const advisoryReach: BuildReport['advisoryReach'] = [];
  const problems: string[] = [];

  for (const advisory of seeds) {
    const versionKeys = dataset.affects
      .filter((edge) => edge.advisoryId === advisory.id)
      .map((edge) => edge.versionKey);

    const apps = new Set<string>();
    let minimumDepth = Number.POSITIVE_INFINITY;
    for (const key of versionKeys) {
      for (const [slug, depth] of depthByVersion.get(key) ?? []) {
        apps.add(slug);
        minimumDepth = Math.min(minimumDepth, depth);
      }
    }

    advisoryReach.push({
      id: advisory.id,
      severity: advisory.severity,
      applications: apps.size,
      minimumDepth: Number.isFinite(minimumDepth) ? minimumDepth : 0,
    });

    const required = advisory.minimumApplicationsReached ?? 0;
    if (apps.size < required) {
      problems.push(
        `${advisory.id} reaches ${apps.size} application(s); the dataset requires at least ${required}.`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `The generated dataset no longer demonstrates what it claims to:\n  - ${problems.join('\n  - ')}\n` +
        'Adjust the catalogue or the seed constant in src/data/build-graph.ts.',
    );
  }

  // Sole maintainers without a second factor, ranked by downstream reach.
  const maintainersByPackage = new Map<string, string[]>();
  for (const edge of dataset.maintenance) {
    const list = maintainersByPackage.get(edge.packageKey) ?? [];
    list.push(edge.handle);
    maintainersByPackage.set(edge.packageKey, list);
  }
  const maintainerByHandle = new Map(dataset.maintainers.map((m) => [m.handle, m]));
  const versionToPackage = new Map(
    dataset.versions.map((version) => [version.key, `${version.ecosystem}:${version.name}`]),
  );

  const reachByMaintainer = new Map<string, { apps: Set<string>; packages: Set<string> }>();
  for (const [versionKeyValue, perApp] of depthByVersion) {
    const owningPackage = versionToPackage.get(versionKeyValue);
    if (!owningPackage) continue;
    const handles = maintainersByPackage.get(owningPackage) ?? [];
    if (handles.length !== 1) continue;
    const handle = handles[0] as string;
    if (maintainerByHandle.get(handle)?.twoFactorEnabled !== false) continue;
    const bucket = reachByMaintainer.get(handle) ?? { apps: new Set<string>(), packages: new Set<string>() };
    bucket.packages.add(owningPackage);
    for (const slug of perApp.keys()) bucket.apps.add(slug);
    reachByMaintainer.set(handle, bucket);
  }

  const chokepoints = [...reachByMaintainer.entries()]
    .map(([handle, bucket]) => ({
      handle,
      applications: bucket.apps.size,
      packages: bucket.packages.size,
    }))
    .sort((a, b) => b.applications - a.applications || b.packages - a.packages)
    .slice(0, 10);

  const nodes =
    dataset.applications.length +
    dataset.packages.length +
    dataset.versions.length +
    dataset.maintainers.length +
    dataset.advisories.length +
    dataset.licenses.length;

  const relationships =
    dataset.applicationDependencies.length +
    dataset.versionDependencies.length +
    dataset.versions.length + // VERSION_OF
    dataset.maintenance.length +
    dataset.affects.length +
    dataset.licensing.length +
    dataset.supersessions.length;

  const depthCounts = new Map<number, number>();
  for (const perApp of depthByVersion.values()) {
    for (const depth of perApp.values()) {
      depthCounts.set(depth, (depthCounts.get(depth) ?? 0) + 1);
    }
  }

  return {
    seed,
    retargets,
    depthHistogram: [...depthCounts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([depth, pairs]) => ({ depth, pairs })),
    counts: {
      applications: dataset.applications.length,
      packages: dataset.packages.length,
      versions: dataset.versions.length,
      maintainers: dataset.maintainers.length,
      advisories: dataset.advisories.length,
      licenses: dataset.licenses.length,
      nodes,
      relationships,
    },
    advisoryReach: advisoryReach.sort((a, b) => b.applications - a.applications),
    chokepoints,
  };
}
